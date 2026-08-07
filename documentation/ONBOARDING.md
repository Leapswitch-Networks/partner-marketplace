# Partner Marketplace — Local Setup Guide

This is the **single source of truth** for setting up Partner Marketplace locally on a fresh
machine. Hand this file to any new developer (or AI coding agent) along with the repo URL, and it
should produce a working environment.

If anything in this file is wrong, fix this file first — don't rely on tribal knowledge.

> The root `README.md` was rewritten on 2026-07-30 because the inherited version was wrong in twelve
> places. It now defers to this file. If you are working from a checkout older than that, see § 12
> for what it used to claim.

---

## 0. Snapshot of the Working Environment

There are **two supported ways** to run this project locally. Pick one and read only its sections.

| | **Path A — everything in Docker** (recommended) | **Path B — apps on the host** |
|---|---|---|
| What you need installed | Docker + Compose v2, Git | Docker + Compose, **Python 3.12**, Node 20 LTS, npm 10 |
| Runs in Docker | `db`, `adminer`, `backend`, `frontend` | `db`, `adminer` |
| Runs on your host | nothing | `uvicorn`, `npm run dev` |
| Start command | `docker compose up -d` | three terminals — § 4, § 5, § 6 |
| Sections to read | § 1, § 3, § 4, § 7 | § 1, § 2, § 3, § 4, § 5, § 6, § 7 |

**Prefer Path A unless you have a reason not to.** The pinned Python dependencies
(`psycopg2-binary` 2.9.10, `pydantic` 2.10.3, `sqlalchemy` 2.0.36) publish **no wheels for Python
3.13 or 3.14**. If your system Python is newer than 3.12 — increasingly the default — Path B will
fail at `pip install` and you will need pyenv/deadsnakes to get a 3.12 alongside it. Path A's
backend image pins 3.12 itself, so the host Python is irrelevant.

| Component | Version | Notes |
|-----------|---------|-------|
| Docker + Compose | v2 | Four services: `db`, `adminer`, `backend`, `frontend` |
| PostgreSQL | 16 (`postgres:16-alpine`) | Always in Docker, both paths |
| Python | 3.12 **exactly** | Path B only. Not 3.13/3.14 — no wheels. Path A's image handles this. |
| Node.js | 20 LTS | Path B only. Next.js 14 requires ≥18.17. |
| npm | 10.x | Path B only. See § 9 on `npm ci` — it fails without a flag. |
| Git | 2.x | |
| OS | Linux. macOS works the same. Windows: use WSL2. | |

There is still **no Nginx, no queue and no scheduler** in either path. The two app containers are
**development-only** — they bind-mount your source and run the dev servers with reload. They are not
a production topology; see `system-design/DEPLOYMENT.md`.

### Ports

Both paths publish the same ports. The two app ports are **not** the framework defaults, and that is
deliberate — `:3000` and `:8000` are commonly occupied by other projects.

| Service | URL | Why this port |
|---------|-----|---------------|
| Frontend | http://localhost:3001 | One of the two origins hardcoded in `backend/app/main.py`'s CORS allowlist, so it needs no code change |
| API | http://localhost:8002 | `:8000` is frequently taken; requires `NEXT_PUBLIC_API_URL` to be set (§ 3) |
| Adminer | http://localhost:8083 | `ADMINER_PORT` in `.env` |
| PostgreSQL | localhost:5434 | `POSTGRES_PORT` in `.env` — avoids clashing with a system Postgres or XAMPP |

Override the two app ports without editing any file by exporting `FRONTEND_PORT` / `BACKEND_PORT`
before `docker compose up`. If you move the frontend off 3001 or 3000 you **must** add the new origin
to the CORS allowlist in `backend/app/main.py`, or every API call will fail.

---

## 1. Clone the Repository

The repo is **public**, so no token is needed to clone.

```bash
git clone https://github.com/Leapswitch-Networks/partner-marketplace.git
cd partner-marketplace
```

Default branch is **`main`**. There are no submodules — a single flat repo.

> The frontend used to be its own git repo. It was absorbed into this one, so `frontend/` is
> ordinary tracked content now. If you see a `frontend/.git`, something has gone wrong.

---

## 2. ⚠️ Delete the Inherited Virtualenvs First

