# Daily Changes

> One entry per task, newest day first. Written in plain business English — what changed and why it
> mattered, not which class was added. Lead with a **bold sentence** stating the change, then explain.
>
> Update this file as part of the same change as the code. A task that isn't here is invisible to the
> next person.

## August 13, 2026 — Branding became a real platform feature: any colour, no leaks, derived everything

**The owner's brief: make this section powerful enough to carry future projects — and stop the
green surviving a colour change.** A two-agent sweep found 21 places the original teal outlived the
chosen theme, in four classes, and the fix for each class is structural rather than a repaint:

- **Three brand tints were frozen to hex at design time** — `surface.wash` (every card), `night.border`
  (132 dark-mode borders), `surface.tile`/`tone.light`, plus the shadcn `--muted/--secondary/--border/
  --input` copies. The backend now computes the exact relationships those hexes encoded (wash = brand
  at 10% over white, night-border = brand at 20% over the dark card, …) per active theme, and
  `tailwind.config.ts` reads variables. Defaults in `globals.css` are byte-for-byte the old values —
  the teal look is pixel-identical.
- **`tone.success` was literally the old brand darkened 27% and frozen** — owner's decision: success
  follows the brand, derived the same way. The two emerald/teal pulse keyframes and both inline
  `rgba()` literals (Sidebar's active ring, ActivityBadge) now read `rgb(var(--brand)/…)`.
- **The default logo and favicon were green artwork.** The bundled logo now renders INLINE with its
  square reading the live `--brand` (same artwork, any colour), and with no uploaded favicon the API
  **generates** an SVG tab icon — monogram on the active brand, cache-keyed by a hash of both.
- **The one sanctioned leftover:** `global-error.tsx`'s literal teal — the crash screen cannot read
  branding by design (globals.css may not have loaded); recorded here so nobody re-reports it.

**And the colour space opened — with the solver the original plan demanded.** `theme.py`'s page-long
argument against a colour picker ended *"a wheel can come later with a contrast validator in front of
it"*; later arrived. `derive_shades()` builds all five brand channels from one picked hex (dark/darker
mirror the teal preset's own ratios; on-dark raises HLS lightness until it clears ~6.5:1 on the dark
card, settling for AA when the hue can't), and `validate_brand_colour()` refuses a pick whose white
button labels fail AA — the 422 carries the measured ratio and a passing same-hue suggestion the form
turns into one click. `app_settings.brand_color` (migration `b6e2a91c4d78`) wins over the preset while
set; clearing it restores the preset, not the factory default. A `theme-preview` endpoint runs the
same derivation without writing, so the form previews the whole page live before saving — a preview
computed anywhere else could disagree with Save.

**The form grew into the feature**: native colour picker + hex field with live whole-page preview,
preset cards now showing their measured WCAG ratios, structured refusals with a "use this instead"
swatch, and the two dead fields (`chrome_subtitle`, `app_short_name` — nothing renders either) removed
from the form while the API keeps accepting both. **Emails now use the database app name** (resolved
by callers; `mail_service` stays DB-free), and **page titles follow the runtime name** via a
client-side `TitleSync` — DYNAMIC_BRANDING_PLAN phase 5 at zero prerender cost, the trade being a
pre-hydration flash of the build-time name on an authenticated admin app.

**Plus the shadcn monochrome pair**, owner's request the same day: `shadcn-black` (zinc-900 primary,
the signature `#fafafa` in dark mode — deliberately not the engine's derived mid-grey, because the
near-white IS the look) and `shadcn-white` (zinc-700 on paper; a literal white brand is impossible —
white button labels on white is 1:1, the exact pick the validator refuses, and the preset comment
says so). Both verified live: the whole app renders as pure monochrome, washes and borders included,
since a neutral's derived tints are pure greys.

Verified end to end with `#8b1e3f` (crimson) applied to the live app: all 43 routes pass the browser
harness under it, and the screenshots show no green anywhere — badge, tab icon, washes, borders,
success chips all crimson-derived. The pale-yellow refusal (`1.43:1`, suggests `#947000`) and the
generated favicon were probed live. Backend 635 tests (7 new engine + the preset suite now covering
10 themes), ruff, typecheck, lint, openapi all green. Default teal restored after the proof.

## August 13, 2026 — Sidebar: collapsible sections (closed by default), a menu filter, no subtitle

**All by the owner's instruction, in two rounds the same day.** The sidebar's section headings are
collapsible again, each with a chevron that turns as the group opens and closes, animated with the
`grid-rows 0fr ⇄ 1fr` transition — smooth at any content height, unlike a `max-height` guess. This
*reverses* a documented decision: `NavTree` flattened the sections because the first collapsible
version hid the current page behind a closed group. The owner then asked for **closed by default**
— the exact shape that failed before — and what makes it safe this time is one invariant: **the
section holding the current page is born open and reopens on navigation into it** (render-time
state adjustment, the pattern `react-hooks/set-state-in-effect` steers toward), so the active row
can never sit hidden. Navigation is an **accordion**: moving from one heading's page to another's
closes the group you left as the one you entered opens — each section watches only its own
"holds the current page" transition, in both directions, so no cross-section coordination exists
and hand-toggled sections in between are left as the reader set them. `section.collapsible` from
the navigation API is honoured now instead of ignored, so the per-role setting on the Roles screen
means something again; a `false` renders an inert always-open heading — which is why Administration
shows no chevron.

- **A menu filter sits at the top of the nav.** It filters the *menu*, not the data — the header's
  Global Search owns records. Matching is case-insensitive on item titles; a section whose label
  matches keeps all its items; a matching parent keeps its children. While a query is live, every
  surviving section is held open so a match can never be invisible, and clearing restores each
  section's own state. One query drives both the desktop nav and the mobile drawer. No box in the
  icon-only rail — no room, and the tooltips already name every icon.

- **"ADMIN PANEL" is gone from the chrome.** The `chrome_subtitle` line came out of all four brand
  blocks (sidebar desktop/mobile/drawer, top navbar) — the header now shows the project name
  alone. The Branding screen still edits the field; nothing in the chrome renders it any more,
  noted at the removal sites so the next person doesn't hunt for a consumer that doesn't exist.

## August 13, 2026 — Every index page now looks like the Users index, to the pixel

**Switching modules no longer changes the page's shape.** The complaint was specific: the Users
index is the reference, and moving to another module shifted paddings, densities and chrome. A
class-level census of all 12 index modules against `UsersModule` found the drift, and the biggest
piece was nowhere near the modules themselves:

- **8 of 12 index routes never got the full-height layout.** `AppShell`'s allowlist covered Users,
  Roles, Invitations and Activity; Data Access, API Credentials (and Providers), Search, Errors,
  Feature Flags, Webhooks and Platform API rendered the identical card inside the *padded,
  scrolling* `<main>` — different padding at every breakpoint (up to `2xl:px-8 2xl:py-8` vs
  `px-3 pb-3`) and a second scroll container around a table that measures its own height, the
  nested-scroll failure `AppShell`'s own comment warns about. All eight added to the allowlist;
  the card now sits at the same offsets on every module.
- **Row density unified at 30 per page** — the owner's number, set on Users on 2026-08-10. It was
  25 on six modules, 15 on two, and viewport-measured (`autoPerPage`, so effectively ~10) on
  Invitations and Activity, where the fixed default and the measuring hook cannot coexist and the
  hook lost, for the reason recorded on `UsersModule` when the owner chose 30.
- **Create buttons now all follow the Users pattern** — permission-gated, module icon inside the
  button. Two were not even gated: Webhooks (`api-token-manage`) and Platform API
  (`api-consumer-create`) rendered their create button to every viewer and let the API refuse.
  Both fixed; both also gained the empty-state "first record" CTA the other modules already had.
- **Header icons now match the sidebar.** Data Access wore Roles' icon; API Credentials,
  Providers, Search and Feature Flags all wore the Configuration gear; Errors wore Activity's.
  Every module header now uses its own nav icon, so the page confirms where you are.
- **Activity's `Details` column sat 80px wide with full cell padding** where every other module's
  second column (`actionsColumn`) is zero-width shrink — the same column reads identically now.
- **The retired aliases became real HTTP redirects.** `/dashboard/all-users`, `/add-user`,
  `/dashboard/profile` and `/settings` relied on a server component's *streamed* `redirect()`,
  which only applies after hydration — measured today at 4–5 seconds on a busy dev server, and
  under load it sometimes never applied, parking a signed-in user on a sidebar with an empty main.
  The middleware now issues an immediate 307; the page stubs stay as fallback.
- **The browser harness got the patience today's dev server demanded**: a bounded re-read loop
  (healthy pages never wait), and a `document.body` null-guard that used to abort the entire pass
  when a read landed mid-navigation. During this work the dev container itself degraded to
  8–26-second page serves on a 5.5 GB heap after a day of recompiles; a container restart cured
  it, recorded here because the symptom — random pages stuck on the auth "Loading…" splash — reads
  exactly like an application bug and is not one.

Verified: 45 PASS, 0 WARN, 0 FAIL across all 43 routes after the changes; typecheck and lint
clean; screenshots of Users, Providers, Invitations, Activity and Webhooks compared by eye at
identical offsets. Not changed, deliberately: per-module column headers ("Kind", "State",
"Access") and badge widths — those carry § 8.1 parity decisions and content-driven sizing, and
renaming them for symmetry would trade meaning for looks.

## August 13, 2026 — Core 100%: the five swept boxes closed, and the sweep found real holes

**§ 8.2 of `CORE_COMPLETION_PLAN.md` is complete — all nine boxes.** The five that remained were
each verified by measurement (three parallel read-only sweeps over the backend, the frontend and the
docs), and three of the five could not be ticked as they stood. What the sweeps found, and what was
done about it, in order of how much it mattered:

- **Twelve write paths wrote no audit row, and the review list that exists to catch that had not
  been updated since 2026-08-03.** § 3.4's deliberate arrangement is explicit logging calls plus a
  list in `AUTHORIZATION.md` a reviewer can check routes against; the calls were added ~40 times
  across seven modules and the list zero times, so it caught nothing. The twelve: role create,
  clone, delete and rename; **both invitation-acceptance paths** (one mints an ACTIVE account
  carrying a role, the other replaces a user's role set and can activate the account — the two
  events an RBAC trail most exists for); self-registration; self-service password change; both ends
  of password reset; profile self-edit; **a revoked data-access grant silently restored** by
  re-granting at the same level (the upsert cleared `deleted_at` without a row, so the trail said
  the access ended while it quietly resumed); assistant-conversation deletion (metadata only — the
  transcript stays unreadable to others by design); and the session evictions after a password
  change or reset, which now record the count a compromise write-up needs. All twelve wired, the
  `delete_role` and nav-preferences signatures grew the actor they never took, and the
  `AUTHORIZATION.md` list was rewritten to cover all eight modules — with the deliberately unlogged
  paths named too, so nobody re-reports them.
- **The data-visibility ledger is now honest: 20 paths, each verified or flagged.** Eight were
  already recorded by the § 8.1 audits. Three are now pinned by `tests/test_visibility_paths.py`,
  probed against the live database: a non-admin asking for someone else's user record gets **404,
  not 403** (a 403 would confirm the account exists); invitations are narrowed to their sender;
  and an assistant thread belongs to whoever started it, same 404 reasoning. The rest are recorded
  here as facts with reasoning: sessions are self-scoped **by construction** (the route passes
  `current_user.id`, nothing user-controlled reaches the query); the recycle bin and the credential
  list are permission-gated but deliberately not actor-scoped, matching the reference; Global
  Search's roles scope restates the registered RBAC divergence. Two findings were worse than
  unverified — `list_grants`' docstring claimed a DAILY_CHANGES flag **that was never written**
  (it exists now: the whole delegation graph is visible to any `data-access-view` holder, Staff
  holds it, and scoping it is the owner's call — PM-5), and the grant-scope helpers
  (`manageable_user_ids` and friends) are built and tested but **called from nothing** — a grant
  today changes Global Search results and nothing else. Both recorded under PM-5.
- **The § 3.1 pipeline box was true in substance and its one real duplication is gone.** All 12
  sort/search-bearing list endpoints already ran the shared pipeline, and all five § 3.1 safety
  requirements held (measured, not assumed). But the promised `paginate()` envelope helper had
  never been built, so 12 routers hand-assembled `{page, per_page, total, pages}` — one of them
  with its own inline page-count arithmetic. A `page_meta()` helper now exists and all 12 use it;
  the two oldest response models (`PaginatedUsers`, `PaginatedActivity`) finally subclass `Page[T]`
  like the six younger ones, wire-identical.
- **The Index/Form/Show box could never have been ticked, so it was decided instead.** Only Users
  and Roles have the full § 2.3 route set. Invitations lacks edit because an invitation cannot be
  edited (sanctioned in-source). Data Access, API Credentials and the Search registry are
  modal-only — and `UI_PATTERNS.md` claimed universally that "the routes stay". Owner's decision:
  **modals are the pattern for those three**; registered in § 1.1, the false claim corrected, and
  the exit criterion stated (a module graduates to routes when a deep-link is actually needed).
- **`ResourceIndex` holds at 12 of 12 list modules**, and every non-list screen that opts out says
  why in-source. Nothing to fix; recorded because "verified" and "assumed" read the same in a
  checklist until someone sweeps.
- **One piece of drift the sweep caught by accident:** yesterday's Activity Log retention work
  changed a response model without regenerating `openapi.json`, so CI's contract check was already
  red. Regenerated, along with the frontend types — which also pick up the two new `Page[T]`
  docstrings.

Verification: backend 614 passed 4 skipped (611 before the three new visibility tests), `ruff`
clean, frontend `typecheck` and `lint` clean, `openapi.json` and `types/api.d.ts` in sync with the
routes. The remaining § 8.2 follow-ups live where they belong: PM-5 for the scoping work, § 1.1 for
the divergences.

## August 13, 2026 — Every screen in the app has now been opened, 43 of 43, and all of them render

**The browser pass now covers every route, not just the indexes.** The harness built on 6 August
walked twenty-four signed-in screens — every one an index. The forms, the detail screens, the edit
screens and the entire signed-out surface had still never been opened, which is the wrong half to
skip: an index that throws shows an empty table, while a form that throws loses whatever was typed
into it. `scripts/browser-check.mjs` now runs four passes over all 43 routes: the 28 static
signed-in screens, 4 redirect aliases, 4 detail/edit screens with **real record ids resolved from
the live API** (a hardcoded id that stops existing renders the "not found" branch, which loads
cleanly and proves nothing), and 7 signed-out pages visited after the cookie is dropped — earlier
would be meaningless, since every one of them redirects to the dashboard while a session exists.

- **This work was started on 12 August and stopped by its own design.** The expanded list treated
  `/dashboard/profile`, `/settings`, `/dashboard/add-user` and `/dashboard/all-users` as screens,
  but each is a pure `redirect()` alias — and "ended up on a different URL" is the harness's
  session-loss check, a hard FAIL. The fix is an `expect` option: for an alias the redirect target
  **is** the pass condition, because an alias that stops forwarding is a broken bookmark. The root
  path `/` (middleware-redirected to `/sign-in`, unconditionally) joined the signed-out pass the
  same way, closing the census at 43 of 43.
- **The result: 45 PASS, 0 warnings, 0 failures.** The 18 screens that had never been opened —
  every form, both detail screens, both edit screens, all six public pages — all render with
  content, no console errors and no failed requests. Screenshots of the create-user form, a
  populated edit-user form and the sign-up page were inspected by eye as well; real screens, not
  shells that cleared a text floor.
- **§ 8.2 of `CORE_COMPLETION_PLAN.md` updated to match reality.** "Every screen has been opened in
  a browser" is ticked by this work. Two boxes that were already true but never ticked now cite
  their evidence: the lint/CI box (closed by `c6b3154`; `ci.yml` runs ruff, pytest, typecheck, lint
  and build with no `continue-on-error`) and the route-gating box (proven by `0d611ad`, which tests
  that every gated route refuses a stranger, in CI). The code-sweep boxes — § 3.1 pipeline,
  `ResourceIndex`, activity-log-by-construction, recorded data-visibility verifications — stay
  open: nobody has swept for them, and ticking them on plausibility is the drift this plan warns
  about.

## August 12, 2026 — All eight core modules audited; the last one had a guard and no test

**Audit 3 of 8 — Data Access — and with it § 8.1 is complete for the core scope.**

The port is faithful: the same four helpers, the same "no grants means own records only" default, and
the same asymmetric scope rule, which is the part worth stating because it reads like a bug. A
wildcard grant answers any question; a grant scoped to one module does **not** answer the unscoped
one. Checked case by case against the reference's `grantScopeApplies`, all five agree:

```
grant '*'    requested None    -> True
grant '*'    requested 'qmas'  -> True
grant 'qmas' requested 'qmas'  -> True
grant 'qmas' requested 'other' -> False
grant 'qmas' requested None    -> False
```

**Ours refuses something the reference allows, and the refusal fires.** The reference blocks a user
being granted access to their own records — pointless rather than dangerous. It leaves the shape
that matters open: set `grantee_id` to your own id, `subject_id` to anyone, `scope='*'`,
`access_level='manage'`, and one request makes you able to see and write every user's records.
Probed against live accounts:

```
grantee == subject   422  a user cannot be granted access to their own records
grantee == actor     403  you cannot grant data access to yourself
access_level 'root'  422  must be view or manage
a -> b, view         allowed, and does not satisfy a manage question
```

**The gap this audit actually closed was the test file — there wasn't one.** Not one test for the
module that carries the only guard we hold and the reference doesn't. A guard with no test is a
guard the next refactor removes with a green suite. Thirteen now cover the scope rule, all three
`create_grant` refusals, the view-does-not-imply-manage comparison, and the empty default.

**One note on method, since it cost something.** Probing `create_grant` by hand left a real grant in
the dev database — it commits, so the rollback in my throwaway script did nothing. Found it,
removed it, and the test fixture cleans up by id rather than by rollback for exactly that reason.
Same mistake as the worker runs that turned up on the Background Jobs screen last week; the fix is
the same one.

**§ 8.1 now stands at 8 of 8.** Three defects across the eight: a privilege escalation in
Invitations, a role-name search gap in Users, and a silent withholding in Global Search — plus the
Activity Log's missing horizon. The five clean modules were each probed, not read.

## August 12, 2026 — The assistant was attacked rather than read, and it held

**Audit 8 of 8 — AI Assistant.** No defect. Reading it would have said that in a paragraph; the
module is the most sensitive code in the parity scope, so it was probed instead.

**The gating matches the reference exactly.** `describe_schema` and `database_query` sit behind
`ai-assistant-query-database`; `locate_data` needs only the right to use the assistant at all,
because Global Search applies its own three permission layers to every result. Who actually holds
that permission, read from the live database rather than the seeder:

```
RootUser · SuperAdmin · BackendDeveloper · Admin   query-database ✓
Staff · Sales                                      use only — locate_data, row-scoped
Partner · User                                     no assistant at all
```

That is the reference's shape: `database_query` does no row scoping by design, so it is admin-only,
and the roles that are not admins get the tool that scopes itself.

**Eight attacks on `database_query`, all refused.** A statement terminator in the table name, a
denied table by name and by substring, an injected `order_by`, an injected operator, an injected
`where` column, a secret column asked for outright, and a limit of 100,000:

```
users; DROP TABLE users--            not found
api_credential_values                not accessible
user_sessions                        not accessible
id; DELETE FROM users--              unknown order_by column
= 1 OR 1                             operator not allowed
1=1--                                unknown column
columns=[password, email]            password → [redacted], email intact
limit=100000                         capped
```

The safety is structural rather than a regex over SQL: the table is checked against a denylist, the
column against the real column list, the operator against an allowlist, and every value is bound.

**And the read-only guarantee was checked against the server, not the config.** `show
default_transaction_read_only` returns `on`, and an `UPDATE` is refused by Postgres itself. That
distinction is not pedantry — an earlier attempt used `SET SESSION CHARACTERISTICS`, which is
transactional, so the rollback discarded it and the connection was read-write while reporting
success. Nine tests now hold all of this down.

**Four places where ours is deliberately stricter**, all already documented in the code: the
assistant's own conversation tables are denied (the reference leaves them readable, which lets
anyone who can use the assistant ask it to read back what colleagues asked it), `otp` and
`alembic_version` are denied, column redaction delegates to the same `is_sensitive_column` Global
Search uses rather than keeping a second list that would drift, and the output guard redacts our own
Fernet ciphertext — a shape that appearing in a reply would mean a stored credential had escaped.

**All eight core modules have now been through § 8.1**, except Data Access, which the plan's table
still shows as unaudited and which no entry here evidences — so it stays open rather than being
marked done on the strength of a memory.

## August 12, 2026 — The audit log now says how far back it goes, and a docstring stopped lying

**Audit 7 of 8 — Activity Log.** The module itself came out well: the causer sandbox, the source
stamping, the module labels, the subject links, the dropdowns scoped to the reader's own slice and
the search that reaches the causer's name are all faithful to the reference. Two things were not.

**A sentence in our own code had become false.** `activity_service.purge_older_than` said *"nothing
calls it on a schedule because there is no scheduler."* True when it was written; untrue since
`app/worker.py` shipped, which has an `activity-log` job. The substance survived — that job is the
one deliberate `enabled=False` in the worker, so switching a worker on does not quietly start
deleting an audit trail — but the docstring told a reader the opposite of the arrangement that now
exists. Corrected, with the correction dated so nobody has to guess which version is current.

**The screen never said where the trail ends.** The reference publishes a retention number on this
index. Ours published nothing, and the consequence is the same shape as yesterday's Global Search
finding: **a trail that stops somewhere looks exactly like a trail with nothing in it.** Someone
filters to last year, sees an empty table, and concludes the thing never happened.

Ours now reports the window **and something a config value cannot know — whether the purge has ever
actually run**:

```
retention_days 730 · purge_ever_ran False · last_purge_at None · rows_removed_last_run 0
```

That is the honest state of this deployment, and it is the stronger statement: not "we would delete
after 730 days" but *"nothing has ever been deleted — this trail is complete."* The index says so
under its title. If the job is ever enabled, the same line switches to naming the last purge and how
many rows it took, because at that point an absence really does have two explanations.

**Registered divergence — the `via` filter is not ported.** The reference distinguishes `inline` /
`form` / `api` because it has a DataTable that writes on the spot. Every write here goes through the
API, so the field would hold one value on every row and filter nothing.

## August 12, 2026 — Global Search told you "no results" when it meant "you weren't allowed to look"

