# Core Extraction Plan — making the platform layer reusable

> ## ✅ Execution status — 2026-08-17
>
> Phases **0, 1, 2, 3 and 5 are complete**. Phase **4 has its foundation built and one module
> converted**; the remaining 16 are mechanical follow-on. Phase **6 is blocked on things engineering
> cannot supply** — credentials, an SMTP provider, and a production topology.
>
> | Phase | State | Evidence |
> |---|---|---|
> | 0 — clear the gate | ✅ | typecheck 0, lint 0; `PartnerForm`, `PartnerShow`, `PartnerTiersModule` and 5 route pages added |
> | 1 — registration seam | ✅ | catalog proven **byte-identical** to the pre-refactor one; `tests/test_core_extraction.py` |
> | 2 — generalise tenancy | ✅ | migration `c9a71f4e2b60`, round-tripped down and up; `tests/test_tenancy.py` |
> | 3 — PM-5 scoping | ✅ | `app/services/scoping.py`; `tests/test_scoping.py` (24 tests); both `# PM-5` sites replaced; dead `data_access` helpers wired |
> | 4 — data layer | 🟡 partial | RTK Query installed and wired; `PartnerTiersModule` converted as the worked example; **16 modules still on `useResourceList`** |
> | 5 — de-brand | ✅ except 5.5 | `MAIL_FROM` and the root address now derive from one setting; **5.5 skipped — destructive, needs the owner** |
> | 6 — deferred | ⛔ blocked | see § 3 phase 6 — every item needs credentials or infrastructure |
>
> **Gate at completion:** backend **722 passed, 4 skipped**; `ruff` clean; frontend `typecheck` and
> `lint` clean; Alembic at head `c9a71f4e2b60`.
>
> **The extraction property was verified by actually deleting the directory**, not only by the unit
> test — see § 6 below. That check found a real defect the test could not: `core/permissions.py`
> imported `app.domain` unconditionally.

> **Goal, in the owner's words (2026-08-17):** *"our focus is only on the core — we need a strong +
> optimized core so that in future we can use this core for another project also."*
>
> This plan is about the **platform layer**. The partner directory is domain, and
> [`PARTNER_DIRECTORY_PLAN.md`](./PARTNER_DIRECTORY_PLAN.md) owns it. Everything here treats that
> directory as **the first tenant of the core**, not as the product.
>
> Planning docs are intent, not current state. Every measurement below is dated and was taken from
> the code, not from another document.

---

## 0. The starting position — measured 2026-08-17

**The core is in better shape than "reusable" usually finds a codebase.** These lift as-is, with no
extraction work at all:

| Already domain-free | Where |
|---|---|
| Environment concept + startup assertions (PM-37) | `core/config.py::model_post_init` |
| Transaction boundary (PM-38) | `db/session.py::unit_of_work`, `core/dependencies.py::get_db` |
| `/api/v1` versioning (PM-40) | `main.py` |
| OpenAPI → TypeScript codegen (PM-42) | `package.json::codegen:api`, `types/api.d.ts` |
| One list pipeline — 12/12 endpoints | `core/query.py::run_list`, `ListSpec`, `ListParams` |
| Generic CRUD + 404 seam | `core/crud.py::get_or_404` |
| Frontend shared shells | `ResourceIndex`, `ResourceForm`, `ShowPage`, `DataTable` |
| Auth: bcrypt, typed JWTs, rotation + reuse detection, server-side sessions, lockout, rate limiting, TOTP 2FA, password confirmation, email verification, OTP recovery | `core/security.py`, `services/auth_service.py`, `services/session_service.py`, `services/two_factor_service.py` |
| Activity log · recycle bin · feature flags · webhooks · error tracking · health · worker jobs · global search · data access · API credentials · platform API · AI assistant | `services/*`, `api/*` |
| Dynamic branding, theme presets, brand assets | `core/theme.py`, `models/app_settings.py` |
| 217 tests + CI (ruff, pytest, typecheck, lint, build — none soft-failing) | `backend/tests/`, `.github/workflows/ci.yml` |

**Branding was already built for reuse.** `TWO_FACTOR_ISSUER` and `MAIL_FROM_NAME` default to empty
and resolve from `APP_NAME` in `model_post_init`, with an in-source note giving exactly this reason:
*"a literal default would put this project's name in the authenticator app of every project built on
this core."* Follow that precedent for the remaining identity constants (§ 5).

### Verification gate, as it stands today

| Check | Result 2026-08-17 |
|---|---|
| `npm run lint` | **0 errors**, 1 warning (unused `Badge` in the untracked `PartnersModule.tsx`) |
| `npm run typecheck` | **3 errors — all in the untracked `PartnersModule.tsx` WIP**, nothing else |
| Alembic | single head `b6e2a91c4d78`, 33 revisions, no branches |

### Two measurements that correct earlier documents

