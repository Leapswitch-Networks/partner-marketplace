"""Seed the initial search registry.

    docker compose run --rm backend python -m app.db.seed_searchable_entities

Idempotent, keyed on `model_class`, like the reference's
`SearchableEntitiesSeeder::updateOrCreate(['model_class' => …])`.

## Why only User and Role

`LEAPDESK_PARITY_PLAN.md` § Module 8 settles it: *"For PM, the initial registry
is `User` and `Role`"* — LeapDesk's own Core group. Its other nine entries are
QMAS, Presales, Inventory and FeedbackHub models that do not exist in this
codebase.

**`Partner` is deliberately not seeded even though the model exists.** There is
no tenant scoping yet (TECH_DEBT PM-5), so nothing would stop one partner's
staff finding another partner's record through the search box. A type that can
be permission-gated but not row-scoped is exactly the failure Module 8's three
layers exist to prevent, so it waits for PM-5 rather than shipping with a gate
that looks like scoping and is not.

## What this seeder does NOT do

The reference prunes rows whose model class no longer exists
(`pruneOrphanedEntities`). **This one does not delete anything.** Ours cannot
tell an orphan from an entity an administrator added ahead of its code, and a
seeder that silently deletes admin-created configuration on every run is a worse
failure than a stale row — which the settings screen already reports as
`broken` health, with the reason, where someone can act on it.
"""

from __future__ import annotations

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.searchable_entity import SearchableEntity
from app.services.search_service import registered_model_names

#: Mirrors the reference's `coreEntities()`, translated to our columns:
#: `model_class` is a short name resolved against the service's allowlist, and
#: `route_name` is a Next.js path template rather than a Laravel route name.
ENTITIES: list[dict] = [
    {
        "model_class": "User",
        "label": "Users",
        "group": "Core",
        "icon": "users",
        # `employee_id` and `designation` are in the reference's list; only the
        # columns this schema actually has are seeded, because a field the model
        # lacks is dropped at search time anyway and would seed a row that
        # reports itself `degraded` on day one.
        "fields": ["first_name", "last_name", "email", "designation"],
        "display_template": "{first_name} {last_name}",
        "subtitle_template": "{email}",
        "route_name": "/dashboard/users/{id}",
        "route_param_field": "id",
        "permission": "user-view",
        "enabled": True,
        "sort_order": 10,
    },
    {
        "model_class": "Role",
        "label": "Roles",
        "group": "Core",
        "icon": "roles",
        # Not `guard_name` — that is a Spatie column and this schema has no
        # equivalent. `display_name` and `description` are the useful ones here.
        "fields": ["name", "display_name", "description"],
        "display_template": "{display_name}",
        "subtitle_template": "{name}",
        "route_name": "/dashboard/roles/{id}",
        "route_param_field": "id",
        "permission": "role-view",
        "enabled": True,
        "sort_order": 15,
    },
]


def seed() -> None:
    db = SessionLocal()
    allowed = set(registered_model_names())
    created = updated = 0

    try:
        for spec in ENTITIES:
            # A seeded row must satisfy the same allowlist the search path
            # enforces. If these ever disagree, the seeder is the one that is
            # wrong — fail loudly here rather than write a row that silently
            # never returns results.
            if spec["model_class"] not in allowed:
                raise SystemExit(
                    f"{spec['model_class']!r} is not in search_service._REGISTRY "
                    f"({', '.join(sorted(allowed))}). Add it there first."
                )

            existing = db.scalar(
                select(SearchableEntity).where(
                    SearchableEntity.model_class == spec["model_class"]
                )
            )

            if existing is None:
                db.add(SearchableEntity(**spec))
                created += 1
                print(f"  created  {spec['model_class']:<8} → {spec['label']}")
            else:
                for field, value in spec.items():
                    setattr(existing, field, value)
                updated += 1
                print(f"  updated  {spec['model_class']:<8} → {spec['label']}")

        db.commit()
        print(f"\nSearch registry seeded: {created} created, {updated} updated.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