**Audit 6 of 8 — Global Search.** The reference implementation returns, alongside its results, a
list of the areas it *skipped* because the caller could not see them. The comment above that field
explains why it exists, and it is the whole finding:

> *"Lets the UI say 'Quotes was not searched' instead of a bare 'No results', which is what hid a
> broken permission for two months."*

Ours skipped silently. Six places in the search service dropped an entity with a bare `continue`,
and the response carried only the query, the groups and a duration. So a person whose permission had
been mis-set typed a name they knew existed, saw **"No results you have access to."**, and concluded
the record was gone — reproducing precisely the two-month failure the reference documents having
suffered and then fixed.

Confirmed by probing, not by reading. Same query, two real accounts:

```
RootUser   groups=['Users', 'Roles']   hidden=[]
limited    groups=[]                   hidden=['Roles', 'Users']
```

The second row is the defect: before this change that account received an empty result with nothing
to distinguish it from a genuinely empty database.

**What changed.** The service now records the label of every area it withholds and returns it as
`hidden_areas`; the search box renders it beneath the list — *"Roles, Users were not searched — you
do not have access."* It renders whether or not anything matched, because a partial answer misleads
just as badly as an empty one: five results and a silently skipped area still reads as complete.

**One caller deliberately does not get it.** The AI assistant's `locate_data` tool keeps the plain
list of groups. Handing a model the names of the areas it was refused turns a withheld area into a
suggestion of what to ask about next, which is the opposite of the point.

Four regression tests pin it, including one asserting the permission gate records before it skips —
the failure mode being a later edit that deletes the recording and leaves the `continue`.

## August 12, 2026 — The audit found an escalation path: Staff could invite an Admin

**Audit 3 of 8 — Invitations — and this is what the exercise was for.**

`InvitationController` excludes `RootUser` from its role picker, so the audit asked the obvious
question of ours: **which roles can someone be invited into?** The answer was any of them that the
super-admin guard did not name. Probing rather than reading, with a throwaway Staff account at
exactly the privilege the matrix grants:

```
blocked  invite as RootUser     — only a super admin may invite into a super-admin role
blocked  invite as SuperAdmin   — same
ALLOWED  invite as Admin        ⚠️
```

**Staff holds `invitation-create`. Admin holds every permission in the catalogue.** So a Staff
account could create an invitation that, once accepted, produced a full administrator — without ever
holding a permission the route required, because the escalation was not in the request, it was in the
`role_id` *inside* the request.

**The codebase had already written the rule down, in the other module.**
`rbac_service._resolve_grantable_permissions` calls it the privilege ceiling and says exactly this:
*"the route guard cannot catch this — they legitimately hold the permission the route requires. The
escalation is in the payload."* That is why this is a defect rather than a policy question: the
principle was decided, and one of the two places that needed it did not have it. An invitation is
that same escalation with a delay on it — whoever accepts arrives holding whatever `role_id` said.

The ceiling now applies to invitations, and the check is the same one: you cannot invite someone
into a role that grants a permission you do not hold yourself. Verified in both directions —

```
Staff:      RootUser ✗   SuperAdmin ✗   Admin ✗ (42 permissions it lacks)   Staff ✓   User ✓
RootUser:   Admin ✓      SuperAdmin ✓
```

Staff can still invite people, which is what the role exists to do; it can no longer invite someone
more powerful than itself. `has_permission` returns True for a super admin, so the ceiling narrows
nobody who could already grant the same access directly. Four regression tests, marked `db`, run in
CI.

**Two other things the audit checked and cleared.** Our bulk create *reports* what it skipped where
the reference silently drops duplicates, and the 60-second resend cooldown matches. And the guard I
suspected was missing for RootUser was already there — we are stricter than the reference, which
only hides that role in the picker while its validation would still accept it.

> **This is the third finding in a row that nothing else could have caught.** Not the type checker,
> not the linter, not the 572 tests, not the browser pass — all of which were green while a Staff
> account could mint an administrator. Only reading someone else's implementation of the same screen
> and asking why it is different.

---

## August 12, 2026 — Users and Roles audited; the two modules disagree about visibility on purpose

**Audit 2 of 8, and the interesting result is a pair.** Users' Show page finished the first audit —
it carries everything LeapDesk's does except the three HR-chart fields already registered, plus a
last sign-in and IP that the reference does not have. Then Roles, compared against `RoleController`
and its seven pages.

**No defect in Roles.** Five divergences, all deliberate, and two of them point in opposite
directions — which is the thing worth writing down:

* **Users is stricter than the reference.** LeapDesk shows a non-admin the users *they created*; we
  show them only themselves, because "users I created" leaks across partners the moment there are
  any.
* **Roles is looser.** LeapDesk scopes roles to `created_by` too — but a role is configuration, not
  a personal record, and that scoping renders the screen **empty** for every reader who has not
  authored a role. Ours shows all roles to anyone holding `role-view`.

Opposite calls from the same reference behaviour, because the data is a different kind of thing in
each case. Both are now registered with that reasoning rather than being two accidents that happen
to look like a policy.

**`RootUser` is the other one.** LeapDesk excludes it from the query entirely; we show it, badged
Protected and uneditable. Concealing a role that holds every permission is worse than showing one
nobody can touch — and the guards, not the query, are what stop anyone changing it.

**Which the audit then proved rather than assumed.** § 8.1 asks for permissions "confirmed blocked,
not merely hidden", so the three protections were run against a live Admin account: editing the
SuperAdmin role → **403**, deleting a protected role → **400**, rewriting SuperAdmin's grants through
the new route → **403**. Read from the source they are three `if` statements; run, they are three
refusals.

> Audit stands at **2 of 8**. Data Access, Activity, Invitations, API Credentials, Global Search and
> the AI Assistant have not been compared.

---

## August 12, 2026 — The first parity audit, and the search that found nobody

**Every core module is built; none had been audited.** `CORE_COMPLETION_PLAN.md` § 8.1 is blunt
about the difference: *"'we built the Users module' and 'our Users module does what LeapDesk's Users
module does' are different claims and only the second one counts."* This is the first module
compared screen by screen, with the reference source open beside it — Users, because every other
index was copied from it, so a divergence there is eight divergences.

**One real defect, and it is the kind only a comparison finds.** LeapDesk's user search matches the
**role name** — `orWhereHas('roles', …)` in its controller. Ours matched email, first name, last
name and company. So typing "Admin" into the user search returned **nothing** here and every
administrator there. Nothing was broken, no test failed, and the feature looked complete. Fixed with
`roles.any(...)` rather than a join, because a join multiplies a user by their roles and the count
then lies. Verified against real rows afterwards: "SuperAdmin" finds four people, "Sales" two,
"BackendDeveloper" two, and a nonsense term still finds none.

**Seven other differences were found and are now registered rather than fixed**, each with its
reason, in § 1.1: the three HR-chart fields (`level`, `department`, `team_lead_id`) that have no
column here; our `account_type` filter, which the reference has no equivalent of; and our non-admin
visibility, which is *stricter* — LeapDesk shows a non-admin the users they created, we show them
only themselves, because "users I created" leaks across partners the moment there are any.

**One thing I expected to find and did not.** LeapDesk requires `min:8` on an admin-set password and
our schema declares no `min_length`, which looked like a hole. It is not: `validate_password_strength`
is wired to `CreateUserRequest` and enforces `PASSWORD_MIN_LENGTH`. Recorded because an audit that
only reports hits is one that stops being read.

**§ 5 of the plan was itself stale and is corrected.** It described API Credentials, Global Search
and AI Assistant as "❌ nothing" and permissions as "0 of 14 seeded" — all three shipped yesterday
and 54 are seeded. The original table is kept collapsed underneath rather than deleted: this is the
file that warns against trusting the *other* plan's marks, and it had drifted exactly the same way.
**Third stale tracker in one day.**

> **Users' Show page is not yet compared**, and the other seven modules are not started. The audit
> is 1 of 8, and calling it more than that would be the same failure this entry is about.

---

## August 12, 2026 — PM-30 closed: lint blocks CI now, because it can

**`ci.yml` carried `continue-on-error: true` on the lint step with an instruction attached: *"DELETE
THIS LINE when PM-25 is settled and PM-30's count is zero."*** PM-25 was settled yesterday. The count
was 19. It is zero, and the line is gone.

**The judgement call first, because `PLANNING.md` § 3.2 asked for one rather than drift.**
`CORE_HARDENING_PLAN` says PM-41's data layer retires PM-30 "by construction", which would make
hand-fixing these throwaway work. PM-41 has not started and is not scheduled this week — and 19
errors behind `continue-on-error` is a CI step nobody reads, which is worse than no step at all. So
they were fixed.

**Almost all nineteen were one shape:** a `setState` run synchronously inside an effect body. React
schedules a second render pass for a value it could have had in the first, and the rule exists to
say so. Four remedies covered every case:

| Remedy | Where |
|---|---|
| Hand the function to a callback instead of calling it — `void Promise.resolve().then(load)` | 12 modules, plus `useResourceList` |
| Derive the value instead of storing it | `AuthInitializer`'s `checked` |
| `useHydrated()` — a `useSyncExternalStore` answering "has hydration happened" in the first render | `Modal`, `Toast`, `RowActions`, `DashboardOverview` |
| Declare the callback above the effect that uses it | `Sidebar` |

**`Sidebar` was the one the register called the worst offender, and its three errors were one
mistake.** `closeMobile` was declared eighteen lines below the effect that calls it — legal at
runtime, because an effect runs after render, but the compiler cannot prove that, so it reported
"cannot access variable before it is declared" *and* bailed out of memoising the whole component.
Moving the declaration up fixed both, and left only the drawer's exit animation, which set state
synchronously while its enter path already waited for the next frame. The two directions of one
animation are written the same way now.

**Verified in the browser, not just by the linter.** `useResourceList` is the fetch hook behind
twelve screens; a change there that satisfies a rule while breaking a page would be the worst
possible trade. All 25 screens still render, no console errors, no failed requests.

> **Lint blocks from now on.** That is the point of the exercise: the errors were never the problem,
> the `continue-on-error` was — it made the step advisory, and an advisory check is one that goes
> red and stays red.

---

## August 12, 2026 — The contrast was reasoned about; now it is measured

**`MODULE_PARITY_PLAN.md` § 5 says the table work was *"reasoned about from classes and contrast
ratios"* and never seen.** `scripts/ui-audit.mjs` stops reasoning and measures: it walks every
visible text node, climbs the ancestors until it finds something actually painted, and computes the
WCAG ratio against it. Both themes, plus a 375px pass for the one responsive question that is
objective — does the page scroll sideways.

**All fifteen pages pass at 375px.** Nothing is unreachable on a phone, which is the single failure
that would have made the app unusable on the device most people would open it on.

**Contrast found real failures, and the worst was `/settings/profile`: 94 of 326 text nodes in dark
mode, 95 in light.** The cause is the rule this project already wrote down and never enforced — bare
`text-gray-*`. `text-gray-500` with no dark override renders at 3.69:1 on the dark surface;
`text-gray-400` used as a light-mode colour is 2.54:1 on white. Both are under the 4.5:1 AA floor.
Fifty-two utilities across nine settings and auth components now use the sanctioned pair, and the
same page **measures zero failures afterwards** — the number moved, which is the only reason to
believe the change did anything. `placeholder-gray-*` and `disabled:text-gray-*` were left alone:
those are muted deliberately and WCAG exempts them.

**The Invitations stat cards were colouring the count itself** in `tone-success` (1.84:1 on dark) and
`tone-warning` (1.47:1 on light) — the least readable thing on a card whose whole job is to show a
count. A semantic fill is built to sit *behind* white text in a badge, not to be text on a page.
The number is ink now and the tone moved to a dot beside the label, so the colour coding survives
carried by a shape rather than a glyph.

**And it caught a claim I had made a few hours earlier that was wrong.**
`components/admin/ProfileForm.tsx` — which I rewrote this morning, and whose commit message
described a user typing a new email, pressing Save and being told it worked — **is imported by
nothing.** The live form is `components/settings/EditProfileForm`, which disables the field
correctly. The bug was real in that file; the file is dead, so no user could reach it, and the
commit message said otherwise. The dead component is deleted, and `MODULE_PARITY_PLAN` step 5 had
been pointing at it too.

> **Two findings are recorded rather than fixed, because both are token changes in
> `frontend/tailwind.config.ts` — a protected file, and the owner's call.** `tone-danger` (#d22d3d)
> measures 3.56:1 on the dark surface and 4.35:1 on the light one: below AA in both, and it is the
> "Protected" badge on Roles, the DELETE badge in the API catalogue, and every danger badge in the
> app. Fixing it is one hex value; deciding to change a brand colour is not mine.

---

## August 12, 2026 — Every screen opened in a real browser, at last

**The caveat at the bottom of every entry for the past week is closed.**
`UI_PATTERNS.md` has said since 2026-08-06 that no component had been checked on screen since the
Viho migration, and each day's writeup repeated it as the largest gap in confidence. The reason given
was always the same: a missing Chrome-DevTools-Protocol harness.

**Chrome was installed on this machine the whole time.** The harness was the missing part, not the
browser — and it is 250 lines with no dependencies at all: Node's `WebSocket` speaking CDP to
headless Chrome. No Playwright, no Puppeteer, nothing downloaded. `scripts/browser-check.mjs`.

It signs in and walks all twenty-four signed-in screens, failing on any that redirects to the login
page, renders no sidebar, raises a console error, makes a failing request, or comes back with almost
no text — **that last one is the point**: a client-rendered page that throws during hydration leaves
an empty shell, which is exactly the failure that fetching the HTML cannot see and the reason a week
of green typechecks proved nothing about the screens.

**All twenty-four pass**, including every screen built today. The credentials come from the
environment rather than the file, because this repository is public and a working credential in a
committed script is a working credential on GitHub.

**And then looking at the screenshots earned it immediately.** The Background Jobs screen — an hour
old — was showing runs of jobs called `works` and `explodes`, one of them failing with
"RuntimeError: boom". `run_job` records every run so the monitor has something to report, and pytest
uses the real `DATABASE_URL`, so **the worker's own schedule tests had been writing fake jobs into
the development database** and the monitor was faithfully displaying them. Nothing was red: the rows
were valid, the tests passed, the screen was correct. It took a person looking at a page. Those tests
patch the recorder now.

> The same lesson as the day's other findings, from a third angle. Typecheck sees types, lint sees
> patterns, tests see what they were told to look at — **and none of them opens the page.**

---

## August 12, 2026 — The last blocked module, re-scoped rather than built to its spec

**Module 16 was blocked on "we have no queue", and the plan warned that building it anyway "would
produce a page that says 0 jobs forever".** The worker changed the first half of that: something does
run in the background now. It did not change the second half, and the interesting work was working
out what to build instead.

**A worker is not a queue, and the difference decides the whole module.** The reference's
`queue_job_runs` records a *backlog* — `queued_at`, `attempts`, `payload_summary` — and its five
operations are retry one, retry all, forget one, purge pending, purge dead. Every one of those acts on
work that is waiting. Ours has none: a job is due or it is not, a failed job runs again on its next
interval, and there is nothing queued to forget. **So this records runs, not jobs**, and the screen is
read-only. Building the five views would have produced exactly the empty page the plan predicted.

**The banner is the screen.** Per-job health cannot answer the question that matters, because every
job reads "healthy" on a stale last run if the worker died five minutes ago and nothing is due yet.
That is the failure this whole module exists for — no errors, no red, nothing in the log, and every
retention sweep and webhook retry silently stopped. "Is the worker running at all" gets its own line,
and its own summary field, computed from the shortest enabled interval rather than from any job's
state.

**A failed run is recorded, with its type and message and deliberately not its traceback.** A job
that has been throwing for a week is the single thing worth surfacing, and a traceback is a stack of
file paths rendered on a screen someone can open — the full one is already in the logs. The recording
never raises either: monitoring that can crash the thing it monitors is worse than none.

The worker gained a fifth job to trim its own run history, because every table that only grows needs
an answer — including the one that monitors the thing enforcing the others.

### And the last two open items on the module parity plan

**Step 5 — `ProfileForm`.** The last flat form in the app, now on `FormSection` + `FormGrid`. The
rewrite found something better than styling: **its email field was a control wired to nothing.**
Editable, counted by `isDirty`, lighting up the Save button — while the endpoint stopped accepting
`email` some time ago. You could type a new address, press Save, read "Profile updated successfully",
and nothing whatever had happened. It is read-only now with the reason inline, which is the position
the parity plan already recorded. Dropping its hand-rolled inputs also cleared one of the standing
lint errors — 20 down to 19.

**Step 6 — sort keys.** Closed by measurement rather than by reading: every module's columns were
cross-checked against its service's `ListSpec.sortable` by importing the specs and comparing.
**No column anywhere sorts on something the API refuses**, which is the half of the rule that was ever
a defect. Six keys are sortable in the API with no column offering them, and that is not an omission —
a table with one Name column cannot offer two sorts.

**Checked, not assumed:** 572 backend tests (28 new); a probe of 19 assertions covering a successful
run, a failing one, all five health states against real rows, and retention. The migration
round-trips. `tsc` clean, whole-tree lint down to 19.

> **Every module in the LeapDesk parity plan is now built.** What remains is not a module: nothing has
> been rendered in a browser, and the worker is not in `docker-compose.yml` — so on this machine the
> Background Jobs screen will report it stopped the moment the last manual run ages out. That is the
> screen doing its job, and it is also the next thing to fix.

---

## August 12, 2026 — The scheduler that four docstrings kept apologising for

**Four functions already existed, each with a docstring saying some version of "nothing calls this on
a schedule, because there is no scheduler".** Webhook retries. Expired sessions. API request-log
retention. Audit-log retention. `app/worker.py` is the scheduler. It calls them.

**This is a completion, not a new feature**, and that distinction was the point of doing it now:
today has produced several things that exist but nothing invokes, and the honest way to stop adding
to that pile is to connect what is already built. The retry backoff has been recording
`next_attempt_at` since this morning and nothing has ever read it. Now something does — the probe
takes a delivery the API gave up on, backdates its next attempt by a second, runs one worker pass,
and watches the receiver get called.

**A loop, not Celery.** Every job here is "run this function every N seconds" — no fan-out, no
queues, no results to collect. A broker plus a result backend plus a second deployment topology to
express a `while True` with a sleep in it would be the expensive way to be modern. If real background
*work* ever appears — a thousand emails, a generated export — that is the moment for a broker, and
Module 16 is where that conversation belongs.

**One decision, and it is the audit trail.** `activity-log` ships **disabled**.
`purge_older_than` states plainly that how long who-did-what is kept is a policy question — legal,
contractual, or simply how far back you want to be able to answer questions — and that picking a
number is not the function's place. Switching on a worker must not quietly begin deleting an audit
trail on the strength of a default nobody chose. It runs when someone asks for it by name. The other
three are safe unattended: a retry sends something already meant to be sent, and the two purges
delete rows that already grant and prove nothing.

**Three things it is careful about**, each because of how the failure would look. A job that raises
is caught and logged so it cannot take the other three with it — that is how a webhook backlog builds
up unnoticed behind a failing retention sweep. **A failed run still records when it ran**, or a
permanently broken job becomes a hot loop against the database on every tick. And SIGTERM sets a flag
rather than exiting, so `docker compose down` finishes the delivery in flight instead of recording as
pending something that was in fact sent.

**It is deliberately not in `docker-compose.yml`.** That file is protected, and adding a long-running
process to everyone's stack is the owner's call rather than a side effect of a feature landing. The
`--once` mode is what makes it useful before that decision — runnable by hand or from cron, on
exactly the code path the loop uses. The README now carries both, plus the four-line compose service
for whenever the answer is yes.

**Checked, not assumed:** 559 backend tests (16 new); a live probe of 13 assertions — a due delivery
is retried and marked delivered, an *undue* one is left alone, the three enabled jobs run in one pass
and the audit purge does not, and a deliberately exploding job returns zero while the real jobs still
run.

> **Module 16 is one step less blocked.** The plan blocks Queue Monitor on "we have no queue"; there
> is now something running in the background, which is the condition it was actually waiting for. It
> is still not a queue, and a monitor over four cron-ish jobs is a smaller and different screen than
> the one specced — worth re-scoping rather than building to the old spec.

---

## August 12, 2026 — Two loops closed, and one of them was a bug I shipped an hour earlier

**Both halves of this entry are the same idea from opposite sides: a control that exists but is
connected to nothing.**

**A permission that gates no route grants nothing**, and it looks identical on the Roles screen to
one that grants everything. Module 15's catalogue made that answerable, so it is now a test. Three of
the fifty-four gate no route — and all three turn out to be **genuinely enforced elsewhere**:
`ai-assistant-query-database` gates the assistant's *tools* rather than an endpoint,
`dashboard-view` gates a nav entry (there is no `GET /dashboard` — the dashboard is assembled from
other calls), and `settings-manage` is the one `permissions.py` already documents as deliberately
route-less, because the branding writes are gated on `require_super_admin` and Admin holds `"*"`.

**Each of those three is checked against the file that enforces it, not merely listed.** An excuse
nobody verifies is exactly how a genuinely dead permission would hide among live ones — so the test
reads `registry.py` for the tool gate and `navigation_service.py` for the nav ones, and fails if a
claim stops being true. A fourth test catches the opposite rot: a permission that later *gains* a
route should be removed from the excused list rather than left excusing something that no longer
needs it.

**The other half: the four webhook events now have call sites.** `user.created` fires from
`create_user`, `partner.created` from `create_partner`, `invitation.accepted` from
`accept_with_credentials`, all after the commit and through a new `emit()` that **never raises** —
the rule `activity_service.record` already follows, and it matters more here because delivery makes a
network request. Creating a user is not allowed to fail because somebody else's server is down. The
probe proves it twice: with a receiver returning 500, and with a port refusing the connection.

**And the probe caught a real defect in yesterday's module — one hour old.** `partner.approved` was
in the event catalogue and wired to `if data.status == "APPROVED"`. **There is no APPROVED status.**
A partner is `PENDING`, `ACTIVE` or `SUSPENDED`; activation *is* approval here. The event could never
have fired: the form offered it, an integrator could have subscribed, and it would have delivered
nothing forever — which is precisely the failure the subscriber-side validation was written to
prevent, arriving from the side nothing was checking. It is `partner.activated` now, firing on
`PENDING → ACTIVE`, and **a test greps the service layer to prove every offered event has an emitter**
so the next one fails in CI rather than in a probe.