1. **`CORE_HARDENING_PLAN.md` § PM-5 implies ~40 `actor: User` signatures to retype.** The real
   count is **258** across 44 files (`actor: User` + `current_user: User`, excluding migrations).
   That is the difference between an afternoon and a multi-day mechanical sweep, and it is the single
   strongest argument for taking § 2 **before** § 3 rather than after.
2. **`AGENTS.md` still calls the plaintext-password design "known, accepted debt."** It is not:
   PM-1 closed 2026-07-31 and `core/security.py` uses bcrypt with a docstring forbidding a
   regression. That line should be corrected — it is a Protected File, so it needs the owner's
   confirmation (§ 5, task 5.6).

   > ✅ **Resolved 2026-08-18.** The root `AGENTS.md` was corrected on 2026-08-17 (struck through,
   > with a note forbidding the line being repeated as current state). What that fix *missed* was the
   > second copy: `documentation/AGENTS.md` still carried the claim in the present tense for another
   > day — which is the drift that motivated merging the two contracts into one. Both are now
   > correct, because only one file remains. See
   > [`ADR-0016`](../adr/0016-one-agent-contract.md).

---

## 1. Where the domain leaks into the core — the full inventory

Five structural touchpoints. Measured by grepping for imports of the `Partner` model, `partner_service`,
and the `PARTNER_*` permission constants outside the partner domain's own files.

| # | Location | What couples | Severity for reuse |
|---|---|---|---|
| 1 | `models/user.py:100-110`, `:214-218` | `partner_id` FK + `partner` relationship **on the User model** | 🔴 core entity |
| 2 | `core/dependencies.py:175-206` | `_assert_organisation_active` reads `user.partner` on **every authenticated request** | 🔴 core guard |
| 3 | `core/permissions.py:240-270`, `:352-367`, `:485-496` | 9 `PARTNER_*` permissions, `ROLE_PARTNER`, and partner grants inside `ROLE_PERMISSION_MATRIX` | 🟠 core vocabulary |
| 4 | `services/navigation_service.py:37-38`, `:57`, `:207-230` | "Partner Directory" section hardcoded in the core nav builder + `COLLAPSIBLE_SECTION_CATALOG` | 🟠 core service |
| 5 | `models/user.py:32`, `models/user_invitation.py:16`, `schemas/rbac.py:11`, `schemas/auth.py:15` | `account_type` is a **Postgres ENUM** literally spelling `"staff" \| "partner"` | 🔴 needs a migration |

Plus `models/__init__.py:35-36` importing `Partner`/`PartnerTier` into the model registry — trivial,
but it is what makes the coupling load at import time.

**That is genuinely shallow.** The problem is not breadth, it is *depth*: #1, #2 and #5 sit in the
User model and the auth guard, which is the part of the core every future project inherits first.

---

## 2. The decision this plan is built on

**PM-5 (row-level scoping) and "make the core reusable" are the same change.**

`app/services/scoping.py` does not exist. When it is written it will encode *what a tenant boundary
is*. Build it around `Partner` and project #2 inherits the partner domain permanently. Build it
around a neutral seam and it lifts.

The cost is asymmetric and that is what fixes the order: PM-5 retypes **258** signatures onto
`Principal`. Renaming the tenancy concept afterwards means doing that sweep **twice**.

> **Assumption, stated rather than asked:** project #2 consumes this as a **template repo** — copy,
> rename, delete the domain modules — not as an installable package or submodule. Packaging a
> FastAPI + Next application as a library is a large amount of machinery for a two-project payoff,
> and the seams below give a clean copy-and-rename either way. If the owner wants a shared package
> instead, § 1's seams are still correct; only the packaging work in § 6 changes.

---

## 3. The checklist

Phases are ordered by what unblocks what. Within a phase, tasks are independent unless noted.

### Phase 0 — Clear the gate *(blocking, ~half a day)*

Core surgery with a red typecheck means you cannot tell what you broke.

- [ ] **0.1** Create `frontend/components/admin/PartnerForm.tsx` and `PartnerShow.tsx`, or strip
      their imports from `PartnersModule.tsx:12-13`. Currently `TS2307` ×2.
- [ ] **0.2** Type the `action` parameter at `PartnersModule.tsx:324` (`TS7006`).
- [ ] **0.3** Remove the unused `Badge` import at `PartnersModule.tsx:4` (lint warning).
- [ ] **0.4** Add `app/(app)/dashboard/partners/page.tsx` and `app/(app)/dashboard/partner-tiers/page.tsx`.
      The nav section added to `navigation_service.py` links to both and **they currently 404**.
- [ ] **0.5** Run the gate clean: `typecheck` 0, `lint` 0 errors, `pytest -q` green, `ruff check .` clean.

> Alternative if the owner would rather not finish the domain UI now: revert the
> `navigation_service.py` Partner Directory section and shelve the four untracked/modified frontend
> files on a branch. **Do not leave the nav pointing at 404s** either way.

---

### Phase 1 — The registration seam *(no migration, pure refactor)*

Core stops hardcoding domain vocabulary; domains register into it. This is the highest-value
structural change in the plan and the cheapest of the three big ones.

