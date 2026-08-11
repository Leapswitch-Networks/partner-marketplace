# PLANNING — 2026-08-07

> **What this file is.** The working plan for today: what is in flight, what is next, and what is
> deliberately not being done. One file, kept current during the session.
>
> **Not to be confused with `documentation/planning.md`** — that is an inherited test-platform
> artifact from the deleted product, flagged stale in `INDEX.md`, and should be deleted (see § 6).
>
> Every status below was **verified against the running system today**, not read from another doc.
> Where a register disagrees with what was measured, the measurement is recorded and the register is
> named. `AGENTS.md` § Critical Rules: *the register is a map, not the territory.*

---

## 1. Verified state — measured 2026-08-07

| Check | Result | How |
|---|---|---|
| Docker stack | All four containers up | `docker compose ps` |
| Migrations | At head `d8c31f60a927` | `docker compose run --rm backend alembic current` |
| Seed data | 5 users · 6 roles · 18 permissions · 7 permission groups · 1 app_settings | direct query on `test_platformDB` |
| `npm run typecheck` | **Passes** | in container |
| `npm run build` | **Passes** — all 21 routes compiled | in container |
| `npm run lint` | **17 errors**, 0 warnings | in container |
| Brand-colour guard | **Clean** | `grep -rniE 'F97316\|EA6C0A\|orange-[0-9]\|249, *115, *22' app components` |
| `npm run codegen:check` | **Cannot run locally** — see § 4.1 | in container |
| Backend `pytest` | **Cannot run locally** — see § 4.2 | in container |
| Uncommitted paths | **90** | `git status --porcelain \| wc -l` |

**The lint count is 17, not the 20 the register claims.** `TECH_DEBT.md` PM-30 and the comment in
`.github/workflows/ci.yml` both say 20. PM-25 was settled today (React 18.3.1), which is the most
likely reason the count moved. Both places need correcting to 17 — or to zero, if § 3.2 gets done.

---

## 2. Priority 1 — Ship what is already built

**This is the largest and most urgent item, and it is not a coding task.** There are **90 uncommitted
paths** in the tree, spanning at least eight distinct pieces of finished work: the dev-cache fix, the
`(app)` route-group restructure, PM-25's React downgrade, PM-42's OpenAPI codegen, the 2FA challenge,
branding changes, the security-header work, and today's green theme.

The risk is concrete and compounding:

- `frontend/app/dashboard/DashboardClient.tsx` and `layout.tsx` are staged **deleted**. Losing this
  tree loses the restructure that replaced them.
- `backend/openapi.json` and `frontend/types/api.d.ts` are staged **added**. They are the contract
  PM-42 exists to enforce; uncommitted, the guard protects nothing.
- Eight documentation files are modified against code that is also modified. Every hour they drift
  further from the diff they describe.

**Do this before writing any more code.**

- [ ] Read the full diff — `git status` then `git diff` per area. Do not stage blind.
- [ ] Split into logical conventional commits, roughly one per piece of work above. Not one commit of 90 files.
- [ ] Run the secret scan before each: `git diff --cached | grep -iE "secret|password|token|api[_-]?key"`
- [ ] Confirm `.env`, `data/`, `node_modules/` are absent from every staged set
- [ ] **The repo is public.** Nothing internal, no real credentials, no partner names.

> ⚠️ **Ask before committing, every time** — `AGENTS.md` § Commit Rules. And **never run git write
> commands from `/opt/lampp/htdocs`**; that is the marketing-site repo with hundreds of pending
> deletions. This repo's root is `/opt/lampp/htdocs/Partner Market Place`.

---

## 3. Priority 2 — Close what today opened

### 3.1 The border token — one line, needs approval

Today's green chrome (`surface-wash` `#eaf0ef` on the canvas, sidebar, header and card) made
`surface-border` `#e6edef` measure **1.02:1** against its own background — invisible. Since this
design separates surfaces with borders rather than shadows, **22 hairlines were hand-edited** to
`border-brand/20` to keep the card, table and dividers visible.

