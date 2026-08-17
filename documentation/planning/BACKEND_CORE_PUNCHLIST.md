# Backend Core — Punchlist

> Every pending item in the **backend platform layer**, verified against code on 2026-08-17 rather
> than copied from a status table. Worked top to bottom, one task per turn, each ticked only after
> its own verification passes.
>
> **How to read a box:** `[ ]` not started · `[~]` in progress · `[x]` done **and verified** ·
> `[!]` blocked on something outside this repo.
>
> Companion documents: [`CORE_EXTRACTION_PLAN.md`](./CORE_EXTRACTION_PLAN.md) (the phases this
> continues), [`CORE_HARDENING_PLAN.md`](./CORE_HARDENING_PLAN.md) (PM-37…44),
> [`TECH_DEBT.md`](./TECH_DEBT.md) (the register — **currently stale, see T6**).

---

## Ordering, and why it is this order

`T1 → T2` is the critical path and the only hard dependency in the list: **T2 retypes the call
signatures T1's tenant filters sit behind**, so doing T1 after T2 means touching the same 43 files
twice. Everything in § B is independent and can run alongside. § C is deferred **by design** — the
boxes exist so nobody "fixes" them early. § D cannot be closed from inside this repo.

**Nothing here is committed without asking**, per the operating contract. Each task ends with the
verification gate, not with a commit.

---

## A. PM-5 — row-level scoping's remaining half 🔴

The only place in this codebase where a mistake is a data breach rather than a bug.
`services/scoping.py` exists and is sound (24 tests, 404-never-403, anonymous fails closed). These
are the four plan items that did not land with it.

- [x] **T1 — Register every tenant-owned table for scoping.** *(plan 3.1 follow-through, 5a)* —
      **done 2026-08-17.** `User` registered in `user_service`, `UserInvitation` in
      `invitation_service`, each beside the service that owns the model.
      **The security fix that came out of it:** `accessible_user_ids` decides *which users* on the
      delegation axis and never consults the organisation, and `create_grant` checks self-elevation
      but not tenancy — so an admin-written grant spanning two organisations produced a genuine
      cross-tenant read. `scoping.apply_tenant_wall` now composes onto `list_users` after the
      delegation filter, narrowing it and never widening it.
      **The wall is a second function rather than `apply_scope`** because the two disagree about an
      actor with no organisation on purpose: `apply_scope` says *nothing* (right for a domain row),
      the wall says *not my business* (right for internal staff, who would otherwise have been
      hidden from themselves). Both behaviours are pinned by tests, including the hazard ones —
      anonymous and machine pass through the wall untouched, so it must never be the only scoping on
      a query the public can reach.
      **Guard added:** `TestEveryTenantOwnedTableIsRegistered` asks the mapper registry which tables
      carry `organisation_id` and requires each to be registered, plus a test that the query itself
      still finds something — a guard that silently matches nothing passes forever.
      *753 tests green, ruff clean.*
      `register_scope` is called **exactly once** today — `partner_service.py:104`, for `Partner`.
      `users` and `user_invitations` both carry `organisation_id` and are unregistered, so the
      central rule governs neither, and `apply_scope` on them would raise rather than filter.
      **Done means:** both registered with the right `owner_column`, every list/detail path for them
      routed through `apply_scope`/`assert_can_read`, the public predicate decided explicitly for
      each (default: nothing), and `scoped_models()` enumerated by a test that fails when a table
      with an `organisation_id` is added without a registration.
      *Orchestrator-owned — this is the data-breach surface, not delegated.*

- [x] **T2 — ~~Retype the stack onto `Principal`~~ — SUPERSEDED, not done.** *(plan 3.3, 5b)*
      **Deliberately rejected 2026-08-17 after reading the code it would change.** Plan 3.3 was
      written before `scoping._as_principal` existed. That function normalises `Principal | User |
      None` at the one boundary that actually has to cope with anonymous and machine callers, and
      its own docstring makes the argument: blanket-retyping the 258 signatures would make most of
      them **less** accurate, not more. `user_service.update_user` genuinely requires a human — it
      reads `actor.id` and `actor.has_admin_access` — and `actor: Principal` would mean the type
      permits an anonymous caller that the body cannot handle.
      **Verified before deciding, not assumed:** every route in `api/partners.py` sits behind
      `require_permission`, so no anonymous or machine principal reaches `apply_scope` from a router
      today. `MachinePrincipal` is used exactly where it is needed — the Platform API token gate in
      `api_consumer_service.authenticate`.
      **What replaces it:** nothing now; one line later. When the public directory route lands
      (`PARTNER_DIRECTORY_PLAN.md` phase 5) it passes `ANONYMOUS` explicitly rather than `None`, and
      the seam already has a considered answer for it. **43 files of churn with no behaviour change
      is not the price of that.**