**1a. Permission catalog**

- [ ] **1.1** In `core/permissions.py`, split `PERMISSION_CATALOG` into `CORE_PERMISSION_CATALOG`
      (dashboard, users, roles, permissions, invitations, activity, settings, data-access,
      api-credentials, search, ai-assistant, platform-api) and leave the `partners` group out.
- [ ] **1.2** Add `register_permission_group(name, display, order, module, entries)` plus a module-level
      `_REGISTERED: dict` that `PERMISSION_CATALOG` is composed from. Keep `all_permission_names()`
      and the group ordering contract identical — `services/rbac_service.py` and the roles UI read them.
- [ ] **1.3** Move the 9 `PARTNER_*` constants and their catalog group out of `core/permissions.py`
      into a new `app/domain/partners/permissions.py`, which calls `register_permission_group`.
- [ ] **1.4** Split `ROLE_PERMISSION_MATRIX` the same way: core ships the matrix for
      Root/SuperAdmin/BackendDeveloper/Admin/Sales/Staff/User; the domain **adds** its grants via a
      `register_role_grants(role, [permissions])` call. Removes `PARTNER_VIEW`/`PARTNER_TIER_VIEW`
      from the core's `ROLE_STAFF` list (`permissions.py:485-486`).
- [ ] **1.5** Decide `ROLE_PARTNER`'s home. Recommended: core ships a neutral `ROLE_EXTERNAL`
      ("external account, sees only their own records"), the domain aliases or replaces it. It is
      currently referenced by `DEFAULT_PARTNER_ROLE` in `permissions.py:73` and by
      `auth_service.register_partner`.
- [ ] **1.6** Verify `db/seed_rbac.py` still seeds every group and grant — it reads the catalog, so
      it should need no change. **That is the test of whether the seam is right.**

**1b. Navigation**

- [ ] **1.7** In `services/navigation_service.py`, extract `build_sections`' literal into
      `CORE_SECTIONS` and add `register_nav_section(section, after=...)`. `build_sections` composes
      core + registered.
- [ ] **1.8** Make `COLLAPSIBLE_SECTION_CATALOG` (`navigation_service.py:57`) accept registrations
      too — a domain section that is not in the catalog cannot be made collapsible per-role, and the
      seeder's `default_nav_preferences()` reads it.
- [ ] **1.9** Move the Partner Directory section (`navigation_service.py:207-230`) into
      `app/domain/partners/navigation.py`.
- [ ] **1.10** Confirm `roles.nav_preferences` round-trips: `resolve_nav_preferences`,
      `role_nav_preferences` and `set_role_nav_preferences` all key off `_section_key_from_label`,
      so a registered section must produce a stable slug.

**1c. Model registry**

- [ ] **1.11** Give `models/__init__.py` a domain import block that is clearly separated and
      documented as "delete this for a new project", rather than the `Partner`/`PartnerTier` imports
      sitting inline at lines 35-36.

**Gate:** full verification gate + seed a clean database and diff the resulting `permissions`,
`permission_groups` and `roles` tables against a pre-refactor dump. **Zero rows may differ.**

---

### Phase 2 — Generalise tenancy *(migration territory — orchestrator work, not delegated)*

This is the change that must land **before** § 3, because § 3 retypes 258 signatures.

- [ ] **2.1** Decide and record the vocabulary. Recommended:
      | Today | Core becomes | Why |
      |---|---|---|
      | `users.partner_id` | `users.organisation_id` | Neutral; the domain calls its table `partners` and the FK still points there |
      | `account_type: staff \| partner` | `account_type: internal \| external` | `is_staff_email()` already decides which; it just spells the answer domain-specifically |
      | `_assert_organisation_active` | unchanged name, generalised body | The name is already right — only the `user.partner` read is domain-specific |
- [ ] **2.2** Write the Alembic migration on head `b6e2a91c4d78`:
      - rename `users.partner_id` → `users.organisation_id` (keep the FK to `partners.id`,
        keep `ON DELETE SET NULL`, keep the index)
      - `ALTER TYPE account_type` — Postgres cannot rename enum *values* transactionally in older
        versions; create `account_type_new`, cast, drop, rename. Same for `invitation_account_type`.
      - **Write the `downgrade()` and test it.** Enum migrations are where a bad downgrade bites.
- [ ] **2.3** Introduce an **organisation protocol** so the core guard stops importing the domain
      model. `core/dependencies.py:175-206` needs only `.status`; define a `Protocol` (or a tiny
      `OrganisationLike` ABC) in `core/` and have `models/partner.py` satisfy it. The relationship
      stays `lazy="joined"` — it runs on every authenticated request.
- [ ] **2.4** Sweep the 12 soft-coupling sites for the literal `"partner"` / `"staff"`:
      `models/user.py:32,114` · `models/user_invitation.py:16,46` · `api/invitations.py:132` ·
      `db/seed_users.py:140` · `auth_service.py:119` · `invitation_service.py:446` ·
      `schemas/rbac.py:11,159,347` · `schemas/auth.py:15`.
