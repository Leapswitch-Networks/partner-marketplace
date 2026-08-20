# Splitting the backend into `core/` and `<project>/` — feasibility R&D

> **R&D only, requested 2026-08-20. Nothing in here has been implemented.** The question asked was:
> can the backend be laid out so that every platform module lives under one folder and every
> project-specific module under another, so that project #3 copies the core and drops in its own
> domain folder?
>
> **Short answer: yes, and about 80% of the difficulty is already paid for.** What remains is one
> genuine architectural decision, one bulk mechanical move, and one choice about migrations. All
> three are described below with what was measured rather than assumed.

---

## 1. The target

```
backend/app/
  core/                     ← the 20 platform modules
    users/  roles/  data_access/  activity/  settings/  branding/
    configuration/  security/  api_credentials/  invitations/  search/
    ai/  platform_api/  webhooks/  api_docs/  operations/  errors/
    health/  worker/  recycle_bin/
  partner_market_place/     ← this project's domain only
    partners/  tiers/  listings/  enquiries/  moderation/  categories/
```

Project #3 then copies `core/`, deletes `partner_market_place/`, and adds `clinic_network/` (or
whatever it is). Nothing in `core/` ever names the project.

---

## 2. What is already true — measured, not assumed

This is the good news, and it is substantial. [ADR-0008](../adr/0008-core-domain-registration-seam.md)
inverted the dependency in 2026-08-17, and it held.

| Property | Measured 2026-08-20 |
|---|---|
| `app/core/` primitives importing anything domain-shaped | **0 files** |
| Core *feature* files (api/services/schemas/models) importing domain | **0 files**, one deliberate exception below |
| The one exception | `models/__init__.py`, which must import every model for SQLAlchemy mapper config and Alembic autogenerate. It already carries a **labelled, separated domain block** with a warning about the isort split marker |
| Registration seams built | permissions (`register_permission_group`), roles, navigation (`register_nav_section`), row scoping (`register_scope`) |
| Proven by test | `TestTheCoreAssemblesWithNoDomain` stubs out `app.domain` and asserts the catalog has 12 core groups, 45 permissions, 7 roles and no partner vocabulary |

**So the code-level direction is already correct.** A domain module adds itself to the core; the core
never reaches back. That is the part that is expensive to retrofit, and it is done.

### Size of the physical split

| Layer | Domain files | Core files |
|---|---:|---:|
| `api/` | 6 — `partners, categories, enquiries, listings, moderation, public` | 23 |
| `services/` | 4 — `partner, category, enquiry, listing` | 26 |
| `models/` | 5 — `partner, partner_tier, enquiry, service_category, service_listing` | 19 |
| `schemas/` | 2 — `partner, directory` | 19 |
| `domain/partners/` | 3 — already separated | — |
| **Total** | **~20** | **~110** |

---

## 3. The four blockers, hardest first

### 3.1 🔴 Two core tables have a foreign key into a domain table

The real one.

```
users.organisation_id            -> partners.id
user_invitations.organisation_id -> partners.id
```

At the *code* level this is clean: `core/tenancy.py` defines a `Protocol`, the core only ever knows
"an organisation", and `models/user.py` says so explicitly. At the *database* level the core's own
`users` table cannot be created without a table called `partners`.

**This is a recorded decision, not an oversight.** `CORE_EXTRACTION_PLAN.md` § 2.1 chose it in as many
words — *"Neutral; the domain calls its table `partners` and the FK still points there"*. It is a
reasonable choice for a **template repo**, which is what § 2 assumes: you copy the repo and rename,
so the FK just gets repointed as part of the copy.

It is the wrong choice for a genuinely standalone `core/`. It means:

* `core/`'s migrations cannot run without the domain present.
* `TestTheCoreAssemblesWithNoDomain` proves the RBAC vocabulary is domain-free but **not** that the
  schema is — and it isn't.
* Project #3 must either name its tenant table `partners` (leaky) or edit a core migration (defeats
  the point).

**Options**

| | Approach | Cost | Consequence |
|---|---|---|---|
| **A** | **Core owns `organisations`.** The domain's `partners` becomes a 1:1 extension keyed on `organisations.id` — classic table-per-subtype. `users.organisation_id` points at a core table | One migration + a data move. Touches the tenant boundary, so it is orchestrator work and wants the full round-trip gate | The correct fix. `core/` becomes schema-standalone. Also matches the existing sentence *"a partner **is** the organisation"* — the partner row would simply carry the domain's extra columns |
| **B** | **Drop the FK**, keep an indexed `organisation_id` with no constraint; enforce in the app | One small migration | Loses referential integrity and `ON DELETE SET NULL`. The comment on that column explains why SET NULL was chosen — deleting an organisation must not delete its people. Re-implementing that in the app is exactly the kind of rule that gets forgotten |
| **C** | **Leave it** (status quo) | Nothing | Fine for copy-and-rename. `core/` is never truly independent, and that should be written down rather than implied |

