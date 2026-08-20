# ADR-0008 — The domain registers into the core; the core never imports the domain

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-17 |
| **Recorded** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | Architecture |

## Context

The goal is a platform layer — auth, RBAC, users, settings, audit, navigation — reusable for a second
project. `CORE_EXTRACTION_PLAN.md` § 1 **measured** where the partner directory reached into that
layer and found five places. Three were a single large literal each: `PERMISSION_CATALOG`,
`ROLE_PERMISSION_MATRIX` and `navigation_service.build_sections`, each mixing core groups with domain
groups in one dict. A fourth was `core/dependencies.py`, whose organisation gate read
`user.partner.status` — putting a directory model's name inside the platform's auth guard.

Lifting the core into a new project therefore meant hand-editing all three literals and hoping
nothing was missed.

## Decision

**Invert the dependency.** The core owns its own entries; a domain **adds** its own through a
registration seam:

- `core/registry.py` — the seam. It imports **nothing from `app`**.
- `core/roles.py` — role names, no imports at all.
- `core/nav.py` — navigation primitives, no app imports.
- `app/domain/…` — imports the three above, **never** `core/permissions`.
- `core/permissions.py` — imports `app.domain` to trigger registration, then materialises the
  catalogs.

That ordering is the whole mechanism. **Adding `from app.core.permissions import …` to a domain
module reintroduces the import cycle this layering exists to prevent** — import from
`app.core.roles` instead.

For the auth guard, `core/tenancy.py` defines a `Protocol` and the status vocabulary; the domain
supplies a model with that shape. The core depends on the *shape*, never the table. The vocabulary is
the core's because the guard branches on it — PENDING and SUSPENDED produce different messages, and a
guard branching on values it does not define is a rule split across two files.

**The property this buys, stated as a test:** deleting `app/domain/` from a fresh copy of this repo
yields a working platform with no partner vocabulary anywhere in it.

## Alternatives rejected

**Hand-edit the literals at extraction time.** The status quo. It works exactly once, silently
misses whatever you forget, and gives no way to check you were right.

**Feature flags around the domain entries.** Keeps one file with `if PARTNERS_ENABLED:` throughout.
The domain vocabulary still ships in the core, so the extraction is cosmetic.

**A plugin system with entry points.** More machinery than three registration calls need, and it
would make the boot order — which is the actual constraint — harder to see rather than easier.

## Consequences

- **Good:** the extraction property is **asserted, not hoped for**.
- **Cost:** a non-obvious import ordering that a contributor can break with one convenient import.
  The docstring in `core/registry.py` exists specifically to warn about this, and is worth reading in
  full before touching either layer.
- **Cost:** registration is boot-time and one-way — there is no unregistering, which is fine for a
  process-lifetime catalog and would not be for anything dynamic.
- **Follow-on:** `CORE_EXTRACTION_PLAN.md` phase 0 is still not started; the tenancy rename must land
  before PM-5's 258-signature sweep.

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Code | `backend/app/core/registry.py` | the seam, and the import rule in its docstring |
| Code | `backend/app/core/tenancy.py` | the organisation `Protocol` and status vocabulary |
| Code | `backend/app/core/roles.py`, `core/nav.py` | the import-safe layer beneath the domain |
| Code | `backend/app/domain/partners/` | `permissions.py`, `navigation.py`, `tiers.py` |
| Test | `backend/tests/test_core_extraction.py` | **fails if partner vocabulary leaks into the core** |
| Test | `backend/tests/test_tenancy.py` | the organisation gate |
| Doc | `documentation/planning/CORE_EXTRACTION_PLAN.md` | the measured plan and remaining phases |