- [ ] **2.5** Regenerate `types/api.d.ts` (`codegen:api`) and fix the frontend fallout — the
      `AccountType` union is surfaced in `UserForm`, `UserShow`, `UsersModule`, `InvitationForm`,
      `InvitationsModule`.
- [ ] **2.6** **Close the write-path hole while you are here.** Nothing in the application can set
      `users.partner_id` today — no `user_service` path, no field on `CreateUserRequest`/
      `UpdateUserRequest`, no `partner_id` column on `user_invitations`. The org gate therefore
      governs zero users. Add: the column on `user_invitations` + its migration, the field on both
      user schemas, assignment in `user_service`, and a column + filter in the users admin.
      *(This is domain-shaped but it is what proves the core's tenancy seam actually works.)*

**Gate:** `alembic upgrade head` then `alembic downgrade -1` then `upgrade head` again on a seeded
database, with `docker compose run --rm backend alembic current` after each. Full verification gate.

---

### Phase 3 — PM-5: `scoping.py` + `Principal` *(the highest-risk work in the repo)*

The only place in this codebase where a mistake is a data breach rather than a bug.

- [ ] **3.1** Write `app/services/scoping.py` — `apply_scope(stmt, model, principal)` and
      `assert_can_read(obj, principal)`. Contract: **404, never 403** (a 403 confirms the row
      exists); anonymous is the most restrictive branch **by construction**, not by convention;
      the filter reaches SQL, never post-filters a page (post-filtering corrupts the count —
      `FASTAPI_STANDARDS.md` § 12).
- [ ] **3.2** **Write the tests before the first caller.** `backend/tests/test_scoping.py`:
      anonymous principal · wrong-tenant principal · internal-staff principal · admin-access
      principal · machine principal · unpublished-vs-published row. This is the narrow testing ask
      `PARTNER_DIRECTORY_PLAN.md` § 11 makes and it is roughly half a day.
- [!] **3.3** ~~Retype the stack onto `core/principal.py`'s `Principal` union. 258 sites across 44
      files. Mechanical and well-specified: delegate to `sonnet-implementer`.~~
      **SUPERSEDED — and it was superseded on the day this item was written (2026-08-17). Do not
      do this.** `scoping.py`'s `_as_principal()` docstring already carries the counter-argument,
      and it is the better one:
      > *"blanket-retyping them onto `Principal` would make most of them **less** accurate, not
      > more: `user_service.update_user` genuinely requires a human and reads `actor.id` and
      > `actor.has_admin_access`. So the union is normalised at this boundary instead, which is
      > the boundary that actually has to cope with anonymous and machine callers."*
      **It is also not mechanical, which is the part that would have hurt.** Measured 2026-08-20:
      of 165 `actor.*` accesses in `app/`, **55 across six attributes would not compile** — the
      principals expose `id`, `label`, `has_permission` and `has_ability` and nothing else, while
      call sites read `has_admin_access` (18), `full_name` (15), `organisation_id` (8),
      `is_super_admin` (6), `email` (6), `role_names` (1) and `first_name` (1). Retyping would
      therefore have forced a choice nobody had made — grow `UserPrincipal` into a `User` proxy,
      or rewrite 55 call sites to reach through `.user` — inside a change advertised as a
      signature sweep, and a subagent handed "retype these files" would have picked one silently.
      **The adopted pattern instead:** signatures that genuinely require a human keep `actor:
      User`; the functions that must cope with anonymous and machine callers take
      `Principal | User | None` and call `_as_principal()` once. `apply_scope` demonstrates it —
      it type-narrows on `UserPrincipal`, unwraps to `.user`, and gives machine and anonymous
      callers the public predicate rather than a human's allowance. **Polymorphism belongs at the
      boundary where the other principal kinds actually arrive, not spread across 264 signatures
      that will never see one.**
      What is genuinely left of the original intent is much smaller and is not this item: any
      *new* function that can be reached by a token or by the public should take the union from
      the start.
- [x] **3.4** Replace the two hand-rolled filters marked `# PM-5` — `get_partner_for` and
      `list_partners` — with `assert_can_read` / `apply_scope`. **Already done; this checkbox was
      stale, verified 2026-08-21.** Both call sites use the scoping helpers and both carry a
      `# PM-5 closed 2026-08-17` comment saying so (`partner_service.py:275` and `:301` — the line
      numbers in the original wording had drifted, which is why it read as outstanding). No
      hand-rolled `organisation_id ==` comparison remains in that file.
- [~] **3.5** Wire the three dead helpers in `data_access_service.py`. **2 of 3 done** (verified
      2026-08-20): `manageable_user_ids` is called from `data_access_service:154` and
      `can_manage_data_of` from `user_service:216`. **`narrow_to_creators` still has zero
      production call sites** — the remaining third of this item.
      ⚠️ **It should be flagged, not quietly wired.** It restricts a list to rows *created by*
      users the actor may reach, so adding it to an existing index **removes rows people can see
      today**. That is the same class of change as 3.6 (`list_grants`), which was deliberately
      flagged and then closed on the owner's word rather than taken silently. The consequence of
      leaving it dormant is the one the plan already states — a data-access grant affects Global
      Search and nothing else — so this is a question about intent, not a defect: **which
      indexes are grants supposed to widen?** Until that is answered, wiring it into a list
      chosen by whoever happened to be editing would be a guess with a visible blast radius.

      **Re-examined 2026-08-21 and deliberately left dormant.** Still zero production call sites.
      Wiring it was considered as part of a sweep to close outstanding code-level items and
      rejected for the reason already written above: it *removes* rows people can see today, and
      which indexes grants are meant to widen is a product question. The one thing that changed is
      that this is now stated twice rather than once, so the next sweep does not have to
      re-derive it. **Do not wire this without the owner naming the indexes.**
- [x] **3.6** Flag to the owner: `list_grants` showed the whole delegation graph to any
      `data-access-view` holder, and Staff holds it. **Done — flagged 2026-08-13, closed
      2026-08-17** on the stated recommendation; it is now scoped on `has_admin_access`, and the
      divergence from the reference is recorded in the function's own docstring.
- [x] **3.7** The wrong-tenant authenticated suite PM-11 says is missing. **Done 2026-08-20** as
      `TestTheTenantWallHoldsOverHTTP` in `tests/test_visibility_paths.py` rather than in
      `test_route_enforcement.py` — the tenant-wall fixtures and the other visibility rules already
      live there, and a second copy of the two-organisation setup would have been the duplication
      § 5 warns about. Three tests: the detail route is 404 for a valid session from another
      organisation (and 200 for its own, so the assertion cannot pass vacuously), the index does not
      list the other organisation, and the id-taking write is refused with the row re-read
      afterwards — because a status code and the database are separate claims.
      ⚠️ **It found a real gap on its first run: the partner write surface applies no tenancy
      narrowing at all.** Reads go through `scoping.assert_can_read`; `can_edit` checks only the
      permission, and `can_delete`/`can_change_status`/`can_verify` add a check that refuses the
      actor's *own* organisation — which is self-approval protection, not tenancy scoping. Not
      exploitable in the shipped configuration (all four permissions are reachable only through the
      wildcard admin roles, whose members have no `organisation_id`), so it was **flagged rather
      than silently narrowed**, following 3.6's precedent. Recorded as **PM-46**, with
      `tests/test_partner_write_permissions.py` turning the configuration fact that keeps it safe
      into an enforced invariant.

**Gate:** full verification gate + `test_scoping.py` and the extended enforcement suite green.

> **Status 2026-08-20: 3.1, 3.2, 3.4, 3.6 and 3.7 are done.** `scoping.py` exists with
> `apply_scope`/`assert_can_read` and 32 tests; PM-5's hand-rolled filters were closed 2026-08-17.
> **3.3 is rejected, not pending** — see the item for why the count was never the problem. 3.5 is
> 2 of 3, and its last third is an owner question rather than a task.

---

### Phase 4 — PM-41: the frontend data layer

> **Status 2026-08-20: Phase 4 is closed.** 4.1–4.7 are all done. Every list module is on the layer,
> and `useResourceList` and `useRowAction` have been **deleted** — the live half of the latter,
> `useBulkAction`, moved to its own file. What remains is **4.3** (type the endpoints against the
> *generated* `types/api.d.ts` rather than the hand-written types in `lib/api/*.ts` — that is
> PM-42's job, and the thirteen slices deliberately did not pre-empt it) and **4.7**
> The hand-written types in `lib/api/*.ts` stay — deliberately, because they narrow what Pydantic
> types loosely — and are now drift-asserted against the generated schemas instead.

**Measured 2026-08-17:** 49 files use `useEffect`; 17 of 20 admin modules fetch on mount; Redux
carries **auth only** (`lib/store/authSlice.ts`), no query layer. Every new module in every future
project inherits this pattern, which is exactly why it belongs in the core rather than after it.

- [x] **4.1** Pick the layer. **RTK Query, and it is built** — `lib/store/api.ts` carries the
      decision and its reasoning. **Recommended: RTK Query** — `@reduxjs/toolkit` and `react-redux` are
      already dependencies and already wired for auth, so this adds **zero** new packages. That
      matches this codebase's standing preference for one fewer dependency (passlib removed, rate
      limiter hand-rolled). TanStack Query is the better-DX alternative and costs one dependency.
- [x] **4.2** **Built** — `lib/api/baseQuery.ts` over the existing `axiosInstance` so the refresh-race fix
      and cookie handling are not reimplemented.
- [x] **4.3** Type every endpoint against the generated `types/api.d.ts`. **Done 2026-08-20 — but
      not the way this said, and the difference matters.**
      Two premises here were stale. **PM-42 was closed on 2026-08-06**, not open; and
      `types/api-contract.ts` is not "the hand-copied layer" — it is the *drift assertion* PM-42
      was closed with, and it explains in its own header why replacing the hand-written types
      wholesale is the wrong move: the generated types come from Pydantic and are **looser**.
      `DataAccessGrantResponse.access_level` is `string`, while the hand-written `AccessLevel` is
      `"view" | "manage"` and three modules `switch` on it. Replacing would have traded a real
      union for a bare string and deleted the exhaustiveness checking with it.
      **What landed instead:** the assertion mechanism was extended to the seven `lib/api/*.ts`
      modules it had never reached — 27 new contracts, taking the file from 18 to 45. Every type
      in `errorApi`, `dataAccessApi`, `credentialApi`, `featureFlagApi`, `searchApi`, `webhookApi`
      and `platformApi` is now compared against its generated schema in both directions, so the
      narrowings survive *and* drift became impossible. All 27 passed on the first run — there was
      no drift to fix, which is the good outcome and also the reason nobody would have noticed the
      gap.
      **The guard was tested by breaking it**, because a contract assertion that passes vacuously
      is worse than none — the file's own header makes that argument. Renaming a field the UI
      declares produces `["UI declares fields the API does not send:", "occurrence_count_renamed"]`;
      removing one the API sends produces `["API sends fields the UI has not modelled:",
      "fingerprint"]`. **The second case is caught by nothing else in the build** — no component
      error, no failing test — and it is the one that ships a feature half-wired.
      Prerequisite that made this possible: the committed `openapi.json` was four routes stale and
      was regenerated the same day, so these assertions compare against the live API rather than
      2026-08-18's.
- [x] **4.4** Migrate `ResourceIndex` to accept a query hook rather than data + loading props.
      **Done 2026-08-20**, as its own change after 4.5 rather than as part of it.
      `ResourceIndex` takes `result={listQuery}` plus an `errorMessage` fallback and derives
      the six values itself; **14 call sites** lost six lines each. The props are an
      **exclusive union** (`?: never` on both arms), so passing a mixture is a type error
      rather than a silent precedence question.
      **The two indexes whose rows are not a paged server query keep the primitive arm**, and
      that is the point of keeping it: `RolesModule` pages a full list in the browser, and
      `PartnerTiersModule` reads an unpaged array. Forcing either through a paged-result shape
      would have meant lying about `total` and `pages`.
      ⚠️ **It also fixed something the conversion had introduced.** Every one of those 14 call
      sites wrote `error={error ? "Could not load X." : null}`, throwing away the message the
      transport had already produced — `axiosBaseQuery` normalises every failure to a sentence
      fit to show a user, and its docstring says components should render it. So a 403
      explaining *why* a list was refused arrived as "Could not load users." The shell now
      prefers the server's message and falls back to the static one, which is what
      `PartnerTiersModule` had been doing by hand all along.
      Not done: `statsLoading` is still passed separately where a module has stat tiles.
      Folding it in would mean deciding whether tiles and table always share a loading state,
      and `EnquiriesModule` is the only caller — not worth a prop for one.
- [x] **4.5** Convert the modules. **Done 2026-08-20 — every module is on the data
      layer and `useResourceList` has zero importers.** The eleven that were still on it —
      Activity, ApiConsumers, Credentials, DataAccess, Errors, FeatureFlags, Invitations,
      Providers, SearchEntities, Users, Webhooks — moved in one pass, plus `InvitationForm`
      so the full-page `/dashboard/invitations/new` route stops leaving a stale table behind
      it. Two endpoint slices became thirteen.
      ⚠️ **The counts in this plan were measured by grepping for the word**, which matches
      prose in comments as well as imports — the "17" further up was never reliable. The
      earlier "11 modules / 5 converted" split *was* right, but a grep for
      `use[A-Za-z]+Query` is not: it matches `useResourceQuery`, which every module imports,
      so it reported all 17 as converted when 5 were. Measure imports, not words:
      `grep -rl 'from "@/lib/hooks/useResourceList"' frontend/components/`.
      **What the conversion found, in three kinds:**
        * **`patchRow` was wrong wherever the field written is also a filter.** Users' status,
          Errors' status, FeatureFlags' `enabled`, SearchEntities' `enabled`, ApiConsumers'
          `active`/`has_tokens`, Providers' `is_active`. Patching left the row visible,
          contradicting the filter above it, with no error anywhere. Invalidation re-runs the
          filtered query and lets the server decide membership.
        * **Values riding on a list envelope were being copied into state from inside the
          fetch callback** — `can_manage` in four modules, plus SearchEntities' `groups` and
          `available_models`, Providers' `categories` and Credentials' `can_reveal` and
          `environments`. Eleven `useState`s removed; each was a second copy of something
          already in hand, written during the commit phase.
        * **`useRowAction` was swallowing rejections**, which made `ConfirmDialog`'s
          `errorFallback` unreachable in ApiConsumers and SearchEntities: a failed write
          showed a toast *and closed the dialog*, when the dialog's whole contract is that it
          renders the failure in place and stays open. Fixed by letting the rejection through.
      **Both superseded hooks were then deleted** (same day, on the owner's go-ahead):
      `useResourceList` entirely, and `useRowAction` — whose file-mate `useBulkAction` is still
      used by Users and moved to `lib/hooks/useBulkAction.ts` rather than sitting in a file
      named after a deleted function. The reasoning that other modules had been citing by name
      was relocated first, not discarded: the two rules the list hook encoded ("do not fetch
      before the filters are restored", "a failed refresh must not blank the table") are now
      written down in `lib/store/api.ts` next to the layer that keeps them, and every comment
      that had deferred to a deleted docstring states its reason inline.
      `PartnersModule` needed **no new endpoint code at all** — `partnersEndpoints.ts` had
      existed since the layer was built and this module was its only missing consumer, which
      is how a data layer ends up with one user and a reputation for not being worth adopting.
      **What it demonstrated:** the enquiry thread's reply mutation invalidates the *inbox*
      list, so the badge counts on another page are correct the moment the thread changes
      something. The hand-rolled reload could not do that, because it did not know the other
      page existed.
- [x] **4.6** Delete the now-dead `useEffect` fetch blocks and confirm the react-hooks lint count
      stays at 0. PM-30 was closed by fixing symptoms; this retires the cause.
      **Done 2026-08-20 alongside 4.5.** Every fetch-on-mount `useEffect` in the eleven
      converted modules is gone — the picker/catalogue fetches (roles, abilities, webhook
      events, targeting options, activity filter options, data-access options, providers,
      consumers, organisations) are now shared cache entries, so screens that need the same
      unchanging list reuse one another's copy instead of refetching. Two of them also carried
      a hand-written `live` flag against the unmount race; RTK Query owns the subscription, so
      that whole class of bug goes with them. **react-hooks lint: 0 errors, 0 warnings.**
      One `useEffect` was deliberately *not* removed but rewritten: `CredentialForm` preloaded
      the editable field values into state, and the naive conversion — an effect copying query
      data into state — is both rejected by the React Compiler lint (`set-state-in-effect`)
      and wrong, because a refetch would overwrite whatever the user had typed. It now derives
      `{...serverValues, ...edits}` with no effect at all.
- [x] **4.7** Establish server-side fetching for public data via `INTERNAL_API_URL`.
      **Already done** (verified 2026-08-20): `lib/api/public.ts` is server-side only, resolves
      `SERVER_API_URL` from `INTERNAL_API_URL`, and its docstring records both traps — the
      reversed-rule one that fails silently, and `SERVER_API_URL` vs `SERVER_API_BASE_URL`, where
      the wrong one 404s and an error boundary turns it into an empty directory that looks
      exactly like an empty database.

**Gate:** full verification gate + the 43-route browser pass (`scripts/browser-check.mjs`).

---

### Phase 5 — De-brand the remaining identity constants

> **Status 2026-08-20: 5.1, 5.2, 5.4 and 5.6 are done; 5.3 was rejected on inspection** (it would
> have broken Google sign-in, staff invitations and a self-registration guard — see the item for
> what landed instead). Only **5.5** remains, and it needs the owner: it is Protected-File and
> dump-and-restore territory.

Small, independent, and each one is a fossil that would follow the core into project #2.

- [x] **5.1** `db/seed_rbac.py` — `DEFAULT_ROOT_EMAIL` → derive from a setting, following the
      `TWO_FACTOR_ISSUER` precedent. **Already done** (verified 2026-08-20): it returns
      `f"root@{settings.primary_domain}"`.
- [x] **5.2** `core/config.py` — `MAIL_FROM` → same treatment. **Already done** (verified
      2026-08-20): the field defaults to `""` and `model_post_init` resolves it to
      `f"no-reply@{self.primary_domain}"`.
- [!] **5.3** `core/config.py` — `STAFF_EMAIL_DOMAINS = "leapswitch.com"`. ~~The **default**
      should be empty, with `is_staff_email()` returning `False` and the internal/external split
      degrading to "everyone is external".~~
      **REJECTED 2026-08-20, after checking the call sites. Do not implement this as written —
      it would break the application.** `is_staff_email()` has three callers, and an empty
      domain list changes all three at once:
        * `google_service` — `if not is_staff_email(...)` becomes true for every address, so
          **Google sign-in refuses everyone**. For staff, who sign in *only* with Google, that is
          a total lockout.
        * `invitation_service` — an `internal` invitation is refused for every address, so **a
          staff account can never be created by invitation**.
        * `auth_service` — the guard that stops a staff address self-registering with a password
          has nothing to match, so **it silently stops firing**. This is the one the field's own
          comment already warned about, and it is a security regression rather than a broken
          feature.
      **The underlying concern is real and was answered differently.** Shipping another
      company's domain as a code default *is* wrong for a reusable core; the fix is to make it
      loud, not to make it broken. What landed instead:
        * `audit_environment()` already warned when the value is still the shipped default. It
          now **also warns when the value is empty**, naming all three consequences — because an
          external-only installation legitimately wants them, and "deliberate" and "forgot to
          set it" were previously indistinguishable. A warning and not a problem, so a
          marketplace-only deployment still boots.
        * **Two dangling error messages fixed.** Both callers built their message with
          `", ".join(...)` over the domain list, so with an empty list they read "Google sign-in
          is limited to ." and "A staff invitation requires an address at ." — truncated
          sentences that name no cause. Each now has a second phrasing for the empty case.
        * The rejection and its reasoning are recorded **on the field itself** in `config.py`, so
          the next person to read this plan item finds the counter-argument in the code rather
          than re-deriving it.
      Three tests were added in `tests/test_config_environment.py`: the empty-value warning, the
      mutual exclusivity of the two `STAFF_EMAIL_DOMAINS` warnings, and the emptiness
      precondition both service messages branch on.
- [x] **5.4** `db/seed_users.py` — confirm it is gitignored/env-driven and carries no real
      addresses into a public repo (rule 7). **Verified clean 2026-08-20.** The roster is read
      from `SEED_USERS_FILE` (default `backend/seed_users.json`), that path is gitignored with a
      comment saying why, and the committed `seed_users.example.json` uses `@example.com`
      throughout. The only address in the module itself is `ada@example.com`, in a docstring.
- [ ] **5.5** PM-21's two deferred items, now worth doing because they travel: `docker-compose.yml`
      network `test-platform` and `POSTGRES_DB=test_platformDB`. **Both are Protected-File /
      destructive territory** — compose needs containers stopped, the database rename is
      dump-and-restore. Needs the owner's go-ahead.
- [x] **5.6** Correct `AGENTS.md`'s stale plaintext-password line (§ 0 above). **Protected file —
      requires explicit owner confirmation.** ✅ **Done 2026-08-18**, with the owner's approval, as
      part of merging the two agent contracts — the root file had been corrected on 2026-08-17, and
      the duplicate in `documentation/AGENTS.md` was still wrong until the merge removed it
      ([ADR-0016](../adr/0016-one-agent-contract.md)).

---

### Phase 6 — Deferred on purpose, and the reason matters

Not weakness in the core — correct sequencing. Recorded so nobody "fixes" them early.

- [ ] **6.1** **PM-44 — Redis.** Rate-limit counters are an in-process dict; at `gunicorn -w 4` a
      limit of 10 becomes 40. Also gives email a queue and sessions a cache. **Lands with the
      production topology, not before** — in a single dev container it is infrastructure serving no
      need. Note RBAC reads are already fine: `roles` and `role.permissions` are both
      `lazy="selectin"` (two queries, never N+1) and `session_service.touch` is throttled to one
      write per five minutes.
- [ ] **6.2** **PM-10 — monitoring.** Logging is done; nothing alerts. Needs somewhere to send to.
- [ ] **6.3** **PM-28 — verify Google SSO against real Google.** Needs credentials. Blocks every
      internal-domain login, since staff addresses are *refused* from credential registration.
- [ ] **6.4** **PM-27 — an SMTP provider.** `MAIL_BACKEND` defaults to `console`; a reset link in a
      log file is a working credential for anyone who can read logs.
- [ ] **6.5** Packaging decision, if the template-repo assumption in § 2 is rejected.

---

## 4. Critical path

**0 → 1 → 2 → 3 → 4**

Phase 5 runs in parallel with any of them. Phase 6 waits on infrastructure and owner decisions.

The two places this can stall are both inside phases that are ours to execute, not decisions —
which is the opposite of `PARTNER_DIRECTORY_PLAN.md`, where the critical path stalls on the owner
twice. **That is the argument for doing core work now:** it is the queue that does not block.

## 5. What this plan deliberately does NOT do

- **It does not delete the partner domain.** Extraction means a clean seam, not removal. The
  directory stays and becomes the proof the seam works.
- **It does not chase test coverage.** 217 tests are a floor. Phase 3 adds the one suite whose
  absence is a real risk (tenant scoping); broad coverage stays PM-11 and stays open.
- **It does not add Redis, a message queue, or an observability stack.** § 6.1's reasoning.
- **It does not upgrade Next.js.** 14.2.35 + React 18.3.1 is a deliberate, hard-won pairing —
  see PM-25. A framework major is not core hardening.

## Related

- [`CORE_HARDENING_PLAN.md`](./CORE_HARDENING_PLAN.md) — PM-37…44, the platform-layer audit this continues
- [`TECH_DEBT.md`](./TECH_DEBT.md) — PM-5, PM-10, PM-11, PM-27, PM-28
- [`CORE_COMPLETION_PLAN.md`](./CORE_COMPLETION_PLAN.md) — § 8.2's "core 100%", all boxes ticked 2026-08-13
- [`PARTNER_DIRECTORY_PLAN.md`](./PARTNER_DIRECTORY_PLAN.md) — the domain, and § 7.1 on the `Principal` type
- [`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md) — § Row-Level Scoping, the rule Phase 3 implements
