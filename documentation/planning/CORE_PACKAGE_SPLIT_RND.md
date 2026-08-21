# Splitting the backend into `core/` and `<project>/` — feasibility R&D

> **R&D only, requested 2026-08-20. Nothing in here has been implemented.** The question asked was:
> can the backend be laid out so that every platform module lives under one folder and every
> project-specific module under another, so that project #3 copies the core and drops in its own
> domain folder?
>
> **Short answer: yes, and about 80% of the difficulty is already paid for.** What remains is one
> genuine architectural decision, one bulk mechanical move, and one choice about migrations. All
> three are described below with what was measured rather than assumed.
>
> **Second pass, 2026-08-21.** The first pass measured *imports* and found zero core→domain
> dependencies. That measurement was correct and also incomplete: a Python import is not the only
> way one module depends on another. Re-measured by **string**, the core reaches the domain in six
> more places — two of them load-bearing, one of them a security allowlist, and one of them the
> core's own test suite. Section 2.2 is that audit. It does not change the verdict; it changes the
> task list from four items to six, and it is the difference between "the move works" and "the move
> works and project #3's copied core actually starts".

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

### 2.2 What the import scan did not show — the string audit

`grep` for imports is the wrong instrument for four of these. A hardcoded event name, a path in an
allowlist, a prompt sentence and a test fixture all couple core to domain without importing
anything. Measured 2026-08-21 across `app/core/`, `app/api/`, `app/services/`, `app/schemas/`,
`app/models/`, `app/ai/`, `app/main.py` and `tests/` — 50 files mention a domain word; sorted by
whether the mention *does* anything:

| Where | Kind | Load-bearing? | Cost to split |
|---|---|---|---|
| `api_docs_service.EXPECTED_PUBLIC_PATHS` — 8 domain paths | **security allowlist** | **Yes, and asserted both ways** | Small — needs a `register_public_path` seam |
| `models/associations.py` — core pivots *and* `partner_expertise` | **one file, two packages** | Yes | Small, but a file *move* cannot do it — it must be **split** |
| `webhook_service.EVENTS` — `partner.created`, `partner.activated` (2 of 4) | registry | Yes — `_validate_events` rejects unknown names | Small — `register_webhook_event` |
| `main.py` — 6 of 29 `include_router` calls | aggregator | Yes | Small — `register_router` (§ 3.4) |
| `tests/` — 3 *core* test files use `Partner` as their tenant fixture | **test collection** | Yes | See § 3.5 |
| `ai/prompt.py`, `ai/tools.py` descriptions, `ai_service.AGENT_NAME` | prose + one constant | No | Trivial — feed from `settings.APP_NAME` |
| `auth_service.register_partner()` + one activity-log string | **naming only** | No — zero domain imports; it builds a `User` with `account_type="external"` and `DEFAULT_EXTERNAL_ROLE` | Rename |
| ~15 files: docstrings in `core/`, `scoping.py`, `user_service.py`, `activity_service.py`, `search_service.py`, `recycle_bin_service.py` | prose | No | **Leave them.** They are the recorded *reasoning* for the seam — `user_service.py` 433 explains why importing `Partner` there would be a genuine cycle. Deleting the explanation is how the seam gets undone later |

**Two of these are the good news, and they are worth naming** because they show the pattern is
already understood in this codebase rather than being invented by this document:

* **`core/config.py` is already the model answer.** `APP_NAME`, `APP_SHORT_NAME` and `APP_TAGLINE` are
  *settings with project defaults*, not constants — exactly what a copied core needs. And
  `ALLOW_PARTNER_SELF_REGISTRATION` was already renamed to `ALLOW_EXTERNAL_SELF_REGISTRATION` in
  phase 1, with the old name kept as an alias. Nothing to do here.
* **The AI SQL tool is domain-neutral by construction.** It enumerates readable tables with
  `inspect(...).get_table_names()` filtered through `is_queryable` — runtime reflection, not a
  hardcoded list — so it picks up project #3's tables on day one with no edit. Only the *example
  words* in the prompt name partners.

#### The public-path allowlist is the one that will actually break

`EXPECTED_PUBLIC_PATHS` is not documentation. `tests/test_api_docs.py` asserts it in **both**
directions: line 65 fails when a route is public but unlisted, and line 91 fails when a listed path
no longer exists. So a copied core carries 8 domain paths that project #3 does not serve, and the
suite goes red on `stale` before that project has written a line of its own code.

That bidirectional assertion is a *good* design — it is what stops a public route appearing by
accident — which is exactly why it should be a registration seam rather than a list someone edits.
The domain declares its own public surface; core asserts against the union.

---

## 3. The six blockers, hardest first

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

~20 files relocate — **plus one that splits**: `models/associations.py` holds `user_roles` and
`role_permissions` (core) alongside `partner_expertise` (domain, both FKs domain-side). It is the
only file in the tree that belongs to both packages, so a bulk `git mv` cannot handle it; the pivot
table moves to the domain and the two RBAC pivots stay.

Otherwise every `from app.services.partner_service import …` becomes
`from app.partner_market_place.services.partner_service import …`. Mechanical, wide, and safe:
`ruff`, `tsc` and 943 tests catch a mistake immediately, and nothing about behaviour changes.

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

### 3.4 🟢 The aggregators and the registry gaps

`models/__init__.py` and `main.py`'s router tuple both name domain modules by necessity — they are
entry points, which is the one place a composition root is *supposed* to know everything.

`models/__init__.py` is already solved (labelled block). `main.py` could take the same treatment the
nav and permission catalogs already got: a domain package registers its routers, and `main.py` loops
over the registry instead of importing 29 names.