- [x] **T3 — Give the data-access helpers their first production call site.** *(plan 3.5, 5c)* —
      **done 2026-08-17, and it turned up the worst defect of the sweep.**
      Looking for an honest call site meant reading the write paths, and they had **no visibility
      check at all**: every one loaded its target with `get_user_or_404` and gated on `can_edit`,
      which is `has_permission("user-update")` plus the super-admin protection. **The list was scoped
      and the writes were not**, so an actor who could not *see* a row could `PATCH` it by id, change
      the `email` — the one field that is not admin-gated — and drive a password reset to an address
      they control. Reachable by any custom role holding `user-update`, because `has_admin_access` is
      derived from role *names* while permissions come from the Roles screen.
      **Two getters now express the two questions:** `get_visible_user_or_404` (404 — delegation ∩
      tenancy) and `get_writable_user_or_404` (403 — admin, self, or a **manage** grant). The second
      is where `can_manage_data_of` and `manageable_user_ids` finally do something: a `manage` grant
      and a `view` grant were indistinguishable everywhere it mattered.
      Bulk paths were the same hole with an `s` — `_load_bulk_targets` ran its own query — and also
      never filtered `deleted_at`, so a bulk delete could re-stamp a binned row and count it.
      **Also fixed:** the detail route refused any id but your own, so a *view*-granted subject
      appeared in the list and 404'd on click. Both now share one rule, and it left the router.
      **`narrow_to_creators` deliberately stays unwired** — nothing here has creator-owned rows
      governed by delegation, so wiring it would invent a policy rather than enforce one.

- [x] **T4 — The wrong-tenant enforcement suite.** *(plan 3.7, 5e)* — **done 2026-08-17.**
      Both scoped models, at the layer each rule lives in: `users` (detail, list, single write, bulk
      write, cross-organisation grant) and `Partner` via `get_partner_for`, each with a genuinely
      authenticated caller from the wrong organisation expecting **404**.
      **The suite was verified by breaking the code, not by going green:** reverting the write paths
      to the pre-fix loader fails three of these tests, including a `DID NOT RAISE` proving a `view`
      grant used to permit a write.

- [x] **T5 — `list_grants` shows the whole delegation graph.** *(plan 3.6, 5d)* — **done
      2026-08-17, on the recommendation, with one change of mechanism.** Administrators see the whole
      graph; everyone else sees grants they are **a party to** — as grantee *or as subject*, because
      "who can see my records" is a question you should be able to answer about yourself.
      **The proposed new permission was rejected.** `list_users`, `list_invitations`,
      `narrow_to_creators` and `apply_scope` already key visibility off `has_admin_access`; a fifth
      spelling of the same idea is a fifth thing to keep in agreement, and it would have needed
      catalog vocabulary and a seeding step to say what was already sayable.

---

## B. Independent — executable now ⚪

- [x] **T6 — Correct `TECH_DEBT.md`.** — **done 2026-08-17.** PM-40, PM-42 and PM-43 marked closed
      with what closed them; PM-5 rewritten as resolved with a table of the six gaps this sweep
      found, and its dead "where" line (`api/candidate.py`, `api/category.py` — deleted scaffold
      files) replaced with a note that a "where" line is the first part of an entry to rot; PM-11
      restated as floor-laid rather than "no automated tests", which had been wrong for eleven days.
      A note now says both files are updated together or neither is trustworthy.