- [ ] Retint `surface.border` in `tailwind.config.ts` to a value that works on both white and green,
      then revert the 22 call sites to the token.

> **Blocked on the owner.** `tailwind.config.ts` is on the Protected Files list. Until then the
> hand-edited version is correct and shipping; this is a tidiness fix, not a defect fix.

This is the *third* instance of the exact exposure `UI_PATTERNS.md` § Pending already predicted:
*"the same exposure still exists for surfaces and text — it was only the brand hue that got a token
layer."* Worth doing the surface/text token layer properly rather than a third one-off.

- [ ] `surface-page` (`#f5f7fb`) is now referenced by **nothing**. Delete it or repurpose it.

### 3.2 PM-30 — 17 lint errors, now unblocked

`ci.yml` line 137 carries `continue-on-error: true` on the lint step with an explicit instruction:
*"DELETE THIS LINE when PM-25 is settled and PM-30's count is zero."* **PM-25 was settled today.**
Half the condition is met; the count is 17.

All 17 are `react-hooks` / React Compiler rules — `set-state-in-effect`,
`preserve-manual-memoization`, `immutability`. `Sidebar.tsx` is the worst offender.

- [ ] Fix the 17, delete `continue-on-error`, correct the count in PM-30 and in the `ci.yml` comment.

> **Judgement call to make first:** `CORE_HARDENING_PLAN.md` says PM-41's data layer *"retires PM-30
> by construction"*. If PM-41 starts this week, fixing these by hand is throwaway work. If it does
> not, 17 errors behind `continue-on-error` is a CI step nobody reads. **Decide which, don't drift.**

### 3.3 DataTable sticky header bleeds

`components/common/DataTable.tsx:261` — the `<thead>` is `sticky` with a **translucent**
`bg-brand/10` and no `<th>` carries an opaque fill, so rows scroll visibly through the header. The
layout spec in `UI_PATTERNS.md` explicitly requires *"sticky thead (top-0 z-10, **opaque bg**)"*.

Pre-existing and unrelated to the colour change — it reads the same on either background.

- [ ] Give the header an opaque fill that matches the new green card.

---

## 4. Priority 3 — Two checks that cannot run locally

Both are CI gates that a developer cannot reproduce before pushing. That is the condition under which
CI becomes something you find out about rather than something you use.

### 4.1 `codegen:check` is unrunnable in the container, and lies about why

The script runs `openapi-typescript ../backend/openapi.json`. Inside `pmp-frontend`, `/app` is the
frontend root, so `../backend` resolves to `/backend` — which does not exist, because the backend is a
separate container. It works in CI only because the runner checks out the whole repo onto one disk.

Worse, the failure is **misreported**. The script is:

```
npm run codegen:api && git ls-files --error-unmatch types/api.d.ts || { echo 'types/api.d.ts is not committed'; exit 1; }
```

When `codegen:api` fails for *any* reason the `&&` short-circuits and the `||` branch fires, so an
unreadable schema path prints **"types/api.d.ts is not committed"**. The file is committed. The
message sends you to fix the wrong thing.

- [ ] Make the schema path work from inside the container, or document that this check is CI-only
- [ ] Separate the two failure modes so each reports itself

### 4.2 `pytest` is not installed in the backend dev image

`backend/Dockerfile.dev` installs `requirements.txt` only; the suite needs `requirements-dev.txt`.
CI installs both. So the **217 tests cannot be run locally** — `docker compose run --rm backend
python -m pytest` returns *"No module named pytest"*.

- [ ] Install `requirements-dev.txt` in the dev image, or document the one-off command

---

## 5. Two roadmaps, not one

There are **two independent queues**, and confusing them is how work stalls. One is the product
(what the app does); the other is the platform beneath it (whether what it does can be trusted).

### 5.1 Product — LeapDesk parity ⭐ the current focus

