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
- [ ] **3.3** Retype the stack onto `core/principal.py`'s `Principal` union. **258 sites across 44
      files** — the heaviest are `user_service.py` (17), `partner_service.py` (15), `api/auth.py`
      (14), `api/users.py` (12), `api/api_credentials.py` (12). Mechanical and well-specified:
      **this is the one part of this phase to delegate to `sonnet-implementer`**, in
      non-overlapping file packages, with the orchestrator validating each.
- [ ] **3.4** Replace the two hand-rolled filters marked `# PM-5` — `partner_service.py:197`
      (`get_partner_for`) and `:222` (`list_partners`) — with `assert_can_read` / `apply_scope`.
- [ ] **3.5** Wire the three dead helpers in `data_access_service.py` — `manageable_user_ids:124`,
      `can_manage_data_of:142`, `narrow_to_creators:158`. They are built, tested, and have **zero
      production call sites**; a data-access grant currently affects Global Search and nothing else.
- [ ] **3.6** Flag to the owner, do not silently change: `list_grants:213` shows the whole delegation
      graph to any `data-access-view` holder, and **Staff holds that permission**. Scoping it is a
      visible behaviour change.
- [ ] **3.7** Extend `tests/test_route_enforcement.py` — it proves a stranger is refused, not that a
      *wrong-tenant authenticated* caller is. That second suite is what PM-11 says is missing.

**Gate:** full verification gate + `test_scoping.py` and the extended enforcement suite green.

---

### Phase 4 — PM-41: the frontend data layer *(largest open item)*

**Measured 2026-08-17:** 49 files use `useEffect`; 17 of 20 admin modules fetch on mount; Redux
carries **auth only** (`lib/store/authSlice.ts`), no query layer. Every new module in every future
project inherits this pattern, which is exactly why it belongs in the core rather than after it.

- [ ] **4.1** Pick the layer. **Recommended: RTK Query** — `@reduxjs/toolkit` and `react-redux` are
      already dependencies and already wired for auth, so this adds **zero** new packages. That
      matches this codebase's standing preference for one fewer dependency (passlib removed, rate
      limiter hand-rolled). TanStack Query is the better-DX alternative and costs one dependency.
- [ ] **4.2** Build `lib/api/baseQuery.ts` over the existing `axiosInstance` so the refresh-race fix
      and cookie handling are not reimplemented.
- [ ] **4.3** Type every endpoint against the **generated** `types/api.d.ts`, not hand-written
      interfaces. `types/api-contract.ts` is the hand-copied layer PM-42 exists to retire.
- [ ] **4.4** Migrate `ResourceIndex` to accept a query hook rather than data + loading props, so all
      12 list modules convert by changing their call site rather than their body.
- [ ] **4.5** Convert the 17 modules. Mechanical once 4.4 lands — **delegate in packages**, one
      module per file, no overlapping ownership.
- [ ] **4.6** Delete the now-dead `useEffect` fetch blocks and confirm the react-hooks lint count
      stays at 0. PM-30 was closed by fixing symptoms; this retires the cause.
- [ ] **4.7** Establish server-side fetching for public data via `INTERNAL_API_URL`. The rule in
      `AGENTS.md` § 5 is real and fails **silently** when reversed — authenticated data must stay
      client-side because the `httpOnly` cookie cannot be forwarded server-side.

**Gate:** full verification gate + the 43-route browser pass (`scripts/browser-check.mjs`).

---

### Phase 5 — De-brand the remaining identity constants

Small, independent, and each one is a fossil that would follow the core into project #2.

- [ ] **5.1** `db/seed_rbac.py:42` — `DEFAULT_ROOT_EMAIL = "root@leapswitch.com"` → derive from a
      setting, following the `TWO_FACTOR_ISSUER` precedent.
- [ ] **5.2** `core/config.py:284` — `MAIL_FROM = "no-reply@leapswitch.com"` → same treatment.
- [ ] **5.3** `core/config.py:181` — `STAFF_EMAIL_DOMAINS = "leapswitch.com"`. Already config, but
      the **default** should be empty, with `is_staff_email()` returning `False` and the internal/
      external split degrading to "everyone is external" rather than silently matching a domain
      belonging to another company.
- [ ] **5.4** `db/seed_users.py` — reads seven real `@leapswitch.com` addresses. Confirm it is
      gitignored/env-driven and carries no real addresses into a public repo (rule 7).
- [ ] **5.5** PM-21's two deferred items, now worth doing because they travel: `docker-compose.yml`
      network `test-platform` and `POSTGRES_DB=test_platformDB`. **Both are Protected-File /
      destructive territory** — compose needs containers stopped, the database rename is
      dump-and-restore. Needs the owner's go-ahead.
- [ ] **5.6** Correct `AGENTS.md`'s stale plaintext-password line (§ 0 above). **Protected file —
      requires explicit owner confirmation.**

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