- [x] **T7 — Extend RBAC route coverage.** *(PM-11, the part PM-39's floor does not reach)* —
      **done 2026-08-17.** The insight that shaped it: the existing suite proves every route
      *declaring* a permission refuses a stranger, and is therefore blind to the failure that
      matters — a route with **no guard at all** declares nothing, so it is not in the sample and the
      suite stays green while the endpoint answers the internet.
      So the matrix pins the **ungated** routes instead, in two tiers: 19 `PUBLIC` and 20 `AUTH_ONLY`
      of 159 total, each entry carrying its reason. Adding a public endpoint now means editing a list
      in a test whose assertion message starts with `SECURITY`; forgetting a guard is a red build.
      Also asserts no stale pins (a pin outliving its route exempts whatever is added at that path
      next), that every declared permission exists in the catalog, and that the three tiers account
      for every route.
      **Verified by planting an ungated route** on the health router: two assertions fired. Removed.

- [x] **T8 — Delete the two dead virtualenvs.** *(PM-23)* — **done 2026-08-17, 211 MB freed.**
      Confirmed dead before deleting rather than on the strength of the register: root `.venv` is
      `cpython-3.14.3-windows`, and `backend/.venv` declares 3.12.3 while its `bin/python` resolves
      to 3.14.4 and cannot `import fastapi`. Both untracked and gitignored (`git check-ignore -v`).
      `ONBOARDING.md` § 2 was an instruction to delete them, so it is now history rather than a step
      — rewritten, since a first-day instruction that no longer applies is worse than none.

---

## C. Deferred by design — do not "fix" early 🟡

Recorded so the reasoning survives. Each becomes correct at a specific trigger, and doing it before
that trigger is infrastructure serving no need — `CORE_EXTRACTION_PLAN.md` § 6.1.

- [~] **T9 — PM-44: rate-limit counters are per process.** *(seam extracted 2026-08-17; PM-44
      itself still open)* The counters are still a `dict[str, deque]` in one process, so at
      `gunicorn -w 4` a limit of 10 is still 40. **Nothing about that is fixed and the code now says
      so in as many words** — the risk of an interface like this is that it reads as a solution.
      What landed is the seam: a `RateLimitStore` Protocol, `SlidingWindowCounter` as the default
      implementation, and `RateLimitMiddleware(store=...)`. Closing PM-44 is now a new class and one
      argument in `main.py` instead of surgery on the middleware and the tier table.
      **Deliberately narrow, and it excludes a clock.** `hit(key, limit, window_seconds)` never takes
      a timestamp, so each implementation owns its own notion of time — this one uses
      `time.monotonic()`, which is per-process and meaningless between machines, and a Redis version
      must use wall-clock. An interface that passed `now` in would have frozen that mistake in place.
      The conformance suite doubles as the spec for a shared implementation: sliding log, a rejected
      request records nothing, `remaining` is the allowance after this request. And it proves the
      middleware **consults the store it was given** — a `store=` argument that were accepted and
      ignored would leave every test green until the day Redis was wired in.
      *No Redis dependency was added: none is installed, and adding infrastructure to serve no
      current need is exactly what § 6.1 defers.*

- [ ] **T10 — PM-44: no RBAC cache.** Every request re-reads roles and permissions. Already not an
      N+1 (`roles` and `role.permissions` are both `lazy="selectin"`; `session_service.touch` is
      throttled to one write per five minutes), so this is a latency optimisation with a real
      invalidation cost. Trigger: measured latency, or Redis arriving for T9.

- [ ] **T11 — PM-44: email sends synchronously in-request.** `SMTP_TIMEOUT_SECONDS` bounds the wait
      at 10s rather than removing it. Trigger: a queue existing, or invitation volume growing.

---

## D. Blocked outside this repo 🔒

These cannot be completed by writing code here. Listed so "all pending tasks" stays honest — the
work is in credentials, providers and one destructive migration, and each needs you.

- [!] **T12 — PM-28: Google SSO has never run against real Google.** The flow is implemented (signed
      `state`, code exchange, `email_verified` check, domain gate). `google_oauth_configured` is
      false, so the endpoints return 503. **Needs:** an OAuth client, then `GOOGLE_CLIENT_ID` /
      `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`. Until then, treat that code as untested.
      Blocks every internal-domain login, since staff addresses are refused credential registration.

- [!] **T13 — PM-27: no verified email transport.** Protocol proven, **deliverability is not** —
      auth, TLS handshake, SPF/DKIM/DMARC all unconfigured. **`MAIL_BACKEND=console` must never
      reach a deployed environment: it writes reset links into the log, and a reset link is a
      working credential for anyone who can read logs.** Needs an SMTP provider.

- [!] **T14 — PM-10: nothing alerts.** Logging is done and structured; there is no error-tracking
      service, no aggregation or dedup, no regression detection, and no log retention beyond
      container stdout. Needs a destination (Sentry or equivalent) before any of it is code.

- [!] **T15 — Rename `POSTGRES_DB=test_platformDB` and the compose network `test-platform`.**
      *(plan 5.5, PM-21's tail)* Fossils of the deleted scaffold that would follow the core into a
      second project. **Protected file + destructive:** compose needs containers stopped, the
      database rename is dump-and-restore. Needs an explicit go-ahead.

- [!] **T16 — Rotate the pre-rebuild credentials.** *(PM-1's one open remainder)* Passwords have
      been bcrypt-hashed since 2026-07-31, but anything that existed before the rebuild was readable
      at the time. Yours to rotate; no code change closes it.

---

## Not a defect — recorded so it is not "found" again

- **`STAFF_EMAIL_DOMAINS` defaults to `leapswitch.com`** (`core/config.py:194`). A deliberate
  deviation from `CORE_EXTRACTION_PLAN.md` 5.3, which wanted an empty default: empty silently
  disables the internal-account gate and would let a staff address self-register as external.
  `_SHIPPED_STAFF_DOMAINS` mirrors it so the production audit warns an installation that never
  changed it. **A second project must set it** — that is configuration, not debt.

---

## Verification, per task

No box is ticked on the strength of a diff. Every one runs:

```bash
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose run --rm --no-deps backend sh -c "pip install -q pytest ruff && python -m pytest -q && ruff check ."
docker compose run --rm backend alembic current      # only after a migration
```

Baseline at the time of writing: typecheck 0, lint 0, **745 passed / 4 skipped**, ruff clean.
`documentation/DAILY_CHANGES.md` is updated in the **same change** as the code it describes, per the
operating contract — not in a batch at the end.