**LeapDesk is the reference implementation.** It is a Laravel app at
**`/opt/lampp/htdocs/LeapDesk`** — confirmed readable today. Three other copies exist on this machine
(`leapdesk_core`, `leapdesk_v2`, `leapdesk_laravel_react_version`); the parity plan was written
against `/opt/lampp/htdocs/LeapDesk`, so **use that one** unless you deliberately decide otherwise.

The job is to replicate LeapDesk's core admin shell — the eight modules in its two lower sidebar
sections plus the self-service Settings area — in this stack. Full spec, schemas, endpoints and
translation rules: [`LEAPDESK_PARITY_PLAN.md`](./LEAPDESK_PARITY_PLAN.md).

**Status: 2 of 10 modules by this register — but see the staleness warning below. Last worked
2026-08-07.** The module count moved from 9 to 10 on 2026-08-10 when the reference added Platform API.

| Module | State | Note |
|---|---|---|
| Settings (Profile / Password / Appearance) | ✅ Done | **Not truly closed** — the profile-email decision below still blocks it |
| Navigation (server-driven + per-role collapse) | ✅ Done | Sidebar consumes the tree |
| Invitations admin index | ⬜ Started, nothing committed | **Smallest next slice — backend is already complete, UI only** |
| Users `user-email`; Roles matrix / clone / role-users | ⬜ Not started | Small, self-contained |
| Activity Log gaps | ⬜ Not started | See the contradiction below |
| Data Access | ⬜ Not started | First new table; closes half of PM-5 |
| API Credentials | ⬜ Not started | Largest; gates AI Assistant, helps PM-28 |
| Global Search | ⬜ Not started | Gates `LocateData` |
| AI Assistant | ⬜ Not started | Needs API Credentials + Global Search |
| **Platform API** | ⬜ Not started — **specced 2026-08-10** | **New: the reference grew.** Machine consumers + API tokens |

> ### The reference added a tenth module — Platform API
>
> **Researched 2026-08-10** at the owner's request, from
> `https://leapdesk.cloudjiffy.net/settings/api/consumers`. LeapDesk shipped it on **2026-08-09**, five
> days after the parity plan was scoped, so this is scope growth in the reference rather than something
> missed. Full spec: [`LEAPDESK_PARITY_PLAN.md`](./LEAPDESK_PARITY_PLAN.md) § Module 10.
>
> **What it is:** the admin surface for *machine* identities — a consumer (a system, never a person)
> holds API tokens, each carrying abilities and an optional expiry, so that who has standing access to
> our data is readable without SSHing into production.
>
> **It is the opposite direction from the API Credentials module** already in the queue: that one holds
> credentials *we* use to call out to third parties; this one governs who may call *in*. LeapDesk
> refused to house them together for exactly that reason and so should we.
>
> **Three things came out of the R&D that matter beyond this module:**
>
> 1. **A machine consumer is not a `User`, and that is now the third such caller in four days** — after
>    the anonymous visitor in `PARTNER_DIRECTORY_PLAN.md` and the tenant boundary in PM-5. Everything we
>    have is typed `actor: User`, including every function in the `data_access_service` written on
>    2026-08-07. **Recommendation: introduce a `Principal` union once, before PM-5 and before this
>    module.** It gets more expensive every week it waits. The shortcut of a hidden service `User` per
>    consumer must be refused — it puts machine identities into user lists and RBAC screens.
> 2. **PM-26's per-process rate limiter is a second argument for PM-44 (Redis).** Per-IP buckets in
>    process memory are an honest speed bump for a login form; for an API whose rate limit is an
>    advertised contract, they are a control that does not hold across workers. A per-*consumer* limit
>    is also a new keying dimension the limiter does not have.
> 3. **Skip the generic resource engine (their Part II).** LeapDesk's own code review found 100 of 105
>    registered resources exposing every column of their table, including an 81-column internal cost and
>    margin model behind an innocuous-sounding ability. We have no data to expose and no consumer asking.
>    **This reopens only if the partner-directory product is chosen**, where partner-facing programmatic
>    access becomes plausible scope.
>
> **Not urgent.** It shares no table with modules 5–9 and nothing currently needs it — no integration has
> been requested and the domain is still greenfield. Positioned last in the build order, with the
> `Principal` work pulled forward out of it.

