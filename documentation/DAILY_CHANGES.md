# Daily Changes

> One entry per task, newest day first. Written in plain business English — what changed and why it
> mattered, not which class was added. Lead with a **bold sentence** stating the change, then explain.
>
> Update this file as part of the same change as the code. A task that isn't here is invisible to the
> next person.

## August 7, 2026 — A second product was described, and it contradicts the one already planned

**The owner asked for "a Justdial, but only for our partners" — a directory where each partner lists
their own services and buyers find them.** That is not what `MARKETPLACE_DOMAIN_PLAN.md` models. That
document, scoped on 2026-07-31, has partners **reselling Leapswitch's** services at a discount tier
and building quotes for their own end customers. The new brief points trade in the opposite direction:
partners are suppliers of their own services, and Leapswitch convenes the market rather than stocking
it. Different core object, different revenue, different catalog owner.

**Written up as `planning/PARTNER_DIRECTORY_PLAN.md`** — research on what Justdial actually monetises
(the lead, not the listing, fanned out to four to seven competing providers), four comparable curated
partner directories, a listing-and-enquiry domain model, and the ten decisions the owner has to make.
Registered in `INDEX.md`, and `MARKETPLACE_DOMAIN_PLAN.md` now carries a banner pointing at the
conflict so nobody builds from it unaware.

**No decision was taken and no code was written.** The reconciliation § 0 recommends keeping
`partners`, `users.partner_id`, `partner_tiers` and the whole scoping design from the existing plan —
they are correct under either product — and shelving the quoting half.

**Two findings that outlive the brief.** First, a public directory breaks an assumption in the
existing scoping spec: every function there takes `actor: User`, but anonymous requests have no actor,
and the obvious fix (`if actor is None: return stmt`) would serve unfiltered rows to the internet.
`apply_scope` needs `Optional[User]` with the anonymous branch as the *most* restrictive, designed in
from the first line. Second, PM-27 (email) stops being a nice-to-have — an enquiry that never reaches
the partner is the entire value loop failing.

**Verified against the running system, not read from a register:** 11 tables, none of them marketplace
domain; 34 seeded permissions, none partner-related; zero matches for `partner_id` in `backend/app/`.
The domain is genuinely greenfield.

> **Side finding, unrelated to the brief:** `PLANNING.md` § 5.1 says the 14 LeapDesk parity permissions
> are "0 of 14" seeded. The database has **34** permissions today including `data-access-*`,
> `api-credential-*`, `api-provider-*`, `ai-assistant-*`, `search-entity-manage`, `user-email` and
> `settings-*`. That register is stale and the prerequisite it names is already met.

---

## August 7, 2026 — One list pipeline for every index, and a pagination bug it made visible

**Every index endpoint now has one place to get search, sorting and pagination right.** `app/core/query.py`
holds a `ListSpec` — a per-resource declaration of which columns may be sorted on, which are searched,
and which column breaks ties — plus `run_list()`, which applies all of it. `app/schemas/common.py` adds
a generic `Page[T]`, field-for-field identical to the `PaginatedUsers` it replaces, so no JSON changed
and no client broke.

**It found a live bug on its first use.** `list_users` sorted by `created_at` and stopped there.
`created_at` is not unique — a seeded batch, or two users created in one request, share a timestamp —
so the sort was partial and **a tying row could appear on two consecutive pages or on neither**. The
symptom would read as a data bug, not a pagination one. `activity_service.list_entries` already sorted
by `id` with a comment explaining exactly this hazard; users never got the same treatment. `ListSpec`
makes `tiebreak` a **required field**, so a resource cannot now be registered without one.

**The other thing it makes impossible.** The reference implementation we are porting from takes the
sort column straight off the query string — `$query->orderBy($request->input('sort_by'))`. `sortable`
is an allowlist and the only path to an ORDER BY, so an unrecognised name falls back to the default and
never reaches SQL. It falls back rather than 422-ing on purpose: a stale bookmark carrying a renamed
column should render the list, not an error.

**`list_users` lost 20 lines and gained nothing to remember.** Filters needing a join stay in the
service, where they are readable; only what is identical for every resource moved.

**Verified against the live database** — `docker compose run --rm backend`, five seeded users:

| Case | Result |
|---|---|
| Baseline | 5 rows, total 5 |
| `search='a'` | 5 rows |
| `sort_by=email&sort_order=asc` | correctly ordered |
| `sort_by=` `password; DROP TABLE users` | fell back to default — no error, no SQL |
| `per_page=99999` | clamped to 100 |
| Paged 2 at a time | 5 fetched, 5 unique, **stable** |

`export_openapi --check` reports the committed contract still matches, `/health` is 200, and the
reloader came back clean.

> **Not finished.** This is the first slice of `CORE_COMPLETION_PLAN.md` § 3. `activity_service` and
> `invitation_service` still hand-roll their own listings, and the CRUD base (§ 3.3) and the
> activity-logging and scoping hooks (§ 3.4) are not written. `ruff` could not be run — it is in
> `requirements-dev.txt`, which the dev image does not install, the same gap that keeps `pytest` from
> running locally.

---

## August 7, 2026 — The signed-in chrome is green, and it took the border system with it

**Every surface in the signed-in frame is now the brand's light green** — the page canvas, the left
navigation, the top header, and the module card. All of them use `surface-wash` (`#eaf0ef`), the teal
at 10% over white that the sign-in page and the branding form already sit on. No new colour entered
the palette; the existing one reached eight more surfaces. Dark mode is untouched throughout.

Done in three passes as the owner looked at each result: the module card first, then the sidebar and
header, then the page canvas behind them. The mobile drawer and mobile top bar were included without
being asked — leaving them white would have made the app change colour when you narrow the window.

**`surface-page` (`#f5f7fb`) is now referenced by nothing.** It was the blue-grey canvas the card used
to sit on. The token is still defined; no code renders it.

**What stayed white, on purpose.** The three-dot menu, the column picker, modals, the dashboard stat
tiles and every settings surface. This design has no shadows, so white-on-green is now the only thing
that says "this floats above". Popovers need that more than they need to match.

**A tint dark enough to read as green is dark enough to break small grey text.** The card header's
one-line description is 11px, which needs 4.5:1 to pass AA. `ink-muted` (`#6b7280`) measures 4.83:1
on white but only **4.19:1** on the new surface — a fail, and all three modules pass a description,
so it would have shipped on every module page. It now uses `ink-label` (`#59667a`), **5.05:1** on the
same surface. The reason is written next to the class so nobody quietly reverts it.

**Then the borders disappeared, and with them the card.** `surface-border` is `#e6edef`. Against
`#eaf0ef` that is **1.02:1** — not faint, *gone*. This design deliberately separates surfaces with
borders instead of shadows, so once the card and the canvas behind it were the same green, the card
had no edge, the table had no frame, and every divider in the sidebar vanished. Twenty-two hairlines
that sit on green moved to `border-brand/20`, which composites to a soft `#c2d5d2` and reads clearly.
The handful still on white — the column picker, modals, form inputs — kept `surface-border`, which is
correct there.

> **The durable fix is one line and was not taken.** Retinting `surface.border` in
> `tailwind.config.ts` would do in one token what 22 call sites now do by hand. That file is on the
> protected list, so it needs the owner's say-so.

**The table header got clearer for free.** It is `bg-brand/10`, a *translucent* fill, so on a white
card it landed on exactly `#eaf0ef` — the same value the card itself now is. Over green it composites
darker, giving the header a visible band it never had.

> **Pre-existing, untouched, worth knowing:** that header is translucent while being `sticky`, and no
> `<th>` carries an opaque fill, so rows show through it while the table scrolls. Unrelated to this
> change and unchanged by it — the bleed reads the same on either background.

**Grey stopped working the moment the surface stopped being white.** The sidebar's chrome buttons —
collapse, expand, mobile open and close — hovered to `bg-gray-100`, which on green reads as a dull
grey smudge rather than a highlight. They now hover to `bg-brand/10` like every other control in the
sidebar. Their icons were `text-gray-400`, **2.54:1 on white and 2.20:1 on green**, both under the
3:1 an interactive control needs; they are now `ink-muted` at **4.19:1**. That one was already broken
before today — the green just made it impossible to keep ignoring.

**Keyboard focus would have drawn a white halo.** Tailwind's ring offset defaults to white, and the
three focusable things in `TopNav` all use `ring-offset-2`. On a green header that is a visible white
gap between control and ring. They now carry `ring-offset-surface-wash` plus a `dark:` counterpart,
which also fixes the same halo in dark mode, where it was wrong already.

**Two real bugs surfaced in the collapsed sidebar rail and were fixed.** Both were pre-existing and
neither is caused by the colour change:

- **The active icon was invisible.** It was `bg-white/20 text-white` — a treatment that only makes
  sense on a dark sidebar. Over the old white surface that is white text on white. It is now
  `bg-brand text-white`, identical to the expanded nav item. Green would not have rescued it: 20%
  white over `surface-wash` is still near-white.
- **The pre-Viho orange was still in the tree.** `UI_PATTERNS.md` § Surfaces publishes a grep for
  `F97316` and says that if it ever returns a hit, "that is the defect". It returned a hit — as
  `rgba(249, 115, 22, 0.2)` in an inline `boxShadow` on the active icon's pulse ring. Now brand teal,
  matching the retint `pulse-ring` itself already received in `tailwind.config.ts`.

Inactive icons in that rail also lost their `bg-gray-100` tile, which `UI_PATTERNS.md` § Sidebar
Anatomy already forbade: "bare outline icon (never in a tinted tile)".

**Verified:** `tsc --noEmit` clean in the container, dev server recompiled with no warnings, `/sign-in`
still 200, and all four new utilities confirmed present in the served CSS with the expected values.
Contrast figures above are computed WCAG ratios, not estimates. ESLint could not be run — the project
has no ESLint config and `next lint` drops into its interactive setup prompt.

---

## August 7, 2026 — A one-line caching rule made the browser run yesterday's code for a year

**This is the actual cause of "I cannot sign in", after two wrong diagnoses.** One line in
`frontend/next.config.mjs`:

```js
source: "/:path*.(js|css|woff2|png|jpg|svg|ico)",
headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
```

**Correct in production, catastrophic in development, and applied to both.** `next build` emits
**content-hashed** filenames (`page-a1b2c3.js`), so there a changed file *is* a changed URL and
`immutable` is exactly right. `next dev` emits **stable** ones:
`/_next/static/chunks/app/dashboard/page.js` keeps that URL while its contents change on every edit. So
every dev chunk was cached for a year and marked **never revalidate**.

**The mechanism, confirmed rather than inferred.** `DashboardClient.tsx` was deleted in the 2026-08-06
dashboard restructure and **no current chunk defines it** — verified by extracting every module id defined
and required across all 17 chunks. A browser holding the previous day's `app/dashboard/page.js` still
calls `__webpack_require__("(app-pages-browser)/./app/dashboard/DashboardClient.tsx")`, finds no factory,
and throws precisely what was reported:

```
TypeError: Cannot read properties of undefined (reading 'call')
    at options.factory (webpack.js:715)
```

**Why the mix was possible at all:** `webpack.js` and `main-app.js` are served with `?v=<timestamp>`, so
those two were *always* fresh. Everything else was frozen. A current webpack runtime asking a
year-old chunk for modules is guaranteed to find gaps.

**Why it resisted every fix.** The stale copy was in the **browser**, so deleting the `.next` volume,
recreating the container and rebuilding from scratch could not touch it. Meanwhile the server side was
provably healthy the whole time and kept saying so: `/dashboard` returned **200**, its RSC payload
returned 200, all 11 referenced chunks returned 200, the on-disk chunk set had **0**
required-but-undefined modules, an import-cycle scan of all 105 files found **0**, `tsc` was clean and
`next build` compiled every route. Every server-side signal was green while the browser was broken.

**The fix splits one rule into two, both conditional on `NODE_ENV`:**

| Assets | Production | Development |
|---|---|---|
| `/_next/static/*` (hashed) | `max-age=31536000, immutable` | `no-store, must-revalidate` |
| `public/` files (**not** hashed) | `max-age=86400, stale-while-revalidate=604800` | `no-store, must-revalidate` |

**The second row fixes a latent production bug too.** `public/` filenames survive deploys — `/logo.svg`
is `/logo.svg` forever — so `immutable` meant a replaced logo would have been unreachable until each
visitor cleared their cache. `BrandMark`'s comment claimed changing it "requires a deploy, which changes
the build", but a deploy does not change that *URL*. Uploaded brand assets were always safe: the API
serves them with `?v=<epoch>`.

**Verified in both modes.** Development: dev chunks and `/logo.svg` both `no-store, must-revalidate`;
`/sign-in` and `/dashboard` 200 on a from-scratch build. Production via `next start`: hashed chunk
`immutable`, `/logo.svg` `max-age=86400, stale-while-revalidate=604800`, pages on Next's own
`s-maxage=300`. All five security headers still present on pages — the rewrite left them untouched.

> ⚠️ **`next.config.mjs` is a protected file.** Edited because it was the direct cause of a blocker
> reported three times. The rewrite is documented in a header comment in the file itself, so the next
> person to consider a blanket `immutable` rule reads the story first.

**Anyone still seeing the error must clear their browser cache once** — `immutable` entries already stored
will not be revalidated on a normal reload. DevTools → Application → Storage → Clear site data for
`localhost:3001`, or a hard reload. New entries carry `no-store`, so this is a one-time cost.

### Two corrections

**The React 19 → 18 downgrade earlier today did not fix this.** PM-25 was a real defect and closing it was
correct — `npm ls` reported `react@19.2.4 invalid` and `npm ci` genuinely failed — but the runtime error
it was blamed for had a different cause, and the error persisted unchanged after the downgrade. The
version pairing was a real latent problem found while chasing this one. **The stack stays on React 18.3.1**
regardless: it is the supported pairing for Next 14 and the change cost nothing.

**The stale-bundle diagnosis earlier today was right about the mechanism and wrong about the remedy.**
Clearing the `.next` volume was recommended; it cannot work, because the stale copy was never in the
volume. The ONBOARDING § 9 rows written this morning have been corrected accordingly.

---

## August 7, 2026 — PM-25 closed: React 19 on Next 14 finally broke (revised — it did not break sign-in)

**The version mismatch filed as a build-tooling annoyance was the thing stopping anyone signing in.**
`TECH_DEBT` had said of PM-25: *"the combination happens to work at runtime, it is simply unsupported."*
That is no longer true, and the failure was not subtle:

```
TypeError: Cannot read properties of undefined (reading 'call')
    at options.factory (webpack.js)
```

thrown from a `<Lazy>` inside Next's own `layout-router`, crashing `NotFoundErrorBoundary` and every
route beneath it. **The application contains no `next/dynamic` and no `React.lazy`** — that `<Lazy>` is
framework-internal, so this was the App Router's client runtime failing against a React it does not
support. `npm ls` had been saying so all along: `react@19.2.4 invalid: "^18.2.0" from node_modules/next`,
exit code `ELSPROBLEMS`.

**Resolved by downgrading React and React DOM to 18.3.1** — inside `next@14.2.35`'s declared peer range.
This was the second of PM-25's three recorded options, and it was the minimal one. Next 15 would have
made React 19 legitimate, but it is a major migration with its own breaking changes — async
`cookies()`/`headers()`/`params`, changed caching defaults — and that is not something to attempt inside a
bug fix while sign-in is down. It remains available as its own piece of work.

**It cost zero code changes,** which is the strongest evidence the downgrade was the right size of fix. The
codebase uses no React 19-only API: no `useActionState`, `useFormStatus`, `useOptimistic` or `use()`.
`forwardRef` appears in three components and behaves identically on 18. `@types/react` and
`@types/react-dom` moved to `^18` so the types match the runtime.

**`npm ci` now resolves with no `--legacy-peer-deps` at all** — the original PM-25 symptom, closed as a
side effect. The flag is still in `Dockerfile.dev` and CI; it is now inert, and worth deleting precisely
because a flag that silences nothing today will silence the next genuine `ERESOLVE`.

**Verification.** `npm ls react react-dom` → **0** invalid peer markers · strict resolve (no flag) clean ·
`tsc --noEmit` clean · `next build` compiles all 20 routes · `npm run lint` **17 errors, unchanged** ·
`/sign-in` and `/dashboard` both **200** on a from-scratch build, React 18.3.1 confirmed in the container.

**Six documents corrected**, because the stack line was wrong in most of them: `NEXTJS_STANDARDS.md` (its
*title* said React 19, as did the § 1 "verified stack"), `ONBOARDING.md` § 6 and § 9, `ARCHITECTURE.md`,
`VERSION_SUMMARY.md`, `CORE_HARDENING_PLAN.md`, `TECH_DEBT.md`, plus a stray line in
`design/VIHO_THEME_REFERENCE.md`.

**The lesson worth keeping: "unsupported but working" is a countdown, not a state.** PM-25 sat at 🟠 for a
week with a note explaining why it had not bitten yet. Two things had to be reconsidered when it did —
that it was a *build* problem (it was a runtime one) and that it *gated PM-30* (it never did; those lint
errors come from `eslint-config-next@16` judging a Next 14 codebase, which the React version does not
touch).

---

## August 7, 2026 — "Cannot sign in as root" was a stale browser bundle, not an auth failure

**Root's sign-in was working the whole time.** `activity_logs` recorded `Root User logged in` from a real
browser at 05:42:47, and the account checked out clean: `ACTIVE`, password set, **0 failed attempts**,
not locked, role `RootUser`. There is not one failed-login row for it. So the password was right and the
backend accepted it — the app just refused to show anything afterwards, which is indistinguishable from
"I cannot sign in" from the outside.

**What actually broke: the browser was running a client bundle built before PM-40 versioned the API.**
It called `GET /api/auth/me` — no `/v1` — and got a 404. No source file contains that path; the axios
`baseURL` is `${API_BASE_URL}${API_PREFIX}`, and the freshly compiled chunks had 16 references to
`/api/v1` and **zero** to the unversioned path. So `/auth/me` failed, `AuthInitializer` never received a
user, and it redirected straight back to `/sign-in`.

**The hydration error in the same trace had the same single cause** — `Server: "" Client: "PM"`. The
current `BrandMark` always renders `<img src="/logo.svg">`, so the badge span holds **no text**; an old
client chunk predating `APP_LOGO` fell through to the monogram `"PM"`. Two correct renders from two
different builds. Confirmed by rebuilding: the server now emits
`<span …><img src="/logo.svg" alt="Partner Marketplace"…/></span>` and the client bundle carries the same
eight `logo.svg` references.

**Three details made this diagnosable, and each is worth remembering.** The stack trace pointed at
`authApi.ts:134` where `me` now sits at **136** — a stale sourcemap. The dev server had logged
`⚠ Fast Refresh had to perform a full reload` and a 404 for a `webpack.hot-update.json` it no longer had.
And the on-disk bundle disagreed with the request the browser made, which is only possible across builds.

**Fixed by deleting the `.next` volume, not the host directory.** `docker compose stop frontend`,
`rm -f frontend`, `docker volume rm partnermarketplace_frontend_next`, `up -d frontend`. The container
never reads `frontend/.next` on the host, so clearing that does nothing — a genuinely misleading dead end.

**Verified after the rebuild**, with a throwaway account (created, measured, deleted):
`POST /api/v1/auth/login` → `GET /api/v1/auth/me` **200** with roles and permissions resolved, while
`GET /api/auth/me` correctly stays **404**. Zero unversioned references in the fresh bundle.

**Three new rows in ONBOARDING § 9**, because anyone who pulls the API-versioning and branding work hits
this on their first page load, and both symptoms point away from the cause.

---

## August 7, 2026 — "Keep me signed in" is verified end to end, and it really does mean 30 days

**Confirmed against the running stack what yesterday could only claim.** The work was finished on
2026-08-06 but the end-to-end check never ran, so the feature sat in the repository as *implemented and
unproven* — which is indistinguishable from broken until someone looks. Measured today:

| Sign-in | Refresh cookie `Max-Age` | Session row lifetime |
|---|---|---|
| `remember_me: true` | 2,591,999 s | **30 days** |
| `remember_me: false` | 604,799 s | 7 days |
| Field omitted entirely | 604,799 s | 7 days |

The refresh token inside the cookie carries a matching 30-day `exp` — checked by decoding it, because a
30-day cookie holding a 7-day token is the worst combination available: the session is alive, the cookie
is present, and the token in it is refused, so the user is signed out while every piece of state says
they should not be.

**A refresh does not slide the window forward.** Refreshing the 30-day session re-issued cookies with
2,591,981 seconds left — thirty days *minus the eighteen seconds that had passed*, not a fresh thirty.
`user_sessions.expires_at` is the single authority on when a session dies, so a session someone keeps
touching still expires on schedule. A sliding window would mean an active session never expires at all.

**Done with a throwaway account, which was then deleted** along with its three sessions. No real user's
sessions were touched.

**Twelve regression tests now cover it** — `backend/tests/test_session_lifetime.py`. They read no
database (the three functions are pure), so they run in the default suite rather than behind the `db`
marker. One of them asserts `REMEMBER_ME_DAYS > REFRESH_TOKEN_EXPIRE_DAYS`: it guards the *configuration*
rather than the code, because setting them equal leaves every other test passing while the feature
silently does nothing. Two assert the default is the **short** session — from `LoginRequest` and from
`TwoFactorChallengeRequest` separately — since too-long is the silent failure. Too-short gets reported by
an annoyed user, which is exactly how this whole thread started.

**The backend test command is now written down** (ONBOARDING § 8). It was not, and reconstructing it
today cost real time: `pytest` and `ruff` are in `requirements-dev.txt`, which the image deliberately
omits, and the `backend/.venv` on this machine is Python **3.14** — which cannot install the pinned
dependencies at all. Undocumented tooling is tooling that stops being run.

**Verification.** **254 tests** passed, 4 skipped (was 241) · `ruff check .` clean.

### Start here next

1. **Commit.** Everything below is uncommitted, including two generated files that `codegen:check`
   *requires* to be committed or it fails by design: `backend/openapi.json` and
   `frontend/types/api.d.ts`.
2. **Check `backend/app/db/migrations/env.py` before you commit it.** An uncommitted change it held was
   destroyed on 2026-08-06 by a `git checkout --` used to undo a `ruff --fix` reordering. Unrecoverable;
   review the file rather than assuming it is as you left it.
3. **`frontend/app/dashboard/DashboardClient.tsx` is staged as deleted while `DashboardHome.tsx` is
   untracked** — a rename that is half-staged. Stage both or neither.
4. **Then the task list.** One item is still waiting on an owner decision and blocks three others: the
   deployment topology (DEPLOYMENT § 1 — it gates Redis-backed state, production artefacts and log
   shipping). *PM-25 was the other one; it settled itself later the same day — see the entry above.* The
   next thing that needs nobody else is **PM-11**: RBAC enforcement across the routes, a login round trip,
   and migrations — the three things a deploy most needs proven and the ones 254 tests still do not cover.

---

## August 6, 2026 — Users were being signed out every hour, and "Remember me" was a decorative checkbox

**Reported from real use: "how many times do I have to login — every time I sign in I click remember me
and still after some time I need to sign in again."** Two separate faults, one visible symptom.

**Fault one: the edge middleware bounced valid sessions.** It checked `access_token` alone, and that
cookie carries `Max-Age=3600` — so **the browser deletes it after an hour**. The refresh token lives for
seven days but is deliberately path-scoped to `/api/v1/auth/refresh`, so a page request never carries it
and the middleware could not see it. An hour after signing in, opening any page redirected to `/sign-in`
**before any JavaScript ran** — so the axios interceptor that would have refreshed the session silently
never got the chance. The refresh mechanism was correct, tested, and unreachable.

**The database said so plainly:** 77 un-revoked sessions, every one still inside its seven days, and
**only 4 ever refreshed**. 73 sessions used for zero minutes each. Users were signing in over and over,
each time creating another session that was abandoned an hour later.