> The lesson is the one this whole day keeps repeating: **validation that runs in one direction only
> catches half the bug.** `_validate_events` stopped a subscriber naming an event that does not
> exist. Nothing stopped us offering one that nothing emits.

**Checked, not assumed:** 543 backend tests (6 new); a live probe of 13 assertions that creates a
real user and a real partner with a webhook listening, confirms what arrives carries no password,
and confirms a broken or unreachable receiver leaves the account created either way. `tsc` clean.

---

## August 12, 2026 — The API documents itself, and the docs turned into a guard rail

**Module 15, and the parity scope closes with it** — every module in the LeapDesk plan is now built
except Queue Monitor, which stays blocked because we still have no queue.

**The plan said we start ahead here, and the honest reading of that was to build less.** FastAPI
already serves `/docs`; `backend/openapi.json` is generated from the running app and CI-checked for
staleness. Rebuilding a request explorer would have been a third copy of the same information and a
third thing to keep true. So this is a *reader*, not a registry.

**What it adds is the one fact OpenAPI cannot express for us: which permission gates each route.**
Our authorization is a FastAPI dependency, not an OpenAPI security scheme, so the generated document
is silent on it — and that is the single most useful thing to know about an endpoint here.
`require_permission("user-view")` returns a closure over the name, so the catalogue recovers it by
walking the dependency graph. No decorator, no registry, nothing for anyone to remember to update: a
route that starts declaring a different permission says so on the next request.

**Then it stopped being documentation and became a test.** `VERSION_SUMMARY.md` has always argued
that gating is declarative per route *"so an ungated route is obvious in review"* — which only holds
if somebody looks. Now something does, on every run: `test_no_route_is_unexpectedly_public` builds
the real application and fails if any route is reachable with **no authentication and no permission**,
unless it is on an explicit list of routes that are public by necessity.

**That list is deliberately exact rather than a wildcard**, and writing it out was the interesting
part. A `/auth/*` prefix rule would have been one line and would have quietly excused `/auth/me/*`
too. Instead each of the seventeen public routes is named with its reason: signing in and the three
Google SSO legs, because there is no account to authenticate as yet; password recovery, by definition
reached without a password; invitation preview and acceptance, which *create* the account; branding,
because the sign-in page renders it before anyone has signed in; and logout, which is public on
purpose — a session that has already expired must still be able to clear its cookie, or a stuck user
cannot get unstuck. **`unexpected_public` is 0**, and it is meant to stay 0.

The reverse index answers the question an administrator actually asks before granting something:
*what does this permission let someone do?* `api-token-manage` opens exactly four routes, all of
which mint or rotate a credential. Read off the routes, so it cannot drift from what the code
enforces the way a written description does.

**Checked, not assumed:** 537 backend tests (11 new). 156 operations across 117 paths, 118
permission-gated, 19 signed-in-only, 19 public and every one of them expected. `tsc` clean, lint
unchanged at 20 pre-existing errors, none in a file touched today.

> **The page has not been opened in a browser**, like everything else built today. And a second guard
> rail is worth adding later but is not here: nothing yet asserts that every permission in
> `permissions.py` is actually *used* by a route. A permission that gates nothing is a checkbox on
> the Roles screen that grants nothing, which is the mirror image of the bug this module catches.

---

## August 12, 2026 — Webhooks ship, and the URL a user types is treated as hostile

**Module 14.** An endpoint belongs to an `api_consumer` — a webhook is a
machine-to-machine arrangement, and hanging it off a person means the integration breaks when they
leave. Registration, a signing secret, a delivery log, redelivery, and a circuit breaker.

**The three mechanics the plan said to copy exactly are copied exactly.** The timestamp is **inside**
the signed string (`{timestamp}.{body}`), not a header beside it — that is what stops a captured
payload being replayed later, because a receiver checking the timestamp's age is checking something
the signature covers. Backoff is `[30, 120, 600]` over three attempts, on the reference's reasoning
that "a receiver that is down is usually down for minutes, not milliseconds". And **a 4xx is not
retried where a 5xx is**: a receiver rejecting the payload will reject it again, and retrying is
noise in their logs and ours.

**The reference does not guard the destination URL. We do, and it is the most important thing here.**
An endpoint is a URL a user supplies that our server then makes a POST to, which is textbook SSRF:
`http://169.254.169.254/` reads cloud instance credentials, `http://localhost:8002/api/v1/users`
reaches our own API from inside the perimeter where it is trusted, and `10.x` reaches whatever else
is on the private network. Every one is refused, at write time **and again immediately before each
send** because DNS can change between the two. A hostname that will not resolve is refused as well —
unresolvable means unverifiable, and "allow what we could not check" is how these guards get walked
around. Redirects are not followed, for the same reason: a 302 would take the request to a URL that
never passed the check.

**Three kinds of secret now exist in this codebase and they are stored three different ways**, which
is worth stating plainly because the temptation is to pick one rule: **API tokens are hashed**
(Module 10 — we only ever compare one), **provider credentials are encrypted** (Module 7 — we have to
send them), and **webhook secrets are encrypted** (here — we have to reproduce the HMAC on every
delivery). The rule is not "hash everything"; it is hash what you compare, encrypt what you must
reproduce, and never store plaintext either way.

**The circuit breaker is the difference between a log worth reading and one nobody opens.** Ten
consecutive failures disables the endpoint, and `disabled_at` is deliberately separate from
`is_active` — "we gave up" and "a person switched it off" are different answers to "why did this stop
working", and only one of them is somebody's fault. Any success resets the counter, so it measures
whether an endpoint is broken *now* rather than whether it has ever failed.

**Nothing retries automatically, and the UI says so.** Failed deliveries record when their next
attempt is due and `process_due_retries()` performs the sweep, but nothing calls it — there is no
scheduler, the same reason Module 16 stays blocked. **Redeliver is the retry that works today**, and
the delivery log carries it, because a webhook that failed silently is otherwise unrecoverable: the
event happened, the receiver missed it, and nothing anywhere can replay it.

**Checked, not assumed:** 526 backend tests (33 new); a live probe of 37 assertions against a **real
HTTP receiver** running in the probe — the signature verifies with the secret we handed over and
breaks when one byte of the body changes, a 4xx settles immediately while a 5xx schedules a retry and
fails after three, redelivery restarts the count, ten failures trip the breaker, a disabled endpoint
receives nothing, rotation invalidates the old secret, and no audit row contains either secret. The
probe patches the URL guard to reach its own loopback server — after first asserting that the guard
refuses exactly that address.

> **Two honest limits.** The four events on offer (`partner.created`, `partner.approved`,
> `user.created`, `invitation.accepted`) have a `dispatch()` entry point but **no call site emits them
> yet** — wiring them into those flows is a separate change, and offering events nothing fires is the
> failure the catalogue validation exists to prevent, so they are listed as the contract rather than
> claimed as live. And delivery is inline: a slow receiver holds the request that triggered it for up
> to ten seconds. That is acceptable for the test button and the redeliver button, which are what
> exercise it today; it is the first thing a queue would fix.

---

## August 12, 2026 — Machine identities get a governance surface, and a token is not a password

**Module 10 Part I — the Platform API.** A *consumer* is a system, not a person, permitted to call
our API; it holds tokens, each carrying abilities and an optional expiry. The screen exists so that
who holds standing access, what it reaches and when it last called are answerable without SSHing
into production.

**Part II is deliberately not ported.** The reference's registry-driven read engine answers a
question we do not have — the marketplace domain is greenfield, so there is nothing to expose and no
consumer asking — and their own code review found **100 of its 105 registered resources had no field
allowlist**, where NULL means every column. Building an exposure engine before there is data to
expose is speculative by definition.

**The whole porting difficulty is that Sanctum does not exist for us**, and the four decisions it
otherwise makes are made here explicitly. The one most likely to be got wrong: **tokens are hashed
with SHA-256, not with the bcrypt already sitting in `core/security.py`.** Bcrypt is wrong three
times over — it is deliberately slow, which is right for a low-entropy human password and pointless
against 400 bits of random; it *salts*, so an arriving bearer token could not be looked up at all and
every API call would load and check every row; and it truncates at 72 bytes, which is shorter than
the tokens we mint. The token's entropy is the security property, not the hash's cost factor.

**This is the opposite direction from Module 7 and the two must never be merged.** API Credentials
holds *other people's* secrets, encrypted because we have to send them. This holds *ours*, hashed
because we only ever need to compare one. They sit next to each other in the sidebar, both say
"API", and housing them together would blur an access-control boundary for the sake of a superficial
grouping. Even the sidebar glyphs are deliberately different.

**`active` is a kill switch that outranks the token**, and the gate checks it before anything about
the token itself — that is the "switch an integration off at 2am without hunting down its
credentials" control, and it is why the flag lives on the consumer rather than being inferred from
whether tokens exist. Switching back on restores the same tokens, which is what makes it safe to use
in a hurry.

**A rejected call is logged with its reason; the caller is told nothing.** Six outcomes —
`no_token`, `unknown_token`, `expired`, `revoked`, `consumer_inactive`, `missing_ability` — go to
our table and all six surface as one 401, because telling a caller a token is "expired" rather than
"unknown" confirms it once existed. Rejections are logged precisely because a burst of them is how a
leaked or probed token shows up, which means the table grows fastest exactly when something is
wrong: **it has a retention policy on day one.** The reference has none and its tracker does not
list one as planned.

**We took the `Principal` decision the plan asked us to take once.** Three requirements in four days
have needed a caller that is not a `User` — an anonymous visitor, a partner organisation, and now a
machine consumer. `core/principal.py` introduces the union with **anonymous as the most restrictive
branch by construction**, and a machine principal answers `False` to *every* permission: a machine
that could satisfy `require_permission` would be a token that can administer the application. The
tempting shortcut — a hidden service user per integration — is refused in as many words, because one
forgotten filter would turn an integration into a login.

**The ability catalogue ships almost empty, and that is the finding.** One real ability, so the
catalogue is exercised rather than hypothetical. Inventing a taxonomy for a domain that does not
exist would mint tokens whose abilities nothing honours — which reads as "granted" on the screen and
arrives as a 403 at the consumer, the worst kind of failure because both sides believe the other is
wrong. Abilities are validated against the catalogue at write time for that reason.

**Checked, not assumed:** 470 backend tests (34 new); a live probe of 28 assertions — the plaintext
appears in no column of the token table, the gate stamps `last_used_at`, `active=false` refuses a
perfectly valid token, expired and revoked each refuse with their own logged reason, deleting a
consumer cascades its tokens but **keeps its request log**, and no audit row anywhere contains a
token. Permissions seeded 5/5: Admin holds all five, **Staff holds none** — who holds standing
machine access is not general staff information. The migration round-trips.

> **Nothing accepts a token yet.** Part II is not built, so the tokens this screen mints have no
> endpoint to call. The gate that will honour them is written and tested so the first machine-facing
> endpoint inherits it rather than inventing one — but "issue a token and watch a real request
> authenticate" is not something that has happened.
>
> **Two known gaps recorded rather than papered over:** rate limiting is per-IP, so a machine
> consumer cannot yet be limited on its own axis, and PM-26's per-process counters mean N workers
> multiply every limit by N — which is a speed bump for a login form and a broken contract for an
> API. Both are arguments for PM-44 (Redis).

---

## August 12, 2026 — The AI assistant ships, and the database it reads cannot be written to

**Module 9 — the last of the original nine, and the one every other module was blocking.** It is a
chat widget in the corner of every signed-in page that answers questions from this application's own
data: who holds which role, which partners exist, where a record lives. It is **off by default** and
stays off until someone adds an Anthropic API key in API Credentials and turns it on.

**The whole design question is what an assistant with database access must not be able to do**, and
the answer here is five controls, four of them ported from the reference and one ours.

**It reads through a connection Postgres will not let it write to.** Not a rule in our code — a
startup parameter on the connection, so `INSERT`, `UPDATE`, `DELETE` and `DROP` are refused by the
database whatever SQL arrives and however it was built. The first attempt at this used a `SET`
statement and *silently did nothing*, because `SET` is transactional in Postgres and the rollback
after connection setup discarded it; the probe caught it by asking the connection what it thought
its own setting was. The stronger version — a dedicated `SELECT`-only role — needs an environment
change in two protected files, so the settings screen says in as many words which of the two is
actually in force rather than implying the better one.

**Credential, session and password tables are invisible, not merely unreadable.** The denylist is
applied to schema discovery as well as to reads, so the assistant is never told the name it would
have to ask for. Matching is by substring, so a table called `partner_api_credentials` that nobody
has thought of yet is already denied. **We deny two tables the reference leaves open: its own
conversation history.** In LeapDesk, anyone who can use the assistant can ask it to read what other
people asked it. That is a privacy hole rather than a feature and it is not ported.

**Secret columns come back redacted**, using the same `is_sensitive_column` rule Global Search
already enforces — one definition with two consumers, because two lists drift and only one of them
gets updated when a new secret column appears. **Filters are bound, never concatenated**: identifiers
are resolved against the live catalogue and used as column objects, so a table or column name the
model invents cannot reach SQL as text. Operators come from a nine-item allowlist. Output is capped
at 50 rows and 12,000 characters, and truncation drops whole rows rather than cutting the JSON —
a model handed malformed JSON does not report a parse error, it guesses.

**Which tools a user gets is the authorization, and it is applied before the model is told anything.**
A role without `ai-assistant-query-database` gets no database tools *described* to it, so there is
nothing to ask for and nothing to argue the model out of. That is what lets the system prompt honestly
say "you only hold the tools your role grants".

**Every reply passes a final deterministic check** for anything shaped like a credential — Anthropic,
Slack, GitHub and AWS key formats, PEM headers, and our own Fernet ciphertext, which would mean a
stored credential had escaped Module 7. PII is deliberately **not** blocked: this is an internal
staff tool and staff legitimately need a customer's email address.

**Probing it found a live defect in yesterday's work.** `credential_service.resolve` asked for
`APP_ENV` verbatim — `development` on every developer machine — while the credentials UI offers only
`local`, `staging` and `production`. **No row it could create was a row `resolve` would ever look
for**, so every credential consumer silently found nothing in development and the symptom was
indistinguishable from having configured nothing: the assistant reported itself off with a key
sitting in the database. One mapping function, and a regression test, because nothing raised and
nothing logged.

**Checked, not assumed:** 436 backend tests (16 new here); three live probes — 35 assertions on the
data path, 22 on the full chat pipeline using a deliberately invalid key, so the SDK really called
Anthropic and really got a 401 and the failure surfaced as a 502 that says nothing about the key. The
migration round-trips. `tsc` clean, lint unchanged at 20 pre-existing errors, none in a file touched
today.

> **The model call itself has never succeeded**, because no valid key exists here. Everything up to
> and including the network request is proven; what a real answer looks like, whether the prompt
> produces good tool choices, and how the widget renders a long reply are not.

---

## August 12, 2026 — The three half-finished modules are finished, and the tracker was wrong about all three

**The Activity Log, Roles and Users each had a list of gaps against LeapDesk that had been open
since the parity plan was written on 4 August.** They are closed. Measuring them first was worth
more than the closing: the tracker said Roles and Users were "not started" when both were nearly
complete, and said the Activity Log was untouched when its `hide_system` filter already worked. Two
of the eleven listed gaps turned out to have been built by someone and never ticked off.

**The audit trail can now tell a person from a script.** Every row written from here on carries a
`source` — `web`, `seeder` or `command` — and a CLI row additionally records which command ran, as
which OS user, on which host, because a CLI row has no causer and that was previously its only
attribution: none. The reference's `tinker` and `job` sources are deliberately **not** offered; we
have no REPL attached to the app and no queue at all, and a filter option that can never match a row
teaches the reader something false about what has been happening. Rows written before today carry no
source and match **no** value, rather than being quietly counted as web traffic.

**A non-admin now sees only the rows they caused — in the list and in the export.** This changes
nothing today and that is the point: `activity-view` is held by three roles, all of which have admin
access, so the sandbox is unreachable. It is wired now so that granting the permission to a fourth
role is not silently a decision to hand over the whole organisation's audit trail. The export was
the half that mattered — an unscoped download is the way around a scoped list, and it hands over the
file rather than one page. The filter dropdowns are scoped the same way, so a sandboxed reader is
not handed the staff directory in a "who did it" menu that would return nothing for everyone but
themselves.

**Search reaches the person, the record links to its page, and the trail sorts.** Searching now
matches the causer's name and email, because "show me everything Ayush did" is what people type.
Each row links through to the record it happened to, from a route map the server owns — the client
building those URLs would need a second copy of it, and a renamed route would then produce a link to
nowhere instead of no link. Types with no page, like `Partner`, get no link, which is the honest
answer. And the oldest-first toggle that `MODULE_PARITY_PLAN.md` § 3 left as an open question now
exists: reading an incident forward is the case that argues for it, and `id` stays the tiebreak so
the ordering is still total.

**`role-permissions` became a route, and doing so exposed a switch wired to nothing.** It was the
one permission of the forty-nine enforced as a conditional field check inside an update rather than
declared on a route, so it appeared nowhere in the API contract — `VERSION_SUMMARY.md`'s whole
argument for declarative gating is that an ungated route is obvious in review, and a rule you cannot
see is a rule a reviewer must already know to look for. Routing all three writers through one place
turned up the real finding: `security.audit.permission_changes` had been in the registry since
Configuration shipped, its code comment claiming "already true of our behaviour — `rbac_service`
records every grant change". **Nothing read the key and nothing wrote the entry.** The most
security-relevant change an RBAC system can undergo was the one change the trail did not record. It
does now, by permission *name* rather than id, because an audit row is read by a person and
`[3, 17, 41]` is not evidence of anything a year later.

**Ad-hoc emails can carry attachments, and the validator does not trust the browser.** PDF, Word,
Excel and images, matching the reference's allowlist exactly — but checked by magic bytes, so an
executable renamed `invoice.pdf` is refused. Three limits are ours and not the reference's: a cap on
the number of files and on their total size, because capping each file at 25 MB and saying nothing
about how many is two hundred files and five gigabytes; and the byte check itself. Filenames are
stripped of paths and quotes before they reach a mail header. The sender's copy became a real `Bcc`
rather than a second send, which had been arriving without the attachments — a misleading record of
what was sent. **The audit row names the files but stores neither the body nor their contents**:
"what was sent to this person" is answerable, "what did it say" deliberately is not.

**Deleting a user crashed, and linting the tree is what found it.** `user_service.delete_user` calls
`recycle_bin_service.soft_delete` and the module was never imported — a `NameError` on every delete,
single or bulk, since the Recycle Bin shipped yesterday. Typecheck cannot see it, no test covered
it, and the Users index would have raised a 500 on the first click. One line. The lesson is the same
one as yesterday's: the tooling that was green all day was not looking at this.

**Checked, not assumed:** 369 backend tests pass (48 new); two live probes against the running
database — 23 assertions on the trail's scoping, source filter and links, 21 on the attachment path
end to end, including that a refused file writes no audit row and sends nothing. `tsc` is clean.
Whole-tree lint is 20 errors, unchanged in kind and none of them in a file touched today.

> **Still not clicked in a browser.** Yesterday's caveat stands and now covers a file picker, a new
> filter row and a linked column — all of which are exactly the kind of thing that renders wrong
> rather than failing loudly.

---

## August 11, 2026 — Day in review: nine modules, and what the browser caught that the tooling did not

**Seventeen entries below, so this is the map.** Read this, then whichever one you need.

| What | Where |
|---|---|
| Nine LeapDesk modules shipped — 6, 7, 8, 11, 12, 13, 17, 18, Recycle Bin | the nine feature entries |
| The Users index became a written contract every module follows | *The Users module became the template* |
| Four agents built in parallel with no conflicts | *Four parallel agents merged* |
| Eight admin screens were in the wrong shell; the sidebar was regrouped | the last three entries |

**122 API operations, 17 pages, 49 permissions, 8 migrations.** Head `b6d41e807f92`.

### The pattern worth carrying forward

**Every bug found today was found by writing something down or by looking at the screen — none by
the type checker or the linter.**

Extracting shared pieces from four copied modules turned up seven live defects, including bulk-action
buttons that had never worked and a `#` column wrong in two opposite directions. Writing a comment
claiming the data-access upsert "revives a binned row" exposed that it did not. Probing the recycle
bin proved three auth paths that would otherwise have let a deleted user keep signing in. And the
owner found two more by opening the app: eight admin screens rendering inside the personal-settings
shell, and six sidebar entries sharing one icon.

Typecheck was clean and lint was flat through all of it.

> **The honest caveat, unchanged since this morning:** most of this has still not been rendered in a
> browser. Seventeen pages now share one table, one dialog shell and one set of column factories — a
> mistake in any of those is a mistake in seventeen places. That remains the cheapest unrun check.

---

## August 11, 2026 — The agent rules now actually reach the agent, and delegation has a policy

**Until today, five lines of project instruction loaded into a session, and the one instruction in
them could not be followed.** `CLAUDE.md` was a single `@AGENTS.md` import, and root `AGENTS.md` was
a five-line framework warning telling the agent to read `node_modules/next/dist/docs/` — **a
directory that does not exist** in `next@14.2.35`, on the host or in the container. Bundled agent
docs ship from Next 16. PM-19's writeup had already recorded that the instruction "cannot be
followed literally"; nobody had corrected the instruction. It is corrected in both files now, and
carries a note saying what to restore if this project ever upgrades to a Next that ships them.

**The 303 lines that matter were reachable by nothing.** `documentation/AGENTS.md` holds the commit
rules, the protected-file table, and the warning that a git write from `/opt/lampp/htdocs` would
delete the company marketing site. Claude Code reads `CLAUDE.md`, never `AGENTS.md`, and **never
auto-discovers an `AGENTS.md` in a subdirectory** — so that file was reached only by luck, via a
personal global instruction to go looking for AGENTS.md files. An agent without that global setting
would have had none of it.

**The fix is not "import the big file".** Imports load **eagerly** — every imported line is in
context on every turn — so importing 303 lines of process would have taxed each turn to carry a
checklist that matters a few times per task. Instead root `AGENTS.md` is now a 150-line operating
contract holding what must never be violated, and it *points at* the process file rather than
importing it. All seventeen hard rules were extracted from the old files and checked present in the
new one, one by one, before this was called done.

