"""One list pipeline for every index endpoint.

Before this module, `list_users`, `list_entries` and `list_invitations` each
hand-rolled search + sort + count + paginate. Three implementations meant three
sets of bugs, and they had genuinely diverged:

  * `list_entries` sorts by `ActivityLog.id` and says why in a comment — two rows
    written in one transaction share a timestamp, so an unstable sort lets a row
    appear on two consecutive pages or on neither.
  * `list_users` sorted by `created_at` with **no tiebreak at all**, so it had
    exactly that bug.

`ListSpec` makes the correct version the only reachable one: a tiebreak is a
required field, so a resource cannot be registered without one.

The reference implementation this project ports from (LeapDesk, Laravel) does the
opposite — `UserController@index` is a 70-line if-chain and every other controller
repeats it, with `$query->orderBy($request->input('sort_by'))` taking the sort
column straight from the query string. See
`documentation/planning/CORE_COMPLETION_PLAN.md` § 1.2. Behaviour is at parity;
the engine is not.

Splitting the work:

  * **The caller** builds the filtered `select()` — visibility scoping and any
    filter needing a join or a subquery (`User.roles.any(...)`), because those are
    resource-specific and pushing them into a generic layer would need a
    mini-language nobody wants to read.
  * **This module** owns everything that is the same every time: free-text search,
    the sort allowlist, the stable tiebreak, per-page clamping, and the count.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Sequence, TypeVar

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import InstrumentedAttribute, Session

T = TypeVar("T")

SortOrder = Literal["asc", "desc"]

#: Mirrors the frontend's per-page selector. A value outside this set is not an
#: error — it is silently clamped, because a bad `?per_page=` should not 422 a
#: page the user can otherwise read.
PER_PAGE_OPTIONS: tuple[int, ...] = (10, 15, 25, 50, 100)


@dataclass(frozen=True)
class ListSpec:
    """Everything a list endpoint needs, declared once per resource.

    Declared next to the service that owns the resource, not here — this module
    holds no knowledge of any particular table.
    """

    #: Public sort name -> column. **This is an allowlist and the only way a
    #: column can be sorted on.** A name that is not a key here never reaches SQL,
    #: which is what stops `?sort_by=password` from being a question we have to
    #: think about.
    sortable: dict[str, InstrumentedAttribute]

    #: Key into `sortable`, used when the caller sends nothing or sends junk.
    default_sort: str

    #: Appended to every ORDER BY so the sort is total. Must be unique per row —
    #: a primary key. Without it, rows tying on the sort column can be dropped or
    #: repeated across pages, and the symptom (a row that "vanishes" on page 3)
    #: looks like a data bug rather than a pagination one.
    tiebreak: InstrumentedAttribute

    #: OR-matched, case-insensitively, for `?search=`. Empty means the resource
    #: has no free-text search.
    searchable: Sequence[InstrumentedAttribute] = field(default_factory=tuple)

    default_order: SortOrder = "desc"
    default_per_page: int = 15
    max_per_page: int = 100

    def __post_init__(self) -> None:
        # A typo here is otherwise invisible: the resource silently sorts by
        # whatever `sortable` happens to contain, forever.
        if self.default_sort not in self.sortable:
            raise ValueError(
                f"default_sort {self.default_sort!r} is not in sortable "
                f"({sorted(self.sortable)})"
            )

    def column_for(self, sort_by: str | None) -> InstrumentedAttribute:
        """Resolve a requested sort name, falling back rather than raising.

        Falling back is deliberate. A stale bookmark carrying `?sort_by=` for a
        column that has since been renamed should render the list, not a 422.
        """
        if sort_by and sort_by in self.sortable:
            return self.sortable[sort_by]
        return self.sortable[self.default_sort]


@dataclass(frozen=True)
class ListParams:
    """The query parameters every index endpoint accepts.

    Routers build this from their own `Query(...)` declarations rather than
    depending on it directly, so each endpoint's OpenAPI documents its real
    filters instead of a generic blob. `backend/openapi.json` is committed and
    generates the frontend's types (PM-42), so a vague signature here would
    become a vague type there.
    """

    page: int = 1
    per_page: int = 15
    sort_by: str | None = None
    sort_order: SortOrder = "desc"
    search: str | None = None


def apply_search(stmt: Select, spec: ListSpec, search: str | None) -> Select:
    """Case-insensitive OR across `spec.searchable`.

    The OR group is wrapped in a single `or_()` on purpose. Chaining
    `.where(a).where(b)` would AND them, and hand-rolled versions of this get it
    wrong in the other direction too — a bare `.where(or_(...))` written after a
    status filter reads fine and silently widens the result set if the
    parenthesisation is lost.
    """
    if not search or not spec.searchable:
        return stmt

    term = f"%{search.strip().lower()}%"
    if term == "%%":  # whitespace-only input is not a filter
        return stmt

    return stmt.where(or_(*(func.lower(col).like(term) for col in spec.searchable)))


def apply_sort(
    stmt: Select,
    spec: ListSpec,
    sort_by: str | None,
    sort_order: str | None,
) -> Select:
    """Order by an allowlisted column, then always by the tiebreak."""
    column = spec.column_for(sort_by)
    descending = (sort_order or spec.default_order) == "desc"

    primary = column.desc() if descending else column.asc()
    # The tiebreak follows the primary direction so the ordering reads naturally
    # ("newest first" stays newest-first within a tie).
    secondary = spec.tiebreak.desc() if descending else spec.tiebreak.asc()

    return stmt.order_by(primary, secondary)


def clamp_page(page: int | None, per_page: int | None, spec: ListSpec) -> tuple[int, int]:
    """Coerce paging input into something safe to put in OFFSET/LIMIT."""
    safe_page = max(1, page or 1)
    safe_per_page = min(max(1, per_page or spec.default_per_page), spec.max_per_page)
    return safe_page, safe_per_page


def count_rows(db: Session, stmt: Select) -> int:
    """Total matching rows, ignoring ordering and paging.

    Must be called on the **filtered but unpaged** statement. Counting after
    `.limit()` returns the page size, which is the kind of bug that looks correct
    until the second page.
    """
    return db.scalar(select(func.count()).select_from(stmt.subquery())) or 0


def run_list(
    db: Session,
    stmt: Select,
    spec: ListSpec,
    params: ListParams,
) -> tuple[list[T], int]:
    """Search, count, sort and paginate a pre-filtered statement.

    Returns `(rows, total)` — the shape the existing services already return, so
    adopting this is not a router-visible change.

    Two queries, always: one COUNT and one page. Never `len(query.all())`, which
    loads the whole table to learn its size.
    """
    stmt = apply_search(stmt, spec, params.search)

    # Before ordering and paging: ORDER BY does not change the count, and OFFSET
    # very much does.
    total = count_rows(db, stmt)

    stmt = apply_sort(stmt, spec, params.sort_by, params.sort_order)

    page, per_page = clamp_page(params.page, params.per_page, spec)
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)

    # `.unique()` is required whenever the caller attached a joined eager load and
    # harmless otherwise, so it is unconditional rather than something each caller
    # has to remember.
    rows = list(db.scalars(stmt).unique())
    return rows, total


def page_count(total: int, per_page: int) -> int:
    """Number of pages. **Zero rows means zero pages, not one.**

    That is the existing contract and the frontend is written against it:
    `DataTable.tsx` renders `{pages === 0 ? 0 : page} / {pages}`, so returning 1
    here would show "1 / 1" above an empty table. Matches the expression it
    replaces — `(total + per_page - 1) // per_page if total else 0`.
    """
    if per_page <= 0 or total <= 0:
        return 0
    return -(-total // per_page)
