# Daily Changes

> One entry per task, newest day first. Written in plain business English — what changed and why it
> mattered, not which class was added. Lead with a **bold sentence** stating the change, then explain.
>
> Update this file as part of the same change as the code. A task that isn't here is invisible to the
> next person.

---

## July 31, 2026

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