> **Model tiering is now the documented default: Opus orchestrates and validates, Sonnet subagents
> implement.** The orchestrator keeps planning, the risky code — migrations, RBAC, auth,
> `app/core/`, API contracts, protected files — and **all** verification; it never rubber-stamps a
> subagent's output. Sonnet takes bounded mechanical volume from an explicit spec. If a subagent is
> wrong twice, Opus takes the task over rather than paying for more rework.

Multi-worker rules came with it: non-overlapping file ownership, one worker owning an atomic
refactor end-to-end, and approved packages chaining without asking — which does **not** extend to
committing, because that rule is unchanged and absolute.

**`.claude/agents/sonnet-implementer.md` is the agent that policy names.** It is scoped away from
migrations, RBAC, `app/core/` and every protected file, and told to stop and report rather than
widen its own file list.

**The suggested policy was adopted with one correction, and it was a load-bearing one.** The source
draft listed *"production build"* in the validation gate. **In this repo a production build is the
thing that breaks it** — `.next` is a volume shared with the running dev server, so `npm run build`
replaces the dev output and every `_next/static` request 404s as an HTML page. The gate here is
`typecheck` + `lint`; CI runs the real build on its own checkout. The draft's Django vocabulary
(views, urls, selectors) was translated to routers, services, Pydantic schemas and components, and
its generic layer advice replaced with this project's own — including that SQLAlchemy here is
**synchronous**, and that public data renders server-side while authenticated data cannot.

**Checked, not assumed:** the subagent frontmatter parses and yields `model: sonnet` with six tools;
both instruction files total 171 lines, inside the 200-line guidance; every hard rule from the old
files greps present in the new one. Note that a **restart is required** before the new agent is
usable — Claude Code's watcher only covers agent directories that existed when the session started,
and `.claude/agents/` was created today.

## August 11, 2026 — The README now tells you how to run the project, instead of pointing elsewhere

**The README's four-line "Quick Start" is now a complete Docker runbook.** It previously deferred
almost everything to `ONBOARDING.md` — including the fact that **three environment files have to be
created by hand before anything works**, which was the one step most likely to stop a newcomer at the
first command. The new "Running Locally with Docker" section carries the whole path: prerequisites,
clone, all three `.env` files with their keys, build and start, migrations, all three seeders,
verification, day-to-day commands, port overrides, reset, and troubleshooting.

`ONBOARDING.md` is unchanged and is still the source of truth — it holds the host-based Path B and
the full gotcha table. The README no longer *depends* on it to get someone to a running app.

**Two seeders were missing from the README entirely.** It documented `alembic upgrade head` and
`seed_rbac`, but not `seed_partner_tiers` — without which `partner_tiers` is empty and every partner
onboards with no entitlement — and not the optional `seed_users` roster. Both are now in Step 4 with
the reason you'd want them.

**Three warnings were promoted out of ONBOARDING because they cost real time when hit.** Use
`docker compose run --rm`, never `exec`, for anything touching the database — `exec` skips the
entrypoint that rewrites `DATABASE_URL` and fails with a misleading `connection refused`. Never run
`npm run build` in the frontend container — it overwrites the dev server's `.next` volume and every
`_next/static` request then 404s as an HTML page, which the browser reports as a MIME-type fault.
And `docker compose down -v` does **not** reset the database, because `data/db` is a bind mount, not
a named volume — a genuinely dangerous thing to assume either way round.

**Two of the commands were wrong when first written, and were caught by running them.** The psql
one-liner used `$POSTGRES_USER` unquoted, so it expanded in the *host* shell where it is empty and
failed with `role "root" does not exist`; it now uses the `sh -lc` form the repo's own
`scripts/unlock-user.sh` already uses, which expands inside the container. And the secret generator
called a `python:3.12-slim` image that is not present locally — a 50 MB pull to print one string —
where `openssl rand -hex 48` was already on the machine. Hex, not base64, so no `/` or `=` for a
dotenv parser to trip over.

Nothing outside `README.md` changed. Every command in the new section was executed against the
running stack before it was written down.

## August 11, 2026 — The index table reads as rows again, and an account is now active or it is not

**Five changes to how a data table looks, and one to what the Users module can store.** Owner's
review of the Users screen, 2026-08-11.

**Rows read as one block, so they now alternate to a lighter green.** The stripe was `bg-muted/30`,
which over the green card composited to about one point of difference — a colour nobody could see.
It is the same token at full strength now: `#eff3f2`, the brand teal at 8%, against a card that is
the same teal at 10%. The striped row is therefore *lighter* than the one above it rather than
darker, which is what the owner asked for and also the only direction that works on a green surface.
The hover moved to brand at 10% in the same change, because a stripe that solid needs a hover that
beats it, and `UI_PATTERNS.md` § The Signed-In Chrome Is Green rules out hovering to a grey.

**Cells were 2px of vertical padding, which is why records merged into each other.** Now 8px, for a
32px row instead of 20px. Horizontal padding went from 6px to 12px. The `#` and Actions columns still
override it and stay narrow — they always did.

**The white hairlines between header cells are gone.** The header row is filled with the brand green,
and the divider was `#e6edef` — a near-white rule drawn across it. That reads as damage to the fill,
not as column separation. The line under the header stays: that one divides the header from the rows,
which is a real boundary. Body columns keep their dividers, which are drawn on white and look fine.

**One font size across every column.** Badges were hardcoded to 11px while the cells around them were
12px, so Status, Role and Type rendered one pixel smaller than Email and Last-login beside them —
close enough to look like a rendering fault. Badges now follow the table's own scale, and so do the
two lines in the User cell. Emphasis inside a row is carried by weight and colour, never by size.

**Two of these fixed real bugs rather than only taste.** Our own `DataTable` — the one behind Roles,
Invitations and Activity — carried `hover:bg-brand/10/40`, which is not a class: Tailwind takes one
opacity modifier, a second makes the whole token unparseable, so it emitted nothing and those tables
had **no hover at all** in light mode. And the Activity-Log `?highlight=` deep link never painted its
yellow flash on an even-numbered row, because the stripe selector outranks a plain utility class on
the row; only the ring was ever visible. Both are fixed, and both tables now match.

> **A user account is ACTIVE or INACTIVE. There is no third value, and the database enforces it.**
> `user_status` had SUSPENDED, distinguished from INACTIVE by intent — "never approved" versus
> "approval withdrawn". Nothing ever acted on that distinction: both refuse the login, both revoke
> the live sessions, and the only code that told them apart was the wording of a 403 and a guard
> refusing to toggle a suspended account. **A state whose entire behaviour is another state's is a
> label, not a state**, and it cost a three-armed conditional at every read.

Removing it from the API alone would have left the database willing to hold a value every read path
had stopped branching on — so migration `b3d7e02f4c19` rebuilds the type. Postgres cannot drop a
value from an enum at any version, so it renames the old type aside, creates the two-value one, and
retypes the column with a cast that folds any SUSPENDED row into INACTIVE. Measured first: 4 ACTIVE,
1 INACTIVE, **0 SUSPENDED** — the mapping is defensive, not corrective. Verified to round-trip:
downgrade restores the three-value type and upgrade returns to two.

**What the downgrade cannot restore is which accounts were suspended**, because that stops existing
the moment they fold into INACTIVE. The activity log keeps it — every status change is recorded with
its `old` value — and that is the honest place for history, rather than a column that has to be
branched on forever.

The label changed too: INACTIVE read "Pending approval", which is true of an account that was never
approved and false of one an admin just deactivated. It says "Inactive" now. Both status maps are
typed `Record<UserStatus, …>` on purpose — if the domain ever grows again, they fail to compile
rather than rendering an empty badge.

**Checked, not assumed:** the enum holds two values and the column kept its default, its NOT NULL and
its index; Pydantic rejects SUSPENDED and Postgres rejects it; the OpenAPI export is deterministic and
the regenerated types show `SUSPENDED` only under `partner_status`, which is a different enum and was
not touched; frontend typecheck passes; lint reports the same 18 pre-existing React Compiler errors as
before the change, verified by stashing.

## August 11, 2026 — Recycle Bin: deleting things stopped being permanent

**The Recycle Bin is done.** LeapDesk's docblock says what it fixes and it was true of us until today:
*"Before this existed every delete in the core was permanent."*

Four tables gained `deleted_at` — `users`, `user_invitations`, `data_access_grants`,
`searchable_entities` — matching the reference's five minus `api_consumers`, which arrives with
Module 10. **A table gets soft deletes when losing a row is recoverable-worthy, not by default**, and
the migration records why each excluded table is excluded: roles and permissions already refuse
deletion while anything holds them; the activity log and error occurrences are append-only evidence
nothing deletes; settings and feature flags come back on the next seed; partners have their own
reversible state and a second one would give two ways to make a partner disappear.

### The allowlist is the security control

`TYPES` is a dict literal and a request's `type` is checked against it before anything is resolved.
The reference states the rule outright — *"a raw string from the request is never resolved to a class
name"* — and without it, `type` is an arbitrary-model-load primitive. Probed: `os`, `User`, `role`
and `""` all rejected; only the four keys resolve.

> ### The real work was deciding **which queries filter `deleted_at` and which must not**
>
> A blanket "hide deleted rows everywhere" is wrong here, and looks like an oversight until it is
> written down:
>
> **Filtered**, because a binned record must not act or be picked — the login lookup, the session
> lookup, the user list and detail, the invitation list, the **invitation token** lookup, the data
> access scoping read, the grant list, the searchable-entity list.
>
> **Not filtered**, because the record is being named *as history* — the activity log's causer names,
> the security audit panel, error occurrences. **A deleted user's name must still resolve**, or "who
> did this" becomes "unknown" for precisely the accounts most likely to be asked about. `causer_id`
> is retained on those tables for exactly this; filtering it away would waste that.
>
> Laravel's `SoftDeletes` global scope has the same problem and unpicks it with `withTrashed()` at
> those call sites. Ours is the inverse default — filter where it matters, and the list is finite and
> enumerated.

**Three of those would have been silent holes**, and each is a different shape of failure:

- **The login lookup.** Without the filter, a deleted account keeps its password and keeps signing in —
  "delete the user" would silently mean "hide the user from one list".
- **The session lookup.** Checked on every authenticated request, so binning a user ends their live
  sessions immediately rather than whenever the token expires. The token cannot know.
- **The data access scoping read.** A grant sitting in the bin that still grants — the worst version,
  because the admin screen would show it as revoked.

**Two queries deliberately still see binned rows, and both are about unique constraints.**
`auth_service.email_exists` counts deleted accounts because `users.email` is UNIQUE at the database
level: filtering would let registration accept an address that then fails on the constraint, and would
make restoring that account **impossible** because its address had been taken meanwhile. So a binned
account still reserves its email, and purging is what frees it — recoverable and reserved, or gone and
released, not both. The searchable-entity `model_class` lookup does the same for the same reason.

**A comment I wrote turned out to be a lie, and fixing it was the point.** The data-access upsert's
note said it finds a binned row "and revives it" — it found it and did not revive it, so re-granting a
previously-revoked permission would update the row, tell the admin it was granted, show it on the
screen, and grant nothing. One line: `existing.deleted_at = None`.

**Restore does not confirm; purge does.** Restoring is reversible and a dialog in front of an undo
button is friction protecting nothing. Purge names the record and says it cannot be undone, because it
is now **the only irreversible delete in the core** — everything else lands here first. The activity
entry for a purge is written **before** the row goes, since afterwards there is nothing left to
describe.

**Verified end to end, not asserted:** created → listed → soft-deleted → invisible in the list,
unfindable by email, 404 from the detail endpoint, present in the bin, email still reserved → restored
→ visible and findable again → purged → gone from the database and the email freed.

Lint **19 → 20**, one more of the same fetch-on-mount effect. Sidebar is now 15 entries across four
sections, all with distinct icons.

## August 11, 2026 — The sidebar was regrouped to LeapDesk's four sections, and Feature Flags stopped being a nav item

**Read from `references/LeapDesk/app/Services/NavigationService.php` rather than assumed.** It has
**four** sections where we had three, and two of our items were in the wrong one.

| Section | LeapDesk | Ours, before | Ours, now |
|---|---|---|---|
| User Management | Users, Roles, Data Access, Activity Log | + Invitations | matches |
| System Settings | Configuration, Security, API Credentials, Invitations, Global Search, Platform API, AI Assistant | + Error Tracking, System Health, Feature Flags; − Invitations | matches, + Branding |
| **Operations** | Queue Monitor, Error Tracking, System Health, Recycle Bin | **did not exist** | Error Tracking, System Health |

**Operations is the section we were missing**, and it is a real distinction rather than a longer menu:
those screens **watch** the running system, where System Settings **configures** it. You open Error
Tracking because something is wrong, not because you want to change something. Collapsing the two had
produced a nine-item System Settings.

Two of its four are absent for reasons already recorded: Queue Monitor is **blocked** (we run no
worker) and Recycle Bin is not started. `filter_sections` drops an empty section, so Operations
appears only because two of its items exist.

**Invitations moved to System Settings.** On reflection LeapDesk's filing is the better reading: User
Management is about people who already exist and what they may see; an invitation is a **pending
grant**, which is configuration.

> ### Feature Flags is no longer a sidebar entry, and the button that replaced it is load-bearing
>
> LeapDesk has no nav item for it either. It lists `/settings/feature-flags` among **Configuration's
> `activePrefixes`** and reaches the page from a button in the Configuration header — so Configuration
> stays highlighted while you are on it. Two sibling entries for one settings surface is a longer
> sidebar that says less, and our `_item` already has `active_prefixes` for exactly this (it is how
> the four Users routes share one entry).
>
> **The consequence is worth stating where someone will read it: that button is now the only route to
> the page.** Removing it makes Feature Flags unreachable. The comment at the call site says so.

`Search` was also renamed **Global Search** — LeapDesk's label and the more accurate one, since it
configures what the *global* search box looks in, which is a different thing from the search box on
every index page.

**One label deliberately not changed:** ours reads *Roles & Permissions* where LeapDesk says *Roles*.
The page heading, its metadata and the module have all read "Roles & Permissions" since 2026-08-07,
and changing the nav alone would have made the sidebar and the page disagree. Left as-is rather than
half-done.

Verified: four sections render in order, every item permission-filtered, all seven affected routes
still serve 200 — **including `/dashboard/feature-flags`, which no longer has a sidebar link**.
Typecheck clean, lint **19 errors / 0 warnings**.

## August 11, 2026 — Eight admin screens were in the profile shell, and the sidebar had six identical icons

**Two problems the owner caught on screen, both invisible from the source.**

### Eight admin modules were rendering inside the personal-settings shell

`app/(app)/settings/layout.tsx` is the **profile** area: heading *"Manage your profile and account
settings"*, a `max-w-5xl` column, and its own left sub-nav. Everything placed at `/settings/*`
inherited it — so Configuration, Security, Error Tracking, System Health, Feature Flags, Search and
API Credentials rendered with the wrong heading, the wrong sub-navigation, and width-capped so the
full-height table layout could not work at all.

Eight page routes moved to `/dashboard/*` — the seven above plus **Branding**, which had the same
problem and predates this session. `/settings/*` now holds **exactly three**: Profile, Password,
Appearance.

**Branding also came out of the settings sub-nav.** It was listed there under an "Installation"
heading gated on super-admin, so one admin screen sat in the profile shell while its seven siblings
were full-page modules — the same screen reachable from two navigations that disagreed about what
kind of thing it was.

> **Only page routes moved. API paths did not.** `axiosInstance.get("/settings/configuration")` is a
> backend router prefix and matches the reference; changing it would have broken every call for
> nothing. Of the ten `/settings/*` references in the frontend, exactly one was a page `<Link>` and
> only that one changed.

Two things fell out of the move. `tsc` went red on modules that no longer exist — Next generates a
type file per route and the deleted ones linger in `.next/types`; cleared those directories rather
than rebuilding. And removing the Installation block orphaned `linkClasses`, which turned out to be
**duplicated by an inline copy in the main loop** — the two had already drifted, with the inline
version carrying `dark:text-brand-on-dark` twice. Collapsed onto the helper.

### Six sidebar entries shared one icon

`settings` was doing duty for Branding, Configuration, Security, System Health, Feature Flags, Search
and API Credentials; Data Access borrowed `roles` and Error Tracking borrowed `activity`. **A sidebar
where six entries carry the same glyph is one whose icons carry no information** — the eye has to read
every label, which is the job the icon was there to save.

Nine new icons, each chosen for what the screen *does* rather than for its name: Security is a shield,
Data Access is a key in transit, Error Tracking is a warning triangle, System Health is a pulse trace,
Feature Flags is a flag, Search is the same magnifier the filter bars use. Same 24px grid and 1.8
stroke as the existing set so they sit level.

**Cross-checked rather than eyeballed:** every icon name the server sends exists in the frontend
registry — a mismatch renders the `dot` fallback silently — and **no two nav items share one**. 14
entries, 14 distinct glyphs.

Verified: all 9 relocated routes and all 3 profile routes serve 200, typecheck clean, lint back to
**19 errors / 0 warnings**.

## August 11, 2026 — Four parallel agents merged: the core is now 13 screens and 119 endpoints

**Data Access (6), Global Search (8), Feature Flags (13) and API Credentials (7) were built in
parallel and merged.** With Configuration (11), Security (12), Error Tracking (17) and System Health
(18) built here, **eight modules landed in one day**. 119 operations across 89 paths; **all 13 pages
render**; typecheck clean.

### The parallelisation held, and the reason is worth keeping

Nothing conflicted. Not because the agents were careful, but because the **shared files were taken
away from them**: every migration, every model registration, every permission and every router mount
was pre-built or reserved here, and each agent was given an explicit "do not open" list. The one that
would have failed silently is Alembic — two migrations revising the same head produce two heads, and
Alembic does not complain until someone runs `upgrade`, long after both authors believe they are
finished.

**The agents added zero lint errors.** Lint is 19 before and after the merge, which is the real
signal: five new frontend modules and not one open-coded fetch, because they all used
`useResourceList` as the contract requires.

### Reviewed before mounting, not trusted

**Global Search's model allowlist was attacked, not read.** `searchable_entities.model_class` is a
string an admin can edit, and resolving it dynamically would be an arbitrary-import primitive. Probed
with `os`, `app.core.config`, `builtins` and `subprocess` — **all four rejected**, `User` resolves.
The registry is a dict literal and there is no `importlib`, `eval` or `getattr` anywhere near it.

**API Credentials encrypts at rest, verified end to end.** A 34-character token becomes 140 characters
of ciphertext, the plaintext does not appear in it, it round-trips, and two encryptions of the same
value differ — Fernet is using a fresh IV rather than deterministic encryption, which is what stops
"do these two providers share a key" being answerable from the ciphertext alone.

> **The agent improved on my instruction, and was right to.** I asked for Fernet in a new module; it
> found `app/core/encryption.py` — pre-existing, used for 2FA secrets, already deriving a Fernet key
> from `SECRET_KEY` via HKDF with a distinct info string — and reused it. **No new dependency, and one
> key-derivation path rather than two.** My probe initially reported "uses Fernet: False" because
> `credential_service` delegates rather than importing it directly; the probe was wrong, not the code.

**And it found a divergence I had not anticipated.** LeapDesk's accessor returns the **raw stored
value** when decryption fails, so a key rotation degrades rather than crashes. That intent is right
and the behaviour is not portable: our raw value is Fernet ciphertext, so returning it would render a
wall of base64 into the UI as though it were the credential — and a `reveal` would hand an operator a
string they might paste somewhere believing it was their key. It returns `None` and reports the field
unreadable instead. Same degradation, honest about which one it is.

`assert_encryption_available()` encrypts and decrypts a **constant probe** at startup and refuses to
boot if it fails — so the failure mode is a dead service rather than a credential store quietly
holding plaintext.

Masking is right including the case that is easy to miss: a field typed `password` with
`is_encrypted` false — secret to *show*, not worth encrypting at rest — **still masks**.

### Where the merge put things

`Data Access` sits under **User Management**, not System Settings, because it answers the same
question as the two items above it: who may see whose records. The other three are System Settings.
The sidebar is now 14 entries across three sections, every one permission-filtered on the server.

## August 11, 2026 — Error Tracking and System Health shipped; the 500 handler now records what it catches

**Modules 17 and 18 are done.** Four of the eight operations modules are now built
(11, 12, 17, 18); three more are with other agents.

### The fingerprint is the module

`md5(exception_class | file | line | route)` — four fields, and **the message is deliberately not one
of them**. Verified: `"User 41 not found"` and `"User 87 not found"` group as **one** row. That is
what turns tens of thousands of log lines into a list somebody can work through, and grouping them
apart would recreate the flood the table exists to replace.

The cost is recorded rather than left to be rediscovered as a defect: two genuinely different bugs
raised from the same line of a shared helper will merge. That is the right trade for a helper, and the
occurrence rows keep the individual messages so the merge is visible rather than lossy.

**One adaptation the reference does not need.** We take the **innermost** traceback frame, not the
outermost. Python's `extract_tb` walks outward-in, so taking the first frame would fingerprint every
error in a request to the same middleware entry point and collapse the entire table into one row.

### The reopen rule, and the half of it that is easy to get wrong

    after ignored : ignored   ← must stay
    after muted   : muted     ← must stay
    after resolved: open      ← regression, resolver cleared

Only `resolved` reopens. `ignored` and `muted` are decisions someone made about a **known** error, and
a new sighting is not new information about them; only `resolved` is a claim that the error stopped,
which a sighting disproves. **One probe line was wrong, not the code** — the first version raised the
same exception from two different source lines, which correctly produced two groups. Re-probed from an
identical origin.

**The recorder is wired into the existing 500 handler**, and three things had to be right: it opens
**its own session** (the request's is often *why* we are there), it **never raises** (it runs inside
the handler that exists to prevent crashes), and its context captures **user agent and referer only —
never request input**, because bodies carry credentials and this table is readable by anyone holding
`error-view`. Proved end to end against a real 500 through the middleware stack: recorded with path,
method, URL and stack, and **the response body leaks nothing**.

It reads `operations.errors.record_outside_production` from the Module 11 registry — the first real
consumer of a setting, which is what the registry was built for.

### System Health, and three panels that could not be ported straight

**Storage is the database, not a disk.** Laravel writes uploads to `storage/app`; we have no upload
directory at all — branding assets are `LargeBinary` columns on `app_settings`. Reporting free disk
space would measure the container's ephemeral layer and tell nobody anything about whether *our* data
is growing.

**There is no log file to size.** Logging goes to stdout and is the container runtime's to rotate. So
`operations.health.log_warn_mb` — seeded yesterday — is **the one setting in the registry with nothing
reading it**. Recorded rather than quietly ignored, because the seeder's own rule is that a setting
nothing reads is worse than no setting.