**The fix is a hint cookie, not a credential.** The backend now also sets `session_active` — same
lifetime as the refresh token, scoped to `/` so the middleware can see it. It holds `"1"`. No user id, no
signature, nothing to forge that gains anything: forging it yields a page shell the client immediately
bounces, which is what a signed-out visitor sees anyway. A missing access token now means *"probably
needs a refresh"* rather than *"logged out"*, and only when **both** cookies are absent is the visitor
actually sent to sign in. Authorization was never here and still is not — every protected route is
enforced by the backend guards, which re-check the session row on every request.

Verified in all three states: no cookies → 307 to `/sign-in` · `session_active` only → 200 ·
access token only → 200. Logout clears all three cookies.

**Fault two: the checkbox had never been wired to anything.** The form posted no such field and the
backend had never heard of one, so every session lasted seven days whether or not the box was ticked.
`REMEMBER_ME_DAYS` (30) now flows through `session_service.create(lifetime_days=…)`, and the cookie
lifetimes and the refresh token's own `exp` are all derived from `session.expires_at` — one authority, so
nothing has to remember which kind of session it was.

**Threaded through the 2FA path too**, which is the one that would have been forgotten: for a 2FA user
the session is created at `/two-factor-challenge`, two requests after the box was ticked, so the choice
has to be carried through the challenge or it is lost for exactly the users most likely to care.

**The label was renamed "Remember Password" → "Keep me signed in".** It never remembered a password, and
saying so invited people to expect their credentials to be filled in.

---

## August 6, 2026 — The API contract is generated and asserted, and it found a live bug immediately

**PM-42 closed.** `frontend/types/index.ts` mirrored `backend/app/schemas/` with **nothing connecting
them**, so a renamed backend field produced a `tsc`-clean frontend that read `undefined` at runtime.
Types that agree by convention give the *appearance* of an enforced contract, which is worse than none
because it stops anyone checking.

**Three layers, each catching drift on its own.** Verified by injecting a real backend change and
confirming all three failed independently, then reverting:

| Layer | Catches |
|---|---|
| `python -m app.tools.export_openapi --check` | The committed `backend/openapi.json` no longer matches the routes |
| `npm run codegen:check` | `types/api.d.ts` is stale against the spec, **or is not committed** |
| `types/api-contract.ts` + `tsc` | The hand-written types disagree with the generated ones |

**The spec is exported statically, not fetched from a running server.** `app.openapi()` builds it from
the route definitions, so CI regenerates and compares **without standing up Postgres**, and generation
stays reproducible from a checkout alone. A build that reaches for a running backend fails on a laptop
with the stack down and — worse — silently generates types from whatever version happens to be running.

**The hand-written types were kept, not replaced.** `openapi-typescript` generates from Pydantic, which
types several fields more loosely than the UI wants: `account_type` is `string` there and
`"staff" | "partner"` here, because the column is a SQLAlchemy `Enum` serialised as `str`. Replacing
them wholesale would discard every narrowing and every exhaustive `switch`. So the contract file asserts
**key-set equality in both directions** instead, plus one-way assignability for the narrowed fields.

Both directions matter. A **removed** field is the obvious case; an **added** one is usually missed, and
without that assertion it stays invisible to the frontend forever — which is how a feature ships
half-wired. The assertions return a tuple **naming the offending key** rather than `false`, because
`Type 'false' does not satisfy the constraint 'true'` tells you nothing.

**The bug it found on its first run.** `CurrentUser.two_factor_enabled` was declared in the frontend
and **`/auth/me` never sent it** — `CurrentUserResponse` omitted it while `UserListItem` had it.
Anything reading it off the current user got `undefined`. Fixed on the backend rather than by deleting
the field, because the model property's docstring says it is named for direct serialisation by schemas,
so the omission was accidental. **This had existed unnoticed; the guard found it in under a minute.**

**A flaw in the guard, found by testing the guard.** The first `codegen:check` was
`npm run codegen:api && git diff --exit-code -- types/api.d.ts`. **`git diff` is blind to an untracked
file**, so while `api.d.ts` was new the check passed unconditionally — a guard reporting success
without checking anything, in exactly the state it shipped in. Now `git ls-files --error-unmatch`
catches "not committed" and `git diff` catches "stale", as two conditions with distinct messages. It
stays tolerant of *staged but not yet committed* so it does not block someone mid-commit.

**⚠️ Two generated files must be committed:** `backend/openapi.json` and `frontend/types/api.d.ts`.
Neither is gitignored (checked). If they are not committed, `codegen:check` fails by design.

**When adding a response type, add a line to `types/api-contract.ts`.** The guard only covers what it
is pointed at — currently `CurrentUser`, `ManagedUser`, `RoleSummary` and `Branding`.

**Verification.** `ruff` clean · **241 tests** · `tsc` clean · `next build` compiles · lint **18
errors, 0 warnings** · `export_openapi --check` matches · 64 operations across 50 paths.

---

## August 6, 2026 — Documentation swept: every claim now matches the running code

**The docs had drifted from the code in about a dozen places, and I had made 190 lines of it worse the
same day by versioning the API.** Swept.

**110 API paths versioned across 13 current-state docs** — `/api/…` → `/api/v1/…`. Done with a regex
carrying two guards, both tested against samples first: `backend/app/api/auth.py` is a **file path**,
not a URL, and `/api/v1/…` must not become `/api/v1/api/v1/…`. Verified afterwards that no file path
was mangled and nothing was double-prefixed.

**Three categories of document, treated differently — this was the main judgment call:**

| Category | Files | Treatment |
|---|---|---|
| **Current state** | `core/*`, `system-design/*`, `ONBOARDING`, `VERSION_SUMMARY`, two planning specs | **Swept.** 110 paths |
| **Historical record** | `DAILY_CHANGES.md` (30 refs), `TECH_DEBT.md` (15) | **Left alone**, note added |
| **Dead inherited** | `architecture.md`, `phases.md`, `planning.md`, `instruction.md` | **Left alone** |

**Rewriting history would have been the wrong fix.** `DAILY_CHANGES` is a dated log and `TECH_DEBT`'s
resolved entries are records of what was true then — editing them to say `/api/v1` would make the log
unreliable for exactly the question it exists to answer. Both now carry a note saying paths in dated
entries are as-of-that-date. The four inherited docs were skipped because `INDEX.md` already marks them
untrustworthy; adding a to-do list to a document scheduled for deletion is negative value.

**Stale sections rewritten:**

- **`DATABASE_MIGRATIONS` § 2 was eleven revisions behind** — the worst of them. It claimed 8 revisions
  with head `e7b41c9a2d10`; there are **19** and head is **`d8c31f60a927`**. Anyone comparing
  `alembic current` against it concludes their database is ahead of the code. Regenerated from
  `alembic history`, and it now records which revisions are **not reversible** (`e7b41c9a2d10` and
  `c1e70a5d94b2` both raise `NotImplementedError`), so nobody discovers that during an incident. Its
  § 1 `env.py` snippet also listed **8 deleted models**; § 6's template pointed `Revises` at a
  mid-chain revision.
- **`FASTAPI_STANDARDS` § 12 was stale in 9 of 10 rows** — every anti-pattern named code that no longer
  exists, inverting "don't copy this" into a list of fixed problems presented as current. Replaced with
  the four that are genuinely live (reading `permission_names` instead of `has_permission`, filtering on
  a Python property, post-filtering a paginated query, `profile_photo_path` as a dead column) plus two
  load-bearing conventions that look like tidying opportunities. § 7 still said there was no rollback
  wrapper, which PM-38 changed hours earlier.
- **`NEXTJS_STANDARDS` was stale in more places than catalogued** — § 5's module table (5 of 6 rows),
  § 13 (5 of 7), and also § 1's folder tree, § 3's file conventions claiming error/loading boundaries
  are "not currently used anywhere" when eight exist, § 3's root-layout snippet still on Inter, and a
  code example calling `authApi.adminLogin`, which does not exist.
- **`DEPLOYMENT`** § 7 said passwords were plaintext — the single most misleading line left in the
  deployment docs. § 0 blocker 1 claimed there was no structured logging; blocker 2 said 74 tests; a
  "closed" row still said per-IP rate limiting did not exist.
- **`ARCHITECTURE`** — 9 spots, including a routing table listing `/dashboard/candidates` and three
  deleted API modules.

**One real bug found in a runbook:** § 6's smoke test curled `/api/v1/auth/whoami`, an endpoint removed
in the account merge. It would return **404**, pass as "not 200", and prove nothing about
authentication. Now hits `/auth/me` (expect 401) plus a public branding check (expect 200).

**Verified by comparing claims against the running system**, not by reading: docs say head
`d8c31f60a927` / alembic says `d8c31f60a927` · docs say 19 revisions / 19 files · docs say 241 tests /
pytest says 241 passed · no unversioned API path left in any current-state section.

The `## Pending` sections keep their *Documentation accuracy* items, annotated as cleared rather than
deleted — the record of what drifted is more useful than a clean list, and all of it accumulated in
under two weeks while the code was being actively improved.

---

> **⚠️ API paths in dated entries are as they were on that date.** All routes moved from
> `/api/…` to `/api/v1/…` on **2026-08-06** (PM-40). Entries written before that say
> `/api/…` and have deliberately **not** been rewritten — this is a record of what was
> true when it was written, and editing it would make the log unreliable for exactly the
> question it exists to answer. For current paths, read the `core/` and `system-design/`
> docs, which were swept.

---

## August 6, 2026 — SVG upload is supported, and the real logo ships as the default

**The owner supplied `logo/` — master SVG, 1024px PNG, favicon PNG and ICO — and asked for
SVG in the branding module. Phase 4 had rejected SVG outright. That decision is reversed,
implemented safely rather than by widening the allowlist.**

**Why it was rejected, and what changed.** The original reasoning holds: an SVG is a
*document*, not a bitmap. It can carry `<script>`, event handlers and external references,
and served from our own origin a malicious one is stored XSS in the single asset shown on
every page including the login screen.

What the first pass missed is an asymmetry. An SVG rendered through `<img src>` — which is
how every consumer here uses it — **cannot execute script in any current browser**. An SVG
*navigated to directly* is a top-level document on our origin and **can**. So the exposure
is someone opening the asset URL, not the application rendering it. Two independent
controls close that, and both are applied because either alone is one mistake from failing:

1. **Refused on upload, not sanitised.** Rejecting beats stripping — silently rewriting
   somebody's logo hands back a file they did not upload, and a half-stripped SVG fails in
   ways nobody can debug from the rendered result. Refused: `<script>`, `<foreignObject>`,
   `<iframe>`, `<embed>`, `<object>`, `<set>`/`<animate>` (SMIL can fire on load and set
   `href`), `<!DOCTYPE>`/`<!ENTITY>` (XXE, billion laughs), `javascript:` and
   `data:text/html`, `@import`, **any** `on…=` attribute, and any `href`/`src` that is not
   a `#fragment`.
2. **A hard `Content-Security-Policy` on the serve response** —
   `default-src 'none'; style-src 'unsafe-inline'; sandbox` — so a file that somehow got
   past control 1 executes nothing. `sandbox` also drops it into an opaque origin.

**Detection is structural, not a magic-byte check**, because SVG is XML. `<svg` must be the
**root** element, behind at most a BOM, XML declaration or comments — so an HTML page
containing an inline SVG is *not* an SVG, which matters because that is a navigable document.

**Verified: 11 attack payloads, all refused** — inline script, `onload` on the root,
`onmouseover` on a child, `foreignObject`, `javascript:` href, external `<use>`, an external
`<image>` beacon, billion-laughs entity expansion, SMIL `<animate>` rewriting `href`, CSS
`@import`, and an HTML page disguising an inline SVG. Each is a named test case, so a
failure says which attack got through. The suite also asserts **the project's own logo is
accepted**, guarding against tightening the rules until they reject our own artwork.

**The artwork is now the bundled default**, so the app ships branded rather than showing a
letter: `logo/logo-master.svg` → `public/logo.svg` (445 bytes), `logo/favicon.ico` →
`public/favicon.ico` (replacing the 25 KB inherited one), `logo/favicon-32.png` →
`public/icon-32.png`. `logo-candidates.png` (215 KB contact sheet) is deliberately not
shipped. `BrandMark` now falls back in **three** steps — uploaded → `NEXT_PUBLIC_APP_LOGO`
(default `/logo.svg`) → monogram — and every step is a complete answer, so a project
reusing this core sets `NEXT_PUBLIC_APP_LOGO=""` and gets the letter badge back.

**⚠️ Worth knowing: the logo's teal is not the brand token, and should not become it.**
`#2f8a78` gives white-on-it **4.18:1**; the brand token `#24695c` gives 6.46:1. The logo's
shade is **fine as a mark** — WCAG's non-text threshold is 3.0:1 — but it would **fail** as
`--brand`, where white button labels need 4.5:1. The two teals differing is correct, not a
mismatch to fix by adopting the logo's shade.

**Verification.** `ruff` clean · **241 tests passed** (217 before) · `tsc` clean ·
`next build` compiles · lint still **18 errors, 0 warnings** · the real SVG uploaded and
served byte-identical with the CSP, `nosniff` and a version-keyed ETag · `/logo.svg` 200
(445 bytes, `image/svg+xml`) · `/favicon.ico` 200 (2089 bytes) · `/brand/favicon` falls back
to the new icon.

Two earlier tests correctly failed once SVG became valid — they listed it as an
unrecognised format — and were updated as stale expectations, not loosened.

**The database copy of the logo was cleared afterwards.** The bundled default already serves
the same artwork on every surface, so storing it twice would be redundant; the upload slot is
left empty and available.

---

## August 6, 2026 — The API is versioned, the purge command exists, and a role label stops lying

**Three items closed: PM-40, PM-43, and the Navbar bug the branding work uncovered.**

**PM-40 — every route now answers under `/api/v1`.** `settings.API_PREFIX` drives all 9 routers. **No
unversioned alias**, because nothing was pinned — the OpenAPI stays clean. `/health` and `/health/ready`
stay unversioned deliberately: a liveness probe should not need to know the API's contract version.

On the frontend the version went into `axiosInstance`'s `baseURL`, so the **57** paths across five
`lib/api` modules are written relative to it — `"/auth/login"`, not `"/api/v1/auth/login"`. A v2 is one
constant instead of 57 edits.

**Three places keyed on the literal path, and each would have broken silently.** The routes moving was
the easy part:

- **The refresh cookie's `Path`.** `_REFRESH_PATH = "/api/auth/refresh"` scopes the refresh cookie so it
  is never sent on ordinary requests. Left as a literal, the cookie would have been scoped to a path
  that no longer exists — the browser would never send it, and **the symptom is every session dying an
  hour after sign-in**, which points nowhere near a path constant. Verified by constructing the response
  and reading `Path=/api/v1/auth/refresh` off the `Set-Cookie`.
- **The rate limiter's tiering** — 14 absolute paths plus a `startswith("/api/auth")` test. Stale, every
  credential endpoint would silently fall from the `sensitive` tier (10/min) to `default` (300/min):
  rate limiting that looks present and is thirty times weaker. Re-verified: login 10, `/auth/me` 60,
  `/navigation` 300.
- **The interceptor's own guards**, which test `original.url` for `/auth/refresh` and `/auth/logout` to
  avoid recursing on the refresh call. That URL is now relative, so a check for the old absolute path
  would never match and a dead session would loop instead of failing.

A script cross-checked **all 43 distinct frontend API paths against the live OpenAPI document** — every
one resolves to a real versioned endpoint. That is what makes 57 mechanical edits trustworthy.
`/api/revalidate-branding` was deliberately **not** versioned: it is a Next route handler served by the
frontend, not the backend.

**PM-43 — `python -m app.db.maintenance`.** Two careful purge functions had no caller, so `user_sessions`
grew by one row per sign-in forever. A command, not a scheduler — meant for a cron line.

**Sessions and the audit trail are treated differently, and that asymmetry is the design.** Expired
sessions are *expired*, so clearing them at 30 days runs by default. Trimming the audit log requires
`--activity` **explicitly**: retention is a policy decision, and deleting evidence should be an
instruction rather than something a cron line does because a default said so. `--dry-run` previews, and
the count and the delete share one cutoff helper so a dry run cannot disagree with the delete it
precedes. Verified: dry run reported 0 sessions / 73 audit rows; `--activity-days 0` was **refused**
rather than read as "everything"; `--sessions-only` overrides `--activity`, resolving a contradictory
invocation toward deleting less.

**The Navbar was lying about roles in three places, not one.** The branding pass found a hardcoded
`"Super Admin"` subtitle; fixing it surfaced two more — a `{displayName || "Super Admin"}` fallback that
invented a role for anyone without a full name, and a mobile-menu heading that told **every** user they
were a super admin. A Partner opening that menu was shown "Super Admin". Now: the brand block uses
`chrome_subtitle` (matching the sidebar), the fallback is gone (`getUserDisplayName` already falls back
to the email), and the menu heading uses the existing `getRoleLabel(user)` — rendered only when there is
something to say.

**Verification.** `ruff` clean · **217 tests passed** (197 before) · `tsc --noEmit` clean · `next build`
compiles · lint still **18 errors, 0 warnings** — the PM-30 baseline · `/api/v1/settings/branding` 200,
old `/api/settings/branding` 404, `/health` 200 · all three rate-limit tiers correct · the rendered
sign-in page still branded, so the server-side fetch found the versioned endpoint.

**Next up is PM-25** — the React/Next version decision. It is a decision rather than a task, `npm ci`
fails until it is made, and it gates both PM-30 and PM-41. **PM-42 (OpenAPI → TypeScript codegen) moved
ahead of PM-41** in the plan: PM-40 just unblocked it, it is a fraction of the size, and doing it first
means the eventual data-layer rewrite is typed against a generated contract rather than a hand-copied one.

---

## August 6, 2026 — Branding is complete: eight themes, logo and favicon upload

**Phases 3 and 4 of [`planning/DYNAMIC_BRANDING_PLAN.md`](./planning/DYNAMIC_BRANDING_PLAN.md) are
done, so all four are.** A project built on this core is now rebranded end to end —
name, monogram, tagline, brand colour, logo and favicon — with no code change.

**Theme presets.** `tailwind.config.ts`'s brand literals became CSS custom properties, with the
**complete default theme in `globals.css`** — byte-for-byte Viho's teal, so nothing changed visually
and all 261 `brand` call sites kept working untouched. Keeping a full default in CSS matters: the app
is styled with no JavaScript and no API call, so a failed fetch degrades to the default theme rather
than an unstyled page.

The channels are **space-separated RGB, never hex** — that is what makes Tailwind's `<alpha-value>`
work, and **12 opacity variants are in use** (`bg-brand/[.04]` through `bg-brand/70`). A hex there
would make every one of them silently render opaque. Verified in the compiled CSS.

**Eight presets, and the colour space is closed on purpose.** `UI_PATTERNS.md` records
`brand-on-dark` as a 🔴 mandatory rule because the failure already shipped once — auth-screen links
unreadable in dark mode. A colour picker cannot honour that, so `core/theme.py` is the only place a
theme may be defined, each ships both halves, and **67 tests enforce AA on both axes**: Teal
(default), Indigo, Azure, Plum, Crimson, Forest, Bronze, Graphite. Every one clears 6.4:1 for white
label text and 7.0:1 for dark-mode brand text.

**Logo and favicon upload**, stored as `bytea` — two rows of ~50 KB that change once a project, no new
infrastructure, included in the database backup. `core/images.py` is the **first upload validation in
the codebase**, so it is written as the pattern everything later copies and tested as a security
boundary (32 tests): the type comes from **magic bytes** not `Content-Type`; **SVG is rejected**
(a document that can carry `<script>`, served from our origin — stored XSS on every page); size is
capped **before the body is fully read**; and dimensions are capped **independently of size**, because
a 30,000 × 30,000 PNG is under 1 KB and passes any byte check.

**Four bugs found by verifying rather than assuming:**

- **`ETag` without `If-None-Match` handling.** Starlette does not do conditional requests for you. The
  first version returned a correct `ETag` and answered every conditional request with a full 200 —
  which looks right until you measure it. Now handles lists, the `W/` weak prefix and `*`.
- **`app/favicon.ico/route.ts` fails the build.** Next 14 treats that name as the metadata convention
  even as a *directory*. The handler moved to `/brand/favicon`; `public/favicon.ico` answers the bare
  path. A `next.config.mjs` rewrite cannot express "uploaded, else default" either.
- **A redirect built from `request.url` emitted `http://0.0.0.0:3001`** — the container's bind address,
  which curl follows and a browser cannot reach. Now a relative `Location`.
- **Route order:** `/branding/{asset}` before `/branding/themes` made the catalog answer **422**.

**A pre-existing 500-instead-of-422 bug this feature exposed.** A `field_validator` raising
`ValueError` made `main.py`'s 422 handler crash: Pydantic v2 puts the exception *object* in `ctx` and
`json.dumps` cannot serialise it, so the caller got a generic 500 instead of the message explaining
what was wrong. **Every schema with a custom validator was affected.** Fixed, and now covered by
`tests/test_validation_error_serialisation.py`.

**The cache defect worth knowing about.** `getBranding` caches for 300 s — which is what keeps 16
routes prerendered — so a save landed in the database *and the audit log* while the page visibly did
not change. `router.refresh()` does not help; it reuses the cached fetch. Fixed with
`POST /api/revalidate-branding` calling `revalidateTag("branding")`.

| Check | Result |
|---|---|
| Page static/dynamic split | **16 / 3** — unchanged; the two new route handlers are 0 B and not pages |
| New react-hooks lint errors | **0.** Still 18 errors, **0 warnings** — the PM-30 baseline |
| Backend suite | **197 passed** (74 at the start of the day) |
| `ruff`, `tsc --noEmit`, `next build` | Clean |
| Theme switch, live | indigo + revalidate → `--brand:77 84 182` in the rendered `<head>`, no restart |
| Asset serve | Bytes byte-identical; correct `Content-Type`, `ETag`, `nosniff` |
| Conditional requests | matching / `W/` / list / `*` → **304**; stale / absent → **200** |
| Favicon, none uploaded | `307 → /favicon.ico` → the bundled default |

**Verified by real use, not just by me:** the audit trail records `Root User updated the application
branding` with a full before/after diff including `theme_preset: crimson → teal` — so super-admin
gating, password confirmation and the audit diff were all exercised through the UI with a real login.

**⚠️ `tailwind.config.ts` was edited** (a protected file), as agreed. `next.config.mjs` was **not** —
the favicon handler was designed to avoid needing it.

**Still open:** `Navbar.tsx` renders a hardcoded `"Super Admin"` where the sidebar renders
`chrome_subtitle` — a *role* label shown to every user regardless of role. Pre-existing, and left
rather than guessed at: it needs a decision. Also, clients that request `/favicon.ico` directly rather
than reading the `<link>` tag get the bundled default; closing that needs a proxy rule, which belongs
with the deployment topology.

---

## August 6, 2026 — Project identity is configurable: the core can now be reused by renaming it

**Phases 1 and 2 of [`planning/DYNAMIC_BRANDING_PLAN.md`](./planning/DYNAMIC_BRANDING_PLAN.md) are
done.** Starting a new project on this core is now four environment variables, not a find-and-replace
across 35 files — and an administrator can override any of it at runtime from **Settings → Branding**.

**Rebranding a deployment:**

```bash
# backend/.env
APP_NAME="Acme Cloud Portal"
APP_MONOGRAM="AC"
APP_CHROME_SUBTITLE="Operations"
APP_TAGLINE="Provision and bill customer infrastructure."

# frontend/.env.local
NEXT_PUBLIC_APP_NAME="Acme Cloud Portal"
NEXT_PUBLIC_APP_TAGLINE="Provision and bill customer infrastructure."
```