> **Path B only.** On Path A the backend never touches a host virtualenv — skip to § 3. The two
> directories are still dead weight (~93 MB) and worth deleting either way.

The repo arrived with **two** committed-then-ignored virtualenvs, and **neither works**:

| Path | Built on | Why it's dead |
|------|----------|---------------|
| `.venv/` (project root) | Windows, Python 3.14.3, via `uv` | `Scripts/` + `Lib/` layout with `.exe` shims — cannot run on Linux/macOS at all |
| `backend/.venv/` | Linux, Python 3.12.3 | Its `bin/python` now resolves to a newer system Python (3.14), so its `site-packages` no longer loads. `import fastapi` fails. |

Both are gitignored, so removing them affects nothing in git:

```bash
rm -rf .venv backend/.venv
```

The root `README.md` tells you to run `source .venv/bin/activate` — that path **does not exist**
(the Windows venv has `Scripts/activate`, not `bin/activate`). Ignore it.

---

## 3. Environment Files

There are **two** `.env` files and they are currently identical (340 bytes each):

| Path | Read by | Why it's needed there |
|------|---------|-----------------------|
| `.env` (root) | `docker-compose.yml` | Supplies `POSTGRES_*` and `ADMINER_PORT` |
| `backend/.env` | `app/core/config.py` via pydantic-settings | `env_file=".env"` resolves **relative to the working directory**, and you run uvicorn from `backend/` |

Both are gitignored. If you're starting fresh, create them with these keys:

```dotenv
# --- consumed by backend/app/core/config.py ---
DATABASE_URL=postgresql://<user>:<password>@localhost:5434/test_platformDB
SECRET_KEY=<generate-your-own>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# --- consumed by docker-compose.yml ---
POSTGRES_DB=test_platformDB
POSTGRES_USER=<user>
POSTGRES_PASSWORD=<password>
POSTGRES_PORT=5434
ADMINER_PORT=8083
```

Generate a real secret — never reuse one from another environment:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 3.1 `frontend/.env.local` — required, because the API is not on :8000

`lib/utils/constants.ts` falls back to `http://localhost:8000`, but the API is published on **8002**.
Create `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8002
```

This value is resolved **by the browser**, not by the server or container — every API call goes
through `lib/api/axiosInstance.ts` on the client and there is no server-side fetching. So it stays
`localhost` on both paths. On Path A `docker-compose.yml` sets the same variable for the container;
real environment variables win over `.env.local`, and both agree, so there is no conflict.

Skip this file only if you set `BACKEND_PORT=8000` and nothing else is using that port.

### 3.2 Notes on the current values

- Postgres is published on host port **5434** (not the default 5432), so it won't clash with a
  system Postgres or XAMPP.
- **`POSTGRES_PASSWORD` contains characters that are not URL-safe** (`@` and `#`), so the password
  inside `DATABASE_URL` is **percent-encoded** and is not a byte-for-byte copy of `POSTGRES_PASSWORD`.
  Keep both in sync by hand if you rotate it, and never rebuild `DATABASE_URL` by string-substituting
  `${POSTGRES_PASSWORD}` — the result is unparseable. This is why the backend container rewrites only
  the host:port of the URL (§ 4.2) instead of assembling a new one.
- The database is still named `test_platformDB`, inherited from the old project. Renaming it is
  tracked in `planning/SCAFFOLD_CLEANUP_PLAN.md` — don't rename it casually, `DATABASE_URL` and the
  existing `data/db` volume both point at it.
- `DATABASE_URL` uses the plain `postgresql://` scheme, which resolves to the **synchronous**
  `psycopg2` driver. Do **not** change it to `postgresql+asyncpg://` — the whole backend is
  synchronous (`create_engine`, `sessionmaker`, `def` endpoints). `asyncpg` isn't installed.

---

## 4. Start the Stack

### Path A — everything in Docker

```bash
docker compose up -d --build      # --build only needed the first time, or after a dependency change
```

That brings up four containers. `backend` waits for the database's healthcheck before starting.

| Service | Container | Host port | Purpose |
|---------|-----------|-----------|---------|
| `db` | `postgresql` | `${POSTGRES_PORT}` → 5432 | PostgreSQL 16 |
| `adminer` | `adminer` | `${ADMINER_PORT}` → 8080 | Web DB browser |
| `backend` | `pmp-backend` | 8002 → 8002 | FastAPI, `uvicorn --reload` |
| `frontend` | `pmp-frontend` | 3001 → 3001 | Next.js dev server, Fast Refresh |

