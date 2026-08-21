# FastAPI + SQLAlchemy 2 + Pydantic v2 Standards

> **Backend only.** For frontend conventions read `NEXTJS_STANDARDS.md`; for styling read
> `UI_PATTERNS.md`; for schema changes read `DATABASE_MIGRATIONS.md`.

---

## 📖 Scope of This File (Read First)

Covers everything under `backend/app/`: routers, services, models, schemas, dependencies, config.

| This file | Not this file |
|-----------|---------------|
| Router/service/model layering | React components (`NEXTJS_STANDARDS.md`) |
| Pydantic v2 schema conventions | Tailwind and theming (`UI_PATTERNS.md`) |
| SQLAlchemy 2.0 declarative style | Alembic workflow (`DATABASE_MIGRATIONS.md`) |
| Dependency injection and guards | Auth behaviour (`../core/AUTHENTICATION.md`) |
| Error/status-code conventions | Deploy steps (`DEPLOYMENT.md`) |

**Verified stack:** FastAPI 0.115.5 · SQLAlchemy 2.0.36 · Pydantic 2.10.3 · pydantic-settings 2.6.1
· Alembic 1.14.0 · psycopg2-binary 2.9.10 (synchronous) · python-jose 3.3.0.

---

## Table of Contents

1. [The Three Layers](#1-the-three-layers)
2. [Routers](#2-routers)
3. [Services](#3-services)
4. [Models — SQLAlchemy 2.0 Style](#4-models--sqlalchemy-20-style)
5. [Schemas — Pydantic v2](#5-schemas--pydantic-v2)
6. [Dependencies](#6-dependencies)
7. [Sessions & Transactions](#7-sessions--transactions)
8. [Error Handling & Status Codes](#8-error-handling--status-codes)
9. [Configuration](#9-configuration)
10. [Everything Is Synchronous](#10-everything-is-synchronous)
11. [Adding a New Resource](#11-adding-a-new-resource)
12. [Anti-Patterns That Are Live Today](#12-anti-patterns-that-are-live-today)

---

## 1. The Three Layers

```
app/api/*.py       → HTTP only: routing, status codes, cookies, response_model
app/services/*.py  → business logic: rules, permissions, orchestration
app/models/*.py    → persistence only
app/schemas/*.py   → wire contract, used by both router and service
```

**Dependency direction is one-way.** A service never imports a router. A model never imports a
service. Nothing imports `main.py`.

| Layer | May raise `HTTPException`? | May touch `Session`? | May know about cookies? |
|-------|:--------------------------:|:--------------------:|:-----------------------:|
| Router | yes (rarely — prefer the service) | passes it in | **yes — only here** |
| Service | **yes — this is the normal place** | yes | no |
| Model | no | no | no |

---

## 2. Routers

### Structure

```python
router = APIRouter(prefix="/categories", tags=["categories"])
```

- One router per resource, in `app/api/<resource>.py`
- `prefix` is the resource path; the **version** prefix (`settings.API_PREFIX` = `/api/v1`) is added once in `main.py` — never write it in a router
- `tags` groups the endpoints in `/docs` — always set it

Register in `app/main.py`:

```python
app.include_router(category.router, prefix=settings.API_PREFIX)
```

### A router function should delegate, not decide

✅ **Correct** — thin, declarative, everything visible in the signature:

```python
@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_admin_user_endpoint(
    user_id: str,
    data: UpdateAdminUserRequest,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
) -> AdminUserResponse:
    return update_admin_user(db, user_id, data, actor=current_admin)
```

❌ **Wrong** — business rules leaking into the HTTP layer:

```python
@router.patch("/users/{user_id}")
def update_admin_user_endpoint(...):
    target = db.get(AdminUser, user_id)          # ← query in a router
    if not current_admin.is_super_admin:         # ← rule in a router
        raise HTTPException(403, "…")
    target.email = data.email
    db.commit()
```

### Rules

1. **Always set `response_model`.** It is the response contract and it filters extra fields —
   this is why `password` never leaks.
2. **Always annotate the return type.** It documents intent and lets type checkers help.
3. **Set `status_code` explicitly for creates:** `status_code=status.HTTP_201_CREATED`.
4. **Use `status.HTTP_*` constants**, never bare integers.
5. **Guards go in the signature**, via `Depends`. If the value is unused, bind it to `_`:
   ```python
   _: AdminUser = Depends(get_current_admin),
   ```
6. **Cookies are set only in routers** — `_set_auth_cookies()` in `api/auth.py` is the one helper.
   Services must never receive a `Response`.
7. **No business logic**, no multi-step queries, no `if` chains on domain state.

---

## 3. Services

### Signature convention

```python
def update_admin_user(
    db: Session,
    admin_id: str,
    data: UpdateAdminUserRequest,
    actor: AdminUser,
) -> AdminUser:
```

- **`db` first**, always
- **identifiers next**, then the validated payload
- **`actor` last, keyword-only at the call site** — `update_admin_user(db, id, data, actor=current_admin)`
- Return the **ORM object**; let the router's `response_model` serialise it

### Rules

1. **Never reach for the current user.** It arrives as `actor`. A service that resolves its own
   caller cannot be reasoned about or reused.
2. **Raise `HTTPException` for rule violations.** This is the layer that owns 403/404/409 semantics.
3. **Pre-check uniqueness** rather than catching integrity errors, so callers get a clean 409:
   ```python
   def _admin_email_exists(db: Session, email: str) -> bool:
       return db.scalar(select(exists().where(AdminUser.email == email))) or False
   ```
4. **Private helpers are `_`-prefixed** and live in the same module.
5. **Commit explicitly**, then `db.refresh(obj)` if you return it — server defaults and `onupdate`
   values are not populated in the instance until refresh.
6. **`.strip()` incoming strings** before persisting.
7. **One public function per use case.** Don't add `mode` flags to fork behaviour.
8. **A write that takes an id must scope it, not just check a permission.** Added 2026-08-21 with
   TECH_DEBT PM-46.

   The failure it prevents is an asymmetry, not a missing check: reads of a tenant-owned row went
   through `scoping.assert_can_read`, while the five writes fetched with a bare `get_or_404` and then
   asked `actor.has_permission(...)`. Both looked guarded. Neither the permission nor the
   `actor.organisation_id == row.id` self-approval guards that sat beside it stop an actor reaching
   *sideways* into another tenant — that guard exists to stop you approving **yourself**, which is the
   opposite problem and reads almost identically.

   ```python
   def _writable_or_404(db: Session, partner_id: str, actor: User) -> Partner:
       partner = get_or_404(db, Partner, partner_id, label="Partner")
       scoping.assert_within_tenant(partner, Partner, actor)   # ← 404, and staff pass through
       return partner
   ```

   One helper per resource, called by every id-taking write, rather than the line repeated five
   times. `assert_within_tenant` returns immediately for `has_admin_access` or a NULL
   `organisation_id`, so this costs staff nothing.

   **404, not 403** — matching the read path. A 403 confirms the row exists, and in a directory that
   discloses a competitor before they are published.

   ⚠️ **It only narrows a real `User`.** `_as_principal` maps anything that is not a `User` or a
   `Principal` straight through, so a hand-rolled test double with an `organisation_id` attribute is
   **not** narrowed and a test built on one passes vacuously. Use a real row.

   The per-row `can_*` predicates stay permission-only on purpose: they feed response flags, which are
   only ever computed for rows the actor could already read, so narrowing them would duplicate the
   guard rather than add one.

---

## 4. Models — SQLAlchemy 2.0 Style

Use the modern typed declarative API. `Mapped[...]` + `mapped_column(...)` only — never the legacy
`Column()` form.

```python
class AdminUser(Base):
    """One-paragraph purpose. Say WHY this table exists, not what the columns are."""

    __tablename__ = "admin_users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
        comment="Inactive admins cannot sign in",
    )
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

### Conventions

| Concern | Rule |
|---------|------|
| Base class | `app/db/base.py` → `class Base(DeclarativeBase)` |
| Table name | plural snake_case, explicit `__tablename__` |
| Primary key | `String(36)` UUID, `default=lambda: str(uuid.uuid4())` |
| Nullability | `Mapped[str]` = NOT NULL; `Mapped[str \| None]` = nullable. Keep `nullable=` explicit so it matches the annotation. |
| Timestamps | `DateTime(timezone=True)`, `default=lambda: datetime.now(timezone.utc)`; add `onupdate=` for `updated_at` |
| Enums | module-level `Enum("a", "b", name="thing_kind")`, reused by the migration |
| Comments | Use `comment=` for anything non-obvious — it lands in the DB and in `\d+` output |
| Derived values | Python `@property` (e.g. `is_super_admin`) — **not queryable in SQL** |
| Relationships | None exist yet. When you add them, be explicit about `back_populates` and loading strategy. |

⚠️ **Never use naive `datetime.utcnow`.** Always `datetime.now(timezone.utc)` with a
`timezone=True` column.

⚠️ **A `@property` cannot be used in `.filter()`.** If you need to query it, make it a real column or
a `hybrid_property`.

### Register every model for Alembic

`app/db/migrations/env.py` imports each model explicitly:

```python
import app.models.user       # noqa: F401
import app.models.admin_user # noqa: F401
```

**A model missing from that list is invisible to `--autogenerate`**, and autogenerate will happily
emit a migration that *drops* nothing and creates nothing. Add the import in the same commit as the
model.

---

## 5. Schemas — Pydantic v2

All request/response models live in `app/schemas/`. **Validation belongs here, not in services.**

### Reading ORM objects

```python
class AdminUserResponse(BaseModel):
    model_config = {"from_attributes": True}   # v2 replacement for orm_mode
    id: str
    email: str
    is_super_admin: bool                       # resolves the @property
```

### Field constraints

```python
class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self
```

### Rules

| Rule | Why |
|------|-----|
| `EmailStr` for every email | Requires `pydantic[email]` — already installed |
| `Field(min_length=…, max_length=…)` mirrors the column width | Rejects at the edge, before the DB complains |
| Cross-field checks use `@model_validator(mode="after")` | Runs once all fields are parsed and typed |
| Closed sets use `Literal` | `AdminRole = Literal["admin", "super_admin"]` — appears in OpenAPI as an enum |
| Update schemas use `X \| None = None` for partial updates | Distinguishes "absent" from "set to null" |
| **Never** include `password` in a response schema | The only reason it doesn't leak today |
| One request schema per operation | Don't reuse a create schema for update |

⚠️ **A `ValueError` in a validator becomes a 422, not a 400.** If a client needs 400, validate in the
service and raise `HTTPException`.

⚠️ **Keep validation consistent across schemas.** The current code isn't: `AdminRegisterRequest`
requires an uppercase letter and a digit, `RegisterRequest` requires only length 8. Don't add a third
standard — consolidate into a shared validator when you touch this.

---

### A response model with required non-column fields needs a route-level test

Added 2026-08-21 after TECH_DEBT PM-48, which took the most important staff screen in the directory
out of service for a day.

```python
# ❌ The assignments run after validation has already failed.
item = ModerationQueueItem.model_validate(listing)
item.partner_name = partner.name          # required on the model, not a column
item.entitlement = ...                    # ditto

# ✅ Attach to the row first, then validate once — same shape as
#    `partner_service.decorate`, which does this for its per-row flags.
listing.partner_name = partner.name
listing.entitlement = ...
items.append(ModerationQueueItem.model_validate(listing))
```

**The testing rule matters more than the ordering rule**, because the ordering mistake is easy to make
again in a different shape. A service can be entirely correct while the endpoint 500s, and unit tests
on the service will all pass — PM-48 sat behind 997 green tests.

It is worse when the route has an early return for the empty case:

```python
if not listings:
    return []          # ← the only path anyone had exercised
```

Then the broken path is the *populated* one, and the failure presents as "nothing to show" rather than
as an error. Any route-level test must therefore use **at least two rows**, so neither an empty-case
early return nor a single-row special case can pass it.

---

## 6. Dependencies

`app/core/dependencies.py` is the only place cross-cutting request concerns are resolved.

```python
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### Rules

1. **Never construct `SessionLocal()` in a router or service.** Always `Depends(get_db)`.
2. **Prefer a declarative guard to an imperative check.** A guard appears in `/docs` and can't be
   forgotten; an `if` inside a service can.
3. **Compose guards** rather than repeating logic:
   ```python
   def require_super_admin(current_admin: AdminUser = Depends(get_current_admin)) -> AdminUser:
       if not current_admin.is_super_admin:
           raise HTTPException(status.HTTP_403_FORBIDDEN, "Super-admin privileges required")
       return current_admin
   ```
4. **Guards raise, never return `None`.** Callers can then treat the value as non-optional.
5. **Assert the token `type` on every decode** — `payload.get("type") != "access"` → 401. This is what
   stops a refresh token being replayed as an access token.

⚠️ `require_admin`, `require_super_admin`, and `get_client_ip` are currently **defined but wired to
no route**. Don't assume an endpoint is gated because a suitable dependency exists — check the
router. See `../core/AUTHORIZATION.md`.

---

## 7. Sessions & Transactions

One module-level engine in `app/db/session.py`:

```python
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,   # discard dead connections instead of failing mid-request
    pool_size=10,
    max_overflow=20,      # 30 connections max
    pool_timeout=30,
    pool_recycle=1800,    # recycle before Postgres/proxy idle timeouts
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

### Rules

- **One session per request**, from `get_db()`, closed in `finally`
- **`autoflush=False`** — flushes are explicit; don't rely on lazy flush ordering

  > **The worked example, because this rule was broken in production code for two days.**
  > `listing_service.update_listing` moved a listing out of `PUBLISHED` and then called
  > `category_service.recount_listings`, which runs a `SELECT COUNT(...) WHERE status =
  > 'PUBLISHED'`. With no autoflush the pending `UPDATE` had not reached the database, so the
  > count query saw the row *as it was before the function ran* and stored that number.
  >
  > It went unnoticed because it was accidentally right: the code recomputed only the listing's
  > **new** category, which stale-read as "does not contain this listing yet" — the correct
  > answer, by luck. The bug surfaced only when a second category was recomputed, where the
  > stale read gave the wrong answer.
  >
  > **The rule in practice:** any read that must observe a write you just made needs a
  > `db.flush()` between them. A denormalised counter recomputed from a query is the shape most
  > likely to hide it, because the wrong answer is a plausible number rather than an error.
  > Fixed 2026-08-20; `tests/test_category_counts.py` pins it.
- **Commit in the service**, once, at the end of the use case
- **`db.refresh(obj)`** after commit if you return the object
- **Reads:** prefer `db.get(Model, pk)` for primary-key lookups (uses the identity map) over
  `.query().filter().first()`
- **Existence:** `db.scalar(select(exists().where(...)))` — don't load a row you're going to discard
- **No nested transactions** anywhere yet. If you need one, use `db.begin_nested()` deliberately and
  document why.

⚠️ **Updated 2026-08-06 (PM-38).** `get_db()` now rolls back **explicitly** on exception before
closing, and `db/session.py` provides `unit_of_work(db)` — commit on success, roll back on anything —
for a flow that writes more than one table:

```python
with unit_of_work(db):
    user = user_service.create_user(db, data, actor)    # must NOT commit inside
    rbac_service.assign_roles(db, user, data.role_ids)  # must NOT commit inside
# one commit here, or nothing at all
```

The original warning's conclusion still holds for anything **not** wrapped: **partial multi-step writes
are not atomic unless you commit once at the end.** The 49 existing `db.commit()` calls across
`app/services/` are single-write and were deliberately left alone, so wrapping a call to one of them
does *not* make it atomic — the nested commit ends the outer transaction and the wrapper becomes
decoration. Move the commit out first.

**`activity_service` stays outside every boundary**, deliberately: it swallows its own exceptions,
because failing a login because an audit write failed turns observability into an outage. Rolling an
audit row back with the operation it records would be the same mistake in the other direction — the
trail would lose exactly the failed operations worth investigating.

---

## 8. Error Handling & Status Codes

| Code | Use for | Example |
|------|---------|---------|
| 200 | Success with a body | Login, update, delete-with-message |
| 201 | Resource created | `register`, `POST /categories` |
| 401 | Not authenticated / bad credentials | Missing cookie, bad password |
| 403 | Authenticated but not permitted | Non-super-admin editing another admin; deactivated account |
| 404 | Target row doesn't exist | `db.get()` returned `None` |
| 409 | Conflicts with existing data | Duplicate email |
| 422 | Schema validation failed | Pydantic (automatic — don't raise it yourself) |
| 400 | Semantically invalid request | Deleting your own account |

### Rules

1. **Don't leak existence through status codes.** Login returns the same 401 for unknown email and
   wrong password. Preserve that.
2. **`detail` is user-facing** — the frontend reads `err.response.data.detail` and shows it. Write it
   as a sentence a user should see, with no internals.
3. **Define the exception once** when reused in a function:
   ```python
   credentials_exc = HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials")
   ```
4. **Catch narrowly:** `except (JWTError, KeyError)`, not bare `except Exception`.
5. **No custom exception handlers exist.** Unhandled exceptions become a plain 500 with no logging.
   If you need observability, that's new infrastructure — say so rather than assuming it's there.

---

## 9. Configuration

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )
    DATABASE_URL: str                        # required — no default
    SECRET_KEY: str                          # required — no default
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

settings = Settings()
```

### Rules

1. **No `os.getenv()` anywhere.** Add a typed field to `Settings` and import `settings`.
2. **Secrets have no defaults** — the app should refuse to start rather than run insecurely.
3. **Non-secrets get sensible defaults.**
4. **`extra="ignore"`** lets one `.env` serve both the app and docker-compose.
5. ⚠️ **`env_file=".env"` is resolved relative to the working directory.** Run uvicorn from
   `backend/` so it finds `backend/.env`. This is why two `.env` files exist — see
   `../ONBOARDING.md` § 3.
6. **Never log or echo secret values.**

---

## 10. Everything Is Synchronous

This is a deliberate, load-bearing choice. `psycopg2-binary` is a **sync** driver; `asyncpg` is not
installed.

| Do | Don't |
|----|-------|
| `def endpoint(...)` | `async def endpoint(...)` |
| `create_engine` / `sessionmaker` | `create_async_engine` / `AsyncSession` |
| `postgresql://` in `DATABASE_URL` | `postgresql+asyncpg://` |

FastAPI runs `def` endpoints in a threadpool, so blocking DB calls don't stall the event loop. An
`async def` endpoint that performs a **sync** DB query **would** block the loop — that's the failure
mode to avoid.

**Do not partially migrate to async.** Mixing the two is worse than either. If async becomes
necessary it is a whole-backend change: driver, engine, sessions, every endpoint, and Alembic's
`env.py`.

---

## 11. Adding a New Resource

Checklist for a resource called `listing`:

- [ ] `app/models/listing.py` — model in SQLAlchemy 2.0 style
- [ ] Add `import app.models.listing  # noqa: F401` to `app/db/migrations/env.py`
- [ ] `alembic revision --autogenerate -m "create listings table"` (from `backend/`)
- [ ] **Read the generated migration** before applying — autogenerate misses enum changes, server
      defaults, and index renames
- [ ] `alembic upgrade head`
- [ ] `app/schemas/listing.py` — `ListingCreate`, `ListingUpdate`, `ListingResponse`
- [ ] `app/services/listing_service.py` — rules, `actor`-based permission checks
- [ ] `app/api/listing.py` — thin router, `prefix="/listings"`, `tags=["listings"]`, guards in the signature
- [ ] `app.include_router(listing.router, prefix="/api")` in `main.py`
- [ ] `frontend/lib/api/listingApi.ts` — client module (never call axios from a component)
- [ ] `frontend/types/index.ts` — matching TypeScript types
- [ ] Entry in `../DAILY_CHANGES.md`

---

## 12. Anti-Patterns That Are Live Today

**Rewritten 2026-08-06.** This section used to list ten anti-patterns "present in the inherited
scaffold" and **nine of the ten no longer existed** — the code they named had been fixed or deleted.
That inverted the section's purpose: instead of *"don't copy this"* it read as a list of current
problems, so a reader either distrusted the file or went looking for code that was not there. The
closed items are recorded in [`../planning/TECH_DEBT.md`](../planning/TECH_DEBT.md) (PM-1, 3, 6, 7, 9,
13, 14, 15) and are not repeated here.

These four are **live**, and each is a mistake this codebase makes easy:

| Anti-pattern | Why it's wrong |
|--------------|----------------|
| Reading `user.permission_names` instead of calling `user.has_permission(p)` | The raw property does **not** apply the super-admin bypass. A check written against it silently **under**-authorises a RootUser/SuperAdmin — and it fails open in the safe direction, so it looks fine until a super admin reports a 403 |
| Filtering a query on a Python `@property` | `User.is_super_admin`, `User.is_locked`, `Role.is_protected`, `User.password_otp_grace` are computed in Python and **cannot** appear in a `.where()`. Join `roles` and filter on `Role.name`, or filter on a real column |
| Post-filtering a paginated query to scope rows | Corrupts the page count and the total — the caller is told there are 40 records and receives 12. Scoping has to reach the SQL (PM-5) |
| A dead column that implies a feature | `users.profile_photo_path` is a `String(2048)` that **nothing writes and nothing reads** — `avatar_url` returns `google_avatar` only, and there is no upload endpoint. This is exactly what PM-6 was about, reappearing on the new table. Either build it or say so in the column comment |

**Two more that are not defects but are load-bearing conventions**, easy to undo by tidying:

| Pattern | Why it must stay |
|---|---|
| `activity_service` swallowing its own exceptions | Failing a login because an audit write failed turns observability into an outage. It commits on its own and never raises — do not "fix" it into the caller's transaction |
| `db.expire_all()` after a bulk `UPDATE` | Objects already loaded in the Session hold pre-UPDATE state, so a caller re-reading one sees the old value. `session_service._revoke_where` does this; any new bulk update needs it too |

---

## Related Documentation

- [`../core/ARCHITECTURE.md`](../core/ARCHITECTURE.md) — layer overview and request lifecycle
- [`../core/AUTHENTICATION.md`](../core/AUTHENTICATION.md) — tokens, cookies, known debt
- [`../core/AUTHORIZATION.md`](../core/AUTHORIZATION.md) — guards and role rules
- [`DATABASE_MIGRATIONS.md`](./DATABASE_MIGRATIONS.md) — Alembic workflow
- [`NEXTJS_STANDARDS.md`](./NEXTJS_STANDARDS.md) — the client that consumes these endpoints

---

## Pending

> **Backend convention work still outstanding.** Last audited **2026-08-06**. Two sections of this file
> — § 7 and § 12 — were overtaken by work on 2026-08-03 and 2026-08-06 and now describe the codebase
> incorrectly. Those corrections are listed last, and they are the most urgent items here, because a
> standards document that is wrong teaches the wrong thing to whoever reads it next.

### 🔴 Conventions that do not exist yet and will be improvised without

- [ ] **PM-40 — no API versioning convention.** All 56 routes mount at `/api`. § 11 *Adding a New
      Resource* will keep producing unversioned routes until the prefix moves to `/api/v1` and § 11 says
      so. Decide before the next resource, not after.
- [ ] **PM-5 — no scoping convention.** § 3 tells a service to take `(db, …, actor)`, and every service
      does — but **nothing says what to do with `actor` for a list query.** The next person writing a
      partner-owned resource has no pattern to copy, so they will invent one. Document the query-level
      predicate (not a post-filter — it corrupts pagination) as a numbered rule in § 3.
- [ ] **No documented pagination contract.** `list_users` is paginated, searchable, filterable and
      sortable, and it is the only example. The shape (`page` / `per_page`, envelope keys, max page
      size, and the stable-sort requirement — the activity log sorts by `id` rather than `created_at`
      precisely because rows sharing a timestamp make an unstable sort put a row on two pages) is
      established in code and written down nowhere.
- [ ] **No idempotency convention for mutating requests.** Nothing prevents a double-submitted
      `POST /api/v1/users` from creating two accounts beyond the email uniqueness constraint that happens
      to catch it. Bulk endpoints have no such backstop.

### 🟠 Adopt what now exists

- [ ] **Use `unit_of_work` for new multi-write flows (PM-38).** Added 2026-08-06 in
      `app/db/session.py`. The 49 existing `db.commit()` calls across 9 services are single-write and
      deliberately left alone — **but do not wrap a call to one of them and assume it became atomic**;
      the nested commit ends the outer transaction and the wrapper becomes decoration. Move the commit
      out first. `activity_service` stays outside every boundary, deliberately: it swallows its own
      exceptions, because failing a login because an audit write failed turns observability into an
      outage.
- [ ] **`ruff` is now the linter and CI runs it.** `backend/pyproject.toml` holds the config; `B008`,
      `B904`, `SIM105`, `UP017` and `B905` are ignored with reasons written at each. This file has no
      § on tooling — add one, and record that **`ruff format` is deliberately not configured** (the
      backend has never been formatted, so enabling it would make reformatting every file a
      prerequisite for the first green build).
- [ ] **`app/db/migrations` is excluded from linting on purpose.** `env.py` is a protected file whose
      import block carries a load-bearing comment; import sorting detached that comment from the list it
      governs. Do not narrow the exclude back to `versions/` only.

### 🟡 Scale and shape

- [ ] **§ 10 *Everything Is Synchronous* is a live constraint, not just a note.** `mail_service` sends
      inside the request; `SMTP_TIMEOUT_SECONDS=10` bounds the block rather than removing it. On a
      synchronous stack every slow send is one fewer request served. A queue is the answer (PM-44), not
      `async def`.
- [ ] **PM-44 — no shared cache, and rate-limit state is an in-process dict.** The pool is sized for one
      process (`pool_size=10, max_overflow=20`); N workers means N pools **and** N × every rate limit.
      Revisit § 7's pool numbers in the same change that adds workers.
- [ ] **`db.expire_all()` after bulk updates is a real pattern with no rule.**
      `session_service._revoke_where` calls it because objects already loaded hold pre-UPDATE state, so
      a caller re-reading one would see it as active. Any new bulk `UPDATE` needs the same, and § 7 does
      not mention it.
- [ ] **PM-11 — no service-layer tests.** The 74 tests added 2026-08-06 cover `core/security.py`,
      `core/config.py` and one pure function in `session_service`. **No service and no router is tested**,
      and services are where this document says the logic lives.

### Documentation accuracy — two sections are now wrong
> **✅ The *Documentation accuracy* items below were cleared on 2026-08-06.** The API-path sweep
> (`/api/…` → `/api/v1/…`, 110 references across 13 current-state docs) and every stale section named
> here have been corrected. They are kept, struck through, as the record of what had drifted and why —
> deleting them would lose the more useful lesson, which is that all of it accumulated in under two
> weeks while the code was being actively improved.
>
> Historical documents were deliberately **not** rewritten: `DAILY_CHANGES.md` and `TECH_DEBT.md`'s
> dated entries still say `/api/…` because that is what was true when they were written, and both now
> carry a note saying so. The four inherited test-platform docs were left alone too — `INDEX.md`
> already marks them untrustworthy.

- [ ] **§ 7's closing ⚠️ is out of date.** It states *"There is **no** `try/except` rollback wrapper
      around requests"* and that a dirty session is discarded by `get_db()`'s `finally`. Since
      2026-08-06 `get_db` rolls back **explicitly** on exception, and `unit_of_work` exists for
      multi-write flows (PM-38). Its conclusion — *"partial multi-step writes are not atomic unless you
      commit once at the end"* — is still true for any flow that does not use `unit_of_work`, so rewrite
      the paragraph rather than deleting it. Also update § 7 *Rules*: "one session per request, closed
      in `finally`" should now say rolled back **and** closed.
- [ ] **§ 12 *Anti-Patterns Already in the Codebase* is stale in nine of its ten rows.** Every one now
      describes code that no longer exists, which inverts the section's purpose from "don't copy this"
      into a list of fixed problems presented as current. Details in the table below.

#### § 12 row by row

| Row | Reality |
|---|---|
| Plaintext password storage | Resolved — bcrypt 12 rounds (PM-1) |
| Token decoding duplicated in routers | Resolved — `decode_typed_token` is the only decoder (PM-13). `whoami` does not exist |
| `except Exception:` in `whoami` | The function is gone |
| Dead dependencies (`require_admin`, `require_super_admin`, `get_client_ip`) | All wired (PM-7) |
| Dead `admin_users` columns | The **table** is gone (PM-6) |
| Privilege check in service instead of a guard | `update_admin_user` / `delete_admin_user` do not exist |
| No role check on admin creation | `register_admin` is gone; `_guard_role_assignment` enforces it (PM-3) |
| Inconsistent password rules | One `validate_password_strength` (PM-14) |
| `PATCH` schemas with required fields | All-optional with `exclude_unset=True` (PM-15) |
| Hardcoded CORS origins | `settings.allowed_origins` (PM-9) |

The tenth row — *"Dead columns suggest features that don't exist"* — is the only one whose **shape** is
still worth keeping, because a live example exists: `users.profile_photo_path` is a `String(2048)` that
**nothing writes and nothing reads** (`avatar_url` returns `google_avatar` only, and there is no upload
endpoint). Same trap PM-6 described, on the new table.

Replace the rest with the anti-patterns that are **actually** live today:

- Reading `permission_names` instead of calling `has_permission` — the raw property does **not** apply
  the super-admin bypass, so this silently under-authorises a super admin.
- Filtering on a Python property (`User.is_super_admin`, `Role.is_protected`, `User.is_locked`) —
  none is a column, so `.filter()` raises. Join `roles` and filter on `Role.name`.
- Post-filtering a paginated query for scoping — it corrupts the page count (PM-5).