Everything else follows from `APP_NAME`: the FastAPI title, all five `mail_service` messages, and
**`TWO_FACTOR_ISSUER` and `MAIL_FROM_NAME`, which were hardcoded literals.** That second pair mattered
more than it looks — a wrong issuer name is written into an authenticator app at enrolment and cannot be
corrected afterwards without every user re-enrolling.

**What was built.** A single-row `app_settings` table (migration `a4f19c72e8d3`) whose every column is
nullable, where **NULL means "use the environment"** rather than "empty". That one decision is what makes
the core reusable: a fresh install has no row and still renders, clearing a field in the form restores
the deployment default instead of blanking the application's name, and the database is an *override*
layer rather than the only source of truth. `CHECK (id = 1)` enforces the single row — "there is one row"
maintained by convention is how a settings table ends up with two, and two rows give branding no defined
value. Plus a public `GET /api/settings/branding`, a `PUT` gated on **super-admin *and* a recent password
confirmation**, a `settings-manage` permission, and `/settings/branding`.

**Two guards on the write, both deliberate.** `require_super_admin` rather than the permission alone,
because `ROLE_PERMISSION_MATRIX` gives `ROLE_ADMIN` the `"*"` wildcard — the re-seed confirmed it,
granting `settings-manage` to all three admin roles automatically, exactly as predicted. And password
confirmation because repainting the application is a convincing setup for a phishing screen served from
the real domain; someone holding a hijacked session should not be able to do it.

**The design constraint held, which was the point.** The naive version — everything reads the settings
table — would have converted **15 prerendered routes into server-rendered-on-demand ones** to make a
`<title>` editable. Instead, document metadata is build-time (`NEXT_PUBLIC_APP_NAME`) and the in-app
chrome is runtime, resolved server-side with a revalidating `fetch` and passed down as a prop.

| Check | Result |
|---|---|
| Static/dynamic split | **16 static / 3 dynamic** — was 15/3, the addition being the new page. Nothing flipped |
| New react-hooks errors | **0.** Still 18, the PM-30 baseline — no component gained a fetch-on-mount |
| `pytest` | **87 passed** (was 74) |
| `ruff`, `tsc --noEmit` | Clean |
| Unauthenticated `GET` / `PUT` | `200` / `401` |
| Second row | Refused: `violates check constraint "app_settings_single_row"` |
| End to end | Row set to "Acme Cloud Portal" → the rendered `/sign-in` heading and tagline changed; `<title>` stayed build-time, as designed |

**A 35th hardcoded site, one more than the audit predicted:** `AuthInitializer.tsx` was still rendering a
**`"T"` monogram** — a "Test Platform" leftover PM-21 believed it had removed. It only shows on the
loading screen during the session check, which is why three brand audits walked past it.

**The bug worth recording, because it failed silently.** Server-side fetching needs a *different* API
address than the browser. `NEXT_PUBLIC_API_URL` is `http://localhost:8002`, and inside the frontend
container `localhost:8002` **is the frontend** — so the root layout's fetch got `ECONNREFUSED`,
`getBranding`'s catch-all returned the build-time defaults, and the page rendered them. Everything looked
correct: the API saved, the endpoint returned the new value, the UI never changed. It was caught by
curling the rendered HTML instead of trusting the endpoint. Fixed with `INTERNAL_API_URL`
(`http://backend:8002` in Compose — the backend listens on 8002 *inside* the container too, not 8000),
with no `NEXT_PUBLIC_` prefix so it can never reach the browser.

**⚠️ Two protected files were edited**, both required rather than incidental:

- **`backend/app/db/migrations/env.py`** — registering `app_settings`. Skipping it is precisely the
  failure its own comment warns about: an unregistered model gets a `DROP` from the next autogenerate.
- **`docker-compose.yml`** — adding `INTERNAL_API_URL`. Its existing comment asserted *"there is no
  server-side fetching"*, which this change made false; that comment is now corrected, because it is
  exactly what would send the next person looking in the wrong place.

**Left alone deliberately:** `Navbar.tsx` renders a hardcoded **`"Super Admin"`** subtitle where the
sidebar renders `chrome_subtitle`. It is a *role* label shown to every user regardless of role — a
pre-existing bug, not branding, so it was not guessed at. It needs a decision: the user's actual role, or
the branding subtitle.

**Still open:** phase 3 (theme presets) needs sign-off on `tailwind.config.ts`, and phase 4
(logo/favicon upload) needs the storage decision `DEPLOYMENT.md` § 1 has not made. `bytea` is the
recommendation and would unblock it immediately.

---

## August 6, 2026 — Design for making project identity configurable, so the core is reusable

**The owner asked whether the project name, icon and favicon could be driven from a Settings module in
the sidebar, so this core can be the foundation for future projects.** The answer is yes, and the design
is in [`planning/DYNAMIC_BRANDING_PLAN.md`](./planning/DYNAMIC_BRANDING_PLAN.md). **No code changed** —
this is design, and two of the four phases need decisions that are not mine to make.

**34 hardcoded sites**, measured: 26 in the frontend across 20 files, 8 in the backend. But they split
into four groups that behave completely differently, and that split is the whole finding:

| Group | Count | Can it be runtime-dynamic? |
|---|---:|---|
| In-app chrome — `Sidebar` ×3, `Navbar`, `WelcomeBanner` | 5 | **Free** — already client components fed by an API call |
| Anonymous chrome — the auth layout's name + tagline | 2 | Free, but needs a **public** endpoint |
| Document metadata — 16 × `export const metadata` + `app/favicon.ico` | 17 | **Expensive** — see below |
| Backend text — FastAPI title, 5 × `mail_service`, 2 config defaults | 8 | Trivial |

Also easy to miss, and part of identity: the **`"P"` monogram** (3 places in `Sidebar.tsx`), the
**`"Admin Panel"` subtitle** (2 places), and the auth tagline *"One place to manage partners, catalogue
and quotes"* — which is product copy that a reused core would be **lying about**.

**The trap the naive design walks into.** Measured from `npm run build`: **15 routes are prerendered
static, 3 dynamic.** `export const metadata` is a static export and cannot read a database — making it
dynamic means `generateMetadata()`, which **converts all 15 to server-rendered-on-demand**, adding a
round trip per page view to render a `<title>`. So "one settings table, everything reads from it" pays
the largest cost in the design to make the least valuable thing on the list editable.

**The recommendation is to split by surface, not by setting.** Env vars are the source of truth at build
time and the fallback before the database is seeded (which matters — the sign-in page must render on a
fresh install); the database overrides only the surfaces that are *already* dynamic. Groups A and B are
rendered by client components that already fetch from the API, so adding branding costs **one extra
field on a request already being made.** Group C stays on `NEXT_PUBLIC_APP_NAME` — free, still
prerendered, and correct for a reusable core since a new project rebuilds anyway.

**Five constraints found by reading the code, not assuming:**

- **Branding must be readable anonymously**, so it **cannot** ride on `GET /api/navigation` — that
  endpoint is gated on `get_current_user`, and the sign-in page and favicon are seen before any session.
- **The favicon is an App Router file convention** (`app/favicon.ico`, 25,931 bytes), baked at build.
  Making it dynamic means deleting it and pointing `metadata.icons` at a route. Verified from the
  installed types — and **`node_modules/next/dist/docs/` does not exist in `next@14.2.35`**, so
  `AGENTS.md`'s instruction to read it cannot be followed literally (the same finding as PM-19).
- **There is no upload infrastructure at all** — no `StaticFiles` mount, no upload endpoint, and
  `users.profile_photo_path` is a dead column. Recommended storage is Postgres `bytea`: two rows that
  change once a year, no new infrastructure, included in the backup. The usual "don't put files in the
  database" objection is about user-generated volume, which this is not.
- **Brand colour is compile-time hex in `tailwind.config.ts`** — `UI_PATTERNS.md` says so outright. The
  2026-08-05 token migration **pre-paid** for fixing this: all 242 call sites already say `bg-brand`, so
  converting the token to a CSS custom property leaves them untouched. But `tailwind.config.ts` is a
  **protected file**, so that phase needs sign-off.
- **A free-form colour picker would silently break accessibility.** `brand-on-dark` is a 🔴 mandatory
  rule with measured ratios — `#24695c` on the dark card is **2.83:1, fails AA**; `#5ec8b4` is 9.03:1.
  A picker that sets `--brand` and not `--brand-on-dark` reproduces the exact bug that shipped and was
  fixed on 2026-08-05. **Recommendation: curated presets with both tokens measured, not a colour wheel.**

**One more trap, verified in `core/permissions.py:143`:** `ROLE_PERMISSION_MATRIX` has
`ROLE_ADMIN: "*"`, so adding a `settings-manage` permission to the catalog **grants it to every Admin on
the next seed** — PM-32 hit this same consequence with `activity-view`. Gate the route on
`require_super_admin` instead. Worth raising separately: `"*"` means every permission added from now on
silently widens what an Admin can do.

**Phases 1 and 2 — text identity via a single-row `app_settings` table with env fallbacks, and the 16
metadata literals to a build-time constant — need no decisions and touch no protected files.** Those are
the ones to build. Phase 3 (theme presets) needs `tailwind.config.ts` sign-off; phase 4 (logo/favicon
upload) needs the storage decision that `DEPLOYMENT.md` § 1 has not made.

**Explicitly not designed in:** a tenant dimension. Reusing the core means a separate deployment and
database per project, so one row is right. Adding `tenant_id` "just in case" costs complexity now and
still would not be enough for real multi-tenancy later.

---

## August 6, 2026 — Every core doc now ends with a Pending section, and the audit found them stale

**Each of the nine live core documents now carries a `## Pending` section at the end** — the outstanding
work for that document's own area, as checkboxes, scoped so the list is useful to someone working in
that file rather than being the same global backlog copied nine times.

| Document | Pending items |
|---|---|
| `core/ARCHITECTURE.md` | Structural (PM-40/5/41/42), runtime & ops, gating decisions |
| `core/AUTHENTICATION.md` | Implemented-but-unproven (SSO, deliverability), no-UI-path, `SECRET_KEY` rotation |
| `core/AUTHORIZATION.md` | PM-5 in depth, provability, granularity the model lacks |
| `core/USERS.md` | Partner-as-organisation modelling, deletion/attribution, data quality |
| `system-design/FASTAPI_STANDARDS.md` | Missing conventions (versioning, scoping, pagination), adopting `unit_of_work` |
| `system-design/NEXTJS_STANDARDS.md` | The missing data layer, PM-25, per-request timeouts |
| `system-design/DATABASE_MIGRATIONS.md` | Protecting `env.py` from tooling, untested migrations, schema debt |
| `system-design/UI_PATTERNS.md` | Rules the code violates, missing primitives, unverified rendering |
| `system-design/DEPLOYMENT.md` | The § 1 decisions, artefacts that don't exist, executable pre-deploy checks |

`documentation/architecture.md` was **deliberately skipped** — `INDEX.md` marks it stale inherited
documentation ("Logic Test Platform", Nginx, ports 3000/8000, none of which is true). Adding a to-do list
to a document scheduled for deletion would be work with negative value.

**The audit's real finding is that the standards docs have drifted badly from the code**, so each Pending
section ends with a *Documentation accuracy* subsection naming the specific false statements. The worst,
in rough order:

- **`DATABASE_MIGRATIONS.md` § 2 is eight revisions behind.** It says *"Linear, eight revisions. Head is
  `e7b41c9a2d10`"*; there are **16** and the head is **`c1e70a5d94b2`**. Anyone checking `alembic current`
  against it concludes their database is ahead of the code.
- **`FASTAPI_STANDARDS.md` § 12 *Anti-Patterns* is stale in nine of ten rows** — every row describes code
  that no longer exists, which inverts the section from "don't copy this" into a list of fixed problems
  presented as current. Its § 7 also still states there is no rollback wrapper, which PM-38 changed
  earlier the same day.
- **`DEPLOYMENT.md` § 7 still says passwords are plaintext** — the single most misleading line left in the
  deployment docs.
- **`NEXTJS_STANDARDS.md` § 5's API-module table is wrong in five of six rows**, and § 13 in five of seven.
- **`core/ARCHITECTURE.md` is stale in six places**, mostly from yesterday's domain deletion — it still
  lists `/dashboard/candidates`, `testSlice`, and three deleted API modules.

**Three code-level facts were found while grounding the claims, and each is now an item rather than a
guess:**

- **`users.profile_photo_path` is a dead column.** A `String(2048)` that nothing writes and nothing reads
  — `avatar_url` returns `google_avatar` only, and there is no upload endpoint. This is exactly the trap
  PM-6 described ("columns that suggest features that don't exist"), reappearing on the new table.
- **`activity_log.causer_id` / `subject_id` have no foreign key and cannot have one** — a single column
  holds both a user UUID and a role integer. Correct for an audit trail, and worth stating so nobody
  "fixes" it with a constraint that would then block user deletion.
- **`updated_at`'s `onupdate` is Python-side on 5 models, so any Core-level `UPDATE` bypasses it.**
  Nothing is wrong today — the one bulk Core update targets `user_sessions`, which has no `updated_at` —
  but the next one written against a table that has one will silently leave the timestamp stale. Checked
  rather than asserted.

**Two claims were corrected during the pass rather than shipped wrong:** an earlier draft said a bulk
update already broke `updated_at` (it does not — the table has no such column), and
`requirements-dev.txt`'s comment claimed keeping it separate stops a test client reaching production
(it does not — `TestClient` comes from starlette, a runtime dependency; the real reason is fewer packages
to audit).

**No code changed.** Documentation only, plus that one comment correction.

---

## August 6, 2026 — The core is audited, and the first three gaps are closed

**The security core turned out to be far stronger than the docs claim, and far less defended than it
looks.** A read of the code — not the register — found 28 of 36 tracked debt items closed, bcrypt where
`README.md` still promises plaintext, and an auth layer with session revocation, refresh rotation with
reuse detection, 2FA, rate limiting and an audit trail. What is missing is the layer *underneath* the
features: the parts that make correctness survive the next change rather than survive a review.

Eight new items, PM-37 to PM-44, are recorded in the new
[`planning/CORE_HARDENING_PLAN.md`](./planning/CORE_HARDENING_PLAN.md). **The headline is that the
core's correctness currently lives in prose.** Three of the eight are now closed.

**PM-37 — production can no longer boot on a development default.** `Settings` had 60-odd fields and
none of them said which environment it was, so `DEPLOYMENT.md` § 0's seven-row *"configuration that
must change per environment"* table was seven things a human had to remember. There is now an `APP_ENV`
field and a validator that **refuses to start** and lists every problem at once. Verified both ways:
with the real `.env` and `APP_ENV=production` it refused with 5 named problems — including that **this
project's own development `SECRET_KEY` contains a placeholder string** — and with a correct production
config it booted. `MAIL_BACKEND=console` is the entry that matters most, because it is the only one
that fails *successfully*: it works perfectly and writes password-reset links, which are live
credentials, into a log file with a wider audience than the database has.

**PM-38 — a request now has a transaction boundary available to it.** `get_db` neither committed nor
rolled back, and 49 `db.commit()` calls were spread across 9 services, so a flow writing two tables
could leave half of it durable. `get_db` now rolls back explicitly, and `db/session.py` gained
`unit_of_work(db)`. The 49 existing commits are **deliberately left alone** — they are single-write and
correct, and rewriting them would be a large diff with no behaviour change. This matters most for what
comes next: PM-5's row-level scoping is about to add exactly the multi-table writes that need it.

**PM-39 — this repository has automated checks for the first time.** 74 tests over the three properties
the register proves are worth protecting: **token type confusion** (the full 4×4 matrix — a refresh
token must not work as an access token, and the matrix grows automatically when a fifth token type is
added), **refresh reuse detection**, and **password hashing**. Plus `.github/workflows/ci.yml`, which
runs `ruff`, `pytest`, `tsc --noEmit`, `npm run lint` and `npm run build` — and **three of those five
already existed and had only ever been run by hand.** That is not hypothetical: `npm run build` was
broken by a type error and stayed broken because nothing ran it (PM-24).

**The test suite immediately found a bug in the code it was written for.** PM-37's first version matched
placeholder secrets by equality, so `"changeme" * 4` — 32 characters — cleared the length floor, matched
no placeholder, and would have signed production tokens. Placeholders are now matched as a substring,
with a distinct-character floor behind it for a repeated string nobody thought to blocklist. Both
paths are asserted, along with 20 real `token_urlsafe(48)` keys to prove the floor does not reject the
thing the error message tells you to generate.

**Also fixed, small and worth naming:**

- **The frontend's refresh had no single-flight.** Four parallel 401s sent four `POST /refresh` calls.
  It worked — but only because the backend's 30-second rotation grace window absorbed them, and that
  window exists for concurrent *tabs*, not for one tab's parallel requests. A correctness property of
  the client was resting on a backend tolerance it never asked for; narrowing the window would have
  started revoking sessions under load, which is near-undiagnosable from the frontend. Now one shared
  promise.
- **`API_BASE_URL` defaulted to port 8000; the API runs on 8002.** A developer with no
  `NEXT_PUBLIC_API_URL` got connection-refused against a port nothing serves.
- **`GET /api/activity/export` was unreachable in practice.** The 5s global axios timeout would kill
  the one endpoint deliberately streamed because it has no upper bound. A `LONG_TIMEOUT_MS` is now
  exported for it, and the default stays short so an unreachable backend still fails fast.
- **One genuinely unused import** (`Boolean` in `models/user.py`) and five un-sorted import blocks.

**A linter incident worth recording, because it nearly did real damage.** The first `ruff` config used
`exclude` rather than `extend-exclude`, which *replaces* ruff's defaults instead of adding to them — so
it linted `backend/.venv` (the dead virtualenv from PM-23) and reported **32,488 errors across 1,256
files**. Worse, before that was noticed, `--fix` reordered the imports in
`app/db/migrations/env.py` — a **protected file** — and hoisted an import above the comment reading
*"EVERY model must be imported here or --autogenerate cannot see it, and may emit a migration that
drops its table."* Detaching that warning from the list it governs is exactly the kind of quiet damage
a formatter can do. The whole `app/db/migrations` tree is now excluded with that reason written down.

**⚠️ In reverting it, `git checkout` also discarded an uncommitted change that file had at the start of
the session.** The content is unrecoverable — unstaged working-tree content is never hashed by git. The
file now matches `HEAD`, and it is functionally correct: all 8 model imports resolve, no deleted model
is referenced, `alembic heads` reports the single head `c1e70a5d94b2`. The captured diff showed a pure
24-line permutation, so the lost change appears to have been import ordering only — but that is an
inference, not a certainty, and **`backend/app/db/migrations/env.py` is worth a look before committing.**

**Verification.** `ruff check .` clean. `pytest` 74 passed, 4 skipped. `tsc --noEmit` clean. Backend
restarted and `/health/ready` reports the database reachable; OpenAPI still serves 58 operations across
47 paths. Production validator exercised in both directions against the running container.

**Not done, and named in the plan rather than left implied:** PM-40 (`/api/v1` — 56 unversioned routes
and 38 hardcoded frontend paths), PM-41 (the frontend has no data layer and does zero server-side
fetching — this is the *cause* of PM-30's climbing lint count, not a lint problem), PM-42 (OpenAPI →
TypeScript codegen), PM-43 (two purge functions exist and nothing calls them), PM-44 (rate-limit
counters are per-process). The plan's main recommendation is an ordering: **PM-40 and PM-42 before
PM-5**, because scoping is the change most likely to leak data across tenants and it should not be the
first thing written on top of an unversioned API with no generated contract.

---

## August 6, 2026 — "Add User" leaves the sidebar

- **It duplicated a button that is already on screen.** `/dashboard/add-user` renders the same Users
  module with its create modal open, and the Users page carries an **"Add user" button directly above
  the table** — so the nav row offered a second route to a control the user is already looking at.
- **`_item`'s own docstring described the right design and the code did not follow it:** *"`/dashboard/
  all-users` and `/dashboard/add-user` are two routes under one conceptual Users item."* That is what
  `active_prefixes` is for. Users now claims both prefixes and `Add User` is gone as a separate entry.
- **The route stays.** The dashboard's Add User quick action navigates to it and it is a legitimate
  deep link — it simply no longer owns a nav row. `USER_CREATE` became an unused import and went too.

**Verified in a browser on both routes:** the nav reads Dashboard · Users · Roles & Permissions ·
Activity Log · Branding, and **Users is the highlighted item on `/dashboard/add-user`** as well as on
`/dashboard/all-users` — the prefix change works rather than just removing the row and leaving nothing
lit. Backend imports clean.

---

## August 6, 2026 — A 500 was hiding every validation message in the API

- **Reported as "the branding form didn't even work."** It didn't, and the cause was not in the
  branding feature. Three things were happening at once and only one was a bug:
  1. `PUT /api/settings/branding` → **403**. Correct — the endpoint is behind a password-confirmation
     gate and answers 403 with `X-Password-Confirmation-Required`, which the form handles by prompting.
  2. `POST /api/auth/me/confirm-password` → **422** twice. Also correct: that endpoint returns 422 for
     an *incorrect* password. Verified against the API — the right password returns 200.
  3. And then, once confirmed, the save returned **500**. That was the bug.
- **`main.py`'s validation handler could not serialise its own error.** It returned
  `JSONResponse(content={"detail": exc.errors()})`, and in Pydantic v2 any error raised by a custom
  `field_validator` carries the original exception *object* in its `ctx`:

  ```
  TypeError: Object of type ValueError is not JSON serializable
  ```

  So the handler crashed inside the error path and the caller got a generic 500 instead of the 422
  explaining what was wrong.
- **This was not a branding bug — it affected every schema with a custom validator, which is most of
  them.** The worst case was on a core path: **signing up with a weak password returned a 500**, not
  "Password must be at least 8 characters". Branding merely happened to be the screen someone
  exercised, because its `theme_preset` validator rejects unknown presets by design.
- **Fixed by rebuilding each entry from its three primitive fields** (`loc`, `msg`, `type`), which is
  serialisable whatever a validator raises. It also stops echoing `input` back to the caller — the
  handler's own docstring already worried about that for logs, where `/api/auth/login` means the
  password, but the response was still returning it.

**A second bug the fix exposed, and it was already known.** A 422 `detail` is a *list*, and eight
components were doing `setError(response.data.detail)` then rendering `{error}` — React throws
"Objects are not valid as a React child" on an array of objects. `lib/utils/apiError.ts` exists to
solve exactly this and cites TECH_DEBT PM-36, but **nothing imported it**. All eight now do:
`SignInForm`, `SignUpForm`, `BrandingForm`, `TwoFactorSettings`, `AcceptInvitationClient` and
`ResetPasswordClient` migrated; `RolesModule` and `UsersModule` already had their own array-safe
`apiMessage`. The helper also now strips Pydantic's `"Value error, "` prefix, which is noise to a user.

**Verification.** The branding save was driven end to end in a real browser: save → password prompt →
confirm → no error, prompt dismissed, and `GET /api/settings/branding` returns the stored
`theme_preset: "teal"`. `POST /api/auth/register` with a weak password now returns a clean 422 with
`"Password must be at least 8 characters"` instead of a 500. `tsc` clean, lint 18 errors 0 warnings
unchanged, build compiles.

> Valid theme presets, for reference: `azure, bronze, crimson, forest, graphite, indigo, plum, teal`.
> **`viho` is not one of them** — the Viho palette ships as `teal`.

---

## August 6, 2026 — The header gets Viho's action row, and the sidebar loses what it should not have had

- **The sidebar profile block is gone.** It was added earlier the same day to match Viho, and the owner
  removed it: the user's identity is already in the header's account menu, so the block repeated it —
  and its three stats (role, join year, status) only existed because Viho's slot needed filling. Viho's
  own `19.8k Follow / 2 year Experience / 95.2k Follower` map onto nothing here. Deleting it was the
  right call; the composition was faithful but the content was filler.
- **The header is now Viho's, action for action.** Bare search on the left — magnifier and placeholder,
  no border, no fill — then fullscreen, language, bookmarks, notifications, dark mode and messages,
  then a tinted `Log out` in `bg-brand/10` with brand text, which is the theme's `.btn-primary-light`.
- **Six of those eight controls had no feature behind them, and were then removed.** They were first
  shipped greyed out and `aria-disabled`; the owner had them taken out the same day, which is the
  better call — a permanently dead control is noise that teaches people to ignore that corner of the
  screen, and greying it out advertises the absence rather than hiding it. **What ships is fullscreen,
  dark mode, log out and the account menu**; search, language, bookmarks, notifications and messages
  are gone until their features exist. The full row stays recorded in the reference doc.

  The original inventory, for the record:

  | Control | Real? |
  |---|---|
  | Fullscreen, dark mode, log out | **Yes** |
  | Search | No — Global Search is an unbuilt parity module |
  | Language, bookmarks, messages, notifications | No |

  The dead ones are `aria-disabled` and titled "— coming soon", so a keyboard or screen-reader user is
  told instead of clicking into nothing. **Viho's red unread dot on the bell is deliberately omitted**:
  an unread badge that can never clear is worse than no badge. It comes back with the feature.
- **Sign-out moved out of the sidebar, except on mobile.** `TopNav` is `hidden md:flex`, so removing the
  drawer's sign-out too would have left phone users with no way to log out. The desktop footer is gone;
  the mobile one stays and is commented as to why.

- **`Log out` sits in the corner, avatar badge to its left.** It first shipped the other way round.
  Viho puts log out last in the row, and so does the owner.
- **The account block is now the badge alone.** The name and role beside it, and the email inside the
  dropdown, are gone on the owner's call — the badge already identifies you. The name survives as
  `aria-label`/`title` so screen-reader and hover users keep it.
  - **The dropdown went with them.** Once `Log out` became its own button it contained exactly one
    item, so the avatar is now a plain `Link` to `/settings/profile`. A menu that opens to reveal a
    single choice is ceremony. `TopNav` lost its open state, its ref and its click-outside effect with
    it — **280 lines down to 157**.

**Verification.** `tsc` clean, lint **18 errors 0 warnings** (unchanged), build compiles. Header and
dashboard rendered and checked in both themes.

> **Process note, worth not repeating.** A `/dashboard` render came back completely blank mid-session
> and recovered on the next attempt. Nothing was broken: `npm run build` was being run **on the host
> while the dev container serves the same bind-mounted `.next`**, and the production build stomps the
> dev server's state until it recompiles. Verify against the dev server, and save the production build
> for last — or a transient blank page reads as a regression that isn't one.

---

## August 6, 2026 — The shadows were wrong, and the sidebar was only half Viho

- **The owner was right about the shadows, and the reference doc was wrong.** `app.css` declares
  `box-shadow: 0 5px 10px 2px rgba(36,105,92,.19)` for `.btn-primary`, the reference doc recorded it,
  and I applied it to `Button` and the active sidebar item. **It does not render.** Sampling the pixels
  directly below and beside real Viho buttons gives pure `#ffffff` — `auth-login-light.png`'s LOGIN
  button, `file-manager-light.png`'s Add New, and the filled nav item in
  `tables-datatable-light-pagination.png`, none of them cast anything. The theme's **69**
  `box-shadow: none` rules win.
  - Removed from `Button`, the active nav item, the sidebar surface itself and the logo tile's hover.
    The **`shadow-brand` token is deleted** rather than left unused, with a comment in
    `tailwind.config.ts` saying why, so nobody re-adds it from the CSS.
  - **The general lesson is one this doc set already states and I failed to apply: where the CSS and
    the pixels disagree, the pixels win.** A declaration inside a 1.3 MB minified stylesheet is not
    evidence that it reaches the screen. Recorded as a correction in the reference doc.