> **Two panels report "not configured", and that is the feature.** A queue panel showing
> **0 pending / 0 failed** is indistinguishable from a healthy queue and would be read as one. We run
> no worker, so it says so. Provider reachability needs Module 7's credential chain, so it reports the
> counts and states that nothing has been probed. **An unchecked green tick is worse than an honest
> blank.**

**A bug proved the error-handling design while I was building it.** The database panel's query used an
unqualified `relname`, which exists on *both* `pg_class` and `pg_stat_user_tables` — an
`AmbiguousColumn` error. Because every panel is wrapped to degrade rather than raise, the endpoint
answered **200 with `reachable: false` and the message**, instead of a 500. A health endpoint that
fails when the thing it monitors is unwell is useless exactly when it is needed; this one demonstrated
that property by accident before it was ever needed on purpose.

**Verified:** migrations round-trip; the fingerprint groups and separates correctly; the reopen rule
holds for all four statuses; a live 500 is recorded with no leak; every health panel returns real data
(10 MB database, PostgreSQL 16.13, watched-table sizes); all five of my routes serve 200. Lint
**18 → 19**, one more of the same fetch-on-mount effect. `createBugReport` is **absent** — it opens a
FeedbackHub item and we have no FeedbackHub, so the button would post nowhere.

## August 11, 2026 — Security shipped, and the reference turned out to be hiding two of its own settings

**Module 12 is done.** Not its own table — it is the `security.*` namespace of Module 11's registry,
with its own screen because these controls need grouping and explaining in a way a generic settings
list cannot. Four controls in three groups, plus an audit panel.

**The guard is the module.** `PUT /settings/security/{id}` refuses any key outside `security.` — one
line, reproduced from the reference, and it is what keeps two screens over one table honest. Without
it this endpoint is a second write path to **every** setting, one that a reader of the Security
screen's permissions would never think to check. It answers **404, not 403**: a caller with no
business here learns the endpoint does not address that row, rather than that the row exists and is
guarded. Verified — writing `operations.errors.record_outside_production` through the security
endpoint returns 404.

> ### 🔴 The reference has a bug here, and copying it would have hidden two security controls
>
> `Security/Index.tsx` builds its tabs as `[...groupNames, 'Audit']`, and its seeder registers two
> settings in a group **called `Audit`**. So the tab list holds `"Audit"` twice with the same React
> key, and the body renders `tab === 'Audit' ? <AuditTab/> : <settings>`. The activity panel always
> wins.
>
> **`security.audit.credential_decrypt` and `security.audit.permission_changes` are unreachable in
> LeapDesk** — including *"log every API credential decryption"*, from the only screen that edits it.
>
> Ours calls the tab **"Recent activity"**, which cannot collide with a group name. One word, both
> controls reachable, contents otherwise identical. Registered as the third entry in the plan's *"where
> LeapDesk's behaviour is a defect"* category, which requires writing the divergence down before
> diverging.

**A second bug was found by a probe rather than by reading.** The audit panel resolves causer names in
one query; a row whose causer has since been **deleted** left `causer` null, which the schema forbids —
it surfaced as a Pydantic error the moment a real request ran. The reference has the same hole and
fails differently: `$a->causer ? name : 'system'` prints **"system"** for a deleted user, labelling a
human action as automation **on the one screen where "did a person do this" is the question**. Ours
has three states — a name, `"system"` for automation, `"deleted user"` when the account is gone.
`causer_id` is retained on the row precisely so that distinction survives the account.

**The row editor is now shared, not copied.** Configuration and Security edit the same table through
two endpoints, so the editor is the same editor — extracted to `SettingRowEditor` with `save` injected,
because which endpoint may write a row is an authorisation decision the *screen* makes, not a property
of the row. Copying it would have been two places to keep five type-editors in step, which is the
shape of every bug this session has found.

**`LOG_SETTINGS` was declared**, and it already existed in the data: three call sites in
`settings_service` wrote the bare string `"settings"` with no constant, while `LOG_AUTH` and
`LOG_DEFAULT` had one. Settings changes now land on it rather than `default`, which is what puts them
in the Security audit panel alongside sign-ins — who signed in, and who changed how signing in works.

**Verified:** 4 controls across 3 groups, all keys namespaced; 50 audit rows from `auth` + `settings`;
the out-of-namespace write 404s; an in-namespace write returns 200 and appears in the panel; all three
`/settings/*` sidebar entries render; no backend tracebacks. Lint **17 → 18**, one more occurrence of
the same fetch-on-mount effect — the two warnings now showing are in `FeatureFlagsModule`, another
agent's work in progress, and were left alone.

## August 11, 2026 — Configuration shipped: one settings registry, and the first constant moved out of code

**Module 11 is done** — the shared settings registry LeapDesk's own docblock describes as *"replacing
four parallel per-plugin implementations"*. Table, service, two endpoints, an idempotent seeder and the
screen. **10 settings registered across 2 modules.** It unblocks Modules 12 (Security) and 13 (Feature
Flags), both of which read this table rather than tables of their own.

**Two endpoints, and deliberately no more.** There is no create and no delete: rows are declared in
code by `setting_service.register` and reconciled by a seeder. That is what guarantees the screen
always knows a label, a type and a group for everything it renders — a key inserted straight into the
table would appear as an untyped, unlabelled row nobody could safely edit. A setting nothing reads is
dead weight; code reading a setting that does not exist is a bug. Both are migration concerns.

> **The property that makes this cheaper than the screens it replaces: validation comes from the row,
> not from a rule table.** An `int` setting rejects `"abc"`, a `bool` rejects `"maybe"` — and a new
> setting needs no new validation rule anywhere. The tempting shortcut is to validate everything as a
> string and cast later, which throws exactly that away.
>
> Ours is **stricter than the reference's**, and that is the one place the port deliberately improves
> on it. PHP's `(int)` turns `"abc"` into `0` and `(bool)` turns the string `"false"` into `true`, so
> LeapDesk has to run a separate validation pass first and relies on it catching bad input before the
> cast ever sees it. Merging validation and coercion into one function means there is no order to get
> wrong. The case that matters most is `bool`: a checkbox that silently read `"false"` as **on** is the
> kind of settings bug nobody finds until a security control is quietly off.

**The idempotence guarantee was tested, not assumed.** A seeder that runs on every deploy must refresh
a setting's *metadata* and never reset its *value* — otherwise every deploy silently reverts whatever
an administrator has tightened. Verified end to end: default 10 → admin sets 45 → re-seed → **still
45**, label still refreshed.

**One constant has started moving out of code**, which is the point of the registry rather than a side
effect. `security.reauth.window_minutes` is seeded at 180 because that is what
`PASSWORD_CONFIRMATION_TIMEOUT_MINUTES` is today, so the row tells the truth about the running system
on the day it appears. Two more — invitation expiry and max resends — are seeded at their real values
with descriptions saying plainly that **the code still reads the constant** and they are wired up with
Module 12. A setting that claims to control something it does not is worse than no setting.

### Two things this port does differently, both forced by our stack

**There is no cache, and the reason is LeapDesk's own comment.** They wrap every read in
`Cache::rememberForever` because *"a setting that takes five minutes to take effect is worse than one
that costs a query."* That argument runs **against** caching here: Laravel has a shared cache store, so
one process busting a key busts it for all. We have none — an in-process dict would be per-worker, so a
write served by worker A would leave B and C on the old value **until restart**. That is not a
five-minute staleness window, it is an unbounded one, and it is the exact failure their comment
rejects. Reads are one indexed query on a table of tens of rows.

**Configuration is not a data table, and yesterday's spec said it was.** Building it disproved that:
the reference renders grouped `module · group` sections with an inline editor per row. The reasons
generalise, so the correction is recorded in the plan rather than quietly fixed — **there is no row to
open**, **five types need five editors**, and **nobody compares settings**. A table exists to scan rows
against each other and pick one; a settings screen is somewhere you arrive already knowing which key
you want. `UI_PATTERNS.md` § The module CRUD contract already allows this — *parity means the same
vocabulary, not the same feature list* — and the vocabulary is all still there: the Card shell,
`FilterCombobox`, the house `Button` and `Badge`, the toast, the ink tokens.

**Two primitives were missing and are now shared.** `Toggle` (a real `<button role="switch">`, not a
styled div — `aria-checked` is what announces its state and a button is what makes Space work) and
`Textarea` (a sibling of `Input`, not a `multiline` flag on it: that flag would make the forwarded ref
type and the spread attributes conditional on a prop, which is how one component becomes two with a
boolean between them). Booleans save the instant they are toggled, because a switch that needs a
second click on Save reads as not having worked — it has already moved.

**Verified, not asserted:** migration round-trips (`c4e1a9038d72` down and up); GET returns 10 items
across 2 modules; a non-int is rejected **422 naming the setting** — `"Invitation expires after
(days)" — Expected a whole number.` — because this screen edits ten rows and "invalid input" would not
say which; unknown id 404s; the activity log records **old and new** for every change; the sidebar
entry appears, gated on `settings-view` rather than `settings-manage` since the screen has a read-only
mode and Branding does not. Typecheck clean. Lint **16 → 17**: one new occurrence of the fetch-on-mount
effect that `useResourceList` and `RolesModule` already carry, not a new class of error. A second,
avoidable one was written and removed — a prop-sync `useEffect`, replaced with React's documented
adjust-during-render recipe, which also fixes the stale-value flash the effect version paints first.

## August 11, 2026 — The reference grew by eight modules, and the CRUD shape became a written contract

**LeapDesk shipped eight more modules between 10 and 11 August**, and all eight were on the owner's
list: Configuration, Security, Feature Flags, Webhooks, API Documentation, Queue Monitor, Error
Tracking, System Health, plus Recycle Bin. Researched from `references/LeapDesk` — routes, migrations,
controllers and seeders — and specced into `LEAPDESK_PARITY_PLAN.md` as modules 11–18. **The module
count went from 10 to 18.**

> **The plan predicted this exactly.** Its Module 10 note, written on 2026-08-10, says *"a reference
> that is still under active development will do this again, so treat this plan's module list as a
> snapshot with a date, not a fixed set."* Eight modules arrived the next day. The prediction is worth
> more than the list — this will keep happening, and the plan is structured so it can.

**These eight are a different kind of module, and saying so is the useful part.** Modules 1–10 are
business objects someone creates and edits. These are **operations surfaces**: they observe the running
system or configure it. Six of the nine have no create form, three are read-only, and one — System
Health — has no tables at all. **Applying the Users CRUD shape to them uncritically would produce
exactly the empty three-dot menu the Activity Log work already rejected**, so § Modules 11–18 carries a
table of which surface gets which affordances, and the answer is different for almost every one.

**The mechanics worth copying were recorded rather than summarised.** Configuration derives each
setting's validation from *its own declared `type`*, so an int setting rejects `"abc"` without a
per-key rule table. Security is not a second table — it is the `security.*` namespace of the same
registry, with a one-line guard that stops that screen writing any other key, and **every default
reproduces current behaviour** so shipping it changes nothing until someone deliberately tightens
something. Webhooks sign with the timestamp *inside* the HMAC string, which is what stops a captured
payload being replayed. Error Tracking fingerprints on `class|file|line|route` and **deliberately
excludes the message**, so two failures differing only in an interpolated id group as one bug. Recycle
Bin validates the record type against a service allowlist, because without it `type` is an
arbitrary-model-load primitive.

**Two findings that change what we should build:**

- **Queue Monitor is blocked, not pending.** We have no queue — no Celery, no RQ, no worker. Building
  the monitor first produces a page that reads "0 jobs" forever. Its real prerequisite is whatever
  first needs a background job, most likely outbound email, which is synchronous today and is the
  thing most likely to make a request hang.
- **API Documentation is a module we mostly already have.** PM-42 already commits a generated OpenAPI
  document that CI checks for staleness. The honest version for us is a viewer over that, not a second
  catalogue.

**The Progress table was re-audited against the running system**, which it had been asking for since
2026-08-10. Every number in it was wrong: permissions are **43**, not 0 and not 34; the migration head
is `b3d7e02f4c19`, not `f5a3c81b7d29`; and four modules marked "not started" have shipped code. Ten
routers exist. **What the audit deliberately does not claim** is that those modules satisfy their
specs — it establishes that code exists, not that the gap lists are closed, and it says so.

> ### `UI_PATTERNS.md` now carries **The module CRUD contract**
>
> The owner's instruction — *"every module CRUD should follow the exact structure and UI/UX of the
> Users index"* — is now a mandatory section rather than a thing four files happen to do. It names
> every shared piece and what it owns, states that create/edit/view are modals while the routes stay
> as the deep-linkable version, and fixes the ink and font-size rules.
>
> **Its opening argument is the seven bugs.** Bringing four modules onto these pieces uncovered a `#`
> column wrong in two opposite directions, dead bulk-action buttons, a sort control wired to nothing, a
> delete button with no hover state, and a dead permission rule — **none visible without clicking to
> page 2 or selecting a row.** Four careful copies are four chances to get it wrong.
>
> **And the line most likely to be misapplied is stated as the contract's own limit:** *parity means
> the same vocabulary, not the same feature list.* Every module gets the same table, filters, columns,
> dialogs and tokens. Which **actions** exist is decided by the domain and the API, never by symmetry
> with Users — with the three current deviations named, and a rule that any new one carries its reason
> in a comment at the deviation rather than in a plan file someone has to find.

Verified: no broken anchors or relative links in any of the three documents, no orphaned table
separators, 82 / 49 / 23 headings resolve.

## August 11, 2026 — Roles, Invitations and Activity brought onto the Users structure

**All three index pages now sit on the same shells, the same hooks, the same column factories and the
same modals as Users**, per `MODULE_PARITY_PLAN.md`. Lint went **18 → 16 errors, 0 warnings**;
typecheck clean; all six affected routes serve 200.

**Every module's create, edit and view is a dialog now**, matching Users. `RoleForm`, `RoleShow` and
`InvitationForm` gained the same `asModal` / `onDone` contract `UserForm` has carried since
2026-08-10 — one component, two shells, so the schema, the fetch and the payload are shared and only
the chrome differs. **The `/dashboard/roles/new`, `/roles/:id/edit` and `/invitations/new` routes all
still exist and still render the full-page version**: they are the deep-linkable, bookmarkable form
and the target of links from elsewhere. The modal is the path from the table, where losing your
filters and scroll position to change one field is the thing being fixed.

`RoleForm` also finally got its section cards — the flat column `DAILY_CHANGES.md` promised to split
on 2026-08-10 and did not. Three sections, matching how the form is read: what the role **is**, what
it **sees**, what it **may do**.

> **Four more bugs surfaced, all in code the parity pass forced someone to read.**
>
> **1. Roles still had a hand-rolled red button.** `DeleteRoleModal` carried `bg-tone-danger` with
> `hover:bg-tone-danger` — the same colour, so **the most destructive control on the page was the one
> with no hover state at all.** That is the exact defect the 2026-08-10 pass set out to eliminate, and
> it survived because it was a bare `<button>` rather than a `Button`, so nothing that pass grepped
> for matched it. It is `DeleteDialog` now.
>
> **2. `RoleShow`'s Edit link was a hand-copied class string** at its own size, drifting from every
> primary button beside it — the same defect fixed on `UserShow` in that pass and missed here. It
> wears `buttonClasses()`.
>
> **3. Roles had dead permission logic.** It computed
> `editable = … && (!row.is_protected || isSuperAdmin)` and applied it as
> `.filter(a => a.label !== "Edit permissions" || editable || true)`. `|| true` makes the predicate
> constant, so the variable was dead and **every caller saw "Edit permissions" regardless**. Restored
> as the label rule it was evidently meant to be, rather than deleted.
>
> **4. Activity's `When` header was a control that could not do anything.** It declared
> `sortKey: "created_at"`, which drew a sort arrow and accepted a click — but the endpoint takes no
> sort parameter at all, deliberately: `activity_service.list_entries` says so, because rows written
> in one transaction share a timestamp and only `id` orders stably. Removed rather than faked. A real
> oldest-first toggle is an API change, and it is in `MODULE_PARITY_PLAN.md` § 3 rather than smuggled
> into a UI pass.

**Where the three deliberately still differ from Users, and why.** Parity means the same vocabulary,
not the same feature list:

| Module | Difference | Reason |
|---|---|---|
| Roles | Keeps client-side filtering and paging | `/api/roles` returns six rows unpaged. `useResourceList` refetches on every dep change — a network round trip per keystroke |
| Activity | No Actions column, no selection, no bulk bar | There is no write route. A delete affordance on an audit trail would be the most damaging button in the product |
| Invitations | Cancel is not `DeleteDialog` | Cancelling is not deleting. The row stays and stops working; "delete" would imply it leaves the table, and it does not |

**Two columns were added while the files were open**, both for data already on the wire and never
shown: Invitations gained **Last sent** — the API has sorted on it since the endpoint landed, and it
is the column you want before chasing someone again — and Roles gained **Created**.

**One deliberate improvement over `UserForm`, worth copying back.** Its loading skeleton is returned
bare even in modal mode, so it renders wherever the module mounts its children — under the table,
not in a dialog. The three converted forms wrap the skeleton in the modal instead.

**Still outstanding:** `dark:text-gray-300` remains as dark-mode body ink in Activity and Invitations.
**No token holds that value** — `night` has body/card/border/muted only — so fixing it needs a new one
in `tailwind.config.ts`, a Protected File. Same shape as the sticky-header shade already waiting on
the owner in `PLANNING.md` § 3.1.

> **None of this has been rendered in a browser.** Four index pages now share one table, three forms
> now share one dialog shell, and a mistake in either is a mistake in every one of them. **This is the
> point at which looking is worth more than any further reasoning.**

## August 11, 2026 — The Users module became the template, and three bugs fell out of the copies

**Everything in the Users index that is not about users now lives in a shared piece**, so the next
module writes its API call, its columns and its actions — and nothing else.

| Concern | Now lives in |
|---|---|
| Page shell — header, filter row, table, paging | `ResourceIndex` *(existed)* |
| Filter/sort/page/selection state, URL round-trip | `useResourceQuery` *(existed)* |
| Fetching, loading, error, refetch, row patching | **`useResourceList`** |
| Per-row write: busy row, toast, apply result | **`useRowAction`** |
| Bulk write: skipped reasons, clear selection | **`useBulkAction`** |
| Which dialog is open, and on which row | **`useModalState`** |
| `#`, `Actions`, badge and date columns | **`columns.tsx`** |
| Delete confirmation and its wording | **`DeleteDialog`** |
| The search field's magnifier | `FilterBar`, by default |

`UsersModule` went from 658 lines to 540, and about 35 of those are a new docblock listing the above
— so the code itself is roughly 150 lines shorter.

> **The case for doing this is not that the code was long. It is that four copies of a thing are four
> chances to get it subtly wrong, and no amount of care catches it.** Extracting these turned up three
> live bugs, none of which is visible without clicking to page 2 or selecting a row.

**1. The `#` column was wrong on two of the three pages that had one — in opposite directions.** Our
`DataTable` passes each cell the row's absolute position; the vendor table passes its position within
the page. Users, on the vendor table, rendered `index + 1` and **restarted its numbering at 1 on every
page**. Invitations, on ours, added the page offset to an index that already carried it and **jumped
to 51 at the top of page 2**. Roles was correct by luck of which table it used. The contract is now
stated on `Column.cell` — the index is absolute — the adapter rebases the vendor's to match, and one
`numberColumn()` serves all three.

**2. Bulk actions on the Users page did nothing.** The module kept its own `useState<Set<string>>`
for the selection and read it in the bulk handler, but `ResourceIndex` wires the table to
`useResourceQuery`'s selection. Nothing ever wrote to the local copy, so every bulk call hit its
`ids.length === 0` guard and returned — **Set Active, Set Inactive and Delete Selected have been dead
buttons for as long as they have existed**, silently, with no error to notice. Two pieces of state
meaning one thing is how that happens.

**3. The sort arrows and the column picker**, both recorded in their own entries below, were the same
shape of problem: a control that existed on one table and not the other.

**Two things were deliberately *not* extracted.** The roles lookup in `UsersModule` stays a plain
`useEffect` — it is not paged, not filtered, and its failure must be silent rather than blocking the
page, so `useResourceList`'s rules would be wrong for it. And `ConfirmDialog` was left alone;
`DeleteDialog` sits on top of it supplying only the wording, because the mechanics were already right
and it is the *copy* that had drifted into four spellings of one sentence.

One lint error was introduced and removed on the way: `useCallback` cannot take a spread dependency
array under the React Compiler rule, so `useResourceList` compares its deps by value instead — which
it needed anyway, since `q.applied` is a fresh object every render and identity comparison would have
refetched in a loop. Lint is back at the same 18 pre-existing errors, and `UsersModule` is no longer
among them: its one error moved into the hook, where it is one occurrence instead of the four it would
have become.

Roles and Invitations were migrated to `numberColumn()` as well — a two-line change each that fixes
Invitations' paging bug. Their fetch blocks and modal state are untouched and still open-coded; they
can move to the hooks whenever they are next opened, and nothing forces it.

## August 11, 2026 — Sorting worked on the server and had no control in the UI

**The Users table's column headers looked clickable and did nothing.** No sort arrows, no reaction —
on a table whose API has supported seven sort keys the whole time.

**One line caused it.** The vendor table gates every sort branch on
`column.sortable && onSort && column.accessorKey` — the header icon, the direction icon, and the
click handler, all three. The adapter that maps our columns into the vendor's shape was setting
`sortable` and **never setting `accessorKey`**, so all three were permanently false. The header kept
its `cursor-pointer`, which is what made it read as broken rather than as read-only.

The field now carries the **sort key**, not the column id, and that distinction is the second half of
the fix. The vendor hands the same value to `onSort` *and* compares it against `sortBy` to decide
which way to draw the arrow — and `sortBy` is the server's key (`last_login_at`), not ours
(`last_login`). Anything else would have left every column drawing the neutral both-ways chevron even
while it was the one being sorted on. The adapter's own handler had the matching bug waiting: it
looked its argument up by column id, which would have found nothing and swallowed the click.

Cross-checked rather than assumed: all six keys the UI declares are in the service's
`ListSpec.sortable` map. The map has a seventh, `last_name`, with no column to attach to — the User
column shows a full name and sorts on `first_name`.

