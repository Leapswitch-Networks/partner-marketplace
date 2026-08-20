# ADR-0009 — One shared list pipeline and one fetch-or-404 — but no CRUD base class

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-07 |
| **Recorded** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | Backend |

## Context

`list_users`, `list_entries` and `list_invitations` each hand-rolled search, sort, count and
paginate. Three implementations meant three sets of bugs, and they **had already diverged in a way
that mattered**: `list_entries` sorted by `ActivityLog.id` with a comment explaining why — two rows
written in one transaction share a timestamp, so an unstable sort lets a row appear on two
consecutive pages or on neither — while `list_users` sorted by `created_at` **with no tiebreak at
all**, and therefore had exactly that bug.

Five services had likewise each written their own fetch-or-404, drifting to four different messages
for one class of failure: *"User not found"*, *"Role not found"*, *"Invitation not found"*, and
*"This invitation link is not valid."* A client cannot branch on prose.

`CORE_COMPLETION_PLAN.md` § 3.3 originally specified a generic CRUD base class to solve all of it.

## Decision

Extract the parts that are genuinely identical, and **leave the parts that genuinely differ alone.**

- **`core/query.py`** — `ListSpec` + `run_list`. Owns free-text search, the sort allowlist, the
  stable tiebreak, per-page clamping and the count. **The tiebreak is a required field**, so a
  resource cannot be registered without one — the correct version is the only reachable version.
- **`core/crud.py`** — `get_or_404`, one message for one class of failure.
- **The caller** still builds the filtered `select()`: visibility scoping and any filter needing a
  join or subquery stay resource-specific, because pushing them into a generic layer would need a
  mini-language nobody wants to read.

**No CRUD base class**, explicitly reversing the plan.

## Alternatives rejected

**The generic `CRUDBase` from the plan.** Reading the real write paths killed it. `update_user` runs
permission predicates, snapshots an audit diff before mutating, and gates `status` and `role_ids`
behind separate admin checks — a generic `update()` would be overridden in full. `invitation_service`
has no plain update at all; its writes are resend, cancel and accept, each a state machine. And
`FASTAPI_STANDARDS.md` § 3 specifies services as module-level functions with `db` first and `actor`
last, so a base class would introduce a second way to do the same thing.

**Leave the three implementations alone.** They were already wrong in different ways, and the
pagination bug was live.

**Copy the reference implementation.** LeapDesk's `UserController@index` is a 70-line if-chain
repeated in every controller, taking the sort column straight from the query string
(`$query->orderBy($request->input('sort_by'))`). Behaviour is at parity here; the engine deliberately
is not.

## Consequences

- **Good:** unstable pagination is unrepresentable, and error messages are consistent.
- **Good:** a new index endpoint is a `ListSpec`, not seventy lines.
- **Cost:** two layers to understand — what `run_list` owns versus what the caller owns. The split is
  documented at the top of `core/query.py`.
- **Cost:** writes remain per-service and therefore repetitive by design. That repetition is the
  price of keeping the domain rules readable where they apply.

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Code | `backend/app/core/query.py` | `ListSpec` / `run_list`; the required tiebreak |
| Code | `backend/app/core/crud.py` | `get_or_404`, and the docstring rejecting the base class |
| Doc | `documentation/system-design/FASTAPI_STANDARDS.md` § 3, § 12 | service shape; why post-filtering corrupts a count |
| Doc | `documentation/planning/CORE_COMPLETION_PLAN.md` § 1.2, § 3.3 | the original spec and its reversal |