App ports are mapped **1:1** on purpose — the port the browser talks to is the same number the dev
server binds, which keeps Next.js's Fast Refresh websocket working without extra configuration.

Then run the migrations and seed RBAC plus the root account (**neither is automatic**, see § 4.3):

```bash
docker compose run --rm backend alembic upgrade head

# ROOT_PASSWORD is optional. Set it to choose the root password, or omit it and
# the seeder generates one and prints it once — there is no default credential.
docker compose run --rm -e ROOT_PASSWORD='choose-a-strong-one' backend python -m app.db.seed_rbac
```

The seeder is idempotent: it reconciles permissions, permission groups and system roles against
`app/core/permissions.py` on every run, leaves administrator-created roles alone, and creates the root
account **only when no user exists at all**. Root's address defaults to `root@leapswitch.com` and can
be overridden with `ROOT_EMAIL`.

Check it came up:

```bash
docker compose ps                       # db "healthy", the other three "Up"
docker compose logs -f backend frontend # follow both dev servers
```

Your source is bind-mounted, so **editing files on the host reloads the servers in place** — that's
the whole point of these two containers. `backend/` maps to `/app` and `frontend/` maps to `/app`,
except `node_modules` and `.next`, which are named volumes so the container's own install is used
rather than your host's (they are built against a different Node/libc combination).

### Path B — database only

```bash
docker compose up -d db adminer
```

Naming the two services matters — a bare `docker compose up -d` would start the app containers too,
and they would fight your host servers for ports 3001/8002. Then continue with § 5 and § 6.

### 4.1 Where the data lives