> **The header is a real button now, not a `<th>` with an `onClick`.** Upstream's version cannot be
> reached with a keyboard and announces nothing to a screen reader; it went unnoticed precisely
> because these headers never did anything. The cell carries `aria-sort`, the button carries the
> click and a focus ring. The click moved onto the button rather than being added to it — a click
> inside a button bubbles to its cell, so keeping both handlers would have sorted twice and landed
> back where it started.

Also caught before it shipped: the first version styled the button `w-[calc(100%+0.5rem)]`, which is
invalid twice over — CSS requires whitespace around `+` inside `calc()`, and Tailwind emitted no rule
at all for it. Verified by grepping the served stylesheet for every class the change introduces,
which is the only way that class of mistake shows up.

## August 11, 2026 — The Users index had no column picker, because two tables disagreed about who owns it

**The `Cols` button was missing from the Users filter row**, next to Reset. Not misplaced — absent.

The cause is worth recording because it is the kind of gap nothing catches. Users is the one module
on the reference implementation's table, reached through the `VendorDataTable` adapter. That adapter
passes `hideColumnToggle` to switch off the vendor's own column dropdown — which is right, since the
vendor renders it as a lone button in a row of its own, styled to match nothing else here — **and
then supplied no replacement.** Our own `DataTable` had the picker built into it inline, so every
other index page had one and the only page anybody was looking at did not.

**The picker is now one component used by both tables**, `ColumnPicker`. Copying the markup into the
second table would have created two things to keep in step; the tables keep only their own `hidden`
set, which is the part that legitimately differs.

The hidden columns are filtered out **before** they reach the vendor rather than by driving its
internal visibility state from outside. That state is seeded once from the first `columns` array it
receives, and since nothing is hidden on the first render every id is seeded visible and stays that
way — so filtering upstream simply shortens the list it renders, and the vendor file stays close to
upstream, which is the entire point of having an adapter.

Two smaller things fixed in passing. The picker now renders in the **loading and error** branches
too, which return early — previously the row gained a button the moment data arrived, shifting the
controls under the cursor mid-fetch. And the popover's rows hovered to `bg-gray-50`, a grey that
`UI_PATTERNS.md` § The Signed-In Chrome Is Green rules out; they hover to `brand/10` now like
everything else.

## August 11, 2026 — Toasts moved to the top-right corner and were rebuilt from LeapDesk's

**Ported from LeapDesk's custom toast**, read from `LeapReview360/resources/js/components/ui/toast.tsx`
and `components/toast-container.tsx` at the owner's request. What changed:

| | Before | Now |
|---|---|---|
| Position | bottom-right | **top-right** |
| Stack | one at a time — a second message erased the first | up to three, oldest dropped |
| Panel | tinted border in the tone's colour | dark card, tone carried by an icon badge |
| Copy | one line | bold tone title over the message |
| Motion | appeared and vanished | slides in and out, 300ms |
| Duration | 3.5s | 5s, **paused while hovered** |

**The panel is dark in both light and dark mode, and that is deliberate.** LeapDesk hardcodes a
`zinc-900`; a literal copy would trip the brand-colour guard that keeps hand-painted colours out, so
it is `night-card` on `night-border` — the same relationship in our palette. It does not flip with
the theme because **a transient overlay that looks identical everywhere is easier to recognise than
one that camouflages itself against whatever page it lands on.**

The badge fills had to be chosen for that dark panel rather than copied: `tone-success` is #1b4c43,
a dark teal that all but disappears on #111727, and `tailwind.config.ts` says outright that brand
icons on a dark surface must not use the base brand — it is 2.83:1 there. So success uses
`brand-on-dark`, error `tone-danger`, and notice `tone-info`, which is grey rather than blue because
there is no blue in this palette to reach for.

> **The rule that could not be copied, because LeapDesk has no equivalent: a toast carrying `details`
> still does not auto-dismiss.** Bulk actions report what they skipped and why. Auto-hiding that after
> five seconds turns a partial success into an apparent total one — the exact failure the API's
> `skipped_reasons` field exists to prevent.

Hover-to-pause is ours too. A five-second toast with a sentence and three bullets in it can outrun
the person reading it, and the cost of getting that wrong is a message nobody ever saw. The timer
restarts rather than resumes, which is the forgiving direction to round.

**One real bug was written and caught before it shipped.** The first version passed
`onDismiss={() => onDismiss(toast.id)}` from the container, which mints a new function on every
render of whichever module owns the stack — and those re-render constantly. That changes the
identity of the close callback, which re-runs the auto-dismiss effect, which restarts the five
seconds. **A toast raised on a busy screen would simply never have left.** The id is applied inside
the item now, against the hook's stable `dismiss`.

Stacking meant the hook returns `toasts` rather than `toast` and `dismiss` takes an id. Four call
sites updated — Users, Roles, Invitations, Role Matrix.

Verified: every token and arbitrary-value class the toast uses appears in the served stylesheet, the
users page compiles and renders clean, typecheck passes, lint reports the same 18 pre-existing errors.

## August 11, 2026 — Dialogs grow with the screen, and the user record stopped being mostly scrollbar

**Every modal was capped at one width regardless of the screen it opened on.** A form dialog was
672px whether the display was 1366px or 2560px, which left most of a wide monitor unused and pushed
the content into a scroll it did not need. Both dialog shells now step the cap up twice:

| size | ≤1279px | ≥1280px | ≥1536px |
|---|---|---|---|
| `md` | 448 | 448 | 448 |
| `lg` | 672 | 768 | 896 |
| `xl` | 896 | 1024 | 1152 |

**`md` deliberately does not grow, and that is the interesting half of the change.** It is the
confirmation size — one sentence and two buttons, which is what Delete User and the status toggle
use. Stretching that to 900px puts the question at the far left and the button that answers it at the
far right with nothing in between: **harder to read, not easier.** Width is only worth taking when
there is content to fill it.

The steps also stop at 896px for a form rather than continuing, because past roughly that width a
two-column form's fields are already wider than anything anyone types into them. **The way to use
more width is more columns, not longer inputs.**

> **Which is exactly what the View User dialog now does.** It carries four cards and nineteen fields
> against a body capped at 60vh, so at 672px it was mostly scrollbar. It moved up to the `xl` size
> *and* its cards pair into two columns — so the extra width makes the dialog **shorter** rather than
> wider, and the cards stay around 340–540px, which is the range a label-left/value-right row reads
> well in. Widening it without the second column would have been worse than leaving it alone: every
> field would have had its label and its value at opposite ends of a 1100px row.

Two details worth recording because both are easy to get wrong. The card grid uses `items-start`,
without which the three-field Contact card grows a tall empty tail to match the eight-field Account
card beside it — a grid item stretches to its row height by default. And the grid's breakpoint is
tied to the width table above rather than picked by eye: it pairs from 768px because that is the
first width at which two cards land inside the readable band and stay there at every step after.

The full-page version of the same record is untouched — it already sits in a two-thirds column beside
a sticky sidebar and is the right width.

Verified: the new caps appear in the 1280px and 1536px media queries in the served stylesheet, the
users page renders, typecheck passes, and lint reports the same 18 pre-existing errors.

## August 10, 2026 — Every page specified: 14 public, 13 partner, 13 staff — each with what it must NOT have

**`PARTNER_DIRECTORY_PLAN.md` § 20 specifies the frontend page by page** — purpose, data source,
what it must have in priority order, **what it must not have**, its empty state, its SEO, and when it
is done. The "must not" column carries as much weight as the "must": most of the ways a directory
looks untrustworthy are things someone added, not things they forgot.

**Two questions had to be settled before a single page could be specified, and both were live
ambiguities in our own standards.**

The first: `NEXTJS_STANDARDS.md` § 2 says *"don't fetch API data in a server component"*, which would
make the whole public surface client-rendered and therefore invisible to search. That rule is about
**authenticated** data — the `httpOnly` cookie cannot be forwarded server-side. **Public data has no
cookie**, and the mechanism already exists: `SERVER_API_BASE_URL` in `lib/utils/constants.ts`, which
`lib/branding.ts` has been using since August. So public pages render on the server via
`INTERNAL_API_URL`, authenticated pages fetch from the client, and the section says so explicitly
along with the warning that getting the two round the wrong way fails *silently*.

The second: `UI_PATTERNS.md` makes the Index/Form/Show contract mandatory for **every module**. Those
shells are the signed-in admin chrome — full-height flex, dense tables, bulk actions. **They are wrong
for a public marketing surface**, and reusing `ResourceIndex` for a category page is the single most
likely way this ends up looking like a CRM. The contract now explicitly governs `(app)`; the new
`(public)` group gets its own shells.

**Some specifics worth pulling out.** The trust bar on the home page is built from § 18.1's real
figures — since 2006, the five ISO certifications, 20,000+ customers, 19 locations — and deliberately
excludes the two numbers § 18.1 flags as self-contradictory. Search result pages are `noindex,follow`,
always, because they are near-duplicate content. The enquiry status page is a **capability URL**
reachable by its unguessable reference alone, excluded from the sitemap. And a category below § 8's
indexing threshold renders a "still building this" state rather than a thin page — **a thin category
page is worse than none, because it is what a buyer judges the whole directory by.**

**The partner profile page carries the section's sharpest tension.** § 9.1 commitment 2 says we will
not compete with a partner for their own company name — so where a partner has their own website, the
profile emits a canonical pointing at it. That is a real cost in SEO terms, and it is the price of the
commitment. The alternative, stated so it is a choice rather than a drift, is `noindex` on profiles
with no listings.

**Also recorded honestly:** `AGENTS.md` instructs agents to read `node_modules/next/dist/docs/` before
writing Next.js code. **That directory does not exist** — checked on the host and in the container.
The version is 14.2.35. So § 20 says to verify each API against the running app rather than assume,
and names the three the spec depends on: `sitemap.ts` / `robots.ts` as file conventions,
`generateMetadata`, and `generateStaticParams`.

> **§ 20.7 lists the five ways this surface most plausibly fails**, because each is easy and each is
> judged: it looks like a CRM, thin category pages get indexed, it ships light-mode only (`text-brand`
> on a dark card is 2.83:1 and fails AA), empty states look like bugs, and we outrank our own partners.

**The authenticated surfaces were then specified to the same depth** — 13 partner pages and 13 staff
pages, each with its purpose, what it must have and what it must not. They needed less prose than the
public side because `UI_PATTERNS.md`'s Index/Form/Show shells already decide the layout, but they
needed three structural decisions written down before anyone starts.

**The first is that there is one route tree, not two.** `/dashboard/listings` serves a partner *and* a
staff member, and `apply_scope` decides what is in it. Building `/partner/listings` alongside
`/admin/listings` would mean two components, two sets of permission checks, and two places to forget
one — and the scoping module exists precisely so the route does not have to know who is asking. The
same holds for enquiries and reviews.

**The second is that the sidebar is already solved and must not be re-solved in React.**
`navigation_service.build_sections()` assembles every item and filters by permission on the server, so
the frontend renders what it receives. Adding a module means adding an item there, not writing
`{can('listing-view') && <NavLink/>}` in a component — with the caveat that the nav is a *visibility*
filter, never a guard.

**The third is that a partner user is not a second-class staff user.** Same shells, same density, same
keyboard behaviour. The difference is scope and vocabulary — "My listings" against "All listings" —
never a cut-down interface.

**Two screens got their own specification** because the shells do not decide them. The listing
authoring form is the one screen the entire supply side depends on: four sections and no more, price
fields that appear only when the pricing model is not `ON_REQUEST`, a live preview of the public card,
autosave to draft, and an explicit warning that editing a published listing returns it to review. And
the enquiry inbox, which must not be treated as one more CRUD list — it is a thread with an unread
state and a response clock, and marking read on hover would corrupt `first_viewed_at`, which every
measure in § 16 is computed from.

**§ 20.6.4 lists what a partner must never reach**, because each line is one forgotten guard away:
another organisation's anything (404, never 403), the internal columns on their own record, their own
status and verification and listing flags, the moderation queue, and staff-internal enquiry messages.
On the staff side the equivalent rule is that there is **no reply-as-partner control** — it would
corrupt the response-time data the whole trust system runs on.

## August 10, 2026 — The plan became executable: §19 is a contract an agent can build from without asking

**A specification that needs a conversation to interpret is not a specification.**
`PARTNER_DIRECTORY_PLAN.md` § 19 is now the execution contract — reading order, non-negotiable rules,
exact internal API signatures, file manifest, the `Principal` and `scoping.py` specs, permissions and
routes for every remaining module, the state machines, an acceptance check, and **a default for every
open decision so the work never stops to ask.**

**Auditing the file for what would actually confuse a builder was the useful half**, and the worst
offender was a contradiction we had created ourselves. § 7 still instructed the reader to design
scoping around `Optional[User]`; § 7.1 superseded it three sections later. An agent reading top to
bottom would have implemented the wrong thing and been correct to. § 7 now carries a stop sign
pointing at § 19.6, keeping only the part that survives — the anonymous branch must be the most
restrictive, and its test must exist before the first listing row does.

**The internal-API section exists because of a mistake made in this repo today.** The first
`partner_service` called `activity_service.log()`, which does not exist — the real API is `record()`,
`record_created()`, `record_deleted()` and `record_change()`, all keyword-only. That cost a rewrite.
§ 19.3 now lists every signature a service will need, verified against source, plus the two traps this
codebase sets: `activity_service` commits on its own and must never be wrapped in `unit_of_work`, and
`user.permission_names` must never be read directly because it skips the super-admin bypass.

**The `Principal` type is specified rather than deferred.** § 7.1 had raised it as a decision blocking
phase 2; § 19.5 settles the technical shape — a frozen dataclass with three kinds, `anonymous()`
constructible with no arguments so the safe case is the easy one to write, and `has_admin_access` as a
plain field that is never re-derived from a user that may not exist. § 19.6 gives `scoping.py`'s
matrix in evaluation order, with the row most likely to be got wrong called out: a staff user with no
admin access and no partner must match **nothing**, because scoping them on `partner_id` would match
every row.

**Every open decision now has a build-this-meanwhile answer.** Fan-out builds `enquiry_recipients`
with one row. Prices default to `ON_REQUEST`. The taxonomy seeds without the two categories Leapswitch
competes in. The § 15.2b ordering proposal stays unadopted unless the owner says otherwise. **An open
question in § 12 is no longer a reason to halt** — and where something genuinely cannot be defaulted,
the instruction is to leave a `TODO` naming the decision and say so, because silence about a gap is
worse than the gap.

**Also specified because they would otherwise be invented differently each time:** slug generation and
the rule that slugs are never reused or edited, the two-level category limit as a service check rather
than a schema one, who maintains `search_vector` and the denormalised counters, that publishing must
re-check the tier's `max_listings`, and that editing a published listing returns it to review —
because moderation means nothing if a partner can publish and then rewrite.

## August 10, 2026 — Visited the whole product estate, and found the directory's scope written on our own pricing page

**The first pass at § 18 read four pages and inferred the rest of the product list from navigation.
That is not research, and the gap showed.** Going through the estate properly — every product page on
leapswitch.com plus the sibling brands — corrected several things and turned up the single most useful
sentence in the whole exercise.

**We are three storefronts, not one.** **CloudPe** (cloudpe.com) is a separate IaaS brand of Leapswitch
with **its own datacenter footprint** — Navi Mumbai live, New Delhi in March 2026, Chennai announced —
positioned directly against the hyperscalers at *"60% less than AWS"*. **CloudJiffy** (cloudjiffy.com)
is a PaaS with its own app marketplace, owned by Leapswitch Pvt Ltd **and a US entity, Leapswitch
Networks, Inc.**, which had not been recorded anywhere. And **Lacehost is gone** — `lacehost.com` now
301-redirects to leapswitch.com, so the affiliate page that still names it is stale. That matters for
the directory because it means **three demand pools**, not one: CloudPe's audience of startups,
developers and GPU users maps onto the consulting categories far better than the legacy hosting base
does.

**The real catalogue, with real prices, is now in the plan** — shared hosting from ₹119, reseller from
₹275, VPS ₹700 self-managed to ₹2,499 managed, bare metal ₹16,420 to ₹93,974 on EPYC up to 256 cores
and 2TB RAM, GPUs from an A4000 at ₹16,523 to an H100 at ₹274,000, colocation ₹4,000 to ₹40,000 across
1U to full rack, CloudPe VMs at ₹930 and S3 at ₹3.10/GB with zero egress. Those numbers matter because
a directory's price facets have to be plausible next to what the host itself charges.

**The finding worth the whole exercise is one sentence at the bottom of the Managed Services page:**
*"Any additional requests or services outside this scope will be handled separately and billed as
one-time engagements."* That is the directory's scope, stated by us, in public, already. **A category
belongs in the taxonomy if it is work a Leapswitch customer needs that falls outside that catalogue** —
which is a far better filter than intuition, and one that whoever runs the step 9 interviews can apply
without any product knowledge.

**A second finding reframes the licensing category.** We resell other people's products ourselves:
business email is SmarterMail, Google Workspace and Microsoft 365 resold, and the stacks run on cPanel,
Plesk, DirectAdmin, Virtualmin, Acronis, HAProxy and Nginx. Before this, "Licensing & Control Panels"
looked like filler in the proposed taxonomy. It is not — **it is the same shape of business we are
already in, one layer up.**

**Corrections to the first pass:** the managed services tiers are **Self-Managed / Semi-Managed /
Fully-Managed**, not the two I had; **APM** is in the catalogue and was missing; and the geography is
not uniform — bare metal publishes to seven locations, VPS to eight, and CloudPe to its own three. If
service areas are ever pre-seeded, they should come from the product a partner actually resells rather
than the company-wide list.

## August 10, 2026 — Researched our own company, and found that "partner" already means three things here

**The directory's categories are defined relative to what Leapswitch sells, so the taxonomy could not
be designed without first writing down what that is.** § 18 of `PARTNER_DIRECTORY_PLAN.md` now does,
from leapswitch.com and its About, Affiliate and Reseller Hosting pages, cross-checked against the
marketing site source already on this machine.

**The company, as stated:** operating since 2006, Pune head office with Mumbai and Nashik offices,
**19 datacenter locations across 3 continents and 10 countries**, 20,000+ customers from 110+
countries, 3,000+ nodes, 80 Gbps, 99.99% uptime, and a certification stack — ISO/IEC 27001:2022,
27017, 27018, ISO 20000-1 and ISO 9001 — that is itself a trust asset the directory can borrow. The
product line runs from CloudPe IaaS and CloudJiffy PaaS through bare metal, VPS, shared and reseller
hosting, to email, SSL, domains, backup and colocation.

**The finding that matters is that "partner" is already an overloaded word at Leapswitch.** There is
an **affiliate** programme paying tiered commission by monthly volume — 5% to 12.5% depending on
product and count — and a **reseller** programme where partners buy hosting wholesale, white-label it
behind their own nameservers, and resell it, with a tiered discount structure on dedicated servers.
The directory partner, who supplies *their own* services, is a **third** thing.

**That reframes something the plan had been treating as hypothetical.** § 0 shelved
`MARKETPLACE_DOMAIN_PLAN.md`'s reseller-quoting model as "a different business". It is not
hypothetical at all — it is a **live Leapswitch programme with real commission and discount tiers**.
Shelving it for v1 is still right, because it is not what the brief asked for, but if it is ever
revived there is an existing structure to model against rather than a blank page. And the three
populations overlap: the reseller programme's stated audience is people starting their own hosting
business, which is plausibly a large share of the 300+ partners the owner counted.

**Two new decisions, recorded as #11 and #12.** Which partner population is actually listable — all
partners, resellers only, or a vetted subset — because it changes the 300+ figure that § 0.1 settled
and therefore the shape of the whole thing. And whether we list categories **Leapswitch competes in**:
the affiliate page states we provide website design, development and SEO ourselves, which puts three
proposed categories in direct conflict with our own service lines. The recommendation is that the host
convenes the market and does not trade in it, which is the posture every comparable takes.

**A 15-category starting taxonomy**, grounded in the gap between what Leapswitch sells and what a
customer still needs — managed infrastructure and NOC, cloud migration and DevOps, security and
compliance, backup and DR, database services, and so on. The five strongest sit directly on top of
what we already sell, and their vocabulary is lifted from Leapswitch's own Managed Services catalogue,
which is the words we already use with paying customers. **It does not replace the buyer interviews in
step 9** — it means that interview starts from a draft instead of a blank page.

**One observation that partially weakens a borrowed assumption.** Justdial's atomic search unit is
category × city because a plumber has to be local. A Kubernetes consultant does not. If most listings
turn out to be remote-capable, city faceting is a secondary filter rather than the primary axis — and
that should be measured before the facet UI is designed rather than assumed from the reference.

> **Also noted: the site disagrees with itself.** The home page says "19 locations world-wide" while
> listing 12; About says 99.99% uptime and the home page says 99.9%; the affiliate page still claims
> 12 locations in 5 countries. Flagged in § 18.1 so the directory's own copy does not repeat a number
> without confirming it with marketing.

## August 10, 2026 — The plan became implementable: every table, every column, every foreign key

**`PARTNER_DIRECTORY_PLAN.md` § 17 is a full data dictionary**, written so an agent — or a developer —
can build from the file without inferring a schema from prose. Twelve tables specified column by
column with exact names, types, nullability and defaults; **24 foreign keys**, each with its
`ON DELETE` and the reason for it; every index, unique constraint, check constraint and Postgres enum
type. § 6 still explains *why* the domain is shaped this way and now says plainly that § 17 is what
you build from.

**The two built tables are documented from the database, not from the model file**, and the difference
matters: a data dictionary copied from source drifts the moment a migration is hand-edited. The
`partners` and `partner_tiers` specs were diffed against `information_schema.columns` — **39 columns
in the database, 39 documented, nothing missing in either direction** — and § 17.6 now carries the
exact query to re-run before trusting the section again.

**Every column gets its own row.** The first draft grouped related ones (`logo_path` · `banner_path`,
`city` · `state` · `country`) because it reads more compactly. That is worse for the stated purpose:
the file is meant to be followed mechanically, and a grouped row makes a column list something you
have to parse rather than read. Six grouped rows were split; the verification above only passed once
they were.

**The foreign-key work turned up two decisions worth stating rather than defaulting.** `enquiries` and
`enquiry_recipients` point at `partners` with **RESTRICT, not CASCADE** — a partner carrying enquiries
cannot be deleted at all, because § 16 makes enquiries the measure of the whole platform and a cascade
there lets one admin action erase the evidence. And `service_categories.parent_id` is RESTRICT so
deleting a parent category cannot silently orphan its children; the staff member has to move them
first.

