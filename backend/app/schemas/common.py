"""Schemas shared by every module.

`Page[T]` replaces the per-resource paginated wrappers (`PaginatedUsers`, and the
ones each new module would otherwise have grown). Field-for-field identical to
`PaginatedUsers`, so adopting it changes no JSON and breaks no client.

Deliberately **not** Laravel's pagination envelope. LeapDesk returns
`current_page` / `last_page` / `from` / `to` / `data` / `links[]`, where `links`
is a pre-rendered array of page URLs — that exists to feed Blade and Inertia
pagination components, neither of which we use. Our client fetches by page number
(`DataTable.tsx` takes `page`/`pages` and calls `onPageChange(n)`), so URLs in the
payload would be dead weight the frontend has to ignore.
"""

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """One page of results.

    `pages` is **0 when there are no results**, not 1 — `DataTable.tsx` renders
    `{pages === 0 ? 0 : page} / {pages}` and would otherwise display "1 / 1"
    above an empty table. Build it with `app.core.query.page_count`.
    """

    items: list[T]
    total: int
    page: int
    per_page: int
    pages: int