**Verified against the database today, not read from the plan:**

- ~~**Permissions: 0 of 14.**~~ **Corrected 2026-08-10 — this was measured on 2026-08-07 and is now
  wrong.** Re-measured against the running database today
  (`docker compose exec db psql -U admin -d test_platformDB`): **34 permissions**, of which **16 are the
  parity set** — `data-access-{view,manage}`, `api-credential-{view,create,update,delete}`,
  `api-provider-{view,create,update,delete}`, `search-entity-manage`, `ai-assistant-{use,query-database}`,
  `user-email`, `settings-{view,update}`. All in PM's `{resource}-{action}` convention; **none of the
  reference's dotted names are present**, which settles the naming question the parity plan still lists
  as open. The prerequisite for modules 5–9 is **met**.
- **Module 10's five are not seeded**, as expected — no `api-consumer-*` and no `api-token-manage` in
  the table.
- **Parity migrations: 2 of 7** — `e2b8d5c31f47` and `f5a3c81b7d29` are both present. Still accurate.
- **But the plan's "Head is `f5a3c81b7d29`" is stale.** Head is `d8c31f60a927` (brand assets), which
  landed after. 19 migration files total.

> ### ⚠️ The parity plan contradicts itself about the Activity Log — fix the doc before acting on it
>
> § *Module 4 → 4a* says non-admin rows are not sandboxed, calls it *"a privacy regression against the
> reference implementation"* and says **"fix this one first"**. § *Build order* repeats it: *"a live
> over-exposure … arguably it belongs at position 1"*.
>
> **§ *Progress → Correction* already retracted that**: *"That was wrong on both counts."*
>
> **I verified the retraction, not the claim.** `activity-view` is held by exactly **Admin, RootUser
> and SuperAdmin** — all `has_admin_access` roles, which is precisely who LeapDesk's
> `$viewAll = has_admin_access()` grants full visibility. **The two systems behave identically. There
> is no leak.**
>
> Two sections still carry the retracted urgency and will send the next reader to fix a non-problem at
> position 1. **Correct § 4a and § Build order.** The sandbox is still worth building as defence in
> depth — at ordinary priority, not as an incident.

- [ ] Correct § 4a and § Build order in the parity plan
- [ ] Refresh its Progress block: migration head, and re-verify each ⬜ against code before starting
- [ ] Seed the 14 permissions — prerequisite for modules 5–9
- [ ] Next build slice: **Invitations admin UI** (backend done, UI only)

### 5.2 Platform — the hardening queue

Per [`CORE_HARDENING_PLAN.md`](./CORE_HARDENING_PLAN.md) § 3. Not being started today.

| # | Item | Why it is next, and why not today |
|---|---|---|
| 8 | **PM-41** — frontend data layer | *"The biggest open build item."* Retires PM-30 by construction. Multi-session; needs its own plan and a clean tree first. |
| 9 | **PM-5** — row-level scoping | Highest open priority in the register and the hard gate in front of the marketplace domain. PM-38/39/40 were done specifically to make it verifiable. **Data Access (§ 5.1) closes half of it** — sequence them together, not separately. |
| 10 | **PM-44** — Redis for in-process state | With the production topology, not before. |
| 11 | **PM-10** — monitoring and alerting | With the production topology. Needs somewhere to send to. |

---

## 6. Cheap wins, if there is time

- [ ] **README is wrong.** `README.md:147` claims two account tables, `users` and `admin_users`. The
      schema has only `users` — verified by `\dt` today. One-line fix.
