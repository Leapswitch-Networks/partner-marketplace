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
12. [Anti-Patterns Already in the Codebase](#12-anti-patterns-already-in-the-codebase)

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
- `prefix` is the resource path; the `/api` prefix is added once in `main.py`
- `tags` groups the endpoints in `/docs` — always set it

Register in `app/main.py`:

```python
app.include_router(category.router, prefix="/api")
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
- **Commit in the service**, once, at the end of the use case
- **`db.refresh(obj)`** after commit if you return the object
- **Reads:** prefer `db.get(Model, pk)` for primary-key lookups (uses the identity map) over
  `.query().filter().first()`
- **Existence:** `db.scalar(select(exists().where(...)))` — don't load a row you're going to discard
- **No nested transactions** anywhere yet. If you need one, use `db.begin_nested()` deliberately and
  document why.

⚠️ There is **no** `try/except` rollback wrapper around requests. An exception mid-transaction leaves
the session dirty; it's closed by `get_db()`'s `finally`, which discards the transaction. That works,
but it means **partial multi-step writes are not atomic unless you commit once at the end.** Do all
your mutations, then commit.

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

## 12. Anti-Patterns Already in the Codebase

Present in the inherited scaffold. **Don't copy them; don't silently "fix" them either — they're
tracked in `../planning/TECH_DEBT.md`.**

| Anti-pattern | Where | Why it's wrong |
|--------------|-------|----------------|
| Plaintext password storage/comparison | `core/security.py`, `services/auth_service.py` | Accepted debt — see `../core/AUTHENTICATION.md` § Known Debt |
| Token decoding duplicated in routers | `api/auth.py` — `refresh`, `whoami` | Three copies of decode-and-assert logic that `dependencies.py` should own |
| `except Exception:` | `api/auth.py` `whoami` | Swallows real bugs as 401s |
| Dead dependencies | `require_admin`, `require_super_admin`, `get_client_ip` | Look like enforcement, enforce nothing |
| Dead columns | `admin_users` lockout/audit/reset columns | Suggest features that don't exist |
| Privilege check in service instead of a guard | `update_admin_user`, `delete_admin_user` | Invisible in OpenAPI; easy to forget on the next endpoint |
| No role check on admin creation | `services/auth_service.register_admin` | Any admin can mint a `super_admin` |
| Inconsistent password rules | `RegisterRequest` vs `AdminRegisterRequest` | Two standards in one file |
| `PATCH` schemas with required fields | `UpdateProfileRequest` | Behaves like `PUT`; misleading verb |
| Hardcoded CORS origins | `main.py` | Not environment-configurable; deploying needs a code edit |

---

## Related Documentation

- [`../core/ARCHITECTURE.md`](../core/ARCHITECTURE.md) — layer overview and request lifecycle
- [`../core/AUTHENTICATION.md`](../core/AUTHENTICATION.md) — tokens, cookies, known debt
- [`../core/AUTHORIZATION.md`](../core/AUTHORIZATION.md) — guards and role rules
- [`DATABASE_MIGRATIONS.md`](./DATABASE_MIGRATIONS.md) — Alembic workflow
- [`NEXTJS_STANDARDS.md`](./NEXTJS_STANDARDS.md) — the client that consumes these endpoints