- **The sidebar was rebuilt against the screenshots rather than approximated.** Four things were wrong:
  - **Nav icons were wrapped in grey tinted tiles.** Viho's are bare outline glyphs on the row; the
    tiles made every item look like a button.
  - **Section headings were 10px uppercase micro-labels.** Viho's are ~17px, semibold, **sentence
    case**, brand-coloured, with a hairline rule beneath — much more prominent than what was there.
  - **There was no profile block at all.** Added: avatar in a tinted ring, a status pill overlapping
    its base, the name in brand colour, a muted secondary line, and a three-up stat row divided by
    hairline rules, with a gear link top-right.
  - **The active row had a pulsing dot.** Invented. Viho uses a chevron on expandable items and
    nothing on leaf items.
- **Sections are no longer collapsible, deliberately.** They defaulted to closed unless they held the
  current page, so landing on `/dashboard` hid the whole of User Management behind a chevron — and at
  Viho's heading size a collapsible heading looked identical to a static one. In the reference,
  "General" and "Applications" are inert labels with every item listed; chevrons belong to nav *items*
  that own children. `section.collapsible` still arrives from the API and is now ignored in the view.

**On the profile stats.** Viho's three are `19.8k Follow`, `2 year Experience`, `95.2k Follower`. We
have no source for any of them, and filling the shape with invented numbers would be worse than leaving
it empty — so the slots carry the user's role, join year and account status. Same composition, true
figures. The pill likewise shows real status rather than Viho's decorative "New".

**Verification.** `tsc` clean, lint **18 errors 0 warnings** (unchanged), build compiles. The absence of
the shadow was confirmed by measurement, not by eye: 16 sampled pixels around our own Add-user button
are all `#ffffff`. Sidebar rendered and checked in both themes.

---

## August 6, 2026 — The inherited test-platform domain is deleted, end to end

- **The owner confirmed none of it serves the marketplace**: Test Platform, Candidate, Create, Add
  Category, Add Job Role, Add Test Section, Select Question Type, Add Question. This is
  `SCAFFOLD_CLEANUP_PLAN.md` tiers 2 and 3.1–3.2, executed.
- **Frontend** — 9 components, `/dashboard/candidates`, `testSlice` and its store registration,
  `testApi`/`candidateApi`/`categoryApi`, the test/question/option/session/category types, the
  sidebar's whole Create group, and `RoleToggle`, which the sweep found was already **dead code
  referenced by nothing**. `/test` and `/result` came out of **both** middleware lists — the plan
  warns they must be edited together, because editing one silently changes protection.
- **Backend** — the `candidate` and `category` routers, services and schemas; 7 models; their
  `env.py` imports **in the same change** (a model file deleted while its import remains breaks
  Alembic on every command); the Test Platform nav section; and 8 RBAC permissions across 2 groups.
- **Database** — migration `c1e70a5d94b2` drops 7 tables. Written by hand, not autogenerated, because
  autogenerate emits drops in arbitrary order and they would fail on foreign keys. The order was taken
  from `information_schema` rather than assumed. `downgrade()` raises `NotImplementedError`: recreating
  a retired product's schema is a lot of code that still could not restore the data. A dump was taken
  first, as § 3.1 requires.
- **The migration also deletes the orphaned RBAC rows.** The seeder only adds and updates — it never
  prunes — so removing the permissions from `permissions.py` alone would have left them in the
  database forever, still granted to roles.

**Two findings worth recording.**

- **`categories` had no foreign keys at all.** Nothing ever referenced it, so § 3.2's caution that
  "questions might depend on it" was unfounded, and it could be dropped with the rest.
- **`DashboardOverview`'s four headline figures were hardcoded `"0"`.** The dashboard had been
  reporting fake zeros for its entire existence. Since every one of its cards pointed at a deleted
  module, it was rewritten rather than trimmed: it now shows **real** counts (Users, Roles,
  Permissions, Activity), each fetched independently via `Promise.allSettled` so that a 403 on one
  endpoint — expected for a Partner — renders `—` for that tile instead of blanking the panel.

Stale copy went with it: the welcome banner still said *"Create and manage your tests, add questions,
and track candidate performance"*, and a status pill read *"Ready to create tests"*.

**Verification.** `tsc --noEmit` clean. `npm run lint` **18 errors, 0 warnings** — down from the
20-error PM-30 baseline because two lived in deleted files, and the 5 warnings the deletion introduced
(props `NavItems` no longer used) were cleaned up rather than left. `next build` compiles, and
`/dashboard/candidates` is gone from the route table. The backend imports, `alembic upgrade head`
applied cleanly, and re-seeding reports **17 permissions across 6 groups**, down from 25. `GET
/api/navigation` no longer serves a Test Platform section. `/dashboard` was rendered in both themes and
checked.

Permissions 25 → 17. Tables 17 → 10. `/dashboard` First Load JS **193 kB → 143 kB**.

**Still open:** tier 1 housekeeping and § 3.3, renaming the database — `POSTGRES_DB` is still
`test_platformDB`, which touches three coupled things and the on-disk cluster.

---

## August 6, 2026 — The whole app is Viho now, and the dashboard stopped being three colours at once

- **The owner opened `/dashboard` and found "orange and white and blue".** That was accurate: an
  orange sidebar, a **blue→cyan gradient** welcome banner, and stat/action cards in a rainbow of
  blue/purple/amber/emerald/rose pastels — three visual languages on one screen. The target was
  `dashboard-default-light-top.png`.
- **All 242 brand-colour occurrences across 37 files are gone**, along with every pastel. Done as three
  scripted sweeps rather than by hand, because a 37-file manual edit is where mistakes live:
  1. brand hex + `orange-*` → tokens, and the legacy dark greys → `night-*`,
  2. semantic families (`red`/`green`/`amber`/`blue`…) → `tone-*`,
  3. a catch-all regex for every remaining palette utility including `hover:`/`group-hover:`/`from-`
     variants, which the first two passes missed.
  The regression guard is a grep, and it now returns nothing app-wide.
- **Three things the sweep could not do, done by hand:**
  - **The sidebar's active nav** is now Viho's *filled* treatment — solid brand, white text,
    `rounded-[9px]`, translucent-white icon tile — not a tint. Section labels are brand-coloured with a
    1px rule beneath, matching the reference.
  - **StatCard and QuickActionsCard were rebuilt.** Their six-colour `color` prop is kept so call sites
    still work, but it now selects between exactly **two** tones, teal and tan, the way Viho alternates
    them. Each card is a white squared surface with a circular tinted icon badge and a faint oversized
    watermark glyph.
  - **The welcome banner** is a flat `bg-brand` fill with a new CSS-only `.texture-brand` utility.
    `.texture-bg` could not be reused: its dots are dark-on-light and vanish against `#24695c`.
- **One refinement came from measuring rather than looking.** The cards initially sat on an opaque
  white panel that hid the page canvas entirely. Viho's cards sit directly on the `#f5f7fb` canvas, so
  the wrapper is now transparent. Verified by sampling a gutter band, not by eye.

**Verification.** `tsc --noEmit` clean. `npm run lint` reports **20 errors, unchanged** — the PM-30
baseline, none in any touched file. `next build` compiles, 22/22 routes. `/dashboard`, `/all-users`,
`/roles`, `/activity` and `/settings/profile` were each rendered **behind real authentication** and
checked; sampled surface colours match the reference exactly:

| | Light | Dark |
|---|---|---|
| Page canvas | `#f5f7fb` | `#202938` |
| Sidebar / header / card | `#ffffff` | `#111727` |
| Border | `#e6edef` | `#142831` |

Dark mode therefore has Viho's **inverted elevation** — the card is *darker* than the page.

To screenshot authenticated pages, a minimal Chrome DevTools Protocol client was written on the Python
stdlib (no `websocket-client` or `websockets` installed). It logs in, injects the session cookies via
`Network.setCookie` — they are host-only on `localhost` and ignore the port, so the API's cookies reach
the frontend — and pins the theme through `localStorage` so light/dark renders are deterministic rather
than inherited from the OS. Worth keeping: `--blink-settings=preferredColorScheme` did **not** work.

**Docs updated:** `UI_PATTERNS.md` (migration marked complete, the pre-migration cost kept as a
historical note, regression grep recorded), `VIHO_ADOPTION_PLAN.md` (phase table), and `TECH_DEBT.md`
**PM-20 closed**.

## August 5, 2026 — The sign-in and sign-up screens are Viho, and the app is deliberately two-tone

- **The auth pages were built first, out of the plan's order, at the owner's request.** That pulled
  parts of five phases forward for the `(auth)` route group: the token layer, the palette flip,
  Montserrat, squared/borderless surfaces with inverted dark elevation, and four of the new components.
  **The dashboard is still orange.** That is the expected mid-migration state, it is recorded in
  `UI_PATTERNS.md` § Known Issues, and phase 3 is what ends it — not hand-painting teal at call sites.
- **Two screenshots the owner added mid-task changed the layout entirely.** `login.png` and
  `register.png` show Viho's **split-screen** auth — artwork panel left, wash panel with the card
  right. The existing `auth-login-light.png` is a **different, centred variant**, and the reference
  doc's § Login Screen Anatomy had been written against that one. The first implementation followed the
  centred layout and had to be reworked. Both variants are now labelled in the doc so the next person
  doesn't repeat it.
- **Measuring the new screenshots contradicted the reference doc on one point.** The card has **no
  border**: the pixel immediately outside it is the `#eaf0ef` wash and its own edge is pure white. The
  first pass had added `border-surface-border` on the strength of `.card { border: 1px solid #e6edef }`
  — but that rule is for *content* cards, not this one. Removed. The wash alone is what makes the card
  read as raised, which is the same trick the doc already credits for the login background.
  - Confirmed by pixel measurement: card **exactly 450px** wide and centred in the wash panel in both
    shots; wash exactly `#eaf0ef`; the in-card colour histogram is 90% `#ffffff`, then `#eff3f2`,
    `#24695c`, `#eaf0ef`, `#e6edef`, `#999999`, `#242934` — every one a value already documented.
  - The two shots **disagree on the split ratio** (58/42 on login, 42/58 on register). Standardised on
    the login proportions since that is the screen originally shared.
- **A real accessibility bug was introduced and then fixed.** The first version used `text-brand` for
  links on the dark card: `#24695c` on `#111727` is **2.83:1** and fails AA outright, so
  "Create Account", "Forgot password?" and the `Show` toggle were unreadable in dark mode. Fixed with a
  new `brand-on-dark` token — `#5ec8b4`, **Viho's own** value for the primary button's focus ring —
  which scores **9.03:1**. `text-brand dark:text-brand-on-dark` is now a mandatory pair, written into
  `UI_PATTERNS.md`.
- **The register screen changed behaviour, not just styling**, and two of the three are improvements:
  - **First and last name are now separate fields.** The old form took one "Full name" and split it on
    the first space to satisfy the API — which mangled every two-word surname. The API always wanted
    the two parts.
  - **The confirm-password field is gone**, matching the screenshot, which relies on the `Show` toggle
    instead. The endpoint still requires `confirm_password`, so the password is sent twice. **This is
    the one change worth a second opinion** — it removes a typo guard.
  - **An "Agree With Privacy Policy" checkbox now gates submission.** "Privacy Policy" is styled as a
    link but rendered as **plain text**, because no privacy-policy route exists and a checkbox gating
    signup must not point at a 404.
- **The tab toggle is gone and `/sign-up` is a real destination.** Viho navigates between Login and
  Create Account as separate screens with a footer link, so the segmented toggle and its four slide
  keyframes were removed. Registration success now navigates to `/sign-in?registered=1` rather than a
  parent callback flipping a tab.
- **Dropping the logo block removed the last inherited test-platform branding** — the `T` monogram,
  "Admin Portal", and the subtitle "Sign in to manage tests, questions, and job roles", which were
  TECH_DEBT PM-21's two deferred items. Viho's auth card is the card alone.
- **`authApi.googleAuthorizeUrl` got its first caller.** The endpoint has existed with no button
  anywhere in the app. Viho's "Sign in with" row now reaches it.
  - **One tile, not Viho's four.** The theme shows LinkedIn, Twitter, Facebook and Instagram; we have
    exactly one federated provider. Four buttons that cannot sign anyone in would be fidelity to the
    picture at the cost of fidelity to the product.
- **The artwork panel is filled with original SVG, not Viho's illustrations.** Viho's are licensed theme
  assets, and the constraint is stronger than "don't copy the files" — **tracing them out of the
  screenshots would produce a derivative of a paid asset in a public repo.** So
  `components/auth/AuthArt.tsx` is hand-authored inline SVG in the same *style*: flat vector, brand
  palette, floating "sticker" composition, swapped per route. Style is not the licensed part.
  - Login gets a phone mockup showing a login screen, a padlock, a plant, picture frames and faint leaf
    line-art. Register gets a browser-window card, a lightbulb in a thought circle, a phone checklist, a
    sticky note and a grid-paper note.
  - **Deliberately no human figures.** Hand-coded characters read as amateurish, and the figure is the
    most distinctive — so most derivative — part of Viho's art.
  - Every surface has a `dark:` counterpart, so it works in both themes. Inline SVG means no image
    requests: `/sign-in` First Load JS was **unchanged at 174 kB** after adding it.
  - A commissioned or licensed illustration can replace `<AuthArt />` without touching the layout.

**Verification.** `tsc --noEmit` clean. `npm run lint` reports **20 errors, unchanged** — the PM-30
baseline, none in any file touched here. `next build` compiles, 22/22 routes. Both pages rendered
headlessly in **both themes** and measured against the references: wash `#eaf0ef` light / `#202938`
dark, card `#ffffff` / `#111727`, card width 450px. Dark mode confirms the **inverted elevation** —
card `#111727` is darker than the page `#202938`, which is the whole point of adoption item 4.

One measurement worth recording so it isn't re-investigated: headless Chrome's viewport is **87px
shorter than `--window-size`** at every height tested, so a bottom band in a screenshot is a capture
artifact, not a layout bug. Render at `window height + 87` to compare against a reference.

**Docs updated alongside:** `VIHO_THEME_REFERENCE.md` (new § Split-Screen Auth Anatomy with the
measurements, both login variants labelled, catalogue 34 → 36), the screenshots `README.md`,
`VIHO_ADOPTION_PLAN.md` (per-phase progress table), and `UI_PATTERNS.md` (tokens, Montserrat, the
`Button`/`Input` contracts, the `brand-on-dark` rule, and the two-tone state as a known issue).

---

## August 5, 2026 — Viho is adopted in full, and the rebrand costs 20× what we thought

- **The design direction is no longer an open question.** `VIHO_THEME_REFERENCE.md` had sat since
  2026-08-03 with a § Adoption Decision marked *"Needs the Owner"* — four conflicts between the Viho
  theme and our own written standards, recorded rather than decided because they are product calls.
  The owner decided all four today, and decided them the same way: **full fidelity.** Teal `#24695c`
  + tan `#ba895d` replacing orange, cards squared while controls stay rounded, Montserrat replacing
  Inter, and Viho's **inverted** dark mode where cards are *darker* than the page. Card spacing goes
  to 30px with them. The product should look like Viho, not like a compromise.
- **Checking the cost before planning the work found the most important thing in this entry.** Both
  `VIHO_THEME_REFERENCE.md` and `UI_PATTERNS.md` stated that only `Button.tsx` and `Input.tsx`
  hardcode the brand hex, and that a rebrand therefore needed those two files migrated first. Against
  commit `b144c24` the real figure is **242 occurrences across 37 files** — 44% of the frontend's 85
  `.tsx` files. Only 6 files use the `brand` token at all.
  - **The `orange-*` Tailwind utilities are why the original count was so far out.** A hex grep never
    sees `bg-orange-50`, `dark:bg-orange-950/40` or `hover:text-orange-400`, and those are 91 of the
    242. Anyone re-checking this must grep both patterns or they will reproduce the same undercount.
  - **Nine orange shades are in use where the token defines two**, so this cannot be a
    find-and-replace onto `brand` — the token layer needs a real tint ladder built first.
  - The heaviest single file is `Sidebar.tsx` at **46** occurrences, more than five times `Button.tsx`
    and `Input.tsx` combined — the two files the docs named.
- **The plan's whole shape follows from that number.** `VIHO_ADOPTION_PLAN.md` sequences the work in
  ten phases, and the ordering is the point rather than the effort: build a token layer *while still
  orange* (no visual change, verified by an empty grep), and only then flip the values. That turns
  "editing 37 files" into one commit that `git revert` undoes. Phases 1–4 are the spine and are worth
  doing in that order even if everything after them slips.
- **A third of the debt should be deleted, not migrated.** 85 of the 242 occurrences live in eight
  inherited test-platform screens that `SCAFFOLD_CLEANUP_PLAN.md` already schedules for removal —
  `Candidate.tsx`, the question/category/job-role forms, `RulesModal`, `TestCard`. Migrating them is
  work thrown away. **That deletion needs its own approval and has not been given**, so it is flagged
  as an open question rather than assumed; the fallback is a visibly two-tone app until they go.
- **Four accessibility carve-outs are proposed against literal 100%, and they are not yet settled.**
  Viho sets white text on its mustard warning at a contrast ratio of **1.70**, uses `#999` muted text
  at **2.85**, white on tan at **3.08**, and removes the focus ring from its login inputs outright.
  The first and last are the ones worth holding: 1.70 is unreadable rather than marginal, and
  removing a focus indicator breaks keyboard use. They are listed as E1–E4 for the owner to veto.
  - Two other Viho oddities the reference doc advised against — `success` being a dark primary shade
    rather than a green, and `info` being grey rather than blue — are **adopted as-is**. Both pass
    contrast; the objection to them is aesthetic, and fidelity wins where nothing is broken.
- **A pre-existing contradiction surfaced while sizing the radius work.** `UI_PATTERNS.md` mandates
  `rounded-lg` everywhere and says *"don't mix radii"*; the code uses five, including 49
  `rounded-xl` and 23 `rounded-2xl`. That drift is unrelated to Viho and has to be resolved by the
  same phase, so it is now recorded as its own Known Issue rather than being discovered mid-work.

**Docs updated alongside:** `INDEX.md` (design section re-statused, plan added), `UI_PATTERNS.md` (a
banner saying it describes today's code and naming which five sections each phase rewrites, plus the
corrected counts), and `TECH_DEBT.md` PM-20 — **re-scoped from ⚪ Low to 🟡 Medium** and moved up the
suggested order, since it now gates an approved piece of work rather than being a tidy-up.

**No frontend code was changed today.** This is a decision and a plan; every phase is still pending.

---

## August 4, 2026 — The sidebar now renders what the server sends, and a correction

- **`GET /api/navigation` was committed and then left unconsumed for two commits.**
  The Sidebar kept rendering its own hardcoded list, so the endpoint verified
  earlier today was dead code. It now renders the server tree, which is what makes
  the inversion actually mean anything: **there is no `can(...)` call left in the
  nav path** except the one gating the inherited authoring group.
  - `NavTree` handles sections, per-section collapse, and which entry is
    highlighted. A collapsible section starts closed **unless it contains the
    current page** — otherwise navigating to Roles would collapse the group you had
    just used.
  - Icons cross the wire as names and resolve through a client registry.
    Cross-checked both directions: every one of the six names the server sends
    resolves, and the registry has no unused entries. An unknown name renders a
    visible fallback dot rather than nothing, so a future mismatch shows up instead
    of leaving an invisible gap.
  - The tree is keyed on the user id, not fetched once on mount. Signing in as
    someone else in the same tab would otherwise render the previous user's nav.
  - On failure the nav renders **empty rather than falling back to a guessed
    tree** — a guessed tree would show items the API refuses, which is the exact
    problem the inversion removes.
- **The inherited authoring group stays client-side, deliberately.** Its five
  sections have no URLs and real cross-section state — `select-question-type` sets a
  type that `add-question` reads, and `add-category` sets an id that `add-job-role`
  reads. Giving them routes means threading that through query params, on screens
  already scheduled for deletion. It is the only nav item the client still gates for
  itself, and it is commented as such.
- **One lint finding was a real flaw in my own new code, not a false positive.**
  `useNavigation` set state synchronously in its effect body — a cascading render,
  and redundant, since the initial state can carry the loading flag itself. Rewritten
  so every `setState` happens after an await, and so signing out empties the nav by
  derivation rather than one render later. PM-30's count is back to 20, unchanged by
  this work, with no findings in any of the new files.

### Correction: there is no Activity Log over-exposure, and I said there was

Earlier entries and commit messages today do not contain this claim, but it was
stated repeatedly in working notes and it changed the order work was done in, so it
is recorded here rather than dropped.

The claim was that anyone holding `activity-view` reads the whole organisation's
audit trail, described as a live over-exposure needing a priority fix. **Both halves
were wrong.**

- **`activity-view` is held only by Admin, RootUser and SuperAdmin** — verified
  against the seeded matrix. All three are `has_admin_access` roles, and LeapDesk's
  rule is `$viewAll = has_admin_access()`, which grants exactly those three full
  visibility. **PM and LeapDesk behave identically today.** No non-admin role can
  reach the endpoint at all.
- **The non-scoping is deliberate and documented** in `list_entries`' own docstring:
  *"a partial view of one is worse than none — someone reviewing an incident needs to
  know they are seeing everything"* — and it already names itself as the query to
  revisit when PM-5 lands. It was read as an oversight; it is a decision with a
  rationale, and not one to reverse unilaterally.

What remains in that module is smaller and not urgent: the `source` filter (which
needs write-side stamping first), `hide_system`, module labels, and clickable subject
URLs. Adding the causer sandbox is still worth doing as **defence in depth**, so the
behaviour stays right if a non-admin role is ever granted `activity-view` — but that
is a latent divergence, not a live one.

---

## August 4, 2026 — Settings is a real area now, and change-password is reachable

- **`POST /api/auth/me/change-password` had worked for a day with no way to reach
  it.** There is now `/settings/profile`, `/settings/password` and
  `/settings/appearance`, at LeapDesk's URLs, with its heading and description
  verbatim. `/settings` redirects to Profile server-side so no blank shell is
  painted first.
- **Profile used to render an empty white panel if you visited its URL.**
  `SECTION_URLS` mapped `/dashboard/profile` to a `profile` section, but profile
  only ever existed as a modal opened by `onNavigate` — so a direct visit, a
  bookmark or a refresh matched no render branch and drew an empty card. The
  modal is gone, `/dashboard/profile` redirects to `/settings/profile`, and about
  60 lines of portal code went with it.
- **The shell was extracted so an area outside `/dashboard` can exist at all.**
  `AppShell` (sidebar + top bar + scrolling content) is what made `/settings/*`
  possible; previously the only way to get the chrome was to render
  `DashboardClient`, which also owns the dashboard's section switch and the
  inherited authoring state. `DashboardClient` deliberately does **not** use
  `AppShell` yet — it needs a viewport-locked variant for the table modules, and
  folding that in would push dashboard concerns back into the shared component.
- **`TopNav` lost both its props.** `onNavigate` and `activeSection` existed only to
  serve the profile modal — one to open it, one to highlight its menu entry. It now
  derives "am I in settings" from the pathname, which also **fixes** the highlight:
  it previously only worked in a shell that happened to pass
  `activeSection="profile"`, so it was already broken everywhere else.
- **Email is deliberately read-only on the profile form, and now says why.** LeapDesk
  edits the address and clears its verification stamp; PM refuses because it would
  break the link to a Google sign-in and to any pending invitation. Rather than
  silently omit a field the user can see, the input renders disabled with the reason
  beside it. `employee_id` was added, since it already existed as a column and the
  API had been dropping it.
- **Two form-state decisions worth recording, both prompted by lint and both real
  fixes rather than appeasement.** The profile form no longer re-syncs from the store
  on every change to `user` — the store is refreshed by unrelated things, including
  an identity re-fetch after any 401 retry, and an effect on `user` would overwrite
  half-typed input at an arbitrary moment. It seeds once and re-seeds from a save's
  own response, which is the only moment the server's copy is genuinely newer. The
  password form collapses its OTP block in the verify handler instead of in an effect
  on `password_otp_grace`, because an effect also fires on a fresh page load and
  would steal focus on arrival.
  - Net effect on PM-30's count: **22 → 20**. Two came off by deleting the profile
    modal, and the two the new forms would have added were avoided.
- **A shared API-error unwrapper was added.** FastAPI returns `detail` as a string for
  handled errors and as a *list* for a 422, and rendering the list directly prints
  `[object Object]` at the user — the mistake PM-36 already had to fix twice. The
  profile thunk was also discarding the server's message and substituting "Failed to
  update profile", which left the user with no idea which field was wrong.
- **The OTP flow is now verified end to end, which yesterday's entry listed as
  outstanding.** Against the running stack with a throwaway account, 13 checks, all
  passing: the gate holds (change-password without `current_password` is refused
  while there is no grace); the 60-second resend cooldown returns 429; a wrong code
  is refused; the right code opens the grace; the change then succeeds *without* a
  current password; the grace is consumed by that change; the code cannot be
  replayed; the old password stops working and the new one works.
  - **One accident worth keeping.** The code drawn during the run was `099955` — a
    leading zero — which exercised exactly the case that justified typing `otp` as a
    string rather than an integer. It would have become `99955` and failed.
  - The probe had to pause 62 seconds before its closing logins: the sensitive
    rate-limit tier allows 10 requests a minute and the run spends most of them, so
    a 429 there would have masqueraded as a wrong password. Worth knowing before
    anyone re-runs it.
  - The throwaway account was deleted afterwards; the root account was not touched.
  - Two things about the test data rather than the code: `email-validator` rejects
    reserved TLDs, so `@example.test` cannot be used for a probe account, and the
    console mail backend prints the code on its own line inside a multiline body, so
    a single-line grep misses it.
- **What is still NOT verified: any of this in a browser.** Routing was checked —
  all four settings paths 307 to sign-in unauthenticated and serve 200 with a session
  cookie, and `/dashboard/profile` redirects — and `next build` generates all four
  routes. But the profile card, the edit form and the appearance tabs are client
  components gated on the hydrated store, so they are absent from the server HTML by
  design and cannot be confirmed by fetching it. Nobody has clicked them.

---

## August 4, 2026 — The sidebar is now decided on the server, and collapses per role

Backend half of the navigation inversion. **The frontend still renders its own
hardcoded nav** — `GET /api/navigation` exists and is correct, but nothing consumes
it yet. That is the next change; this one is committed separately because it is
independently verifiable and large enough to review on its own.

- **The sidebar had two sources of truth for authorization, and they could disagree
  silently.** `Sidebar.tsx` hardcoded every item with its own `can("user-view")`
  call, so an item could be shown that the API refuses, or hidden that the API
  would allow, and nothing compared the two. The tree is now built and filtered in
  `services/navigation_service.py` and the client will render what it receives.
  Ported from LeapDesk's `NavigationService`, including the property that makes it
  worth having: **to add or remove a nav item, you edit one file.**
  - **Hiding a link was never the security control and still isn't.** Every route
    stays independently gated by `require_permission`; an item omitted from the tree
    and reached by typing the URL still returns 403.
  - **Icons cross the wire as names, not markup.** The server says `"users"`; the
    client owns the SVG. Sending markup would put presentation in the API and turn a
    restyle into a backend deploy.
- **Sections collapse per role, which the client could not have done.** A JSON
  column on `roles` (migration `f5a3c81b7d29`) holds
  `{"user-management": {"collapsible": false}}`. The client cannot know another
  role's stored preference, so this was impossible before the inversion — it is the
  concrete reason the inversion had to happen rather than a tidy-up.
  - **NULL means "use the code defaults", not "collapse nothing", and nothing was
    backfilled.** Writing the default map into every existing row would have frozen
    the defaults: changing `default_nav_preferences()` later would not affect any
    role that had been backfilled. A role with NULL contributes the default instead.
  - **Where several roles disagree, the first role listed on the user wins.**
    Preferences are merged across roles in reverse order, matching LeapDesk, where
    Spatie returns the most recently assigned role first.
  - **Unknown section keys are rejected twice, and that is not redundant.** The
    schema refuses the request loudly; the service filters again before writing, so
    the column cannot hold junk regardless of how a future caller arrives.
- **The nav is now grouped the way LeapDesk groups it.** Users, Add User, Roles and
  Activity Log sit under a collapsible "User Management"; an empty "System Settings"
  is declared for the parity modules still to come. The inherited candidate item
  moved into its own "Test Platform" section — grouped rather than mixed into the
  flat list specifically so that retiring the scaffold
  (`planning/SCAFFOLD_CLEANUP_PLAN.md`) is deleting one section, not hunting through
  a list. **An empty section renders nothing** rather than an empty heading.
- **Verified per role against the seeded role matrix**, which is the check that
  matters for a permission-filtered tree:

  | Role | Sections returned |
  |---|---|
  | RootUser / SuperAdmin / Admin | Dashboard · User Management (all four) · Test Platform |
  | Staff | Dashboard · User Management (Users, Roles only) · Test Platform |
  | Partner | Dashboard alone |
  | User | Dashboard alone |

  Partner-sees-Dashboard-alone reproduces the browser-driven result recorded on
  2026-07-31, from a different direction. Staff correctly loses Add User (no
  `user-create`) and Activity Log (no `activity-view`). "System Settings" is
  correctly absent everywhere because it is empty.
  - Also verified: the preference overlay flips `collapsible` and survives a
    round trip through the column; a junk key is stripped by the service; the schema
    rejects both an unknown section and a section missing `collapsible`; clearing the
    column back to NULL restores the defaults.
  - **Not verified: anything in a browser.** No UI consumes this yet, so there is
    nothing to click. The endpoint is exercised through the service and the schema
    only.

---

## August 4, 2026 — Password recovery from inside the app, and a real "System" appearance option

First slice of the LeapDesk parity work. Backend only — the `/settings` pages themselves are not
built yet, so **nothing here is reachable from the UI**; the endpoints and the theme groundwork are.

- **A signed-in user who does not know their current password can now change it.** Previously the only
  route was to sign out and use `/forgot-password`, which is useless for the three cases this actually
  affects: a partner who has only ever signed in through a recovery flow, a Google SSO user who never
  set a fallback password, and anyone who has simply forgotten and does not want to lose their session.
  They now request a 6-digit code to their own address, enter it, and set a new password without the old
  one. Ported from LeapDesk's `PasswordOtpController`.
  - **The address is always read from the authenticated row, never the request body.** Accepting a
    caller-supplied address would have turned an authenticated endpoint into a mail relay for our own
    domain.
  - **The code is stored hashed; LeapDesk stores it in plaintext.** Storing a live credential readable
    is the exact debt PM-1 existed to remove, and `verify_password` already existed, so it cost nothing.
    Six digits is a small enough space that the hash is not much of a barrier on its own — the real
    protections remain the ten-minute expiry and single use — but a casual read of the table no longer
    hands over a working code.
  - **A wrong guess does not clear the pending code.** Clearing it would let anyone who can reach the
    endpoint invalidate the real user's code at will, which is a denial-of-service dressed up as a
    security measure. The expiry bounds guessing instead, and both the send and verify paths sit in the
    strictest rate-limit tier alongside the 2FA challenge.
  - **Requesting a new code revokes any grace already earned**, so a stale verification cannot be
    paired with a fresh request.
- **`current_password` became optional on change-password, and that is not a loosening.** It may be
  omitted only when the server can see a recent, unexpired OTP verification for that user; a request
  that omits it without one is still refused. The check lives in `auth_service`, not in the schema, so
  the client cannot talk its way past it.
  - **Where LeapDesk keeps that "already proved it" flag in the session, we cannot** — authentication
    here is a stateless JWT and there is no session bag. It became a timestamp on the user row instead,
    which has the side benefit of surviving a restart and being auditable. Three nullable columns,
    migration `e2b8d5c31f47`.
- **"System" is now a real appearance choice rather than a one-time guess.** The old theme hook seeded
  itself from the OS preference and then wrote a concrete light/dark value on first toggle — so the OS
  was consulted once, at first load, and never again. There are now three states, and while on
  `system` a `matchMedia` listener keeps following the OS if it changes mid-session. The anti-FOUC
  script in `<head>` was updated to agree on all three values, and treats an unrecognised stored value
  as "follow the OS" so the values written by the old hook keep working.
- **`employee_id` is now self-editable.** It already existed as a column and appears on LeapDesk's
  profile form, but PM's profile endpoint silently dropped it.
- **Email stays read-only on the profile page, diverging from LeapDesk deliberately.** LeapDesk's form
  edits the address and clears the verification stamp. PM's `update_own_profile` excludes it on purpose
  — changing it breaks the link to a Google account and to any pending invitation, so it is an admin
  action. Flagged as an open decision rather than quietly changed in either direction.
- **Verified against the running stack, not just the compiler.** `alembic upgrade head` applied and
  `alembic_version` reads `e2b8d5c31f47`; all three columns present and nullable in
  `information_schema`; both new paths appear in the live OpenAPI document and return **401**
  unauthenticated; `password_otp_grace` is on `CurrentUserResponse` and `employee_id` on
  `UpdateProfileRequest` in that same document; `tsc --noEmit` clean after the theme-hook rename, whose
  only consumer was updated with it.
  - **Not yet verified: a full send → verify → change round trip against a real mailbox.** That needs
    SMTP configured and the UI to drive it, so it is listed as outstanding rather than claimed.

---

## August 4, 2026 — LeapDesk core parity: the eight admin modules specced against real source

- **The project's focus changed, and the marketplace domain is now parked.** The owner set the near-term
  goal as replicating LeapDesk's core admin shell rather than building the marketplace domain. The
  eight modules named — Users, Roles, Data Access, Activity Log, API Credentials, Invitations, Global
  Search, AI Assistant — turned out to map **exactly** onto LeapDesk's two lower sidebar sections
  ("User Management" and "System Settings"), plus its self-service Settings area (Profile / Password /
  Appearance). That made the scope precisely bounded rather than a wish list.
  `MARKETPLACE_DOMAIN_PLAN.md` is marked parked in `INDEX.md`; nothing in it was deleted.
- **The whole study was done against LeapDesk's source, not from memory.** Result:
  `documentation/planning/LEAPDESK_PARITY_PLAN.md`, with a per-module spec covering schema, endpoints,
  permissions, UI anatomy and business rules. LeapDesk's own docs cover Users, Roles, Invitations,
  Activity Log and UI patterns — but **Data Access, API Credentials, Global Search and the AI Assistant
  are undocumented there and exist only as code**, so those four were read line by line.
- **Four of the eleven items are already done or nearly so, which shrank the real work considerably.**
  Users and Activity Log are at or ahead of parity (PM has CSV export and a retention purge that
  LeapDesk lacks). Invitations is complete on the backend and needs only an admin index page. And PM's
  `users` table already carries **every** field LeapDesk's profile form edits — `first_name`,
  `last_name`, `designation`, `employee_id`, `personal_email`, `personal_mobile_number` — so the
  Profile page needs no migration at all.
  - **The genuinely new work is four modules**, needing seven migrations and fourteen new permissions.
    API Credentials is the largest (~1,040 backend lines, 4,057 frontend across eight pages) and gates
    the AI Assistant, which cannot ship before it.
- **Two findings are defects rather than parity gaps, and one is a live over-exposure.** PM's activity
  list binds the actor to an unused `_actor` parameter, so **anyone holding `activity-view` reads the
  whole organisation's audit trail**; LeapDesk sandboxes non-admins to rows where they were the causer.
  Separately, `POST /api/auth/me/change-password` works and has **no UI anywhere** — a functioning
  endpoint no user can reach. Both are argued in the plan for jumping the queue.
- **Four things do not survive the Laravel→FastAPI translation and are flagged as decisions, not
  assumptions.** LeapDesk's password-OTP recovery parks a grace flag in the session, and PM is
  stateless JWT. `CredentialManager` and the search registry both use Laravel's cache store, and PM has
  no Redis. Those two got options tables with a recommendation rather than a silent choice. The other
  two resolve cleanly: Global Search runs on Scout with `SCOUT_DRIVER=database` — SQL `LIKE`, **no
  external search engine** — so it ports to Postgres directly; and `Laravel\Ai` becomes the Anthropic
  Python SDK's tool runner.
  - **The AI model pin was deliberately not copied.** LeapDesk pins `claude-sonnet-4-6`; the plan
    specifies `claude-opus-5` with adaptive thinking and effort control, notes that `budget_tokens`
    and `temperature` now return 400, and requires handling the `refusal` stop reason before reading
    the response. Copying the constant verbatim would have shipped a stale model and two dead
    parameters.
- **A convention conflict inside LeapDesk was surfaced rather than smoothed over.** Its own
  `AUTHORIZATION.md` documents `{resource}-{action}` permission names — which is what PM already uses —
  but its four newest modules ignore that and use dotted names (`data-access.manage`,
  `api-credentials.providers.create`, `search.entities.manage`, `ai-assistant.use`). The plan
  recommends adopting the dotted names verbatim **including the inconsistency**, so a future LeapDesk
  feature ports without a rename table. That is one of eight open decisions listed at the end.
- **An earlier claim of mine was wrong and is corrected in the plan.** I had said Data Access was
  "LeapDesk's answer to PM-5". It is only half that: Data Access delegates by **record creator**
  (`created_by`), while PM-5 and the marketplace plan specify scoping by **partner organisation**
  (`partner_id`). They are complementary — building Data Access closes the "no row-scoping pattern
  exists anywhere" half of PM-5 and leaves the tenant-isolation half open.
- **Nothing was built.** No code, no migrations, no permission seeding — this entry is a spec and two
  documentation updates only. The security-sensitive parts were written up in detail precisely because
  they will ship without a test suite: the AI assistant's `DatabaseQuery` needs all five of its
  controls (a read-only DB connection, a denied-table regex, column redaction, an operator allowlist,
  output caps), and Global Search has three distinct permission layers. Per PM-11's recorded
  mitigation, each of those gets its verification written into this file when it is built.

---

## August 3, 2026 — Viho theme captured as a design reference

- **The visual direction now has a written spec instead of living in a browser tab.** The owner
  selected the Viho admin theme (Pixelstrap) and shared its login screen. Because the theme is
  **paid**, its source cannot enter this repo — so the design *decisions* were extracted into
  `documentation/design/VIHO_THEME_REFERENCE.md` and the source stays out. New folder
  `documentation/design/` with `assets/screenshots/` for the owner's screenshots, plus a row in
  `INDEX.md`.
- **The values are parsed from the theme's stylesheets, not eyedropped from screenshots.** The demo
  serves two CSS bundles totalling 2.6 MB; `app.css` alone carries 3,878 hex literals across 258
  distinct colours. Every value in the doc names the selector it came from, so it can be re-checked.
  The filenames are content-hashed, so the doc records the hashes and says to re-verify when they
  change. The theme's brand variable is genuinely misspelled `--theme-deafult` — quoted verbatim so
  nobody "corrects" it while diffing against the demo, but our own token is spelled properly.
- **Viho is teal-and-tan, and our app is orange.** Primary `#24695c`, secondary `#ba895d`. That makes
  the theme's personality a genuine product decision rather than a styling tweak, so the doc ends with
  an explicit Adoption Decision section listing three conflicts against `UI_PATTERNS.md` — brand hue,
  `border-radius: 0` versus our mandatory `rounded-lg`, and Montserrat 14px versus Inter — with the
  cost of each. None were applied; no component or config was touched.
- **A contrast audit was run rather than assumed, and it found four failures worth not copying.** The
  worst is real and shipped in the theme: `.btn-warning` sets white text on mustard `#e2c636`, which
  is **1.70:1** — dark text on the same fill is 8.58. Also failing: muted `#999999` on white (2.85),
  white on secondary `#ba895d` (3.08), and placeholder `#898989` (3.50). The doc's proposed token set
  substitutes our own passing values for these instead of inheriting them.
- **One trap found that a purely visual review would have missed.** Viho's cards use 30px padding and
  30px bottom margin — airier than ours. Our mandatory full-height index layout sizes itself with
  `useAutoPerPage()`'s `floor((h − 433) / 38)`, so adopting that spacing changes how many table rows
  fit and the 433 constant must be re-measured. Recorded in the doc so it is not discovered later as a
  layout bug.
- **Also noted:** the theme's `success` is a shade of its own primary and its `info` is grey, so both
  read wrong semantically; and its login input sets `:focus { box-shadow: none }`, which our standards
  forbid. All three are called out as "do not copy".
- **The owner then supplied four screenshots, and checking the doc against them corrected two claims.**
  The images went into `documentation/design/assets/screenshots/`; the parallel `assets/inspiration/`
  folder was folded into it so the two could not drift, and three files were renamed to the documented
  convention. Colours were then verified by sampling pixels rather than by eye.
  - **Dark mode was documented backwards.** Reading the CSS alone suggested the content wrapper and the
    cards were both `#111727`, and the doc warned cards would look flat. The pixels say the gutters are
    `#202938` and the cards are `#111727` — so cards are **darker** than the page. That is an
    inversion of the usual convention and of our own dark mode, where surfaces are *lighter* than the
    page. It is now recorded as a fourth adoption conflict, because matching it means inverting our
    surface tokens rather than re-hexing them. This only came to light because a dark-mode screenshot
    arrived; static analysis of a 1.3 MB minified stylesheet could not settle it.
  - **"Squared corners" was too broad.** Cards really are `border-radius: 0`, but corner-pixel scans
    show the primary button at ~5–6px and the active sidebar item at ~8–10px. The theme pairs squared
    surfaces with rounded controls, so our `rounded-lg` controls **already match** and only the card
    radius conflicts. The adoption cost for that item dropped from "touch 11 primitives" to one
    decision about `Card`.
- **The screenshots also produced a dashboard-shell section the CSS could not give.** Sidebar profile
  block, nav item states, header icon row, and the widget vocabulary — stat cards, gradient area
  charts, ghost/track bars behind real bars, in-cell sparklines, borderless tables. Three of those
  conflict with our patterns and are flagged: Viho renders status as plain text where our index spec
  mandates an interactive `Badge` in a fixed column, its charts use a strictly two-colour categorical
  palette, and in-cell sparklines would be a real `DataTable` feature rather than a style tweak.
- **A ranked list of the screenshots still worth capturing is in the doc** rather than left to memory —
  index/table page first, then the form wizard, then user edit/profile, then a modal and input error
  states. The reasoning is recorded per item so the next person can re-prioritise instead of guessing.
- **The owner then added 30 more screenshots covering the widget and chart pages plus 15 other screens,
  and the doc became a build-time lookup rather than a colour reference.** All 30 arrived as
  `Screenshot From <timestamp>.png`; each was opened and identified, then renamed to describe its screen
  (`tables-datatable-light-pagination.png`, `widgets-chart-dark-2-radar-bubble.png`, and so on), and the
  earlier misspelled `dashbaord1_darkmode.png` was regularised to `dashboard-default-dark.png`. 34
  screenshots total, no duplicates by hash, every one referenced from the doc and every link verified to
  resolve.
- **The doc now leads with a "when you're building X → open this screenshot" table.** That was the
  owner's stated goal: not a palette, but something a future session can consult before writing a
  component. Nineteen build tasks map to specific files, followed by a per-file index of what to notice
  in each, grouped by area.
- **Two more of the doc's own claims were wrong and are corrected.** The dashboard widget's borderless,
  plain-text-status table had led to "status is plain text, not a badge" — but the real index pages
  (`tables-basic-light`, `tables-datatable-light-pagination`) use badges, `#` first columns, `⋮` action
  menus and 1px `#e6edef` row dividers. Viho's tables are **closer to our mandatory index spec than the
  widget suggested**, and the only genuine conflict is page size: Viho asks the user via
  `Show [10] entries` where `useAutoPerPage()` derives it from viewport height. Separately, "charts use
  exactly two categorical colours" was wrong — the Support Ticket page's six progress bars sample to
  exactly the six semantic tones, and the radar and bubble charts add gold as a third series.
- **The most reusable find is a derivable soft-badge rule.** The Todo page's `In progress` / `Pending` /
  `Done` pills all composite to within 1–3 values of `tone at 20% over white` with the solid tone as
  text, so the whole variant is `bg-{tone}/20 text-{tone}` against the solid `bg-{tone} text-white`.
  No new tokens, and our `Badge` only has the solid style today.
- **Also newly documented:** the full form vocabulary (labels always above, 20px field gaps, 2-up/3-up
  grids for short fields, a dashed brand-bordered tinted upload zone), pagination styling (active page a
  solid squared `#24695c` tile), the six-group ~40-item sidebar structure, and calendar/kanban tone
  usage. Three things are explicitly marked do-not-copy: `Add`-in-tan beside `Cancel`-in-red, the
  required-asterisk hidden in a placeholder, and treating `success`/`info` as teal/grey.
- **Verified:** values quoted from real selectors in the downloaded CSS, then cross-checked against all
  34 renders by pixel sampling, 1px border scans and corner-radius ramps; contrast ratios computed from
  sRGB relative luminance, not estimated. The login page's alpha washes composite to exactly the
  measured `#eaf0ef` / `#eff3f2` and the six progress fills to the exact `.btn-*` hexes, so extraction
  and render agree. Link integrity checked programmatically: 34 files on disk, 34 referenced, 0 broken.
  **Documentation only — no application code changed**, so there is nothing to build or test. Four gaps
  remain and are listed: input error states, form wizard, an open modal, an open dropdown.
- **The screenshots are temporary, by the owner's decision, and that is now written down.** They exist to
  get the UI/UX components built; once the component set is complete and the patterns live in
  `UI_PATTERNS.md`, the folder gets deleted. That also settles the licensing tension the folder's own
  README raises — 34 shots of a paid theme is acceptable as working reference during a build, and is not
  meant to remain in a public repo afterwards. The extracted **values** are the lasting output; the
  images are scaffolding.
- **One catch recorded with it, because the plan does not work the way it sounds.** `git rm` removes the
  files from the working tree but **not from history**: after deletion the ~14 MB still ships with every
  clone, and the images stay reachable at their old commits on a public remote. Deleting them does not
  un-publish them. Reclaiming the space needs a history rewrite plus a force-push, which changes every
  commit hash — **cheap on an unmerged feature branch, expensive on `main`**, so it is worth deciding
  before this branch merges rather than after.

---

## August 3, 2026 — Activity Log index: the audit trail is readable

- **The audit trail has a read surface, so PM-32 is finally a whole feature.** It has been recording since
  earlier today and nothing could read it — history nobody can see is not much better than no history. There
  is now `GET /api/activity` behind a new **`activity-view`** permission, plus an Activity Log index at
  `/dashboard/activity`, which is the equivalent of LeapDesk's.
- **Read-only structurally rather than by policy.** No create, update or delete route exists and no service
  function sits behind one — `POST`, `PUT`, `PATCH` and `DELETE` all return **405**, verified. An audit trail
  a privileged user can edit is not evidence of anything, so tampering is prevented by the absence of a code
  path rather than by a permission that someone could later widen without knowing why it was narrow. The UI
  follows the same rule: no row actions, no bulk actions. A delete button on an audit trail would be the
  single most damaging control in the product.
- **The filter dropdown is built from the data, not a hardcoded list.** `GET /api/activity/events` returns
  the event names actually present, so an event added by a future call site appears without anyone
  remembering to register it, and one that has never occurred does not clutter the filter. It found 15.
- **Sorted by `id`, not `created_at`.** Rows written inside one transaction share a timestamp, and an
  unstable sort lets a row appear on two consecutive pages or on neither.
- **Actor names are resolved once per page, not once per row.** `causer_id` is a bare UUID that means nothing
  on screen; resolving it per row would issue 25 lookups to render one page.
- **`activity-view` went to Admin and above, deliberately not to Staff.** Staff is a read-across-modules
  role, and the trail carries failed-login attempts with email addresses and IP addresses for every account.
  Worth noting what happened when the permission was added: **every Admin received it automatically**,
  because the role matrix gives Admin `"*"`. That is exactly the documented consequence of the wildcard
  choice made earlier today — a new sensitive permission has to be reviewed against it on purpose.
- **Not scoped by actor, and that is a decision rather than an omission.** `activity-view` is the whole
  authorisation: a partial view of an audit trail is worse than none when someone is reviewing an incident
  and needs to know they are seeing everything. It is now flagged as **the first query to revisit when
  partner scoping lands (PM-5)**, because a partner must never read another partner's history.
- **The wired coverage is written into `AUTHORIZATION.md` rather than left implicit.** Recording is explicit
  at each call site instead of a global ORM hook — a hook cannot be forgotten, but it would log the inherited
  test-platform domain and every session `last_seen_at` touch and bury the role grants. The cost of choosing
  explicit is that calls *can* be forgotten, so all sixteen wired events and where they fire are listed for a
  reviewer to check against the routes.
- **Lint 18 → 19, and one of the two new errors was fixed properly rather than absorbed.** `ActivityModule`
  originally reset the page number from an effect reacting to a filter change — a genuine synchronous
  setState-in-effect, and backwards as an expression of intent. Resetting the page inside the filter setters
  is both what the rule wants and the clearer statement that "changing a filter means starting at page 1".
  The remaining one is the same fetch-on-mount false positive as the other 17, all still waiting on the
  PM-25 config decision.
- **Verified against the running stack:** 42 entries across 11 pages with names resolved; filters correct
  (`log_name=auth` → 34, `failed_login` → 5, `search=granted` → 2); every write verb `405`; `activity-view`
  absent from the Partner role and present for Admin; `tsc` clean; build green with the new route. The test
  account moved to Partner for the permission check was restored to Admin.
- **Still open on the audit log:** no retention policy — the table grows forever and, unlike sessions, must
  not simply be purged, so how long who-did-what is kept is a real decision. And no export, which is the
  first thing anyone asks for during an actual incident review.

---

## August 3, 2026 — Email verification, enforced (last Fortify gap)

- **Email verification exists and is actually enforced, which is more than LeapDesk manages.** Its
  `config/fortify.php` enables the feature, but `User.php` has `MustVerifyEmail` commented out and the
  class does not implement it — so the routes exist and nothing checks them. Copying that would have been
  copying a half-wired feature. This closes the last of the four Fortify features.
- **The real design question was where the gate goes, and the answer is not where you would first put it.**
  Registration already lands INACTIVE pending approval, so blocking the *user* on verification adds a
  second gate that tells them nothing new. Blocking the *approver* is what matters: activating an
  unverified account hands a live password-reset path to an address its owner may not control. So
  approval answers **409** on an unconfirmed address, with an explicit `force_unverified=true` for an
  administrator who has confirmed identity over a call — recorded as an override, both in the description
  and as `unverified_override: true`, so "who approved an unverified account" stays answerable.
- **Tokens are stateless and bound to the address.** No columns, no cleanup, nothing to leak — the same
  approach Laravel takes with signed URLs. Binding the address into the claim buys a property a stored
  token would not: **changing the address invalidates every outstanding token for the old one**, so a link
  mailed to a typo cannot verify the corrected address. Verified — after an admin changed the email, the
  outstanding token returned `400`.
- **Not single-use, on purpose.** Verifying twice is harmless, so a column and a write to prevent it would
  buy nothing. The second click returns `200`.
- **24-hour expiry rather than the password reset's one hour.** A reset link is a live credential and
  should be short-lived; a verification link proves an address and grants nothing on its own, so the
  balance tips towards the person who opens their email the next morning.
- **`/resend-verification` deliberately says nothing.** Identical answer whether the address exists, is
  already verified, or the send failed — same reasoning as `/forgot-password`. Distinguishing those cases
  would be an enumeration oracle *and* would reveal which addresses are pending. It is in the strict rate
  limit tier especially, because it mails an address the caller names and would otherwise be a free relay
  for mailbombing a third party.
- **Eight checks against the running stack, all passing:** register produced a link in the log; approving
  before verifying returned `409` with a message naming the override; verify `200`; verify again `200`;
  approve then `200`; the override path `409` then `200` with the audit row flagging it; and an address
  change invalidated the outstanding token. Both probe accounts were deleted afterwards, leaving the local
  database as it was found.

---

## August 3, 2026 — 2FA frontend, security headers finished, admin 2FA reset

- **The 2FA endpoints now have a UI.** They worked and nothing reached them — the same state the RBAC API
  was in before July 31. Sign-in gained a challenge step, and the profile modal gained a security section
  for enrolling, confirming, disabling and re-keying.
- **Sign-in branches on an explicit flag, not on a missing field.** `/login` returns one of two shapes, and
  the client tests `two_factor_required` rather than inferring from an absent `user`. A correct password
  with 2FA enabled is **not** a sign-in, and treating it as one would drop the user at a dashboard with no
  session. A typed `isTwoFactorRequired()` narrowing helper exists so no call site has to remember which
  field to check.
- **The challenge replaces the form rather than appearing beside it.** Leaving the email and password on
  screen invites re-submitting them, which mints a second challenge token and invalidates nothing.
- **Both ways in are offered, and that is not optional.** A phone is lost far more often than a password,
  so a UI accepting only an authenticator code strands the user holding recovery codes they cannot use.
  The recovery path shows how many codes remain, and the settings panel warns in amber at two or fewer —
  running out is how losing a phone becomes losing the account.
- **A 429 at the challenge is reported as rate limiting, not as a wrong code.** Saying "that code is
  invalid" when the real problem is too many attempts sends people hunting for a fault in their
  authenticator app.
- **The UI mirrors the backend's three states instead of collapsing them to on/off.** A stored-but-
  unconfirmed secret gets its own "Setup incomplete" badge and its own copy saying 2FA is *not* being
  enforced. Collapsing that into "on" is precisely how a user believes they are protected when they are
  not — or believes they are locked out when they are not.
- **No QR image, deliberately, and that is a trade-off worth naming.** Rendering one means adding a QR
  library to a project where `npm ci` is already broken on a peer conflict (PM-25). What ships instead
  works everywhere: the `otpauth://` URI as a link, which opens the authenticator directly on a phone,
  plus the secret grouped in fours for the manual-entry field every authenticator has. A QR is a nicety on
  top of that, recorded as follow-up rather than pretended to be present.
- **The password-confirmation gate is handled as a retry, not an error.** The backend answers `403` with
  `X-Password-Confirmation-Required`; the UI catches that, prompts for the password, and then **re-runs
  the original action**. Treating it as a `401` would have signed the user out instead of asking them a
  question.
- **Security headers are now on the frontend too, completing PM-33.** `next.config.mjs` sets them on every
  page. Not duplication of the API's set — a header on the API does nothing for a page the API did not
  serve, and framing and MIME-sniffing protections matter on HTML where they are close to decorative on
  JSON. HSTS is deliberately absent here: it belongs on the TLS terminator, and emitting it from a dev
  server on plain HTTP would pin `localhost` to HTTPS in every developer's browser for a year with no
  server-side undo.
- **Admin 2FA reset added, for the case recovery codes exist to cover and sometimes do not** — a lost
  phone with every code already spent. `POST /api/users/{id}/reset-two-factor` clears the enrolment **and
  revokes every session**, and the pairing is the point: if the phone was stolen rather than lost, whoever
  has it may still hold a live session, so clearing only the secret would remove the second factor and
  leave the attacker signed in. Gated on `user-update` plus the same protection rule as an edit — verified
  `403` when an Admin targets a super-admin, `400` when there is nothing to reset rather than a silent
  no-op, and recorded with the actor.
- **Lint went 17 → 18, and it is not being hidden.** The new settings component fetches on mount, which is
  the ordinary shape of a client component reading an API, and `set-state-in-effect` flags it. An honest
  attempt to satisfy the rule — threading a cancellation flag so the effect cannot write state after
  unmount — **did not clear it**, because the rule flags any call that transitively sets state and cannot
  see that the function awaits first. The flag was kept regardless, since it fixes a real
  setState-after-unmount in a component living inside a closable modal. The count was updated in PM-30
  along with the point this proves: the rule set is a tax on every new component, not a fixed list of 17
  legacy problems, which is the real argument for settling PM-25.
- **Verified:** `tsc --noEmit` clean, `next build` green, security headers confirmed on `/sign-in`, and the
  admin reset exercised through all four of its outcomes against the running API.

---

## August 3, 2026 — Two-factor auth and password confirmation (Fortify parity)

- **The ecosystem question first, because it decided the approach: there is no Fortify for FastAPI.**
  `fastapi-users` is the nearest analogue — registration, login, password reset, email verification,
  OAuth — but it has **no 2FA at all**, and adopting it means it owns the user model and replaces an auth
  layer that had just been audited and hardened. Rejected. Built directly instead, on **one** new
  dependency: `pyotp`. Secret encryption reuses Fernet from `cryptography`, already installed as a
  `python-jose` extra, and no QR library was needed — the API returns the `otpauth://` URI and the
  frontend renders it, rather than pulling in `qrcode` plus Pillow to draw a picture the browser can draw.
- **Fortify gives LeapDesk four features. Three were already covered and two were genuinely missing.**
  Registration, password reset and login throttling we had — and on throttling we are *ahead*, because
  LeapDesk has no lockout columns at all. Missing were two-factor auth and, less obviously, the
  **password confirmation** that `confirmPassword => true` implies. That third one is easy to overlook and
  is the reason 2FA is worth anything: without it, someone holding a stolen session could quietly turn the
  second factor **off**.
- **2FA has three states, and the middle one is the whole design.** A stored secret does not enable
  anything until the user has proved once that they can read a code from it. If storing a secret were
  enough, anyone who mis-scanned the QR — or scanned it into an app on a phone they then wiped — would be
  required to produce codes nothing can generate, with no way back in. Verified: while enrolment is
  pending, login still succeeds without a code.
- **The secret and the recovery codes are encrypted at rest, and that is not paranoia.** In the clear,
  anyone with a database dump — a backup on a laptop, a restored snapshot, a reporting replica — can mint
  valid codes for every account with 2FA enabled, and the second factor silently becomes no factor.
  Laravel encrypts these columns for exactly this reason. The key is derived from `SECRET_KEY` via HKDF
  with its own info string, so the encryption key and the JWT signing key are different values.
- **The cost of that choice is written down rather than discovered later: rotating `SECRET_KEY` makes
  every enrolled user re-enrol.** `decrypt` returns `None` instead of raising, which callers read as "no
  secret", so the failure is a refused code rather than a 500. Rotation already invalidates every token
  and signs everyone out, so it was never routine — this raises the stakes.
- **Recovery codes are single-use by deletion.** Eight at enrolment, each removed the moment it is used,
  so a code read over someone's shoulder is worth one login at most. Shown exactly once; the column holds
  ciphertext and nothing decrypts it for display.
- **A wrong 2FA code counts against the same lockout the password uses.** A separate counter would hand an
  attacker who already knows the password a fresh, independent budget of guesses at the second factor —
  precisely the position 2FA exists to make hopeless. Both challenge endpoints are also in the rate
  limiter's strict tier, since a six-digit code is one in a million per guess and only strong while
  guesses are limited.
- **Password confirmation is stored per session, not per user.** It means "this browser proved it knows
  the password recently", which is a property of the session; on the user, confirming on a laptop would
  authorise a sensitive action from a phone. 180-minute window, matching Laravel's default.
- **Fifteen checks against the running stack, all passing.** Enrol refused `403` until the password was
  confirmed; wrong password `422`; enrolment returned a secret, URI and 8 codes; pending state reported
  `enabled=false` and login still worked without a code; wrong confirm code `422` and the real one enabled
  it; login then returned `two_factor_required` with **zero `Set-Cookie` headers**; the challenge token was
  **refused at `/me`**, confirming the `type` assertion holds; wrong TOTP `401`, real TOTP gave a working
  session; a recovery code signed in and dropped the count 8 → 7; **reusing it returned `401`**; disable was
  `403` without confirmation and `200` with it, clearing the secrets; and login returned to normal after.
  The test account was left with 2FA off.
- **A real bug found by reading, not by testing.** `POST /api/auth/accept-invitation` still called
  `set_auth_cookies` with the pre-sessions two-argument signature and **would have raised on the first
  invitation anyone accepted**. Nothing exercises that path, which is PM-11 earning its severity — the
  session work landed with a latent crash in it and only a manual read caught it.
- **A finding about LeapDesk worth recording, because it changed what "parity" means.** Its email
  verification is **configured but never enforced**: `config/fortify.php` enables
  `Features::emailVerification()`, but `app/Models/User.php` has
  `// use Illuminate\Contracts\Auth\MustVerifyEmail;` commented out and the class does not implement it.
  The routes exist; the gate does not. Copying LeapDesk here would mean copying a half-wired feature, so
  it is recorded as **PM-35** to be built *enforced* — along with the honest question of whether
  verification should gate approval rather than add a second gate that says nothing new.
- **Still open on 2FA: there is no frontend.** The endpoints work and nothing in the UI reaches them —
  the same state the RBAC API was in before July 31. There is also no admin "reset this user's 2FA"
  action, which support will want the first time someone loses a phone with no recovery codes left.

---

## August 3, 2026 — Audit trail and security headers

- **There is an audit trail now, and it can answer questions the old columns could not (PM-32).**
  `created_by` and `updated_by` record who last touched a row and then overwrite themselves, so nothing
  could answer *who granted this user the Admin role*, *who deactivated this account*, or *what did this
  role's permissions look like before*. `activity_log` is append-only and keeps the history. Structured
  logging was not a substitute: those lines go to stdout, are not queryable, and vanish with the
  container.
- **Column names are LeapDesk's verbatim**, because it is `spatie/laravel-activitylog`'s table and a
  developer who knows one schema should read the other without translating: `log_name`, `description`,
  `subject_type`, `subject_id`, `event`, `causer_type`, `causer_id`, `properties`, `batch_uuid`,
  timestamps — down to Spatie's index names `subject` and `causer`.
- **Two column *types* diverge while the names do not.** `subject_id`/`causer_id` are strings, because our
  ids are UUIDs and one column has to hold both a user's UUID and a role's integer id. `properties` is
  `JSONB` rather than `json`, so it can be indexed and queried — storing an audit trail in a database
  rather than a log file is pointless if it cannot be searched. And `*_type` holds `User` or `Role`, not
  `App\Models\User`; a PHP namespace in a Python codebase is a lie someone would eventually try to
  resolve.
- **Every auth outcome is recorded, including the failures.** `failed_login` fires on an unknown email, a
  bad password, a locked account, and — the one that is easy to miss — **credentials correct but status
  blocked**. That last case is not a login, because no session was created, and dropping it would hide
  someone repeatedly probing a suspended account. A failed login has **no causer and no subject**: nobody
  authenticated, and the submitted address may match no account, so inventing a subject would be fiction.
- **Role changes get their own event rather than hiding inside a diff.** In an RBAC system a role grant is
  the change most likely to be the subject of "who did that?", so `roles_changed` carries explicit
  `granted` and `revoked` lists. Verified: *"abcd@gmail.com — granted Staff; revoked Admin"*. A status flip
  likewise becomes `status_changed` rather than a generic `updated`, copying LeapDesk's rewrite.
- **Testing found a gap in my own wiring.** The first pass covered create, update and delete but **missed
  `toggle_status`, `approve_user`, `unlock_user` and both bulk operations** — which is to say it missed
  most of the administrative actions actually worth auditing. Caught only because the verification ran a
  toggle and no row appeared. Now wired, with `batch_uuid` grouping bulk operations so deleting nine
  accounts reads as one action instead of nine unrelated ones.
- **Three deliberate constraints.** Nothing in the service may raise — every entry point swallows and logs
  its own exceptions, matching LeapDesk's try/catch, because failing a login over an audit write would turn
  observability into an outage. Passwords, hashes and reset tokens are stripped from every diff, since a
  trail is read by more people than the database is. And a deletion stores a snapshot of what was removed,
  because after a hard delete a row reading "deleted #7" answers nothing a year later.
- **Recording is explicit rather than a global ORM hook, and that trade-off is named.** A hook cannot be
  forgotten, which is its advantage — and it would have logged the inherited test-platform domain and every
  session `last_seen_at` touch, burying the role grants. The mitigation is that the security-relevant paths
  are listed in the register so a reviewer can check the list against the routes.
- **Security response headers (PM-33).** The API sent none. Now `nosniff`, `Referrer-Policy`,
  `X-Frame-Options`, a CSP `frame-ancestors` and a `Permissions-Policy` on every response — verified
  present on a `429`, since an error is exactly the response someone probing receives. HSTS is behind its
  own flag, verified to emit `max-age=31536000; includeSubDomains` when on and nothing when off.
- **Two deliberate divergences from LeapDesk's middleware.** `X-XSS-Protection` is **not** set: it
  controlled an auditor every current browser has removed, Chrome dropped it in 2019, and it could itself
  be abused to block scripts selectively. And HSTS is not tied to `COOKIE_SECURE`, because the two answer
  different questions — whether cookies need TLS, versus whether every browser that has seen this host
  should refuse plain HTTP to it for a year. Enabling that against a host without a valid certificate is
  not a warning, it is an outage no server-side change can clear.
- **Being honest about what the headers buy here:** this service returns JSON, so framing and sniffing
  protections matter far less than they do on LeapDesk's HTML. The ones that genuinely count are `nosniff`,
  `Referrer-Policy` (reset and invitation links carry a token in the query string) and HSTS.
- **Two halves left open, both stated rather than implied.** The audit log has **no read surface** — no
  endpoint, no permission, no screen — so it is write-only until an Activity Log index is built, and it has
  no retention policy, which is a real decision rather than a cron job. And the frontend still has no
  security headers: `next.config.mjs` is a protected file, and a header on the API does nothing for a page
  the API did not serve.
- **Verified:** migrations applied (head `b6e15d3a9f27`), backend imports clean, and the audit rows checked
  by driving the live API — failed logins with reasons and no causer, login and logout self-attributed,
  role changes both directions, status change on toggle. The test account modified during verification was
  restored to `ACTIVE` / `Admin`.

---

## August 3, 2026 — Auth foundation: sessions, revocation, and LeapDesk column parity

- **Logging out now actually ends the session, which it did not before.** Authentication is stateless
  JWT, and a JWT cannot be un-issued — so `logout` cleared the browser's cookie and nothing else. A
  token captured beforehand stayed valid for the rest of its life: up to an hour for access, **seven days
  for refresh**. Three things followed from that, all real. Logging out forgot the session rather than
  ending it. `/refresh` minted a new pair while the old refresh token stayed good, making a stolen one a
  renewable seven-day credential. And **changing your password evicted nobody** — the one action a person
  takes after a suspected compromise left the attacker exactly where they were.
- **The fix is a `user_sessions` table, which is what LeapDesk gets from Laravel for free.** Laravel
  sessions are database rows, so deleting the row ends the session; there is nothing to port because the
  framework does it. Adapted to JWT: every token now carries a `sid` claim naming a session row, and the
  guard refuses a token whose row is revoked or expired. Logout revokes that one session; a password
  change revokes every **other** one; completing a password reset revokes **all** of them; an admin
  deactivation, single or bulk, revokes all of them too.
- **Change spares the current session and reset does not, deliberately.** Someone changing their password
  in their own settings is demonstrably holding a live session and should not be logged out of the tab
  they are working in — the point is to evict everyone *else*. Someone completing a reset link is usually
  locked out or recovering from a compromise and may be on a borrowed device, so nothing is spared.
- **Measured, not assumed.** A token that returned `200` from `/me` was captured, logout was called, and
  the same token then returned `401 "Your session has ended"`. A refresh token refreshed fine while live
  and returned `401` after logout. Two devices were signed in, the first changed its password, and the
  response said *"Password updated. 7 other sessions signed out"* — device one still `200`, device two
  `401`. A hand-minted token with no `sid` was refused. The session table's `revoked_reason` column shows
  the trail: 2 live, 2 `logout`, 7 `password_change`.
- **Pre-existing tokens fail closed, on purpose.** Anything minted before this has no `sid` and is
  refused, so everyone signs in once more. Accepting a token without one "for compatibility" would have
  left a permanent bypass of the entire mechanism.