- [ ] **Delete `documentation/planning.md`** — inherited test-platform plan, already flagged stale in
      `INDEX.md`, describes a product that was deleted 2026-08-06. Also `architecture.md`,
      `instruction.md`, `phases.md` alongside it. Tier 1 housekeeping from `SCAFFOLD_CLEANUP_PLAN.md`.
- [ ] **PM-22** — remove the unused `@tailwindcss/postcss ^4` dependency. Safe to remove; **not** safe
      to activate without a full v3→v4 migration.
- [ ] **PM-23** — two dead virtualenvs in the tree.

---

## 7. Blocked — needs the owner, not effort

| Item | Blocked on |
|---|---|
| § 3.1 border token | `tailwind.config.ts` is a Protected File |
| **PM-28** — Google SSO end-to-end | Real OAuth client credentials |
| **PM-27** — email deliverability | A real provider to send through |
| § 3.2 sequencing | The PM-41 timing decision |
| **Parity module 1 cannot be called done** | **Profile email: editable (LeapDesk parity) or read-only (this project's rule)?** Read-only today, because changing it breaks the Google account link and outstanding invitation links. LeapDesk edits it and clears the verification stamp. |
| ~~Permission naming~~ | ✅ **Settled** — normalised to `{resource}-{action}`, seeded, verified in the database 2026-08-10. No longer blocked. |
| `.claude/settings.json` | Commit it, or keep it out of a public repo? Still uncommitted — now with 28 further Bash allowlist entries added since the question was first asked. |
| **`Principal` — one type or three** *(new 2026-08-10)* | A shared union for user / machine / anonymous callers, versus letting Module 10, PM-5 and the partner directory each solve it. Three separate needs have now appeared in four days. **This is a design decision, not a preference, and it gets more expensive the longer it waits.** |
| **Module 10 timing** *(new 2026-08-10)* | Build the Platform API when something asks for it (recommended), or design machine access before the domain exists? Nothing currently needs it. |

Nine further parity decisions are listed in [`LEAPDESK_PARITY_PLAN.md`](./LEAPDESK_PARITY_PLAN.md)
§ *Open decisions* — 2FA in the settings sub-nav, credential caching, `role-permissions` routing,
`level`/`department` on role-users, Data Access vs. marketplace `partner_id` ordering, and the four
added with Module 10 (its scope, the `Principal` type, the generic resource engine, and the token
expiry default). **None of them blocks the next slice**, which is finishing the Data Access module —
its service layer is written but has no router, so it is currently unreachable code.

---

## 8. Explicitly not today

- The marketplace domain — parked pending LeapDesk parity (`MARKETPLACE_DOMAIN_PLAN.md`)
- The mixed-radii cleanup — 110 violations of a mandatory rule; needs the rule decided first
- Any browser-render or accessibility audit — `UI_PATTERNS.md` § Pending notes **no component has
  been visually verified since the Viho migration**. Today's colour work was verified by computed
  contrast ratios and the served CSS, **not by looking at it**. That gap is real and is not closed.

---

## Related

- [`LEAPDESK_PARITY_PLAN.md`](./LEAPDESK_PARITY_PLAN.md) — **the product spec.** Nine modules, schemas,
  endpoints, translation rules, and the build order. Read this before any parity work
- [`TECH_DEBT.md`](./TECH_DEBT.md) — the ranked defect register (PM-1 … PM-36)
- [`CORE_HARDENING_PLAN.md`](./CORE_HARDENING_PLAN.md) — PM-37 … PM-44, and the recommended order
- [`../system-design/UI_PATTERNS.md`](../system-design/UI_PATTERNS.md) — § The Signed-In Chrome Is Green, § Pending
- [`../DAILY_CHANGES.md`](../DAILY_CHANGES.md) — what actually shipped, newest first

**Reference implementation:** `/opt/lampp/htdocs/LeapDesk` (Laravel). Read it directly rather than
trusting a summary — the parity plan's own rule is that everything in it *"was read from LeapDesk
source … not from memory"*, and that standard applies to every module still to be built.