**Recommendation: A**, and do it *before* the bulk file move — the plan already learned this lesson
the other way round (§ 2 exists before § 3 precisely so a 258-signature sweep is not done twice).

### 3.2 🟠 The migration chain is linear and interleaved

40 revisions, single chain. Roughly seven touch domain tables, and **two touch core and domain
together** — `0e6d123d0fa3` (column comments across everything) and `b6d41e807f92` (soft deletes).
So domain revisions cannot simply be deleted from a new project's history: removing a middle
revision breaks every `down_revision` after it.

**Options**

| | Approach | Cost | Consequence |
|---|---|---|---|
| **A** | **Squash to a baseline per new project.** Project #3 copies the repo, deletes the domain, then generates one fresh initial migration from the core models and discards the inherited chain | Very low | Standard practice for template repos. History has no value in a project that never had it. Loses the ability to replay this project's history — which project #3 does not want |
| **B** | **Alembic branch labels + `version_locations`.** `core/migrations/versions` and `<project>/migrations/versions` as separate branches, cross-branch order expressed with `depends_on` | Real machinery: multiple heads, a `branch_labels` discipline, and every cross-package FK needs an explicit dependency | Genuinely supported by Alembic. Buys independent history per package. § 2 already judged packaging machinery poor value for a two-project payoff, and this is that machinery |

**Recommendation: A.** It is the option that costs almost nothing and matches the template-repo
assumption already recorded. Revisit **B** only if the core ever becomes a shared installable package
consumed by projects you do not control.

> Note: **A becomes much cleaner if 3.1/A is done first.** With `users` pointing at a core
> `organisations` table, a core-only baseline is generatable without the domain models present at all
> — which is also the moment `TestTheCoreAssemblesWithNoDomain` could be extended to assert it.

### 3.3 🟡 The bulk move itself

~20 files relocate, and every `from app.services.partner_service import …` becomes
`from app.partner_market_place.services.partner_service import …`. Mechanical, wide, and safe:
`ruff`, `tsc` and 876 tests catch a mistake immediately, and nothing about behaviour changes.

Two sub-questions worth deciding once rather than per-file:

* **Layer-first or module-first inside each package?** Today the repo is layer-first
  (`api/`, `services/`, `models/`, `schemas/`). Keeping that inside each package —
  `core/api/users.py`, `partner_market_place/api/partners.py` — is the smaller change and keeps every
  existing convention. Going module-first (`core/users/{router,service,model,schema}.py`) is tidier per
  feature but is a second restructuring on top of the first, and `FASTAPI_STANDARDS.md` § 11 is
  written against the current shape.
* **Does `api/public.py` belong to the domain?** It serves the partner directory's public surface, so
  yes — but a future project will want *a* public surface, so the router-mounting pattern should stay
  in core even though this file does not.

### 3.4 🟢 The two aggregators

`models/__init__.py` and `main.py`'s router tuple both name domain modules by necessity — they are
entry points, which is the one place a composition root is *supposed* to know everything.

`models/__init__.py` is already solved (labelled block). `main.py` could take the same treatment the
nav and permission catalogs already got: a domain package registers its routers, and `main.py` loops
over the registry instead of importing 29 names. That is a small, self-contained change and it is the
last place the word "partners" appears in core code.

---

## 4. Suggested sequence

1. **Decide 3.1.** Everything else is cheaper afterwards and none of it is blocked meanwhile.
2. **`organisations` table migration** (if A), with the `upgrade → downgrade → upgrade` gate on a
   seeded database.
3. **Router registration seam** in `main.py` (3.4) — small, and removes the last core mention of the
   domain.
4. **The bulk move** (3.3), layer-first, one package at a time, gate after each.
5. **Extend `TestTheCoreAssemblesWithNoDomain`** to assert the *schema* stands alone, not just the
   RBAC catalog. That test is what stops this decaying.
6. **Write the baseline recipe** (3.2/A) into `README` or a new `documentation/core/` doc: copy,
   delete `<project>/`, squash, rename. One page.

---

## 5. Honest caveats

* **This buys reuse, not correctness.** Nothing in it makes the current product better; it makes the
  *next* one cheaper to start. Worth saying because it competes for time with PM-46, PM-47 and the
  open owner decisions, all of which affect the product that exists.
* **The payoff is unproven until project #3 exists.** § 2's assumption — template repo, not a package
  — was chosen precisely because a two-project payoff does not justify library machinery. That
  reasoning still holds, and it argues for the cheap options (3.2/A) over the thorough ones.
* **One thing genuinely does not split**: `db/migrations/env.py` and `alembic.ini` are single-chain
  configuration and are on the Protected list. Any migration restructuring needs explicit approval.
* **Current state correction for the plan**: § 2.6 says the tenancy seam "governs zero users". As of
  2026-08-20 **7 of 19 users have an `organisation_id`** and `user_invitations.organisation_id`
  exists, so that item is closed and the seam is live.