Data persists to `./data/db` on the host (gitignored — it's a live Postgres cluster, never commit it).
Both paths share it, so you can switch between them without losing data. Adminer is at
**http://localhost:8083** (System: PostgreSQL, Server: `db`, not `localhost`).

### 4.2 How the backend container reaches the database

`app/core/config.py` reads `DATABASE_URL` from `backend/.env`, which points at `localhost:5434` —
correct for Path B, wrong inside a container where Postgres is a sibling service at `db:5432`.

`backend/docker-entrypoint.dev.sh` rewrites **only the host:port** of that URL at startup, using the
`DB_HOST`/`DB_PORT` variables set in `docker-compose.yml`, and leaves the credentials byte-for-byte
alone. It works that way because the password is percent-encoded (§ 3.2): rebuilding the URL from
`POSTGRES_USER`/`POSTGRES_PASSWORD` in compose would produce something unparseable, and hardcoding
the encoded form would commit a secret to a **public** repo.

### 4.3 ⚠️ Use `run`, not `exec`, for one-off backend commands

`docker compose exec` **does not run the entrypoint**, so a command started that way still sees the
un-rewritten `localhost:5434` URL and fails with `connection refused`. Use `run --rm`, which does:

```bash
docker compose run --rm backend alembic upgrade head       # ✅ works
docker compose exec backend alembic upgrade head           # ❌ connection refused
```

If you specifically want `exec` (it's faster — no new container), invoke the entrypoint yourself:

```bash
docker compose exec backend docker-entrypoint.dev.sh alembic current
```

`run --rm` does not publish ports, so it won't collide with the already-running `backend` container.

---

## 5. Backend Setup

> **Path B only.** On Path A the image already did all of this — go to § 4.
>
> **Your `python3` must be 3.12.** On 3.13 or 3.14 the `pip install` below fails: `psycopg2-binary`
> 2.9.10 has no wheel for them and building from source needs `libpq-dev` plus a compiler. Check with
> `python3 --version`; if it's newer, either install a 3.12 (pyenv, deadsnakes) and use it explicitly
> below, or switch to Path A.

All backend commands run **from `backend/`** — this matters for both `.env` discovery and Alembic's
relative `script_location`.

```bash
cd backend

python3.12 -m venv .venv           # be explicit about the version
source .venv/bin/activate          # Windows/WSL: .venv/Scripts/activate

pip install --upgrade pip
pip install -r requirements.txt
```

### 5.1 Run migrations

```bash
alembic upgrade head
```

Alembic ignores the placeholder `sqlalchemy.url` in `alembic.ini`; `app/db/migrations/env.py`
overrides it from `settings.DATABASE_URL`, so `.env` is the single source of truth.

Current head is **`e7b41c9a2d10`** (`unify_accounts_and_add_rbac`). Full chain and conventions:
`system-design/DATABASE_MIGRATIONS.md`.

### 5.2 Seed RBAC and the root account

```bash
# Choose the password:
ROOT_PASSWORD='choose-a-strong-one' python -m app.db.seed_rbac

# Or omit it and let the seeder generate one — it prints the password once and
# never again, so capture it from the output.
python -m app.db.seed_rbac
```

What it does, idempotently, on every run:

| Step | Behaviour |
|------|-----------|
| Permissions & groups | Created or updated to match `app/core/permissions.py`, the source of truth |
| System roles | Created if missing, permissions re-synced |
| Administrator-created roles | **Never touched** |
| Root account | Created **only if no user exists at all** — it will not silently mint a second one |

| Setting | Env var | Default |
|---------|---------|---------|
| Root email | `ROOT_EMAIL` | `root@leapswitch.com` |
| Root password | `ROOT_PASSWORD` | **none** — a random one is generated and printed once |

> **There is no default credential**, deliberately: this is a public repo and a committed working
> password is a working password for everyone. If the seeder generated yours, it appears in the output
> exactly once — rotate it before the environment is reachable from anywhere.

### 5.2b Seed the team roster (optional)

`seed_rbac` creates one bootstrap root account. To get a whole team able to sign in — the FastAPI
equivalent of LeapDesk's `PermissionSeeder::createUsers()` — use the roster seeder:

```bash
cp seed_users.example.json seed_users.json    # then edit it
python -m app.db.seed_users
```

| Behaviour | Detail |
|---|---|
| Roster location | `backend/seed_users.json`, or `SEED_USERS_FILE=/path/to.json` |
| Passwords | Omit `password` and one is generated and **printed once** |
| Re-running | Idempotent. Roles and profile are synced; **an existing password is never reset** |
| Roles | **Set**, not appended — removing a role from the roster removes it from the user |
| Unknown role | **Fails the run.** Half-seeding an account that looks fine and cannot work is worse |
| Malformed entry | Fails the run, naming the entry number and field |

**`seed_users.json` is gitignored, and that is the point.** It holds real addresses and possibly
passwords, and **this repository is public**. LeapDesk keeps its equivalent roster in the source file
including plaintext passwords — defensible in a private repo, not here. The committed
`seed_users.example.json` shows the shape with obviously-fake values.

### 5.3 Run the API

```bash
uvicorn app.main:app --reload --port 8002
```

Port 8002, not 8000, so it matches `NEXT_PUBLIC_API_URL` (§ 3.1) and Path A.

| URL | What |
|-----|------|
| http://localhost:8002/health | `{"status":"ok"}` |
| http://localhost:8002/docs | Swagger UI |
| http://localhost:8002/redoc | ReDoc |

---

## 6. Frontend Setup

> **Path B only.** On Path A the `frontend` container already runs this — go to § 4.

In a second terminal:

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev -- --port 3001
```

Frontend runs at **http://localhost:3001**.

**`--legacy-peer-deps` is no longer required (2026-08-07).** It was, for as long as `package.json`
pinned React 19.2.4 against `next@14.2.35`'s `peer react@^18.2.0` — React 19 support arrived in Next 15,
not 14, so `npm install` and `npm ci` both aborted with `ERESOLVE`. **PM-25 is now resolved**: React and
React DOM are on 18.3.1, which is inside Next 14's declared range, and the tree resolves with no flag at
all. `Dockerfile.dev` still passes it; that is now harmless rather than load-bearing.

`NEXT_PUBLIC_API_URL` must point at port 8002 — see § 3.1. `lib/utils/constants.ts` falls back to
`http://localhost:8000`, which is the wrong port for this setup, so without `.env.local` every API
call fails.

The backend's CORS allowlist is hardcoded to `http://localhost:3000` and `http://localhost:3001`
(`backend/app/main.py`). If you serve the frontend on any other port, requests will be blocked —
add the origin there.

---

## 7. Quick Verification Checklist

- [ ] `docker compose ps` shows `db` healthy (Path A: and `backend`/`frontend` `Up`)
- [ ] `curl -s localhost:8002/health` → `{"status":"ok"}`
- [ ] http://localhost:8002/docs lists the `auth`, `users`, `roles`, `permissions`, `invitations`,
      `candidates`, `categories` and `health` tag groups
- [ ] http://localhost:3001 redirects to `/sign-in` (root always redirects — see `frontend/middleware.ts`)
- [ ] Signing in as the root account from § 5.2 reaches `/dashboard`
- [ ] `curl -s localhost:8002/api/v1/auth/me` without a cookie → `401`
- [ ] http://localhost:8083 (Adminer) connects to the `db` server

The whole set as one paste-able block:

```bash
curl -s localhost:8002/health                                   # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' localhost:8002/api/v1/auth/me       # 401
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' localhost:3001/  # 307 …/sign-in

# One login endpoint for everyone. There is no /api/v1/auth/admin/login and no
# /api/v1/auth/whoami — both were removed when the two account tables were merged
# (migration e7b41c9a2d10). Capability comes from roles, not from the endpoint.
# Use the root credentials from § 5.2; there is no committed default.
curl -s -X POST localhost:8002/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"root@leapswitch.com\",\"password\":\"$ROOT_PASSWORD\"}"  # 200 + Set-Cookie

# CORS preflight must echo the frontend origin back
curl -s -i -X OPTIONS localhost:8002/api/v1/auth/login \
  -H 'Origin: http://localhost:3001' \
  -H 'Access-Control-Request-Method: POST' | grep -i access-control-allow-origin
```

Path A only — confirm the bind mounts really do reload:

```bash
touch backend/app/main.py
docker compose logs backend --since 15s | grep Reloading   # WatchFiles detected changes…
```

---

## 8. Day-to-Day Commands

### Path A — all from the project root

| Task | Command |
|------|---------|
| Start everything | `docker compose up -d` |
| Stop everything | `docker compose down` |
| Restart one service | `docker compose restart backend` |
| Follow logs | `docker compose logs -f backend frontend` |
| Status | `docker compose ps` |
| Shell in the backend | `docker compose exec backend bash` |
| New migration | `docker compose run --rm backend alembic revision --autogenerate -m "<msg>"` |
| Apply migrations | `docker compose run --rm backend alembic upgrade head` |
| Roll back one | `docker compose run --rm backend alembic downgrade -1` |
| Current revision | `docker compose run --rm backend alembic current` |
| Seed RBAC + root account | `docker compose run --rm -e ROOT_PASSWORD backend python -m app.db.seed_rbac` |
| **Backend tests + lint** | `docker compose run --rm --no-deps backend sh -c "pip install -q pytest ruff && python -m pytest -q && ruff check ."` |
| Lint frontend | `docker compose exec frontend npm run lint` |
| Production build | `docker compose exec frontend npm run build` |
| Rebuild after a dependency change | `docker compose up -d --build backend` (or `frontend`) |
| Reinstall node modules | `docker compose down && docker volume rm partnermarketplace_frontend_node_modules && docker compose up -d --build frontend` |

`alembic` and `seed_rbac` use `run --rm` rather than `exec` for the reason in § 4.3. Everything else
uses `exec` because it doesn't touch the database.

**The test command installs its own tooling, and that is not an oversight.** `pytest` and `ruff` live in
`requirements-dev.txt`, which the backend image deliberately does not install — a deployed image carries
no dev tooling (§ 10). `--no-deps` skips starting Postgres, because the default suite connects to
nothing. The install is a few seconds from pip's cache. If you run the suite often, build a local
`backend/.venv` on **Python 3.12** instead and use Path B — note that a 3.14 virtualenv will not install
the pinned dependencies at all, which is the whole reason § 2 tells you to delete the inherited ones.

### Path B

| Task | Command | Run from |
|------|---------|----------|
| Start database | `docker compose up -d db adminer` | root |
| Stop database | `docker compose stop db adminer` | root |
| Start API | `uvicorn app.main:app --reload --port 8002` | `backend/` |
| Start frontend | `npm run dev -- --port 3001` | `frontend/` |
| New migration | `alembic revision --autogenerate -m "<msg>"` | `backend/` |
| Apply migrations | `alembic upgrade head` | `backend/` |
| Roll back one | `alembic downgrade -1` | `backend/` |
| Current revision | `alembic current` | `backend/` |
| Lint frontend | `npm run lint` | `frontend/` |
| Production build | `npm run build` | `frontend/` |

---

## 9. Common Gotchas

| Symptom | Cause / Fix |
|---------|-------------|
| `source .venv/bin/activate: No such file or directory` | You're using the inherited **Windows** venv. Delete both venvs and rebuild — § 2. |
| `ModuleNotFoundError: No module named 'fastapi'` inside a venv | `backend/.venv` is the stale broken one. Delete and recreate — § 2. |
| `pydantic_core.ValidationError: DATABASE_URL Field required` | `backend/.env` missing, or you ran uvicorn from the project root instead of `backend/`. |
| `ModuleNotFoundError: No module named 'app'` | Same cause — run uvicorn from `backend/`, not the repo root. |
| `connection refused` on port 5434 | Postgres container isn't up (`docker compose up -d`), or `POSTGRES_PORT` doesn't match the port in `DATABASE_URL`. Both must say 5434. |
| Alembic can't find migrations | You ran it outside `backend/`. `script_location = app/db/migrations` is relative. |
| Frontend loads but every API call fails with a CORS error | Frontend is on a port other than 3000/3001. Add the origin to `allow_origins` in `backend/app/main.py`. |
| Logged in but immediately bounced to `/sign-in` | `access_token` cookie missing. Cookies are `httponly` + `samesite=lax` + `secure=False`; over plain HTTP the host must be `localhost` for both, not a mix of `localhost` and `127.0.0.1`. |
| Sign-in appears to fail, and the console shows a **404 on an unversioned path** like `GET /api/auth/me` | The browser is running a client bundle built **before PM-40 versioned the API**. No source file contains that path — check with `grep -r '"/api/auth' frontend/lib` (→ nothing). Sign-in itself succeeded; `activity_logs` will show the `login` row. Fix: **clear the browser cache** — see the row below. |
| `Text content did not match. Server: "" Client: "PM"` in the dashboard shell | Same cause. The server renders the current `BrandMark` (an `<img src="/logo.svg">`, so the span holds no text) while a cached client chunk predates `APP_LOGO` and falls through to the monogram. Both halves are individually correct; they are from different builds. |
| `TypeError: Cannot read properties of undefined (reading 'call')` at webpack's `options.factory` | Same cause, worst symptom — a cached chunk requires a module that has since been **deleted**, so webpack has a module id with no factory. This is what a renamed or removed component does to a browser holding the old chunk. |
| **Stale browser bundle — the fix** | **Clear the browser cache for `localhost:3001`** (DevTools → Application → Storage → Clear site data), or hard-reload. **Recreating the `.next` volume does not help** — the stale copy is in the browser, not the container. Tells you are looking at this and not a code bug: the server returns 200 for the page *and* every chunk, `tsc` and `next build` are clean, and the stack-trace line numbers are a little off from the current source (stale sourcemap). |
| Why it happened at all, and why it should not recur | `next.config.mjs` applied `Cache-Control: …immutable` to every `.js` — correct for production's content-hashed filenames, ruinous in dev where `page.js` keeps its name while its contents change. **Fixed 2026-08-07**: the rule is now `NODE_ENV`-conditional and dev serves `no-store`. Entries cached *before* that fix still need one manual clear. |
| `POST /api/v1/auth/refresh` returns 401 even with a valid session | The refresh cookie is scoped to `path=/api/v1/auth/refresh`, so it's only sent to that exact path. That's intentional — call refresh at exactly that URL. |
| Requests hang then fail after 5s | `axiosInstance` has a hard 5s timeout. The backend is slow or down. |
| `data/db` permission errors | The Postgres cluster is owned by the container's uid. Don't `chown` it. For a clean slate: `docker compose down` then `sudo rm -rf data/db`, then `up -d` and re-migrate. Note `down -v` does **not** clear it — `data/db` is a bind mount, not a named volume, so `-v` leaves it untouched. |
| Tailwind classes not applying | `tailwind.config.ts` only scans `./app` and `./components`. A new top-level folder needs adding to `content`. |

### Path A (Docker) specifically

| Symptom | Cause / Fix |
|---------|-------------|
| `npm ci` fails with `ERESOLVE … peer react@^18.2.0 from next@14.2.35` | **Fixed 2026-08-07 (PM-25)** — React is on 18.3.1 now and the tree resolves with no flag. If you still see this, your `package.json` predates the fix. |
| `TypeError: Cannot read properties of undefined (reading 'call')` at webpack's `options.factory`, thrown from a `<Lazy>` inside Next's `layout-router` | React/Next version mismatch — this is what an unsupported React does to the App Router's client runtime, and it broke sign-in entirely (**PM-25**). Check with `docker compose exec frontend npm ls react react-dom`; any `invalid:` marker is the cause. The app has no `next/dynamic` or `React.lazy` of its own, so a `<Lazy>` in a trace is always framework-internal. |
| `connection refused` / `could not translate host name "localhost"` from a backend command | You used `docker compose exec` for something that talks to the database. `exec` skips the entrypoint that rewrites `DATABASE_URL`. Use `docker compose run --rm backend …` — § 4.3. |
| `Bind for 0.0.0.0:3001 failed: port is already allocated` | Something else holds the port. Find it with `ss -ltnp \| grep 3001`, then either stop it or start with `FRONTEND_PORT=3005 docker compose up -d` — and add the new origin to the CORS allowlist in `backend/app/main.py`. |
| Edits on the host don't reload the container | Check the mount resolved: `docker compose exec backend ls /app` should show your source. If watching is silently missing events, `WATCHPACK_POLLING=true` is already set for the frontend; for the backend add `--reload-delay 1` or fall back to `docker compose restart backend`. |
| Frontend can't reach the API from the browser | `NEXT_PUBLIC_API_URL` must be a **host-visible** URL (`http://localhost:8002`), never `http://backend:8002`. The browser resolves it, not the container. |
| Next.js behaves as if a package is missing after you edit `package.json` | `node_modules` is a named volume, so a host `npm install` does not reach the container. Rebuild: `docker compose up -d --build frontend`. |
| `pip`/`npm` changes vanish after a restart | Expected. Dependencies live in the image, not the bind mount. Change `requirements.txt`/`package.json` and rebuild. |
| Containers start before the DB is ready | They shouldn't — `backend` has `depends_on: db: condition: service_healthy`, and the entrypoint additionally waits on `pg_isready`. If you see it anyway, check `docker compose logs db`. |
| Everything is up but stale in confusing ways | `docker compose down && docker compose up -d --build`. Add `-v` only if you want to **destroy the database** too — `data/db` is a bind mount, so `-v` will not delete it, but the `node_modules`/`.next` volumes do go. |

---

## 10. What Runs Where

| Concern | Path A (Docker) | Path B (host) |
|---------|-----------------|---------------|
| Frontend | `next dev` on :3001, in `pmp-frontend` | `npm run dev` on :3001 (host) |
| Backend | `uvicorn --reload` on :8002, in `pmp-backend` | `uvicorn --reload` on :8002 (host) |
| Python | 3.12, from the image | 3.12, yours — must not be newer |
| Database | `postgres:16-alpine` on :5434 (Docker) | same |
| DB host from the app's view | `db:5432` (rewritten at startup, § 4.2) | `localhost:5434`, straight from `.env` |
| DB admin UI | Adminer on :8083 (Docker) | same |
| Source of truth for code | your working tree, bind-mounted | your working tree |
| Reverse proxy | none | none |
| Queue / scheduler | none | none |
| Mail | none configured | none configured |
| Auth cookies | `secure=False` — HTTP only | same |

Production topology is **not yet defined** — see `system-design/DEPLOYMENT.md`.

---

## 11. Security Notes Before You Push

This repo is **public**. Before every push:

```bash
git status                     # nothing unexpected staged
git diff --cached | grep -iE "secret|password|token|api[_-]?key"
```

Confirmed-excluded by `.gitignore`: `.env*`, `.venv/`, `node_modules/`, `data/`, `__pycache__/`,
`*.tsbuildinfo`, `.claude/settings.local.json`.

**Known accepted debt:** passwords are stored and compared in plaintext. See
`core/AUTHENTICATION.md` § "Known Debt" and `planning/TECH_DEBT.md`. This is deliberate and known —
it must be fixed before any partner-facing deployment.

---

## 12. What the Inherited README Got Wrong (fixed 2026-07-30)

The root `README.md` came from the previous project and was never updated. It has since been
rewritten to defer to this file and to drop its version table entirely — a hardcoded version table
goes stale silently, so the lockfiles are now the only source of truth.

Recorded here because the claims below circulated for a while, and because an older checkout still
contains them:

| Old README said | Reality |
|-----------------|---------|
| Next.js 16.2.3, Tailwind 4.2.2 | 14.2.35, 3.4.19 |
| FastAPI 0.135.3, SQLAlchemy 2.0.49, Alembic 1.18.4, Pydantic 2.13.0 | 0.115.5, 2.0.36, 1.14.0, 2.10.3 |
| PostgreSQL 18.3, Nginx 1.28.3, Docker 29 | Postgres 16-alpine; no Nginx at all |
| `docker-compose up --build` starts all four services | Compose has only `db` + `adminer` |
| Backend auto-runs `alembic upgrade head` on startup | It does not — run it yourself (§ 5.1) |
| `cp backend/.env.example backend/.env` | No `.env.example` exists |
| `docker-compose exec backend python seed.py` | No `seed.py`; use `python -m app.db.seed_rbac` |
| Admin login `admin@example.com` / `admin123`, or `abc@gmail.com` / `Abc@1234` | **Neither exists.** There is no committed credential at all — the seeder takes `ROOT_PASSWORD` from the environment or generates one and prints it once (§ 5.2) |
| `postgresql+asyncpg://` | `postgresql://` (sync psycopg2) |
| `docker-compose.yaml`, `docker/` folder, `docs/` folder | `docker-compose.yml`; no `docker/`; folder is `documentation/` |

✅ **Resolved 2026-07-30** — the README was rewritten and the stale product naming was cleared from
the source at the same time. `planning/TECH_DEBT.md` PM-12 and PM-21 are closed.

---

## 13. Where to Go Next

- **Doc map:** [`INDEX.md`](./INDEX.md) — start here for everything
- **Agent rules:** [`AGENTS.md`](./AGENTS.md) and [`../CLAUDE.md`](../CLAUDE.md)
- **Architecture:** [`core/ARCHITECTURE.md`](./core/ARCHITECTURE.md)
- **Backend conventions:** [`system-design/FASTAPI_STANDARDS.md`](./system-design/FASTAPI_STANDARDS.md)
- **Frontend conventions:** [`system-design/NEXTJS_STANDARDS.md`](./system-design/NEXTJS_STANDARDS.md)
- **Schema changes:** [`system-design/DATABASE_MIGRATIONS.md`](./system-design/DATABASE_MIGRATIONS.md)
- **What changed recently:** [`DAILY_CHANGES.md`](./DAILY_CHANGES.md)

---

## 14. Help

If anything in this file doesn't work:

1. Check § 9 (Common Gotchas).
2. Ask the project owner (Ayush Mishra, `ayush.mishra@leapswitch.com`).
3. Once you've solved it — **update this file** so the next person doesn't hit the same wall.

### Locked out of your own local account

The API locks an account after `MAX_FAILED_LOGIN_ATTEMPTS` failures for
`ACCOUNT_LOCKOUT_MINUTES`. The production defaults (5 / 15) are painful on a local
box, where you mistype your own password far more often than an attacker guesses
it — a 15-minute lockout costs you 15 minutes to protect a database with nothing
in it.

`backend/.env` (gitignored) therefore raises them locally:

```bash
MAX_FAILED_LOGIN_ATTEMPTS=50
ACCOUNT_LOCKOUT_MINUTES=1
```

Raised, not disabled, so the code path is still exercised. `app/core/config.py`
keeps the real defaults, so nothing changes for any other environment.

If you do get locked out:

```bash
./scripts/unlock-user.sh                      # root@leapswitch.com
./scripts/unlock-user.sh someone@example.com
```

It clears the counter and the lock. It cannot show you a password — they are
bcrypt-hashed.

**A password is compared byte-for-byte.** Copying one out of a chat window often
picks up a trailing space, which fails as surely as a wrong password. Type it.
