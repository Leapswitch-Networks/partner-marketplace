"""The service taxonomy — Leapswitch's own vocabulary.

`PARTNER_DIRECTORY_PLAN.md` § 6.2: **partners never write to this table.** A
directory whose listers can extend its vocabulary is a tag cloud, and the joins
that make filtering work stop working the day two partners invent two spellings
of the same thing.

There is no scoping registration here, deliberately: the taxonomy is not owned by
any organisation, so `apply_scope` would have nothing to filter on. It is public
reference data gated by permission, exactly like `partner_tiers`.
"""

from __future__ import annotations

import re

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.service_category import ServiceCategory
from app.models.service_listing import ServiceListing


def slugify(value: str) -> str:
    """A URL segment from a display name.

    Shared with `listing_service` rather than duplicated, because two slug
    algorithms in one codebase produce two different URLs for the same words and
    the difference only shows up as a 404 in production.
    """
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "untitled"


def list_categories(db: Session, *, include_inactive: bool = False) -> list[ServiceCategory]:
    stmt = select(ServiceCategory).order_by(
        ServiceCategory.parent_id.nulls_first(), ServiceCategory.sort_order, ServiceCategory.name
    )
    if not include_inactive:
        stmt = stmt.where(ServiceCategory.is_active.is_(True))
    return list(db.execute(stmt).scalars().all())


def get_or_404(db: Session, category_id: int) -> ServiceCategory:
    category = db.get(ServiceCategory, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    return category


def get_by_slug(db: Session, slug: str) -> ServiceCategory | None:
    return db.execute(
        select(ServiceCategory).where(ServiceCategory.slug == slug)
    ).scalar_one_or_none()


def create_category(
    db: Session,
    *,
    name: str,
    parent_id: int | None = None,
    description: str | None = None,
    icon: str | None = None,
    sort_order: int = 0,
) -> ServiceCategory:
    """Create a category, refusing a third level.

    **The depth check is a 409, not a silent flattening** (§ 19.12). An admin
    who tries to nest three deep holds a model of the taxonomy that disagrees
    with ours; accepting the write quietly would leave them believing theirs and
    the mismatch would surface much later as a route that cannot be built.
    """
    if parent_id is not None:
        parent = get_or_404(db, parent_id)
        if parent.parent_id is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "The taxonomy is two levels deep. "
                f"{parent.name!r} is already a child, so it cannot be a parent.",
            )

    slug = _unique_slug(db, slugify(name))
    category = ServiceCategory(
        name=name.strip(),
        slug=slug,
        parent_id=parent_id,
        description=description,
        icon=icon,
        sort_order=sort_order,
    )
    db.add(category)
    db.flush()
    return category


def update_category(
    db: Session,
    category: ServiceCategory,
    *,
    name: str | None = None,
    description: str | None = None,
    icon: str | None = None,
    sort_order: int | None = None,
    is_active: bool | None = None,
) -> ServiceCategory:
    """Update a category.

    ⚠️ **The slug is not updatable.** It is a published URL the moment a category
    has a page, and renaming it silently breaks every inbound link and every
    search result pointing at it. Renaming the *display name* is free and is what
    an admin almost always means.
    """
    if name is not None:
        category.name = name.strip()
    if description is not None:
        category.description = description
    if icon is not None:
        category.icon = icon
    if sort_order is not None:
        category.sort_order = sort_order
    if is_active is not None:
        category.is_active = is_active
    db.flush()
    return category


def delete_category(db: Session, category: ServiceCategory) -> None:
    """Delete, refusing if anything still points at it.

    The FK is already `RESTRICT` so the database would refuse anyway — this
    turns that into a 409 with a sentence, rather than a 500 with a constraint
    name in it.
    """
    if category.children:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{category.name!r} has {len(category.children)} subcategories. Delete or move them first.",
        )
    listing_count = db.execute(
        select(func.count())
        .select_from(ServiceListing)
        .where(ServiceListing.category_id == category.id)
    ).scalar_one()
    if listing_count:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{category.name!r} still has {listing_count} listings. Move them to another category first.",
        )
    db.delete(category)
    db.flush()


def reorder(db: Session, ordered_ids: list[int]) -> None:
    """Persist a drag-to-reorder.

    Takes the whole ordered list rather than a pair of ids: a swap-based API
    needs the client and the server to agree on the current order, and they do
    not after any concurrent edit.
    """
    for position, category_id in enumerate(ordered_ids):
        category = db.get(ServiceCategory, category_id)
        if category is not None:
            category.sort_order = position
    db.flush()


def recount_listings(db: Session, category_id: int) -> int:
    """Recompute `listing_count` from the listings table.

    Called by `listing_service` whenever a listing is published or leaves the
    published state. **Recomputed, not incremented** — a counter that is only
    ever nudged drifts, and there is no volume here that makes one COUNT
    expensive.
    """
    category = db.get(ServiceCategory, category_id)
    if category is None:
        return 0
    count = db.execute(
        select(func.count())
        .select_from(ServiceListing)
        .where(
            ServiceListing.category_id == category_id,
            ServiceListing.status == "PUBLISHED",
            ServiceListing.deleted_at.is_(None),
        )
    ).scalar_one()
    category.listing_count = count
    db.flush()
    return count


def _unique_slug(db: Session, base: str) -> str:
    slug, suffix = base, 2
    while db.execute(
        select(ServiceCategory.id).where(ServiceCategory.slug == slug)
    ).scalar_one_or_none() is not None:
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug
