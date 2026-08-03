# Daily Changes

> One entry per task, newest day first. Written in plain business English — what changed and why it
> mattered, not which class was added. Lead with a **bold sentence** stating the change, then explain.
>
> Update this file as part of the same change as the code. A task that isn't here is invisible to the
> next person.

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