**One constraint the prose implied but no schema would have enforced.** § 6.3 says a service area
belongs to "`partner_id` *or* `listing_id`". Written as two nullable columns that is a comment, not a
rule — so § 17 specifies
`CheckConstraint("(partner_id IS NULL) <> (listing_id IS NULL)")`, which makes "exactly one" something
the database guarantees rather than something every writer remembers.

> **Specifications, not decisions.** § 17.6 says so explicitly: a column list does not settle § 12.
> Decision #5 still shapes what goes in `enquiry_recipients`, #6 whether `price_from` is ever
> populated, #9 how often `buyer_user_id` is non-NULL. And nothing here should be migrated ahead of
> its phase — § 15 remains the order, and everything below `service_categories` needs scoping first.

## August 10, 2026 — The Justdial research was pushed into the plan, and it found a column nothing enforces

**Research that changes nothing is a reading list.** § 2.1's findings are now amendments to the plan
itself — six sections changed, two added, and one genuine build gap surfaced that nobody had noticed.

**Five commitments we bind ourselves to, published to partners alongside the ranking rule (§ 9.1).**
Each is a practice that made Justdial's own listed businesses hostile to it, and the asymmetry is the
argument: Justdial's suppliers are strangers to it, ours are 300+ organisations we hold commercial
relationships with who talk to each other. The load-bearing one is **a lead that named you is yours** —
never resold, never re-broadcast. The second is that we will not compete with a partner for their own
company name, which has a concrete technical form: canonical the profile at the partner's own site
where they have one, rather than outranking them for their own brand.

**That commitment settles a question the plan had left open.** Decision #5 was "one enquiry to one
partner, or fan out to several?" and it now has a shape rather than a toss-up: **support broadcast
requirements, never redistribute a named enquiry.** The two `source` values were always two different
products and the plan now says so — a `LISTING` enquiry belongs to the partner it named, while a
`CATEGORY_BROADCAST` takes nothing from anyone because the buyer never named a partner. IndiaMART's
core loop is the second one, and it is the larger B2B marketplace in the same country by a wide
margin, so the expectation has shifted: broadcast may be the main path and the listing enquiry the
narrower case.

**A definition of success, which the plan did not have (§ 16).** One number — **enquiries per listed
partner per month**, and the share answered within the SLA — with a per-phase ladder of leading
indicators beneath it, all computable from tables already designed. Two numbers are explicitly marked
as untrustworthy: page views, which rise with any spend and say nothing about match, and total
listings, a supply-side vanity metric under which 300 partners publishing one stale listing each
outscores 60 publishing four current ones. The section also states the uncomfortable part plainly:
**every measure reads zero until phase 6**, because the enquiry is the product.

**The SEO surface was re-scoped from volume to taxonomy (§ 8).** Justdial's transferable engine was
millions of long-tail pages; at 300 partners we cannot have those and must not fake them. The honest
surface is `category × city` over a real taxonomy — hundreds of pages that answer a question — with
**indexing thresholds** so a category page with one partner on it is generated but `noindex`ed. A thin
page is worse than no page, because it is what a buyer judges the whole directory by.

**One real gap: `partner_tiers.max_listings` and `featured_slots` are columns that nothing checks.** A
tier is currently a label. That was invisible while tiers were decorative, and became a problem the
moment the research made tier-gated entitlement the favoured revenue model — you cannot sell an
allowance you do not enforce. Recorded as § 14.1 row 2b and attached to the listings work in phase 4,
where it belongs on the publish path rather than in the UI.

**Two risks added (§ 13), both from the research.** Supply engagement is *not* solved just because the
partners already exist — every one of them already has a free Google Business Profile, and a
commercial relationship gets us the sign-up but not a maintained listing. And measuring the wrong
thing is its own risk, which is why § 16 was written before there is any pressure to report the
flattering number.

> **One proposal is deliberately left undecided (§ 15.2b): swap phases 5 and 6.** Build the enquiry
> loop on the authenticated surface before the public one. It does not reverse the owner's decision
> that the destination is public — § 6's tables are identical either way — but it would produce the
> § 16 number a phase earlier, take decision #4 off the critical path, and let the public surface be
> built knowing which categories actually generate enquiries. **Recommended, not adopted.**

## August 10, 2026 — Researched why Justdial reaches millions, and concluded we should not try to be one

**The question was "why are platforms like Justdial so famous, and how do we build one at
Leapswitch?"** The research is now § 2.1 of `PARTNER_DIRECTORY_PLAN.md`, and its answer is not the one
the question expects.

**Four engines made Justdial famous, and two of them are unavailable to anybody in 2026.** It was
founded in 1996 with ₹50,000 in a garage, selling a phone number you called instead of leafing through
a paper directory, into a market with no consumer internet — then rode the web and mobile waves rather
than creating them. By 2012 it had over 7 million listings and 1.9 million calls a day, and that
listing breadth is really an SEO surface: millions of long-tail pages nobody can buy their way onto.
The two engines that do transfer are mechanics — monetise the **lead**, not the listing, and let the
enquiry create a response race.

**The more useful finding is that the model is being taken apart right now, by two forces at once.**
Google absorbs the general case, because people increasingly search for the business directly and
Google gives businesses free listings, which narrows the gap between a paid listing and a free one.
And vertical specialists — Zomato, Practo, Urban Company — take the categories one at a time. **A
Leapswitch partner directory sits on the specialist side of that split.** The brief's instinct is
sound; the platform it names is the loser in the fight, not the winner.

**Industry research on directories says the same thing with numbers.** A niche directory with domain
authority 45 routinely outperforms a horizontal one at DA 90 for a matched audience, and niche leads
convert around 40% faster because the visitor is further along by the time they use a specialised
platform. That reframes what success means here: the measure is **enquiries per listed partner per
month**, not visitors. A directory doing 2,000 well-matched visits that produces real enquiries beats
one doing 200,000 that produces none — and only the second one looks like Justdial.

**IndiaMART turned out to be the better reference, and nobody had named it.** Same country, same
lead-generation mechanic, but B2B — a buyer posts a requirement and suppliers respond, which is
exactly what our enquiry model already does. Its revenue split is the useful part: **subscriptions are
roughly 95% of it.** That is the strongest evidence available that recurring supplier revenue beats
per-lead billing, so § 10's tier-gated option is now the recommended eventual model and pay-per-lead
is weaker than it looked.

**Three of Justdial's practices are recorded as disqualifying rather than instructive**, and one would
be actively damaging here: selling a lead onward to competitors after a buyer specifically named one
business. Justdial's suppliers are strangers to it. **Ours are partners we hold commercial
relationships with, and 300 of them talk to each other.** That gives decision #5 — one enquiry to one
partner, or fan-out to several — an argument attached to it rather than only a schema cost.
`enquiry_recipients` still gets built from day one; what goes in it is now a relationship question.

**The honest verdict, written into the plan:** Leapswitch cannot build "a Justdial" and should be glad
— what it can build is the thing currently taking Justdial's categories away, a focused vetted
vertical directory where the curator's endorsement is the product. An asset inventory makes the case:
we already hold verified supply, the host brand's trust, a first audience of existing customers, and a
real niche, all of which Justdial spent two decades buying. **What we do not hold is traffic**, which
is decision #4 again, and no amount of research substitutes for answering it.

## August 10, 2026 — The inventory got an order: 34 numbered steps, and only four things actually constrain it

**`PARTNER_DIRECTORY_PLAN.md` § 15 sequences everything § 14 listed** — every backend module and every
page, as 34 numbered steps grouped under the existing phases, each carrying what blocks it. § 14
answers "how big is this"; § 15 answers "what do I do on Monday".

**Only four dependencies genuinely fix the order, and saying so is the useful part.** A table cannot be
scoped by a module that does not exist, so scoping precedes the first partner-owned table. A listing
cannot exist without a category to sit in. The public surface has nothing to show until listings are
published — building it earlier produces a directory of empty categories, which is exactly the "UI that
looks broken when empty" the comparables section warns about. And an enquiry that does not reach the
partner is a lead lost, so email gates the whole of phase 6. **Everything else is arrangement**, and
where an item is ordered by preference rather than dependency the plan now says so, because a
preference presented as a constraint is how a queue becomes unchallengeable.

**The critical path is eleven steps**, and neither of its two stall points is engineering: the
`Principal` actor type, which is ours to settle, and an email provider, which is the owner's. A
separate table lists what can run in parallel — the taxonomy interviews above all, which need no code,
are the cheapest item on the whole list, and are the one most likely to be skipped.

**Three gates are named explicitly, along with what each stops.** The actor type stops all
engineering from step 5. Email stops the value loop. And "who owns buyer acquisition" stops nothing
from being *built* — it decides whether the public surface is worth *shipping*, which is a different
and more expensive kind of blocker, because the work can be completed before anyone discovers the
answer was "nobody".

**One thing broke while writing it and was caught by the linter**: the cross-reference note was
inserted between § 11's table header and its first row, splitting one table into two. Fixed, and a
check now confirms no table anywhere in the file is preceded by a stray line, and that § 15's steps
run 1 to 34 with none missing or duplicated.

## August 10, 2026 — The whole surface area is written down: 17 backend modules, 40 pages across three applications

**`PARTNER_DIRECTORY_PLAN.md` § 14 now lists every module and every page the directory needs**, split
the way the product actually splits: the public site, the partner's back office, and the Leapswitch
staff shell. Until now the size of the thing had to be inferred from a domain model, which is how a
project talks itself into believing the remaining work is "some more pages on the dashboard".

**Seventeen backend modules, and four of them are not CRUD.** Scoping is one file every other module
calls. The public directory is a read API with no writes and a different actor type. Ranking is a
single ordering function whose politics cost more than its code. The market dashboard is aggregation
over tables that do not exist yet. Reading the list as seventeen identical CRUD modules would
mis-scope all four.

**Forty pages: 14 public, 13 partner, 13 staff — and they are not equally expensive.** The staff
surface is the cheapest, because five of its pages already have their API from today's phase 1 work
and the rest are `ListSpec`-driven index pages this codebase now builds repeatably. The expensive
halves are the public site — new architecture, since every route today sits behind `middleware.ts` —
and the listing authoring form, which is the one screen the entire supply side depends on.

**Thirteen entries are marked as proposed rather than inherited from the plan**, and marking them was
the point. Legal pages, a 404, `sitemap.xml`, a supply-side landing page and a partner's own
team-management screen are all things a public directory needs to *function*, and none of them
appeared in the plan before today. They are flagged so they can be cut deliberately: if **decision 4,
who owns buyer acquisition**, is never answered, the SEO-shaped rows are effort spent on traffic
nobody will send — and they should be cut together with that decision, not one at a time.

**A section on what is deliberately absent** closes it: quotes and the approval machine, a local
catalog, payments, a search engine, buyer accounts. Each with the reason and the decision it waits on.
Writing down the eight things we are *not* building is what stops them being rediscovered as good
ideas in three weeks.

## August 10, 2026 — Partner organisations exist, and suspending one now stops every login inside it

**Phase 1 of the partner directory is built on the backend.** The plan puts the organisation layer
first because every partner-owned table will carry `partner_id`, and retrofitting ownership afterwards
means backfilling it on every table that already exists. Migration `a9f2c71e5b64` creates
`partner_tiers` and `partners` and adds `users.partner_id` — nullable permanently, because **NULL is
what "Leapswitch staff" means**. It round-trips: `downgrade` then `upgrade` runs clean, which is the
part that proves the enum cleanup is right.

**The organisation gates its logins, and that is the whole reason this table exists at the top.**
`get_current_user` now performs a fourth check: a user inside a `PENDING` or `SUSPENDED` partner is
refused with 403 whatever their own account status says. Suspending a partner is therefore one action
instead of a hunt through its accounts — and the account you forget is the one that matters.
Suspension also revokes the members' live sessions, so reinstating an organisation does not silently
restore sessions opened before it was stopped. The relationship is `lazy="joined"` precisely because
this runs on every authenticated request.

**Two gates, deliberately not one column.** `status` decides who may sign in; `is_listed` decides who
the public may see. A partner drafting their profile is `ACTIVE` and unlisted, which is the normal
state — conflating the two would mean the only way to hide a partner is to lock them out of the tool
they need to fix it. Publishing is refused unless the organisation is ACTIVE, so a published-but-
suspended row cannot exist.

**Three verbs that the obvious design would have folded into one.** `partner-approve` grants login to
a whole organisation, `partner-verify` sets what Leapswitch publicly vouches for — the directory's
entire trust proposition, ranked above any paid placement — and `partner-publish` is the only
permission whose effect the anonymous internet can observe. They are separate permissions with
separate endpoints, and `UpdatePartnerRequest` deliberately has no `status`, `verification_level` or
`is_listed` field, so a general edit cannot become a superset of the three. `slug` is not editable
either: it is the partner's permanent public URL, and slugs are never reused, because recycling one
would redirect another company's inbound links and search ranking.

**Tiers were repurposed rather than rebuilt.** `MARKETPLACE_DOMAIN_PLAN.md` specified
`partner_tiers` with discount columns for the reseller product; the directory keeps the table and
changes what the numbers mean — listing entitlement, not discount authority. The two discount columns
were **not** carried over, and neither were `avg_rating` / `review_count` / `response_rate` /
`avg_response_minutes` from § 6.1: nothing writes them until enquiries (phase 6) and reviews (phase 8)
exist, and four columns that nothing reads is the exact anti-pattern `FASTAPI_STANDARDS.md` § 12 still
lists as live on `users.profile_photo_path`. `partners` is a low-volume table where adding them later
is a trivial ALTER.

**The scoping rule is broken on purpose, and marked.** `list_partners` and `get_partner_for` filter on
`actor.partner_id` by hand, which § Row-Level Scoping rule 1 forbids in as many words. The module it
names does not exist yet (PM-5), and the alternative was an unscoped list showing every partner to
every partner user. Both sites carry a `# PM-5` comment so phase 2 can find them. The filter does
reach the SQL rather than post-filtering the page — post-filtering corrupts the count and hands the
caller 12 rows after telling them there are 40. One case worth naming: a staff account with no admin
access **and** no organisation gets `WHERE id IS NULL`, i.e. nothing. Scoping them on `partner_id`
would have matched every row.

**Verified, not assumed.** 31 service-layer assertions pass — status machine, both 409 refusals, the
verification evidence being cleared when a partner is un-verified, the org gate in all three states,
delete refused while members remain, and all three list-scoping branches. The existing suite still
passes at **254 passed, 4 skipped**; `ruff` is clean; `openapi.json` regenerated to **80 operations
across 63 paths** and `--check` matches; frontend types regenerated and `tsc --noEmit` is clean. The
18 `npm run lint` errors are all in components this change never touched.

> **The staff UI is not built.** Phase 1's stated end state is "staff can onboard a partner org and
> its logins", and the API supports that today while nothing renders it. `AUTHORIZATION.md`'s
> permission table was also re-measured while it was being extended — it had claimed "23 permissions
> in 7 groups" and listed `categories` and `candidates`, both deleted on 2026-08-06. It now reads 43
> in 12, counted from the database.

## August 10, 2026 — The directory question was answered: it is the public marketplace, and 300+ partners makes ranking the hard part

**The owner settled the three decisions the partner-directory plan had been blocked on since
2026-08-07.** In their words: Leapswitch gives partners the whole frontend and backend as a platform;
verified partners get a dedicated back office where they add their services and choose what detail is
shown; the public visits the frontend and contacts partners based on their requirement; and because
Leapswitch offers the platform, Leapswitch monitors everything.

**Translated: the directory, not the reseller-quoting product. Reading A, the public. 300+ partners.**
Recorded as § 0.1 of `PARTNER_DIRECTORY_PLAN.md` — the deliverable its own Phase 0 asked for.

**The answer confirmed the existing recommendation without amendment**, which is the good news.
`partners`, `partner_tiers`, `users.partner_id` and row-level scoping are kept from the parked
`MARKETPLACE_DOMAIN_PLAN.md`; quotes and the nine-state approval machine are shelved; the Leapswitch
catalog is replaced by partner-authored listings under a Leapswitch-owned taxonomy. The domain model in
§ 6 needed no change at all — it was deliberately written to be identical under all three readings of
the brief, and that held.

**Three consequences make the build materially harder, and they are worth stating plainly.** 300+
partners is the band the plan itself calls a *ranking problem* — roughly 600–1,500 listings competing
for position, in front of 300 businesses who can all see where they placed, so publishing the ranking
rule stops being good practice and becomes necessary. Choosing the public also means real requests with
**no actor object at all**, which moves the `Principal` type decision from adjacent to critical path.
And the public surface — indexable, cacheable, unauthenticated — is a shape this application has never
produced; every route today sits behind `middleware.ts`.

**The most important outcome is which question is now the dangerous one.** Deciding "the public" made
buyer acquisition a commitment rather than an option, and nobody owns it. A directory of 300+ verified
partners that no one visits fails on the demand side exactly as the plan predicted, and unlike a
missing feature it fails after the supply side has done real work. It does not block the partner back
office or the staff shell, which are worth building under any answer — it blocks the public surface
being worth shipping. Moderation at 300+ partners is the second unowned item.

**One stale gate was lifted, by measurement.** § 13 said nothing in the plan should start before the
90-path uncommitted tree was shipped. `git status --porcelain | wc -l` returns **8** today, all but one
of them documentation edits from this session. That tree went out. Two things the check surfaced:
`PLANNING.md` § 2 still reports 90 and is now stale, and `data_access_service.py` is still untracked —
the same file § 7.1 warns will be copied when someone builds the real scoping module.

> **Still nothing built.** Six of the ten decisions remain open. Phase 1 — `partners`, `partner_tiers`,
> `users.partner_id` and staff onboarding — is now unblocked, but phase 2 must still precede the first
> partner-owned table, and PM-27 (email) remains a hard blocker on the core value loop at phase 6.

## August 10, 2026 — The directory R&D was re-measured, and its central safety recommendation turned out to be the weakest of three

**`PARTNER_DIRECTORY_PLAN.md` was written on 2026-08-07 against a system that has since moved.**
Re-measured today rather than assumed: the database now has **12 tables, not 11** — `data_access_grants`
landed — while everything else § 1 claimed still holds. There are still zero marketplace tables, still
34 permissions with none of them partner- or listing-related, still no `partner_id` anywhere, and
`scoping.py` still does not exist. The domain remains entirely greenfield.

**The finding worth the re-measurement is about the actor type, and three registers now disagree.**
§ 7 said to design `apply_scope` around `Optional[User]`, with the anonymous visitor as the `None`
branch. The LeapDesk Module 10 research from earlier today says something better — introduce a
**`Principal` union once, before** any of its callers — because the anonymous visitor is not a special
case but the third known caller that is not a `User`, after the machine consumer and the tenant
boundary in PM-5. And the code says a third thing: `actor: User`, hard-typed, **75 times across 12
files**, with zero occurrences of `Principal`.

**The risk is concrete rather than theoretical.** `data_access_service.py` — written the same day as
the plan, still uncommitted — contains `narrow_to_creators`, which is already `apply_scope`-shaped: it
takes a statement and an actor and returns the statement filtered. It is the nearest thing in the tree
and therefore what someone will copy when they build the real scoping module. Copying it also copies
the signature § 7 warned against, in the one place whose failure mode is public disclosure rather than
a bug. Worth noting the codebase already carries both habits — `activity_service.py` types
`actor: User | None` and branches on it explicitly.

**Recorded as § 7.1, which supersedes § 7's recommendation without touching its requirement.** The test
that a non-user actor cannot see a `DRAFT` listing, written before the first listing exists, is still
the requirement; the union is just what makes it cheap to keep passing. **And it is explicitly a
core-platform decision, not a directory one** — it belongs in `CORE_HARDENING_PLAN.md` and should only
be consumed here, because a decision recorded solely in a document the directory author reads is a
decision that gets taken three separate times.

> **Nothing was built and no decision was taken.** The ten open decisions in § 12 are unchanged and
> remain the next action; decisions 1–4 are not technical and no amount of engineering resolves them.

## August 10, 2026 — The README now names every document, because thirty-one of them had become impossible to see at once

**The documentation folder has grown to 31 files, and the README listed seven.** It pointed at
`INDEX.md` and deferred everything else to it, which is the right instinct — one detailed map beats two
competing ones — but it left anyone arriving at the repo unable to answer "what is actually documented
here?" without opening the index and reading it in full. Seven task-shaped shortcuts are not an
inventory.

**The README now carries the complete list**, grouped the way the folder is: tracking and process, then
`core/`, `system-design/`, `design/`, `planning/`, and the four inherited files last under an explicit
warning. Every file gets one line saying what it is for. The task-oriented "I want to…" table stays
where it was, because knowing *which* file to open for a job is a different question from knowing what
exists.

**The division of labour is stated rather than assumed.** `INDEX.md` stays the detailed map — statuses,
cross-references, the "Start Here" column — and the README is deliberately one line per file. Both files
now say so in text, so the next person adding a document knows they are updating two places on purpose,
not duplicating by accident.

**Cataloguing the folder found a claim that was wrong.** `INDEX.md` stated there was "exactly one README
in the project"; there are two, the second being `design/assets/screenshots/README.md`, which carries
that folder's public-repo rules and is the reason those screenshots can sit in a public repo at all. The
index also omitted `design/LOGO_BRIEF.md` from its folder tree. Both are corrected, and the count of 31
is now recorded in the index so the next drift is visible rather than silent.

**Verified, not assumed:** every purpose line was read from the file's own opening rather than copied
from the old index prose, and all 34 links in the README were resolved against the filesystem — none
broken, and all 31 documentation files are linked. The lint warnings the editor raises on the new tables
are its own defaults; the repo commits no markdownlint config, and the table style used matches every
other document in the folder.

## August 10, 2026 — The reference's DataTable was vendored in, and I was wrong that it couldn't be

**I told the owner three times that LeapDesk's DataTable could not be copied. One of my four reasons
was wrong, and it was the load-bearing one.** I claimed React 19 blocked it. Checked properly, after
the owner copied the project into `references/`: its DataTable and all five shadcn components it needs
use `useState` / `useEffect` / `useRef` and **no React 19 API at all**. I had asserted a version
incompatibility without verifying these files used any 19-only feature. Recorded because it changed
the owner's options and they were right to keep pushing.

**What actually shipped.** Nine dependencies installed (4 Radix packages, `lucide-react`,
`class-variance-authority`, `tailwind-merge`, `clsx`), `components/ui/*` and the DataTable copied to
`components/vendor-datatable/`, and `components/common/VendorDataTable.tsx` adapting our props to
theirs. `ResourceIndex` swapped one import, so **all four index pages moved at once**.