**And the same treatment covers the two § 2.2 findings**, because they are the identical shape — a
core-side list with domain entries typed into it:

| Gap | Seam to add | Domain entries today |
|---|---|---|
| `main.py` router tuple | `register_router` | 6 of 29 |
| `api_docs_service.EXPECTED_PUBLIC_PATHS` | `register_public_path` | 8 |
| `webhook_service.EVENTS` | `register_webhook_event` | 2 of 4 |

This is not new machinery — `register_permission_group`, `register_role`, `register_nav_section` and
`register_scope` already exist and work the same way. Three more of the same, and after them the
word "partners" appears in core code only inside explanatory prose.

### 3.5 🟡 The core test suite does not currently stand alone

The item the first pass missed entirely, and the one that decides whether project #3 starts green.

**8 of 37 test files touch the domain.** Five are domain tests and simply move with it
(`test_category_counts`, `test_directory_crud`, `test_directory_lifecycle`,
`test_listing_entitlement`, `test_partner_write_permissions`). The other three are **core** tests
that use `Partner` as their tenant fixture, because it is the only tenant model that exists:

| File | How it reaches the domain | Effect on a bare core |
|---|---|---|
| `test_visibility_paths.py` | `from app.domain.partners.permissions import …` at **module level**, plus `Partner(...)` rows in fixtures | **Collection error** — the file cannot even be imported |
| `test_role_hierarchy.py` | `from app.domain.partners.permissions import ROLE_PARTNER` at **module level** | **Collection error** |
| `test_scoping.py` | `from app.models.partner import Partner` *inside test bodies* (deliberately deferred) | Collects fine; those tests fail at run time |

So `TestTheCoreAssemblesWithNoDomain` proves the RBAC **catalog** is domain-free while the **suite
that guards it** is not. Both of the module-level cases sit in files that test the tenancy seam,
which is precisely where a copied core most needs its tests working.

**Options**

| | Approach | Cost | Consequence |
|---|---|---|---|
| **A** | A **core test fixture tenant** — a tiny model defined in `tests/` (or a core `organisations` row, free if 3.1/A is done) that the three files use instead of `Partner` | Moderate; three files, and the assertions stay as they are | Core suite becomes copy-and-run. If 3.1/A lands, this is nearly free: the fixture becomes a real core table |
| **B** | Move the three files into the **domain** suite and accept that the tenancy seam is tested only where a tenant exists | Low | Project #3 copies a core with its tenancy rules untested until it writes its own domain. That is the seam most likely to be misused |
| **C** | Leave them; document that the core suite needs a domain | Nothing | Honest, but "copy the core and 3 files fail to collect" is a bad first five minutes for project #3 |

**Recommendation: A**, sequenced *after* 3.1 — if core owns `organisations`, the fixture is a real
core row and the change is small. Doing A first means writing a throwaway stub and then deleting it.

---

## 4. Suggested sequence

Ordered so nothing is done twice. Steps 2–4 are independent of each other and could run as parallel
packages on disjoint file lists (§ 3 of `AGENTS.md`); everything after step 1 is cheaper once it is
decided.

1. **Decide 3.1.** Everything else is cheaper afterwards and none of it is blocked meanwhile.
2. **`organisations` table migration** (if A), with the `upgrade → downgrade → upgrade` gate on a
   seeded database. Orchestrator work — it touches the tenant boundary.
3. **The three registration seams** (3.4): `register_router`, `register_public_path`,
   `register_webhook_event`. Same shape as the four that already exist, and after them core code
   names the domain only in prose. Bounded and well-specified — a good subagent package.
4. **Cosmetics** — rename `auth_service.register_partner` → `register_external_account`, and feed the
   AI prompt's product words from `settings.APP_NAME`. Trivial, and best done before the move so the
   diff is not tangled with path changes.
5. **The bulk move** (3.3), layer-first, one package at a time, gate after each — remembering that
   `models/associations.py` splits rather than moves.
6. **Re-home the core tenancy tests** (3.5/A) onto a core-owned tenant now that one exists.
7. **Extend `TestTheCoreAssemblesWithNoDomain`** to assert the *schema* stands alone, not just the
   RBAC catalog — and add the check that would have caught § 2.2 in the first place: **no core module
   may contain a domain table name as a string**, allowlisting docstrings. That grep is the test.
8. **Write the baseline recipe** (3.2/A) into `README` or a new `documentation/core/` doc: copy,
   delete `<project>/`, squash, rename. One page.

---

## 5. Honest caveats

* **This buys reuse, not correctness.** Nothing in it makes the current product better; it makes the
  *next* one cheaper to start. Worth saying because it competes for time with PM-46, PM-47 and the
  open owner decisions, all of which affect the product that exists.
* **The payoff is unproven until project #3 exists.** § 2's assumption — template repo, not a package
  — was chosen precisely because a two-project payoff does not justify library machinery. That
  reasoning still holds, and it argues for the cheap options (3.2/A) over the thorough ones.
* **The lesson from the second pass is worth keeping**: "zero core→domain imports" was true and
  reassuring and hid four real couplings, one of them a security allowlist. A dependency you can
  only see by importing is the *easy* kind. Step 7's string check exists so this is measured
  automatically next time rather than depending on somebody thinking to grep.
* **One thing genuinely does not split**: `db/migrations/env.py` and `alembic.ini` are single-chain
  configuration and are on the Protected list. Any migration restructuring needs explicit approval.
* **Current state correction for the plan**: § 2.6 says the tenancy seam "governs zero users". As of
  2026-08-20 **7 of 19 users have an `organisation_id`** and `user_invitations.organisation_id`
  exists, so that item is closed and the seam is live.
