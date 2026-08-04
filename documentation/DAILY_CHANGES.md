# Daily Changes

> One entry per task, newest day first. Written in plain business English — what changed and why it
> mattered, not which class was added. Lead with a **bold sentence** stating the change, then explain.
>
> Update this file as part of the same change as the code. A task that isn't here is invisible to the
> next person.

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