**The theme is aliased, not duplicated.** Their files are written against shadcn's semantic names
(`bg-muted`, `text-muted-foreground`, `border-input`, …) which this project never had. Rather than
carry two palettes, 15 CSS variables in `globals.css` map each shadcn name onto an existing Viho
value — `--primary: var(--brand)`, `--muted: surface.tile`, `--muted-foreground: ink.label`. One
colour system, two vocabularies. `tailwind.config.ts` — a Protected File — was edited with the
owner's explicit approval.

> **`accent` is deliberately absent from that mapping.** Viho already owns the name: it is the tan
> `#ba895d`, live in `StatCard` and `QuickActionsCard`. shadcn uses `accent` for menu-item hover, so
> redefining it would have silently repainted both dashboard cards. The copied files have those two
> classes rewritten to the documented house hover instead (`bg-brand/10` + `text-brand`).

**Three patches to the vendor code, each marked `// PATCHED:`:**

| Patch | Why |
|---|---|
| Row ids widened `number` → `string \| number` | Their models use bigint PKs; `users.id` here is `String(36)`. Roles and Activity *are* numeric, which is why the union rather than a swap |
| `bg-blue-50 dark:bg-blue-950/50` on the header row → `bg-muted` | The one palette colour in the copy. It **failed the brand-colour guard** — exactly the call-site colour the 2026-08-05 migration removed from 37 files |
| Laravel pagination | Their pager reads `links: [prev, 1…n, next]` and calls `onPageChange(url)`. The adapter synthesises that array from `{page, pages}` and parses the number back, so their sliding-window pager (`1 … 4 5 [6] 7 8 … 20`) works untouched |

**Nothing regressed.** Their table has no loading, error or retry state and cannot tell "no data" from
"filters hid everything" — the three things `CORE_COMPLETION_PLAN.md` § 4.1 measured as ours being
ahead. All four are handled in the adapter, before the vendor renders, so the swap adds their pager
without losing our states.

**Lint carries an exemption, and it is narrow.** `components/vendor-datatable/**` and
`components/ui/**` are ignored by ESLint — vendored source is kept close to upstream so re-copying
stays a file copy rather than a merge, and it is not edited to satisfy our rules. **They remain
covered by `tsc --noEmit` and by the brand-colour guard**, which is what caught the `bg-blue-50`.

**Scoped to Users, opt-in per module.** The first cut swapped `ResourceIndex` outright, which moved
all four index pages at once — more than was asked for, and the wrong shape for a component nobody has
looked at yet. `ResourceIndex` now takes `table?: "default" | "vendor"` and defaults to ours; only
`UsersModule` passes `"vendor"`. Roles, Invitations and Activity are untouched and stay on our table
until the Users screen has been seen in a browser and signed off.

**Verified:** typecheck passes · lint **18 — unchanged from baseline** (27 before the exemption) ·
brand-colour guard **clean** · `/dashboard/{users,roles,invitations,activity}` all compile and serve
200, with only Users on the vendor table.

> **Not rendered.** This is the largest visual change of the day — a different table component on four
> screens — and none of it has been looked at. The pager, the row density, the checkbox column and the
> dark-mode mapping of those 15 new variables are all unverified. **This is the one to open first.**

---

## August 10, 2026 — The Index / Form / Show shells are settled, and written down as a contract

**The owner's instruction: fix the UI/UX of the three page types once, then follow it everywhere.**
So this closes the shells rather than another module. All three now live in `components/common/`, and
`UI_PATTERNS.md` carries a new § *The three-page contract* stating the rule that matters: **a module
supplies columns, fields and handlers, and no layout.** If a module needs a shape the shell does not
offer, the shell gets extended so all eight modules gain it — it is not forked locally.

**Form had the real gap: no concept of a section.** The reference splits its Users form into five
titled cards (Basic Information, Organization, …); ours rendered a flat column of fields with
`gap-4`. Flat is both unlike the reference and simply hard to read at fifteen fields — and with no
primitive, each of the seven remaining modules would have invented its own grouping. `ResourceForm`
now exports **`FormSection`** (titled card, optional description and icon) and **`FormGrid`** (two
fields per row above `sm`). Users is the worked example, split into Basic Information / Organization /
Access.

**The Form heading now names the record.** `Edit User: Ayush Mishra` rather than `Edit User`, matching
the reference — the difference between a heading and one that tells you what you are about to change,
which matters most on the screen where you can do damage. Submit reads `Update User` / `Create User`,
busy `Updating…` / `Creating…`. Cancel wears `buttonClasses("outline")` instead of a hand-copied class
string, so it cannot drift from the Save beside it.

**Show gained two things from reading the reference's `show-page.tsx`:**

- **A 2:1 grid instead of a fixed sidebar.** Ours was a flex row with `lg:w-80`. A fixed 320px column
  is a third of a 960px window and a fifth of a 1600px one, so the balance the design was drawn at
  only held at one width. Now `lg:grid-cols-3` with the main column spanning two.
- **A sticky sidebar** (`lg:sticky lg:self-start`). It holds status, security and audit metadata —
  context for the main column rather than something to scroll away from. `self-start` is load-bearing:
  without it the grid item stretches to the row height and `sticky` does nothing at all.

`InfoCard` also takes a `description` now, which the reference has and we did not.

**Verified:** `npm run typecheck` passes; `npm run lint` is **18 — unchanged**; `/dashboard/users`,
`/users/new`, `/roles`, `/roles/new`, `/invitations` and `/activity` all compile and serve 200.

> **Not finished, and worth being plain about it.** Only `UserForm` has been split into sections. The
> other forms — `RoleForm`, `InvitationForm`, `ProfileForm` — pick up the new heading, submit labels
> and Cancel automatically, because those live in the shell, but their fields are still a flat column.
> That is the next mechanical pass, and it is exactly the "apply it to all modules" the contract
> exists to make cheap.
>
> **Still not rendered.** The sticky sidebar and the section cards were reasoned about, not looked at.
> Sticky positioning inside a scroll container is the single thing here most likely to be subtly wrong
> on screen and completely invisible from the source.

---

## August 10, 2026 — The Users index was audited against LeapDesk screen-by-screen, and now matches it

**The owner asked for the reference's Users index exactly — heading, filters, table.** That is the
standard `CORE_COMPLETION_PLAN.md` § 1.1 already sets: everything the user sees is 🔒 exact parity,
everything about how it is built is ours. So this was the § 8.1 audit, done properly, with
`resources/js/pages/Users/Index.tsx` open beside our screen.

**Brought to parity:** the heading is now `Users Management` with a users glyph and the description
*"Manage users and their permissions"*; the button is `Add User`; search reads `Search users...` behind
a magnifier; the filter placeholders are `All Status`, `All Roles`, `All Types`; the roles column
header is singular `Role`; the row menu is View → Edit → **Approve User** → **Send Email** → … →
Delete, in that order and with those labels; the bulk bar says `Set Active` / `Set Inactive` /
`Delete Selected`; the counter reads `3 of 137 user(s) selected`; and the empty state is
`No users found` with a `Create First User` button, or `No users match your filters` when filters are
on.

**One finding was a pleasant surprise: the reference already puts its filters, `Cols` and `Reset` on a
single row** — `mb-6 flex flex-wrap items-center gap-3`, with both buttons `h-9 shrink-0`. Ours had
them stacked and had been merged earlier the same day for space reasons. The two arrived at the same
layout independently, which is the useful kind of confirmation.

**What deliberately still differs is now written down** rather than left as drift — six entries in
§ 1.1's divergence register. Three are data-model facts (we have `SUSPENDED`, `account_type`,
`company_name`; they have `level`, `department`), one is a better label kept on purpose (`INACTIVE`
renders as *"Pending approval"*, which says what the state means), one is the sanctioned visual theme,
and one is a **genuine gap, recorded as a to-do rather than a decision**: their row-menu items each
carry an icon and ours do not, because `RowActions` has no icon slot.

> **Their `Updated At` column renders `created_at`** — header and accessor disagree in the source.
> Not copied. This is only the **second** entry in § 1.1's *"where LeapDesk's behaviour is a defect"*
> category, after the unrestricted sort column, and that category requires writing the divergence down
> before diverging — which is what this is.

**Two shared props came out of it**, so the other seven modules inherit the shape rather than
re-deriving it: `ResourceIndex` now takes `icon` for the header glyph, and `rowNoun` for the selection
counter (`"user"` → *"3 of 137 user(s) selected"*, defaulting to `"record"`). `FilterBar`'s text
filters accept an `addon`, which is how the search magnifier arrives — Viho's `.input-group-text`
tile rather than the reference's absolutely-positioned icon, per sanctioned divergence #1.

**Verified:** `npm run typecheck` passes, `/dashboard/users` compiles and serves 200, `npm run lint` is
**18 — unchanged**. Still not rendered in a browser; the labels and order were read off the source, not
seen on screen.

### The filters still did not match, because the control was wrong

**The first pass matched every label and missed the thing that actually differs.** The reference's
filters are not dropdowns — they are `FilterCombobox`, which its own docblock calls *"a Select2-like
searchable dropdown"*: a button that opens a popover containing a **search box**, a list with a tick
beside the current value, and an inline ✕ to clear. Ours were native `<select>` elements. Matching
"All Status" as a placeholder while leaving a plain select underneath changed the words and none of
the interaction, which is why it still read as wrong on screen.

**`components/common/FilterCombobox.tsx` reproduces it feature for feature** — filter-as-you-type
(matching the option's value as well as its label, mirroring the reference's `keywords`), a first row
that clears back to "All …", ticks, the ✕, an empty-results message, and the popover matched to the
trigger's width. Keyboard: ↑/↓ move, Enter picks, Escape closes and returns focus to the trigger.

**The Role filter is the case that forces it**, and it is worth stating because it justifies the whole
component: a native select has no search, so choosing one of forty roles means scrolling a list you
cannot filter. `<select>` is still right in **forms**, and `Select` stays there — this is a filter-bar
control only.

**None of it could be copied.** Theirs is Radix `Popover` + `cmdk` `Command`; we have neither, so the
popover, the filtering, the roving focus and the outside-click handling are written here in ~270 lines.

**The search field's icon moved inside the field.** The first pass used `Input`'s `addon` — Viho's
bordered `.input-group-text` tile — which reads as a *second control* sitting in a row of single
controls. `Input` now takes `leadingIcon` for an icon on the field's own background, which is the
reference's treatment and what a filter bar wants.

> **Two lint errors were introduced and fixed before finishing**, both in the new component: a
> `mounted` state guard before `createPortal` (unnecessary here — the popover only renders while open,
> and open is only ever set by a click, so the guard was an effect setting state for no reason), and
> `role="combobox"` without `aria-controls`, which `jsx-a11y/role-has-required-aria-props` catches.
> Count went 18 → 20 → **18**. Measured, not assumed.

---

## August 10, 2026 — The Users module gets the component system the rest of the app will copy

**Users is module 1 — the reference implementation the other seven copy — so before building any more
of them, the shared pieces it improvises were pulled out and made real.** The shape was already right:
`ResourceIndex`, `ResourceForm` and the `ShowPage` primitives landed on 2026-08-07 and Users, Roles and
Invitations already sit on them. What was missing was the layer below — the small things every module
needs and every module had therefore written for itself.

**The same error formatter existed seven times, in four different versions, and two of them were
losing information.** `InvitationsModule` and `UserShow` had no branch for a 422 `detail[]` array at
all, so **every Pydantic validation failure in those screens was swallowed** and shown as the generic
fallback — the user was told "Could not load invitations." when the API had said exactly which field
was wrong. A fifth version dropped Pydantic's `"Value error, "` prefix; a sixth kept it. The sharper
finding is that **`lib/utils/apiError.ts` already existed and was better than all seven** — it prefixes
the field name, which none of the copies did — and nine other files were already using it. Two camps in
one codebase. The copies existed because the shared one lacked the "no response at all" branch, so that
branch was added and the seven were deleted.

**One date rendered six different ways.** An account created on 7 August 2026 appeared as "7 Aug 2026"
in the Users table, "August 7, 2026" on the profile card, "8/7/2026" in the Activity log and "Aug 7,
2026" on invitations — four of those from a bare `toLocaleString()`, which inherits the *browser's*
locale, so the same build rendered differently for different people. `lib/utils/format.ts` now has
`formatDate` and `formatDateTime`. **The locale is pinned and the timezone deliberately is not**: a
pinned locale makes output deterministic (and removes a hydration-mismatch risk the moment anything is
server-rendered), while pinning IST would show a partner abroad a time that never happened for them.
Fourteen call sites moved; one survives, `WelcomeBanner`'s "Member since August 2026", because a
month-and-year formatter used once is worse than the inline call.

**Four primitives, each of which `UI_PATTERNS.md` had already predicted would be needed.** That file's
§ Pending listed *"no `danger` variant, so each destructive action invents its own red"*, *"no `cn()`
helper"* and *"no toast/confirm convention for destructive actions — improvised per screen"*. Every one
of those had come true in code:

| Added | What it replaced |
|---|---|
| `Button` `danger` variant + `size` prop | Two hand-rolled red buttons in Users and Roles, with different padding and different disabled opacity |
| `ConfirmDialog` | Two near-identical delete modals, each re-implementing the busy flag and error banner |
| `Avatar` | Four hand-drawn initials discs at four sizes |
| `cn()` | Template-literal class concatenation |

**The most telling detail:** both hand-rolled red buttons carried `hover:bg-tone-danger` on a
`bg-tone-danger` background — the same colour, so **the two most dangerous controls in the app were the
only ones with no hover state at all.** Nobody wrote that on purpose; it is what copy-paste does.

**`getInitials()` was already in `lib/utils/user.ts` and used by nothing.** All four discs had either
inlined the fallback or read the server field with no fallback at all. It has a consumer now.

**Three fixes that were on the register rather than found today:**

- **The sticky table header was translucent** (`bg-brand/10`), so rows scrolled visibly *through* it —
  flagged in both `PLANNING.md` § 3.3 and `CORE_COMPLETION_PLAN.md` § 4.1, and a direct violation of
  this file's own mandate of *"sticky thead (top-0 z-10, **opaque bg**)"*. The fill also moved from
  `<thead>` to the `<th>` cells, because several engines do not paint a table section's own background
  for a stuck row. ⚠️ **The shade is approximate**: over the green card the old fill composited to
  ≈`#d6e2e0` and no token holds that value, so it uses `surface-tile` and leans on a hairline. The
  exact fix needs a new token in `tailwind.config.ts`, which is a Protected File — the same shape as the
  `surface-border` retint already waiting on the owner.
- **Every button's focus ring was `focus:ring-brand`**, which on a red button is a teal halo, and
  `focus:ring-offset-2` was set with **no offset colour** — so Tailwind's default white drew a halo
  around every focused button on the green chrome. Both now correct, and the second was a live
  violation of this file's § The Signed-In Chrome Is Green.
- **The Users detail page's Edit control was a `<Link>` styled by hand** at `h-9 … text-xs` while every
  other primary button beside it was `py-1.5 … text-sm` — visibly a different size for no reason
  anyone chose. `Button` now exports `buttonClasses()` for the case a `<button>` genuinely cannot
  serve. **Navigation gets an anchor wearing those classes; actions get `<Button>`** — because
  `<Button onClick={router.push}>` looks identical but loses middle-click, open-in-new-tab and the
  status-bar URL.

**Verified in the container, not asserted:**

| Check | Result |
|---|---|
| `npm run typecheck` | **Passes** |
| `npm run build` | **Passes** — all 25 routes compiled |
| `npm run lint` | **18 errors — unchanged.** Measured against a stashed baseline rather than assumed; zero added. All 18 are pre-existing `react-hooks` errors, none in the new files |
| Brand-colour guard | **Clean** |
| Routes serve | `/dashboard/users` and `/dashboard/users/new` → 307 to sign-in (middleware), `/sign-in` → 200 |

> ### ⚠️ The verification broke the dev server, and the failure is worth knowing
>
> **`npm run build` must not be run inside the frontend dev container.** `.next` is the named volume
> `frontend_next`, shared by `next build` and the running `next dev`, so the build replaced the dev
> output with a production one. Every `_next/static` request then 404'd — and because Next answers a
> 404 with its HTML error page, the browser reported it as a **MIME type** problem:
>
> ```
> Refused to apply style from '…/_next/static/css/app/layout.css' because its MIME
> type ('text/html') is not a supported stylesheet MIME type
> GET …/_next/static/chunks/main-app.js  404 (Not Found)
> ```
>
> `next dev` asks for `main-app.js`, `app-pages-internals.js`, `app/(auth)/sign-in/page.js`; a
> production build contains hashed chunks (`2117-cf6ac3a12ac767f1.js`) instead. **Nothing was wrong
> with the code** — the build genuinely passed, and passing is what broke it. Tell it apart from the
> two neighbouring failure modes by looking for `BUILD_ID`, `prerender-manifest.json` and
> `required-server-files.json` in the container's `/app/.next`: those exist only in a production build.
>
> Recovery, ~1 second to Ready:
>
> ```bash
> docker compose stop frontend
> docker compose run --rm --no-deps -T frontend sh -c 'rm -rf /app/.next/* /app/.next/.[!.]*'
> docker compose start frontend
> ```
>
> **Verify with `npm run typecheck` and `npm run lint`, which write nothing.** After the reset, checked
> live: `/sign-in` 200 with `main-app.js`, `app-pages-internals.js` and `app/(auth)/sign-in/page.js`
> all 200 `application/javascript`, `layout.css` 200 `text/css`, and `/dashboard/users` compiled in
> 992ms and served 200.

> **Not verified: any of it rendered.** The sticky header, the red confirm button and the avatar sizes
> were changed by reasoning about classes and contrast, **not by looking at them**, and one of the three
> is a deliberate approximation. `UI_PATTERNS.md` § Pending has said since 2026-08-06 that no component
> has been checked in a browser since the Viho migration; this work does not close that and makes it
> more pressing. **The Users index in both themes is the screen to open first.**
>
> **Side finding:** `PLANNING.md` § 1 records the lint count as **17**, and `TECH_DEBT.md` PM-30 and the
> comment in `ci.yml` both say 20. Measured today on a clean tree: **18**. All three registers are wrong,
> in two directions.

---

## August 10, 2026 — The reference grew a tenth module, and researching it surfaced a design decision we keep deferring

**The owner pointed at a screen in LeapDesk that did not exist when the parity plan was written —
`/settings/api/consumers`, shipped there on 2026-08-09.** It is the admin surface for *machine*
identities: a consumer (a system, never a person) holds API tokens, each carrying a set of abilities and
an optional expiry, so that who holds standing access to the data is readable without SSHing into
production. Before it, tokens were minted from a CLI and nobody could answer that question.

**Researched from source and added as Module 10** to `LEAPDESK_PARITY_PLAN.md`. The reference turned out
to document itself unusually well — `documentation/planning/LEAPDESK_PLATFORM_API.md`, 584 lines, is the
only one of the ten modules that records its own code review and its own mistakes, and it is worth
reading directly rather than through our summary.

**The most important thing this is *not*: it is not the API Credentials module already in the queue.**
That one stores credentials *we* hold to call out to third parties, decryptable because we have to send
them. This one governs who may call *in*, and its secrets are hashed and never recoverable. They sit
side by side in the sidebar, both say "API", and merging them would blur an access-control boundary for
a superficial resemblance. LeapDesk refused that explicitly; the plan now says so too.

**One finding outlives the module, and it is the reason this R&D was worth doing.** A machine consumer
has no user row — and that makes it the **third** caller in four days that is not a `User`, after the
anonymous visitor in the partner-directory research and the tenant boundary in PM-5. Everything we have
is typed `actor: User`, including every function in the `data_access_service` written on 2026-08-07. The
recommendation is to introduce a `Principal` union **once, before** any of the three, with anonymous as
the most restrictive branch by construction. The tempting shortcut — a hidden service `User` per
consumer — has to be refused: it would put machine identities into user lists, RBAC screens and every
`SELECT * FROM users`, where one forgotten filter turns an integration into a login.

**Two smaller findings.** Sanctum does the token work for LeapDesk and has no equivalent here, so the
port needs its own `api_consumer_tokens` table — and it must hash with **SHA-256, not bcrypt**, which is
the trap, since `security.py` offers `hash_password` right there. Bcrypt salts every hash, so an
incoming bearer token could not be looked up without scanning and comparing every row; its slowness buys
nothing against 256 bits of entropy; and it truncates at 72 bytes. Separately, PM-26's per-process rate
limiter turns out to be a second, independent argument for PM-44 (Redis): per-IP counters in one
process's memory are an honest speed bump for a login form, but for an API whose rate limit is an
advertised contract they are a control that does not hold.

**We recommend skipping the half of it that looks most impressive.** LeapDesk's registry-driven engine
exposes arbitrary models over HTTP, and its own code review found **100 of 105 registered resources
returning every column of their table** — one of them the entire 81-column internal cost and margin
model, behind the ability you would hand out most freely. We have no data to expose and no consumer
asking for it. That decision reopens only if the partner-directory product is chosen.

**Two registers were stale and are now corrected, both verified rather than assumed.** Re-measured
against the running database today: **34 permissions, 16 of them the parity set**, all in this project's
`{resource}-{action}` convention. So `PLANNING.md`'s "Permissions: 0 of 14" was wrong, and the parity
plan's still-open "adopt LeapDesk's dotted names verbatim" question **was settled by the code on
2026-08-07** — the seeded names are `data-access-view`, `api-credential-view`, `search-entity-manage`.
Both documents now say so, and the parity plan's own self-contradiction on that point is resolved.

> **Nothing was built and no decision was taken.** Four new questions are recorded for the owner: whether
> Module 10 is in scope now at all, the `Principal` type, the resource engine, and whether tokens should
> default to expiring (we recommend yes — the opposite of LeapDesk's default, because a token nobody
> remembers issuing is the failure mode here).
>
> **Side finding, unrelated:** `README.md:155` still says passwords are *"stored and compared in
> plaintext"* as a deploy blocker. That is no longer true — `security.py` hashes with bcrypt,
> `verify_password` is the only comparison, and `is_bcrypt_digest` records that pre-existing plaintext
> rows were hashed in place by the migration that introduced hashing. The README needs correcting, and
> it is the kind of stale claim that matters more than most: it is the first thing a reader is told
> about deploying.

---

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