- **The cost is one indexed lookup per authenticated request, and it is unavoidable.** Any design that can
  revoke keeps server state somewhere; the only real choice is where. `last_seen_at` is written at most
  once every five minutes, because otherwise every authenticated read becomes a write and a polled
  endpoint like `/me` churns the row continuously.
- **Column names now match LeapDesk where the two schemas mean the same thing.** The owner's point was
  that a developer moving between the projects should not have to translate. `user_invitations` turned out
  to be an **exact** match already, and `permission_groups` nearly so. Renamed `phone` →
  `personal_mobile_number`; added `personal_email`, `profile_photo_path` and `sidebar_preference`
  (LeapDesk's inverted `ACTIVE = collapsed` semantics kept verbatim, with the comment, because matching
  matters more than improving); and renamed the `auth_provider` enum value `'credentials'` → `'password'`.
  Postgres renames an enum label in place, so all four existing rows converted with no data migration.
- **Four LeapDesk columns were deliberately not copied, and the reasoning is recorded.** `guard_name`
  would be the string `'web'` on every row forever. `remember_token` is Laravel cookie auth, not JWT.
  Spatie's polymorphic `model_has_roles` exists so roles can attach to any model — we have exactly one, so
  `model_type` would be `App\Models\User` on every row and `user_roles(user_id, role_id)` says what it
  actually is. And `sessions.payload`/`last_activity` is a server-side session blob, where ours is a
  revocation registry. Adding a column nothing reads is worse than not having it.
- **We also keep four things LeapDesk does not have:** the lockout columns (`failed_login_attempts`,
  `locked_until`, `last_login_at`, `last_login_ip` — LeapDesk has **no lockout columns at all**),
  `is_system` and `description` on roles, and `account_type` / `company_name`.
- **The audit's good news, which is worth recording as much as the gap:** enforcement coverage is
  **complete**. Every route was checked programmatically — all of them are permission-gated, and every
  ungated one (`register`, `login`, `logout`, `refresh`, `forgot`/`reset-password`, the Google endpoints,
  `invitations/preview`) is intentionally public. Every rule in LeapDesk's `UserPolicy` and `RolePolicy`
  is already ported into `user_service` / `rbac_service`.
- **Three gaps found and recorded rather than half-built:** **PM-31**, `/refresh` reissues rather than
  rotates, so a superseded refresh token stays usable while its session lives — proper rotation needs a
  `jti` and reuse detection. **PM-32**, no audit log; LeapDesk has `spatie/laravel-activitylog` with a
  dirty-field diff trait and a `failed_login` listener, and `created_by`/`updated_by` cannot answer "who
  granted this role". **PM-33**, no security response headers; LeapDesk registers a `SecurityHeaders`
  middleware globally.
- **Verified:** backend imports clean, both migrations applied (head `a7d92c4f1b83`), `tsc --noEmit`
  clean, `next build` green, lint unchanged at 17 pre-existing PM-30 errors. `/me` confirmed returning
  `auth_provider: "password"` with the new field names.

---

## August 3, 2026 — Tech-debt sweep: seven items closed, and a register that had drifted

**The day in one line:** the ranked tech-debt queue was worked top to bottom. Seven items closed, two of
them turning out to have been **fixed in code for days with only the register still calling them
blockers**, and one security control I wrote was found to be completely bypassable before it shipped.

| Item | Outcome |
|------|---------|
| PM-29 | ESLint runs for the first time. Recorded cause was wrong; 7 real defects fixed |
| PM-2 | Cookie flags — the **logout** half was genuinely still open |
| PM-4 | Already fixed in code. The **documentation** was the live defect |
| PM-26 | Per-IP rate limiting. Also closed PM-8, and closed a bypass in my own first version |
| PM-10 | Structured logging with request correlation. **Monitoring half left open** |
| PM-19 | Error boundaries, loading states, 404 |
| PM-27 | Invitation and password-reset email |
| PM-30 | **New** — the 17 react-hooks errors that closing PM-29 revealed |

