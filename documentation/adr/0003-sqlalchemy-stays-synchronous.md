# ADR-0003 — SQLAlchemy stays synchronous: `def` endpoints, psycopg2, no asyncpg

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-07-30 (inherited with the scaffold, affirmed since) |
| **Recorded** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | Backend |

## Context

FastAPI's public identity is asynchronous, and effectively every tutorial, code sample and model
completion for it reaches for `async def`. This project's database driver is **`psycopg2-binary`,
which is synchronous.** `asyncpg` is not installed.

The failure mode is what makes this worth a record: an `async def` endpoint performing a synchronous
database query **blocks the event loop**. It does not error, it does not warn, and under light local
load it looks perfectly fine. It degrades under concurrency, in production, as a mystery.

FastAPI runs a plain `def` endpoint in a threadpool, which is exactly correct for a sync driver.

## Decision

Everything is synchronous. Endpoints are `def`, not `async def`. The engine is `create_engine` with
`sessionmaker`, not `create_async_engine`/`AsyncSession`. `DATABASE_URL` stays on the plain
`postgresql://` scheme, which resolves to psycopg2.

**Do not partially migrate.** Mixing the two is worse than either.

**One exception exists and it is not a precedent:** `upload_asset` in `backend/app/api/settings.py`
is `async def` because `UploadFile.read()` must be awaited. It touches the request body, not the
database. As of 2026-08-18 it is the **only `async def` handler in `app/api/`**, across 157 routes.

## Alternatives rejected

**Migrate to asyncpg + AsyncSession.** The honest option, and the one a fresh contributor proposes.
It means rewriting every service function, every dependency and every test, for throughput this
application does not need — 157 routes against a Postgres instance serving an internal admin tool.

**Allow `async def` where the handler does no database work.** Sounds harmless, and it is the route
by which the mixed state arrives: the next person copies the async handler as a template, adds a
query, and the loop blocks. The single upload exception is tolerable precisely because it is one, is
documented, and is countable.

## Consequences

- **Good:** no coloured-function split. Every service is an ordinary Python function, trivially
  testable and readable.
- **Cost:** slow I/O in a request occupies a worker thread. `mail_service` sends synchronously, so a
  slow SMTP send is one fewer request served. **The answer is a queue (PM-44), not `async def`** —
  `FASTAPI_STANDARDS.md` § 10 is explicit that this stays a live constraint.
- **Cost:** it contradicts almost every FastAPI example in existence, so it must be restated to each
  new contributor — which is why the root operating contract carries it in its layer table.

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Doc | `documentation/system-design/FASTAPI_STANDARDS.md` § 10 | the full explanation, including the migration table |
| Contract | root `AGENTS.md` § 5 | *"SQLAlchemy 2 — Synchronous. `def` endpoints, not `async def`"* |
| Dependency | `backend/requirements.txt` | `psycopg2-binary==2.9.10`; asyncpg absent |
| Code | `backend/app/api/*.py` | 157 routes, all `def` but one documented `async def` |

**No test asserts this.** A lint rule or test forbidding `async def` in `app/api/` outside an
allowlist would make the constraint self-enforcing, and does not exist today.