Still needing the owner: **PM-5** (blocked on domain-plan approval), **PM-28** (needs OAuth
credentials), **PM-25** (a framework-version decision), **PM-11** (last, by the owner's decision).

All of it went onto `feature/platform-hardening` rather than straight to `main`, and was pushed.

---

- **The Users and Roles work is in version control, as two commits rather than one.** It had been
  finished and documented since July 31 but never committed, which meant three days of the project's
  largest frontend change existing only in one working tree. Split so each half is reviewable on its
  own: `feat(ui)` for the reusable index-page component set (9 new files plus the `Input` changes the
  filter bars needed), and `feat(admin)` for the two modules, the permission gating and the `UserInfo`
  deletion. `tsc --noEmit` exits 0 on the committed tree.
- **Automated tests (PM-11) are now deliberately the *last* item in the queue, not the first.** The
  owner's reasoning: tests are slow to write and slow to run, and that cost would be paid on every
  task ahead of them. This reverses what both `TECH_DEBT.md` and `MARKETPLACE_DOMAIN_PLAN.md`
  recommended, so both were updated in the same change — leaving them saying "tests first" would have
  had the next session arguing with the decision instead of acting on it.
- **What that costs is written down rather than left implicit.** Row-level scoping (PM-5) will ship
  with no regression net, and a scoping bug does not raise an error — it quietly returns another
  partner's rows. `tsc` and `next build` are the only automatic checks, and until PM-29 is fixed there
  is no linting at all; none of the three check behaviour. The agreed mitigation is that every change
  to a scoping or permission path records its manual verification here — what was run, against which
  role, and what came back — so the eventual suite knows what it has to reproduce.
- **The revised order:** PM-29 (ESLint) → PM-26 + PM-2 → PM-5 → PM-27 → PM-28 → PM-4/10/19 → PM-25 →
  PM-11. PM-5 moved up because it is the same work as Build Sequence step 2 and blocks the first
  partner-owned table.
- **One correction to the domain plan while it was open:** step 6 claimed the RBAC admin UI was still
  outstanding. Its admin half shipped on July 31; only the partner-facing side remains.
- **Linting works for the first time (PM-29), and the recorded cause of the outage was wrong.** The
  register said a hoisted transitive ESLint 6 was winning module resolution. It wasn't: the local
  install is 9.39.4 and always was. What had actually happened is that all 23 shims in
  `frontend/node_modules/.bin/` had lost their execute bit, so `npx` and `npm run` skipped straight past
  them to Debian's `/usr/bin/eslint`, which is 6.4.0 and wants an `.eslintrc`. The dependency tree was
  never the problem. Restoring the bit is a local repair because `node_modules` is gitignored; what is
  committed is the script fix — `lint` finally has a target, plus `lint:fix` and `typecheck`. The
  diagnostic worth remembering is written into PM-29: compare `npx eslint --version` against the
  version in `node_modules/eslint/package.json`, and if they disagree check the execute bit before
  suspecting the tree.
- **The first real lint run found 24 errors; 7 were genuine defects and are fixed.** Five were one bug
  wearing two rule names: `BottomExpanded` and `BottomCollapsed` were `memo()` components declared
  *inside* `Sidebar`'s render, which hands them a new type on every render — the memoisation was doing
  nothing and any state they held would reset. Both are hoisted to module level and take
  `loggingOut`/`onLogout` as props, and the now-unused `navIcons.logout` gave way to a module-level
  `logoutIcon`. The other two were raw quote characters in JSX text in `Candidate.tsx`.
- **The remaining 17 are deferred on purpose, as PM-30.** Fifteen are `set-state-in-effect`, plus one
  `immutability` and one `preserve-manual-memoization`. They come from `eslint-plugin-react-hooks` v6,
  bundled by `eslint-config-next@16.2.3` — two major versions ahead of the `next@14.2.35` the app
  actually runs. Fixing them now means refactoring twelve files to satisfy rules that the PM-25 version
  decision could remove. They were not blanket-disabled either: the `static-components` findings above
  prove this rule set catches real defects here.
- **Verified:** `npm run typecheck` clean, `npm run build` green across all 10 routes, `npm run lint`
  down from 24 errors to 17. The Sidebar refactor was **not** exercised in a browser — the build
  compiles it, which is not the same as watching the sign-out button work.
- **Working the queue found that two of its items were already fixed, and the register was the only
  thing that still said otherwise.** PM-2 and PM-4 were both sitting there as 🔴 blockers. PM-4 was
  fully closed in code on July 31; PM-2 was half closed. This is worth stating plainly because the
  register is what the next person plans from: **verify an item against the code before starting it.**
- **PM-2's remaining half was real, and it was the logout path.** `set_auth_cookies` has honoured
  `COOKIE_SECURE` since the rebuild, but `clear_auth_cookies` passed only a path to Starlette's
  `delete_cookie`, which does not inherit the flags — it defaults to `samesite="lax"`, `secure=False`.
  Deletion still worked, because browsers match on name/domain/path, so nothing looked wrong. It would
  have broken the first time anyone set `COOKIE_SAMESITE=none` for a cross-site deployment: a
  `SameSite=None` cookie without `Secure` is rejected outright, the expiry header would be dropped, and
  **logout would silently leave the session cookie in place**. Both calls now mirror the full flag set,
  verified by building both responses inside the running container under `False/lax` and `True/none`.
- **PM-4 was closed in code but broken in the docs, which was the more dangerous half.** The seeder
  that hardcoded `abc@gmail.com` / `Abc@1234` doesn't exist any more — it's `seed_rbac.py`, taking
  `ROOT_EMAIL`/`ROOT_PASSWORD` from the environment and generating a random password if none is given.
  There is no working credential in the repository. But **nine places still told people to run
  `python -m app.db.seed_admin`**, so the documented setup command failed with `ModuleNotFoundError`,
  and ONBOARDING § 5.2 still published `Abc@1234` as the password it creates.
- **The deploy blocker list was the worst of it: five of its eight entries were already fixed.** It
  still led with plaintext passwords. A blocker list nobody trusts is worse than none, because the
  entries that *are* real get lost among the ones that aren't. § 0 is now split into what still blocks
  (logging, tests, no production topology), per-environment configuration that is not a defect, and a
  closed-items table, with a note that closing a blocker and moving its row are one change, not two.
- **Four more stale claims found while verifying, all corrected against the live API and files:** the
  migration head was documented as `3ab496a7c5b7` when it is `e7b41c9a2d10` (eight revisions, not
  seven, in two files); the onboarding checklist tested `/api/auth/whoami` and
  `/api/auth/admin/login`, both **removed** when the account tables merged; and it listed an `admin`
  OpenAPI tag group that no longer exists. The corrected commands were each run against the running
  stack — `/api/auth/me` → 401, `/` → 307 to `/sign-in`, CORS preflight echoes the origin, health ok.
- **Per-IP rate limiting exists now (PM-26), and account lockout is no longer the only throttle.**
  Lockout protects one account against many guesses; it does nothing about one guess against many
  accounts, which never trips it. The new limiter keys on the caller's IP with three tiers, because a
  single number cannot serve both a login form and a dashboard: 10/min on credential and token
  endpoints, 60/min on the rest of `/api/auth/*` (the frontend reads `/me` on navigation, so anything
  tighter breaks ordinary browsing rather than an attack), 300/min elsewhere. Health probes are exempt
  so an orchestrator cannot exhaust its own quota and get the service pulled from a load balancer, and
  CORS preflights are exempt so one real request does not cost two. Hand-written rather than adding
  `slowapi`, for the same reason `passlib` was dropped — and because `slowapi`'s default backend is
  in-process memory too, so it would not have fixed the limitation below.
- **Verifying it found that the first working version could be bypassed completely.** Sending 14
  logins while rotating `X-Forwarded-For: 10.9.9.$i` produced **14 successes against a limit of 10** —
  one fresh bucket per request. The fault was not in the limiter but in `get_client_ip`, which returned
  that header whenever it was present. `X-Forwarded-For` is written by the *client*; it is only
  trustworthy when a proxy overwrites it, and this deployment has no reverse proxy at all. So the
  limiter was keyed on a string the attacker chose — and the same header could write any address into
  `users.last_login_ip` and poison the audit trail. It is now gated on `TRUST_PROXY_HEADERS`, default
  off, with the warning that it must be enabled in the same change that deploys the proxy and never
  before. Re-measured after the fix: 10 through, then `429`, whatever the header says. **Had this not
  been tested with a spoofed header, the register would now claim rate limiting that did nothing.**
- **The subtle one: a `429` must carry CORS headers or the user sees nothing useful.** Starlette runs
  the most recently added middleware outermost, so the limiter is registered *before* `CORSMiddleware`
  to sit inside it. Backwards, and the rejection escapes without `Access-Control-Allow-Origin`, so the
  browser reports an opaque network error instead of "too many attempts". Verified present on the 429.
- **Eight checks run against the running stack, all passing:** 10 then `429`; `Retry-After` and
  `X-RateLimit-*` headers correct; CORS header present on the 429; the window releases rather than
  latching; `/health` × 30 all `200`; `/api/auth/me` still served on its own tier while the strict tier
  was exhausted; the spoofing bypass closed; and `get_client_ip` correct in both trust modes, including
  parsing a two-hop chain. **What is not fixed:** counters live in process memory, so N workers
  multiply every limit by N and a restart clears them, and per-IP limiting does nothing against a
  botnet. Both are recorded rather than glossed.
- **The backend logs now, and every line is attributable to a request (PM-10).** It previously logged
  nothing: an unhandled exception became a bare 500 with a traceback on stdout and no way to tie it to
  the request that caused it. Every request now gets an id, echoed back as `X-Request-ID` and stamped
  onto every log record via a filter, so a line emitted deep inside a service is traceable without
  passing an id through every function signature. Three exception handlers: validation errors at INFO
  because a 422 is the caller's mistake, database errors separately from the catch-all because "the
  database refused this" and "the code has a bug" need different responses from whoever is on call, and
  a last-resort handler that logs the traceback and returns only a correlation id. `LOG_FORMAT=console`
  for a human, `json` for an aggregator.
- **Two rules shaped the implementation, and one of them nearly went wrong.** Request bodies are never
  logged, because login, registration, change-password and reset all carry a plaintext password —
  logging bodies would write them to disk in cleartext and undo the bcrypt work. The near-miss was the
  validation handler: `exc.errors()` can echo the submitted value, so it logs only field locations and
  messages. Checked with canary passwords through both the normal and the 422 path; neither appeared in
  the logs. The second rule is that responses carry a correlation id and nothing else — a traceback in a
  response body tells an attacker table names, driver versions and file paths.
- **Verifying it found two bugs in the logging itself, both the same mistake.** The 500 body reported
  `request_id: "-"`, and every access log line read `[-]`. Both because the middleware reset the
  context variable too early — on the error path it ran before Starlette invoked the handler that builds
  the body, and on the success path before the summary line was even emitted. So the one response whose
  entire purpose is to hand over an id handed over a dash, and the most useful line in the log had no id
  on it. Fixed by never resetting: each request sets its own id first thing, so a stale value can never
  be mistaken for a fresh one. **Both were invisible without checking the actual output** — the code
  read fine.
- **A 500 was also logging three tracebacks.** The middleware, the handler, and uvicorn all recorded
  the same failure. The middleware now logs the exception type and message without a traceback,
  contributing the route and duration the other two lack. Uvicorn's copy cannot be removed —
  `ServerErrorMiddleware` always re-raises after calling a handler.
- **Seven checks, all passing:** id generated when absent; a valid inbound id honoured; a malformed one
  (`bad id with spaces!!`) replaced with a fresh id, which is what blocks log injection through a
  newline in the header; a deliberate unhandled exception returning 500 with an id and **no traceback in
  the body**; the traceback present in the log under that same id; canary passwords absent; and
  `LOG_FORMAT=json` emitting one object per line. The 500 was triggered with a temporary route that was
  removed afterwards, and its removal confirmed.
- **PM-10 is deliberately *not* marked resolved — only its logging half is.** Nothing alerts anyone,
  there is no error-tracking service, and container stdout is lost on `docker compose down`. Ticking off
  the whole item because logs exist is how a register stops being trustworthy, which is the same failure
  this day already found twice.
- **A render error no longer produces a blank screen (PM-19).** There were no `error.tsx`,
  `loading.tsx` or `not-found.tsx` files anywhere, so any component that threw took the page with it.
  Eight files now: a global boundary for a failure in the root layout itself, a root boundary, one
  scoped to the dashboard so a broken module leaves the sidebar and top nav usable, one for sign-in, a
  404, two skeleton loading states, and a shared `ErrorState` so four boundaries are not four
  near-copies.
- **The contract was read from the installed package, because the required docs do not exist.**
  `AGENTS.md` says to read `node_modules/next/dist/docs/` before writing Next code — that directory is
  **not present in `next@14.2.35`**. So the shipped types were read instead: `error-boundary.d.ts` for
  the `{ error, reset }` signature and `next-app-loader.js` for which convention filenames this version
  actually recognises. Recorded in PM-19, since the instruction cannot be followed literally.
- **Three details that would each have been a silent bug.** The global boundary renders its own
  `<html>` and `<body>` with inline styles, because it *replaces* the root layout — it cannot assume the
  providers, the store, the theme class or even that the stylesheet loaded, and importing something that
  reached for the store would fail inside the error handler and cause the very blank screen it exists to
  prevent. Users are shown `error.digest`, not `error.message`, because Next deliberately replaces the
  message with an opaque digest for server errors; the message appears only in development. And the
  first verification attempt used a folder named `__boom`, which 404'd — **a folder starting with `_` is
  private and not routable**, so the route never existed and the boundary was never involved.
- **What was verified, and one thing that was not.** All eight files are registered as real route-tree
  entries in the build manifest, which is what catches the actual silent failure — a boundary in the
  wrong place or with the wrong filename is ignored without complaint. The 404 was confirmed end to end:
  a bad URL returns **HTTP 404** with the new copy, and middleware does not intercept it. `tsc` clean,
  build green. **The boundaries themselves were never rendered in a browser** — that cannot be done with
  `curl`, because dev mode's error overlay intercepts and a route that throws during prerender *fails
  the build* (confirmed, which is why the test route was removed). Proving the fallback looks right needs
  the Chrome-DevTools-Protocol harness from July 31.
- **Also fixed, and honestly a pre-existing gap these files exposed:** `Skeleton` had no dark variant.
  Fine as a small inline placeholder, glaring as a full-page one.
- **Invitations and password resets can now actually email people (PM-27).** There was no mail
  configuration at all: creating an invitation returned the accept link for an administrator to send by
  hand, and a password reset token was only reachable by reading the database. There are two backends
  now — `console`, which logs the message so local development needs no SMTP server, and `smtp`, which
  sends for real. `console` is the default on purpose: an unconfigured `smtp` backend fails every send,
  while an unconfigured `console` backend works, and the cost of guessing wrong should be "the link is
  in the log" rather than "nobody can be invited".
- **A send never breaks the thing that triggered it.** Creating an invitation writes a row; emailing is
  a side effect that can fail for reasons of its own — wrong password, blocked port, greylisting relay.
  Letting that propagate would return a 500 for an invitation that *was* created, and the retry would
  then be refused with "a pending invitation already exists". So sending reports back a boolean and the
  caller decides what to say.
- **The accept link is now withheld only when a real email was delivered.** Returning it after
  successful delivery would leave a working credential in an API response, a devtools tab and a log for
  something already sent privately — but withholding it after a *failed* send would leave an invitation
  that nobody can complete. A new `email_sent` flag lets the UI distinguish "we emailed them" from "copy
  this link and send it yourself".
- **`forgot-password` deliberately does not report whether the email went out.** A caller who could
  tell "sent" from "not sent" could enumerate accounts just as easily as one who could read a 404 —
  which is the entire reason that endpoint answers identically either way. Failures are logged, never
  surfaced. The reset TTL also became a named constant, because the email quotes it and a literal in two
  places is how an email ends up promising an hour for a token that lasts two.
- **The SMTP half looked untestable without credentials, so a fake SMTP relay was written to test it.**
  Eight checks passed: the console backend; `smtp` with no host and `smtp` with an unreachable host both
  returning false and logging rather than raising; an unknown backend rejected; and a real SMTP
  conversation against the fake relay that received a well-formed message with the correct recipient,
  subject and an intact reset link. A canary body pushed through both failing paths appeared in
  **neither** log, confirming that a failure logs only recipient and subject — the one moment someone
  would be reading logs is exactly when a reset token must not be in them. Live checks too:
  `forgot-password` returned the neutral message with the link logged under the request's correlation
  id, and a real invitation came back with `email_sent: false` and the link present.
- **What is still not proven:** delivery against a real provider. Authentication, the TLS handshake and
  whether anything lands in an inbox are untested, and SPF/DKIM/DMARC are unconfigured. The protocol is
  verified; deliverability is not. Sends are also synchronous, bounded by a 10-second timeout rather
  than moved to a queue. And `MAIL_BACKEND=console` must never be used in a deployed environment,
  which is now written into the deploy configuration table alongside `TRUST_PROXY_HEADERS` and
  `LOG_FORMAT`.
- **One thing left alone deliberately:** the four accounts in the local database still carry their
  pre-migration passwords, now bcrypt-hashed. `abc@gmail.com` therefore still signs in *on this
  machine*, which is why the onboarding checklist used to pass — but a fresh setup has only the root
  account, so the checklist was misleading for exactly the reader it exists for. Those four passwords
  were readable while they were plaintext and should still be rotated.
- **The day's work went to `feature/platform-hardening`, not straight to `main`.** Nine commits: the two
  Users & Roles commits that had been sitting uncommitted since July 31, plus seven from this sweep.
  Branched rather than pushed to `main` at the owner's request, so the security-relevant changes — rate
  limiting, the `X-Forwarded-For` fix, cookie flags on logout — can be reviewed as a set before they
  land.
- **The one lesson worth carrying forward: the register is a map, not the territory.** Two items were
  worked on that needed no code, the deploy blocker list had five resolved entries still marked as hard
  blockers, the documented setup command referenced a deleted module, and the documented migration head
  was two revisions stale. A note now sits at the top of `TECH_DEBT.md` § Suggested Order telling the
  next person to verify an item against the code before starting it. Closing an item and updating the
  register kept being treated as two acts, and the second one kept not happening.
- **Also worth stating: three of the four things left are waiting on the owner, not on effort.** PM-5 is
  Build Sequence step 2 and building it before the domain plan is approved risks the one mistake that
  plan calls expensive to undo. PM-28 needs OAuth credentials. PM-25 is a framework-version decision
  that also gates PM-30. Only PM-11 is deferred by choice.

---

## July 31, 2026 — Users & Roles modules

- **The Users and Roles modules are now usable after login, instead of only by `curl`.** The RBAC
  backend has been in place since earlier today, but nothing in the UI reached it — there were no
  roles, permissions or invitations pages at all, so granting someone a role needed a developer with
  an HTTP client. Both modules now exist as real screens, built on LeapDesk's mandatory index-page
  patterns rather than an approximation of them: a viewport-locked card where **only the table rows
  scroll**, a sticky table header, pagination at top and bottom that never scrolls out of reach, the
  fixed `#` → `Actions` → `Status` → data column order with `#` and `Actions` squeezed to minimum
  width, a 500ms search debounce, a Reset button that is always visible but disabled until a filter is
  active, and rows-per-page that sizes itself to the viewport so a 32" monitor is not two-thirds white
  space and a 14" laptop is not endless scrolling.
- **Users: everything the API already supported, now reachable.** Search across name, email and
  company; filter by status, account type and role; sort on seven columns; select rows for bulk
  activate, deactivate or delete; and per-row edit, approve, activate/deactivate, clear-lockout and
  delete. Two details carried over deliberately from the API's design: the status badge is itself the
  toggle (click Active to deactivate) and **bulk results report what they skipped and why** — a
  toast carrying skipped reasons does not auto-dismiss, because hiding it after three seconds turns a
  partial success into an apparent total one.
- **Roles: a permission matrix, not a text field.** Each role opens into its permission groups exactly
  as the API returns them, with a select-all per group, a live selected-count, and `partial` / `all`
  markers per group. Protected roles are flagged and open read-only for anyone who is not a super
  admin, matching the API's refusal rather than letting the user discover it on save. A role that
  still has users assigned shows why it cannot be deleted before the button is pressed.
- **Every nav item and dashboard card is now gated on a permission, which surfaced two that never
  were.** The new Users and Roles entries were gated from the start, but the inherited `Candidate` item
  and the whole `Create` group were not — a Partner saw both, and clicking either produced a 403. The
  dashboard's Quick Actions had the same problem, offering "Manage Users" and "View Candidates" to
  accounts that cannot use them. All are filtered on permission now. A Partner's sidebar correctly
  shows Dashboard alone, and their Quick Actions show only "My Profile".
- **Verified by driving real Chrome over the DevTools Protocol, not by reading the code.** 26 checks
  against an Admin session (both modules render and populate from the live API, sticky header, measured
  scroll container, column order, permission matrix opens with all 23 checkboxes) and 9 against a
  freshly created Partner session (each nav item and card correctly absent, and a direct visit to
  `/dashboard/all-users` shows the API's *"This action requires the 'user-view' permission"* rather
  than any data). 35 checks, all passing.
- **Two of those checks failed first for reasons worth writing down.** One was a wrong assertion: the
  test matched the string "Users" anywhere on the page and caught an `<h4>Manage Users</h4>` in a
  dashboard card, not the nav item — the gating was already correct, the test was not. The other was
  browser disk cache: Next.js dev serves chunks under **stable** names, so a headless Chrome reusing
  its profile happily replayed a pre-edit bundle and the fix appeared not to work through a container
  restart and a recompile. `Network.setCacheDisabled` fixed it. Both are now noted in the harness,
  because either would waste an afternoon a second time.
- **The old `UserInfo` component was deleted rather than left beside its replacement.** It was still
  wired to the pre-RBAC shape, and nothing imported it once `UsersModule` landed. Two
  user-management components in one tree is how the wrong one gets edited.
- **Found while trying to lint: ESLint cannot run on this project at all.** `package.json` declares
  ESLint 9 and the config is flat-format, but the binary that resolves is **6.4.0**, which looks for
  `.eslintrc` and errors out. `npm run lint` is also just `eslint` with no target, so it prints help.
  So the only checks that actually run are `tsc --noEmit` and `next build`. Recorded as PM-29.

---

---

## July 31, 2026 — auth & RBAC rebuild

- **Passwords are hashed now, and the four existing accounts kept working.** The scaffold stored and
  compared passwords in plaintext at every layer — `hash_password()` returned its input, login was a
  raw `==`, and the columns said so in a comment. That is replaced with bcrypt at 12 rounds, and
  `verify_password` is the only comparison left anywhere. The migration hashed every existing row **in
  place** rather than forcing a reset, which was verified by logging in afterwards with a
  pre-migration password. One dependency note worth keeping: `passlib` was removed rather than used,
  because passlib 1.7.4 reads a bcrypt attribute that bcrypt deleted in 4.1 — the pair trips on
  import, so bcrypt is called directly. The old values were readable while they existed, so those four
  passwords should still be rotated.
- **The two account tables became one, and roles now decide everything.** `users` and `admin_users`
  were separate tables with separate login endpoints, which meant `whoami` and `refresh` had to probe
  both, `get_current_user` rejected an admin's own token, and adding partners would have made a third
  identity. They are merged: one table, one `POST /api/auth/login`, one guard chain, and capability
  comes from roles. The migration preserved each admin's row `id` specifically so the inherited
  `tests.created_by` foreign key stayed valid, and mapped the old `admin`/`super_admin` values onto the
  new `Admin`/`SuperAdmin` roles. Pre-existing accounts were activated rather than left INACTIVE,
  because they worked before the migration and silently locking everyone out would have been a nasty
  surprise; only *new* accounts get the approval gate.
  - **Old `users.role = 'admin'` was mapped to the plain `User` role, not `Admin`.** No route ever
    checked that column, so it granted nothing — mapping it to `User` preserves what those accounts
    could actually do instead of inventing privilege for them.
- **Authorization is now declarative on every route, which is a deliberate departure from LeapDesk.**
  LeapDesk derives the permission from the route name (`users.index` → `user-view`) with a lookup table
  for anything that doesn't fit the convention. That is elegant but fails *silently* when a path
  doesn't match. Here each endpoint states what it needs — `Depends(require_permission(USER_VIEW))` —
  so the requirement shows up in the OpenAPI schema, can't mis-match, and an ungated route is obvious
  in review. 34 protected routes, 23 permissions in 7 groups, 6 system roles.
- **The three auth guards that existed but were wired to nothing are now the only way in.**
  `require_admin`, `require_super_admin` and `get_client_ip` were previously defined and referenced by
  no route, so reading the dependencies file gave a false impression of what was enforced; super-admin
  rules were actually hand-written inside service functions. Every guard is wired now, and status is
  re-read from the database on **every request** rather than trusted from the token — so suspending an
  account kills its live sessions immediately, which was verified rather than assumed.
- **Account lockout and login auditing work, after being implied by the schema but never implemented.**
  Six columns on the old `admin_users` table — the failure counter, the lock timestamp, both
  last-login fields, and the two password-reset fields — were never written by anything, so reading the
  model suggested lockout and auditing existed when neither did. All six are written now: five
  consecutive failures locks the account for fifteen minutes and login returns `429`, a success or a
  password reset clears it, and an admin can clear it directly. The limitation is worth stating plainly
  — the lockout is per-account, so an attacker can still try one password each against many accounts.
  HTTP-level rate limiting is recorded as PM-26.
- **The privilege-escalation path is closed.** Any admin could previously create a new account with
  `role: "super_admin"` in the request body — stranger still, the same admin could not change their
  *own* role. Role granting now refuses `RootUser`/`SuperAdmin` unless the actor already holds one, on
  both the user and invitation paths. Alongside it, the protection rules from LeapDesk's policies were
  ported and put in one place so no route can forget them: you cannot delete your own account, change
  your own status or roles, or edit or delete a super-admin — and bulk operations *skip* protected
  targets and report why rather than failing the whole batch.
- **Signup policy splits staff from partners, which is where copying LeapDesk exactly would have been
  wrong.** LeapDesk refuses every address outside its own domain. This product exists for external
  partners, so a domain lock would block its primary users. Staff addresses use Google SSO and are
  refused at `/register` — otherwise someone could create a staff account with a self-chosen password
  and bypass SSO entirely — while everyone else registers with credentials and lands INACTIVE pending
  approval. Invited users skip the queue, since an administrator already vouched for the address. All
  of it is configuration, not code.
- **Google SSO is implemented but has never spoken to Google, and the docs say so.** The flow is
  complete — a signed, expiring `state` parameter guards the handshake and carries the optional
  invitation token, Google's own `email_verified` flag is required before an existing account can be
  claimed, the domain is re-checked server-side because `hd` is only a hint, and account resolution
  follows LeapDesk's three steps (known Google id → known email, linked → create INACTIVE). But no
  credentials are configured, so the endpoints return `503` and none of it has run for real. Recorded
  as PM-28 rather than presented as working.
- **Tokenised invitations, with the two checks that actually matter.** An invitation carries a 64-char
  token, a 7-day expiry and a pre-assigned role. Acceptance verifies the invitation is still pending
  and unexpired, **and that the accepting account's email matches the invited address** — without the
  second check anyone holding a link could claim the invited role. Resending rotates the token so the
  old link dies rather than becoming a second valid one. Because there is no mail transport, the create
  and resend responses return the accept URL for an administrator to send by hand; that is a visible
  manual step rather than an email that silently never arrives (PM-27).
- **Verified with 41 end-to-end checks, and two of the first failures were the test's fault.** The
  script exercises hashing, enumeration parity, the approval gate, partner confinement, self-protection,
  escalation attempts, token-type confusion, lockout, the invitation lifecycle and immediate session
  death on suspension. The first run failed sixteen checks; the cause was using `.test` addresses,
  which `EmailStr` correctly rejects as an RFC 2606 reserved TLD, and the empty ids that followed
  turned `/api/users//approve` into a `307`. Worth recording because the failure looked like a broken
  API and was a broken fixture. All 41 pass. It is still a shell script and not a test suite — PM-11
  is now the highest-value gap, since the auth surface is much larger than it was.
- **The frontend had to be rewired, and it was silently broken until it was.** Six places still called
  endpoints that no longer exist — `adminLogin`, `whoami`, `adminMe`, `/api/admin/users`. The API layer,
  auth slice, types, sign-in and sign-up forms, profile form, and the user-administration component
  were all moved onto the unified shape: a single `CurrentUser` with resolved `roles` and `permissions`,
  a `usePermissions()` hook for gating, a role picker driven by the real roles table instead of a
  hardcoded admin/super-admin pair, and a three-state status control because a boolean toggle cannot
  express SUSPENDED. `tsc` is clean and `npm run build` generates all 12 routes.

---

---

## July 31, 2026 — earlier (containerisation)

- **Local development is now fully containerised, and the reason is that the project could no longer
  be set up by hand on this machine.** `docker-compose.yml` gained two development services, `backend`
  and `frontend`, alongside the existing `db` and `adminer`, so `docker compose up -d` now brings up
  the whole stack. The trigger was concrete: the host's only Python is **3.14**, and the pinned
  backend dependencies — `psycopg2-binary` 2.9.10, `pydantic` 2.10.3, `sqlalchemy` 2.0.36 — publish no
  wheels for it, so the documented "run uvicorn on your host" path fails at `pip install` and would
  have needed a second Python installed system-wide first. The backend image pins 3.12 and sidesteps
  the problem entirely. Both containers bind-mount the working tree and run the reload-enabled dev
  servers, so editing a file on the host still reloads in place — verified in both directions rather
  than assumed. Running the apps on the host remains supported and documented as Path B, for anyone
  whose machine has a 3.12.
- **The two app ports are 3001 and 8002, not the framework defaults, and one of those numbers was
  chosen rather than picked.** `:3000` was already held by an unrelated project's container and
  `:8000` by a PHP process, so the defaults were unavailable regardless. `:3001` is specifically
  useful because it is already one of the two origins hardcoded in the backend's CORS allowlist,
  which means the whole setup works **without editing application code** — the alternative was
  adding an origin to `main.py` purely to accommodate local infrastructure. The API moving off 8000
  does have a cost: `lib/utils/constants.ts` falls back to `http://localhost:8000`, so
  `frontend/.env.local` must now set `NEXT_PUBLIC_API_URL`, and that is documented as required rather
  than optional. Both ports can be overridden with `FRONTEND_PORT`/`BACKEND_PORT` without editing a
  file.
- **`npm ci` does not work on this project, and hasn't for as long as the lockfile has existed — found
  because a container is the first thing to ever attempt a clean install.** `package.json` pins
  `react` 19.2.4 while `next` 14.2.35 declares `peer react@^18.2.0`; React 19 support arrived in Next
  15, not 14. The lockfile already records the React 19 tree, so it was produced with peer checks
  bypassed, and `npm ci` re-validates them and refuses. Nobody had hit it because
  `frontend/node_modules` already existed locally. Nothing was silently upgraded to make the build
  pass: the Dockerfile installs with `--legacy-peer-deps`, which reproduces exactly the tree the
  project already runs, and the underlying mismatch is now **PM-25** in the debt register with the
  three real options laid out. It is a decision about the framework version, not a command.
- **The backend container reaches the database by rewriting one part of a URL, because rebuilding that
  URL would have broken it.** `DATABASE_URL` in `backend/.env` points at `localhost:5434`, which is
  right on the host and wrong in a container where Postgres is a sibling service. The obvious fix —
  assembling a new URL from `POSTGRES_USER` and `POSTGRES_PASSWORD` in compose — does not work here:
  the password contains `@` and `#`, so the URL carries it **percent-encoded**, and substituting the
  raw value produces something unparseable. Hardcoding the encoded form was also out, since this repo
  is public. So `docker-entrypoint.dev.sh` replaces only the host:port and leaves the credentials
  untouched. That constraint is now written down in ONBOARDING § 3.2 so the next person doesn't
  rediscover it.
- **One consequence of that entrypoint is worth knowing before it wastes someone's afternoon:
  `docker compose exec` is the wrong tool for backend commands that touch the database.** `exec` does
  not run a container's entrypoint, so anything started that way still sees the un-rewritten
  `localhost:5434` and fails with `connection refused`. `docker compose run --rm backend …` does run
  it and is the documented form for `alembic` and the seeder. ONBOARDING § 4.3 states both the working
  and the failing command side by side, because the failure looks like a broken database rather than a
  wrong invocation.
- **Setup was verified end to end rather than declared done.** Migrations reported the expected head
  `3ab496a7c5b7`, the seeder found the admin already present, and the API answered on 8002 with all
  four tag groups. Admin login returns 200 and sets both cookies with the right paths, `whoami`
  identifies the account, a CORS preflight from `http://localhost:3001` is echoed back, and the
  frontend redirects `/` to `/sign-in`. Reload was tested by editing files and watching both servers
  pick the change up. One thing the checklist in ONBOARDING § 7 had left implicit and now spells out:
  the seeded account is an **admin**, so it authenticates at `/api/auth/admin/login` — plain
  `/api/auth/login` checks the separate `users` table and returns 401 for it.

---

## July 30, 2026

- **The production build was broken, and had been all along — nobody had run it.** `npm run build`
  compiled the code fine and then died in the type-checking phase, so the project **could not be built
  for production at all**. It was found only because the documentation work included actually running
  the build rather than taking the README's word that it worked. The cause was one line in the Add
  Question form: `marks: z.coerce.number()`. A coercing Zod schema has a different *input* type from
  its *output* type — the input accepts the raw string a number field produces, the output is a real
  number — and the form typed itself with `z.infer`, which gives the output type, then handed that to
  the resolver, which needs the input type. Fixed by declaring both and using React Hook Form's
  three-generic form, which exists for exactly this case. Runtime behaviour is unchanged. The build now
  completes and generates all 12 routes. Two things worth carrying forward: this is the only `z.coerce`
  in the codebase and the rule is now written down in the frontend standards, and the fact that a broken
  build sat unnoticed is the strongest argument yet for the "no automated tests, nothing runs the build"
  item in the debt register.
- **All markdown now lives in `documentation/`, and the project has exactly one README.** The root was
  carrying six `.md` files; it now carries three — `README.md`, `CLAUDE.md` and `AGENTS.md` — because
  those three are the files tools and agents look for by name in the project root. `instruction.md` and
  `planning.md` moved into `documentation/`. The root `phases.md` was deleted rather than moved: it was
  **byte-identical** to the copy already inside `documentation/`, so moving it would have meant choosing
  between two identical files. And `documentation/README.md` was deleted outright — it was the old
  two-row "Docs Index" that `INDEX.md` had already replaced, and having a second README in the project
  invited exactly the confusion it caused. Its content survives in git history. Seven docs referenced
  the old locations; all were updated.
- **The app called itself "Test Platform" in eighteen places, four of them on screen.** The rename to
  Partner Marketplace had only ever touched the folder name. A verification sweep across the source —
  not the earlier audit, which undercounted this at six — found the old product name in 14 files. Four
  were **user-visible**: the sidebar rendered "Test Platform" in each of its three layouts (mobile,
  drawer, desktop) and the navbar rendered it once more, each beside a `T` monogram. Those now read
  Partner Marketplace with a `P`. The rest were browser tab titles for all seven routes, the
  descriptions behind them, the FastAPI title that names the API in its own docs page, and the root
  lockfile.
- **The root README was rewritten, and deliberately no longer states a single version number.** It was
  wrong in twelve places, and the reason is instructive: it hardcoded a version table that nothing kept
  in sync, so it drifted silently until it claimed Next.js 16 on a Next.js 14 project and described a
  four-container Docker setup that has never existed in this repo. The replacement points at
  `frontend/package.json` and `backend/requirements.txt` and states no versions of its own, so it cannot
  drift the same way. It now opens by saying plainly that the marketplace domain isn't built yet, warns
  that the app is not deployable as-is with a link to the blocker list, and defers setup to
  `documentation/ONBOARDING.md`. Deleted along the way: the invented `docker/` folder listing, the
  `docker-compose up --build` instructions, the `seed.py` command, the login credentials, and an
  "Application Flow" diagram that described the old test engine end to end.
- **Two entries in the debt register turned out to be understated, and were corrected rather than just
  ticked off.** PM-21 listed six naming locations; the real count was eighteen across fourteen files,
  including the on-screen brand text — worth recording because it shows an audit that reads config files
  will miss what a user actually sees. PM-12 and PM-21 are now closed, with two items explicitly left
  open: the Docker network name (renaming it recreates the network, so containers have to come down
  first) and the database name `test_platformDB` (three coupled values plus the existing cluster, so it
  needs a dump-and-restore rather than a rename — low value against real risk, and invisible to users
  either way).
- **The project now has its own repository, and is public.** Until today "Partner Market Place" was an
  untracked folder sitting inside the working tree of a completely different repository — the
  `leapswitch` marketing site — whose own `git status` shows hundreds of deleted files. A commit from
  that directory would have deleted the website and swept this project in with it. The project now
  lives at `Leapswitch-Networks/partner-marketplace` on branch `main` with its own history: 130 files,
  16,740 lines in the initial commit. Visibility is **public**, chosen deliberately after the
  plaintext-password issue below was raised.
- **Rewrote `.gitignore` before the first commit, which is what kept the repo small.** The inherited
  file was written for a Next.js project *root*, so its root-anchored patterns (`/node_modules`) missed
  everything nested one level down. Left as it was, the first commit would have carried 583 MB of
  `frontend/node_modules`, 93 MB of a virtualenv, and a **live 47 MB PostgreSQL data directory** from
  `data/db`. The rewritten file covers the monorepo layout properly — `node_modules/`, `.venv/`,
  `__pycache__/`, `data/`, `.env*`, `*.tsbuildinfo`, and local editor settings. Actual committed size:
  984 KB.
- **The frontend was secretly its own git repository, and would have pushed as an empty folder.**
  `frontend/.git` existed with no remote and exactly one commit — the untouched `create-next-app`
  scaffold — while every real file (`app/dashboard/`, `components/`, `lib/`, `types/`) sat uncommitted
  inside it. Because of that, `git add` staged `frontend` as a **submodule pointer** rather than as
  files, so a push would have produced a repository whose frontend directory was a dangling reference
  to a repo that exists nowhere. The nested repository was absorbed into the main one; the old `.git`
  was backed up rather than deleted, since discarding history is not reversible.
- **Scanned for secrets before publishing, and found the auth system stores passwords in plaintext.**
  `.env`, the virtualenvs, `node_modules` and the Postgres data directory were all confirmed excluded,
  and `docker-compose.yml` reads its password from the environment rather than hardcoding it — so no
  real credentials were committed. But the scan surfaced something more serious: `hash_password()`
  returns its input unchanged, login is a raw `==` string comparison, the database columns are
  commented *"plain text password (dev/test only)"*, and a past migration deliberately renamed
  `password_hash` to `password`. `bcrypt` is installed and imported nowhere. This was raised before the
  first push, along with the fact that a public repo would carry the pattern under the company's name;
  the decision was to publish as-is and treat it as known debt. It is now recorded in
  `planning/TECH_DEBT.md` as a hard blocker for any partner-facing deployment.
- **Renamed `docs/` to `documentation/` and fixed the paths the rename broke.** Used `git mv` so all
  three files tracked as renames rather than delete-and-add, preserving their history. The rename left
  9 dangling `docs/` references across `README.md`, `planning.md`, `phases.md`,
  `documentation/architecture.md` and `documentation/phases.md` — all updated. The one reference
  deliberately left alone is in the root `AGENTS.md`, which points at `node_modules/next/dist/docs/`;
  that is Next.js's own path, not ours.
- **Built the documentation system, modelled on LeapDesk.** Studied LeapDesk's `documentation/` tree
  (~27,500 lines across 39 files) and mirrored its conventions here: an `INDEX.md` doc map with a
  "Start Here" column so an agent reads one file rather than everything, `AGENTS.md` for agent
  workflow, `ONBOARDING.md` for setup, a `core/` folder for architecture and auth, a `system-design/`
  folder for standards, a `planning/` folder for reference-only plans, and `VERSION_SUMMARY.md` +
  `DAILY_CHANGES.md` for tracking. Names were adapted to this stack — `FASTAPI_STANDARDS.md` and
  `NEXTJS_STANDARDS.md` in place of LeapDesk's Laravel and module equivalents.
- **Every documentation claim was checked against the code, and the inherited README turned out to be
  wrong in twelve places.** The root `README.md` describes a system that does not exist: it claims
  Next.js 16.2.3 (actually 14.2.35), Tailwind 4.2.2 (actually 3.4.19), FastAPI 0.135.3 (actually
  0.115.5), PostgreSQL 18.3 (actually 16-alpine), an `asyncpg` async driver (the backend is entirely
  synchronous on psycopg2), a `docker-compose up --build` that starts Nginx, Next.js, FastAPI and
  Postgres (Compose defines only a database and Adminer — there is no Nginx anywhere in the repo, and
  no Dockerfiles), automatic migrations on startup (there is no startup hook), a `seed.py` and a
  `docker/` folder that don't exist, and admin credentials that don't match the actual seeder. The
  discrepancies are now listed in `ONBOARDING.md` § 12 so the next person doesn't follow them, and
  rewriting the README is tracked in `planning/SCAFFOLD_CLEANUP_PLAN.md`.
- **Documented several places where the scaffold looks more capable than it is.** Three of the five
  authentication guards — `require_admin`, `require_super_admin` and `get_client_ip` — are defined but
  wired to no route at all, so reading `dependencies.py` gives a false impression of what's enforced;
  super-admin rules are actually applied by hand inside service functions. Six columns on
  `admin_users` (`failed_login_attempts`, `locked_until`, `last_login_at`, `last_login_ip`, and the two
  password-reset fields) are **never written by anything**, which means there is no account lockout and
  no login auditing despite the schema strongly implying both. And `POST /api/auth/admin/register` is
  gated on "is an admin" with no check on the requested role, so any plain admin can create a
  super-admin account — an escalation path made stranger by the fact that the same admin cannot change
  their *own* role. All recorded with severity in `planning/TECH_DEBT.md`.
- **Both checked-in virtualenvs are unusable, and the setup guide now says so first.** The root
  `.venv/` was built on Windows with `uv` (Python 3.14, `Scripts/` and `Lib/` layout with `.exe`
  shims) and cannot run on Linux or macOS at all — which is why the README's
  `source .venv/bin/activate` fails: that path doesn't exist. `backend/.venv/` was built on Linux for
  Python 3.12, but its interpreter now resolves to a newer system Python, so its packages no longer
  load and `import fastapi` fails inside it. `ONBOARDING.md` § 2 now opens by telling you to delete
  both before doing anything else.

---

## Format Rules

**Entry structure** — bold lead sentence, then the detail:

```markdown
## <Month Day, Year>

- **<What changed, as a complete sentence.>** <Why it mattered, what was wrong before, what
  behaviour is different now. Name files only when a reader would need them.>
  - **<Sub-point>** for a distinct part of a larger change.
```

**Rules**

1. **Newest day at the top.** Newest entry at the top of its day.
2. **Lead bold, in plain English.** "Login now locks an account after five failed attempts", not
   "added `LockoutService`".
3. **Say why, not just what.** The reason is the part that isn't recoverable from `git log`.
4. **Nest sub-points** under a larger change rather than splitting it into unrelated entries.
5. **Be honest about what didn't happen.** Deliberately skipped, deferred, or left broken — say so.
6. **Never put credentials or secrets in an entry.** This file is in a public repo.
7. **Shippable features also get a row in [`VERSION_SUMMARY.md`](./VERSION_SUMMARY.md).** This file is
   the running log; that one is the release record.
