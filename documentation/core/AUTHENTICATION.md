# Partner Marketplace Core — Authentication System

**Rebuilt:** 2026-07-31 · **Status:** implemented and verified, except Google SSO (see § Google)

> Passwords are hashed with **bcrypt**. The plaintext storage this document previously described was
> removed on 2026-07-31 — `verify_password` is now the only comparison in the codebase, and reviving
> a `stored == plain` comparison anywhere is a regression.

---

## Overview

Modelled on LeapDesk's base, adapted for a marketplace that has **external partners** as well as
internal staff. The shape LeapDesk gets right and that is preserved here:

| Control | Effect |
|---|---|
| **Every new account starts `INACTIVE`** | Authenticating proves identity, not authorisation. A valid Google login or a correct password gets you nothing until an administrator approves. |
| **Status re-checked on every request** | Not read from the token. Suspending an account kills live sessions immediately. |
| **Domain gating for staff** | `@leapswitch.com` (configurable) may use Google SSO and is classed as staff. |
| **Credentials checked before status** | A wrong password on a suspended account still returns 401, so the endpoint doesn't reveal that the account exists. |

**The one deliberate divergence from LeapDesk:** LeapDesk refuses every address outside its own
domain. That would block the partners this product exists for, so signup policy is split — see
§ Signup Policy.

---

## One Account Table

`users` + `admin_users` were merged on 2026-07-31 (migration `e7b41c9a2d10`). There is **one** table,
**one** login endpoint, and roles decide capability. Do not add a second identity table for partners —
add a role.

| Concept | Column | Notes |
|---|---|---|
| Who may sign in | `status` | `INACTIVE` \| `ACTIVE` \| `SUSPENDED` — only ACTIVE |
| Staff vs partner | `account_type` | `staff` \| `partner` — drives *signup policy*, never authorization |
| How they sign in | `auth_provider` | `credentials` \| `google`; a `google` account has `password = NULL` |
| What they may do | `roles` → `permissions` | See [`AUTHORIZATION.md`](./AUTHORIZATION.md) |

---

## Signup Policy

Configured, not hardcoded — `STAFF_EMAIL_DOMAINS`, `ALLOW_PARTNER_SELF_REGISTRATION`,
`NEW_USER_DEFAULT_STATUS`.

| Who | Route in | Lands as | Approval needed? |
|---|---|---|---|
| **Staff** (`@leapswitch.com`) | Google SSO, or an invitation | `staff`, role `User` | **Yes** — unless invited |
| **Partner** (anyone else) | `POST /api/auth/register`, or an invitation | `partner`, role `Partner` | **Yes** — unless invited |

Two refusals are load-bearing:

- **A staff-domain address cannot use `/register`** (`400`). Otherwise someone could create a staff
  account with a self-chosen password and bypass SSO entirely.
- **A non-staff address cannot use Google SSO** (`403`). Partners use credentials.

**Invited users skip the approval queue** — an administrator already vouched for the address by
inviting it, so a second approval would be pure friction.

---

## Password Hashing

`app/core/security.py`:

```python
def hash_password(plain: str) -> str:
    salt = bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)   # 12, matching LeapDesk
    return bcrypt.hashpw(_prepare(plain), salt).decode()

def verify_password(plain: str, stored: str | None) -> bool:
    if not stored or not plain:
        return False          # Google-only accounts must not pass on an empty string
    try:
        return bcrypt.checkpw(_prepare(plain), stored.encode())
    except (ValueError, TypeError):
        return False          # malformed digest is a FAILED login, never a pass
```

Three details worth keeping:

1. **bcrypt is used directly, not through passlib.** passlib 1.7.4 reads
   `bcrypt.__about__.__version__`, which bcrypt removed in 4.1 — the pair emits a spurious error on
   import. `passlib` was dropped from `requirements.txt`.
2. **`_prepare` truncates to 72 bytes explicitly**, because bcrypt's limit is 72 and some builds
   raise rather than truncate. Doing it deliberately keeps behaviour identical across versions.
3. **A non-bcrypt digest fails.** There is no plaintext fallback. Existing rows were hashed in place
   by the migration, so this should never trigger; if it does, that account needs a reset.

Password policy is one rule for everyone — `validate_password_strength`: min length (config,
default 8), at least one uppercase letter, at least one digit.

---

## Token & Cookie Design

Unchanged in shape from before, and still sound:

| Cookie | Path | httpOnly | samesite | secure | Lifetime |
|---|---|:---:|:---:|:---:|---|
| `access_token` | `/` | yes | config (`lax`) | **config** | `ACCESS_TOKEN_EXPIRE_MINUTES` (60) |
| `refresh_token` | `/api/auth/refresh` | yes | config (`lax`) | **config** | `REFRESH_TOKEN_EXPIRE_DAYS` (7) |

- Every token carries a `type` claim (`access` \| `refresh`) which is **asserted on every decode**, so
  a 7-day refresh token cannot be replayed as an access token. Verified.
- The refresh cookie is **path-scoped**, so it is never transmitted on ordinary requests.
- `secure` now comes from `COOKIE_SECURE` rather than being hardcoded `False` — it must be `True`
  behind HTTPS (TECH_DEBT PM-2).
- `refresh` re-checks status and **clears both cookies** when the account is no longer ACTIVE, so a
  dead session stops retrying.

---

## Sessions and Revocation

**Added 2026-08-03.** Every token carries a `sid` claim naming a row in `user_sessions`, and the guard
refuses a token whose session is revoked or expired.

### Why this exists

A JWT cannot be un-issued. Until this table existed, `logout` cleared the browser's cookie and did
nothing else — a token captured beforehand stayed valid for the rest of its life, **up to an hour for
access and seven days for refresh**. Three consequences, all real:

- Logging out did not end the session, it just forgot about it.
- `/refresh` minted a new pair while the old refresh token stayed valid, so a stolen one was a
  renewable seven-day credential.
- **Changing your password evicted nobody** — the single action a user takes after a suspected
  compromise did not remove the attacker.

LeapDesk does not have this problem because Laravel sessions are database rows and deleting the row
ends the session. This is the same idea adapted to JWT.

### The rules

| Trigger | Scope | `revoked_reason` |
|---|---|---|
| Logout | that session only | `logout` |
| Password change | every **other** session | `password_change` |
| Password reset completed | **every** session | `password_reset` |
| Admin deactivates / suspends (single or bulk) | every session | `revoked_by_admin` |

**Change spares the current session, reset does not**, deliberately. Someone changing their password
in their own settings is demonstrably holding a live session and should not be thrown out of the tab
they are working in; the point is to evict everyone else. Someone completing a reset link is usually
locked out or recovering from a compromise and may be on a borrowed device, so nothing is spared.

### What it costs, and what it still does not do

- **One extra indexed lookup per authenticated request.** That is the price of revocation: any design
  that can revoke keeps server state somewhere, and the only real choice is where.
- `last_seen_at` is written at most once every 5 minutes, or every authenticated read would become a
  write and a polled endpoint like `/me` would churn the row constantly.
- **`/refresh` reissues rather than rotates.** The session id is carried over, so the previous refresh
  token remains decodable and usable until its own expiry while the session lives. Making a superseded
  token individually dead needs per-token state and reuse detection — recorded as **PM-31**, not
  pretended away. The session check bounds the damage: revoke the session and every token naming it
  dies at once.
- **Tokens minted before this change fail closed** — no `sid`, no entry. Accepting a token without one
  "for compatibility" would have left a permanent bypass of the whole mechanism.
- Session rows are never purged automatically. `session_service.purge_expired()` exists and nothing
  calls it, because there is no scheduler.

`user_sessions` also records `ip_address` and `user_agent` per sign-in, which is what a future "active
sessions" screen would list. `session_service.list_active()` is already written for it.

---

## Login Throttling

The lockout columns are written now — they were dead before (PM-6/PM-8).

```
failed login ──> failed_login_attempts += 1
                   └─ reaches MAX_FAILED_LOGIN_ATTEMPTS (5)?
                        └─ locked_until = now + ACCOUNT_LOCKOUT_MINUTES (15); counter reset
successful login ──> counter = 0, locked_until = NULL, last_login_at/ip recorded
```

While locked, login returns **429** with the remaining minutes. A password reset also clears the
lockout — the legitimate owner has just proved control of the mailbox. An administrator can clear it
with `POST /api/users/{id}/unlock`.

⚠️ This is **per-account**, not per-IP. An attacker can still spray one attempt each across many
accounts — see TECH_DEBT PM-26.

---

## Google SSO

⚠️ **Implemented but never run against Google.** No credentials are configured, so
`settings.google_oauth_configured` is false and the endpoints return `503`. Treat the code as
untested until PM-28 is closed.

Implemented directly with `httpx` (three requests; an SDK would add a dependency for no gain).

```
GET /api/auth/google/authorize   -> { authorization_url }   (or /redirect for a plain <a href>)
        │  browser navigates (MUST be a full navigation — Google blocks cross-origin XHR)
        ▼
Google consent
        │
        ▼
GET /api/auth/google/callback?code=…&state=…
        ├─ verify `state`         signed JWT, 10-min expiry — CSRF defence on the handshake,
        │                         and it carries the optional invitation token
        ├─ exchange code          -> access token -> userinfo
        ├─ require email_verified otherwise an unverified address could claim an existing account
        ├─ require staff domain   `hd` is sent as a hint but re-checked server-side
        ├─ resolve the account    (three steps, below)
        ├─ apply invitation       if `state` carried one and the email matches
        ├─ require ACTIVE         else redirect to /sign-in?error=…
        └─ set cookies, 302 to the frontend
```

### Account resolution — three steps, in order

1. **known `google_id`** → returning user; refresh the avatar
2. **known email** → existing account, **link** the Google identity to it
3. **neither** → create, `INACTIVE`, pending approval

Step 2 is what lets an admin-created or invited account be claimed via SSO without producing a
duplicate.

### Why the callback redirects instead of returning JSON

Google navigates the browser here, so a JSON error body would render as a bare error page. Failures
become `GET {FRONTEND_URL}/sign-in?error=<message>` instead.

---

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | — | Partner self-registration. **Does not sign you in.** |
| POST | `/api/auth/login` | — | Single login for everyone |
| POST | `/api/auth/logout` | — | Unauthenticated on purpose — must work with an expired token |
| POST | `/api/auth/refresh` | refresh cookie | Rotates both cookies; re-checks status |
| GET | `/api/auth/me` | access cookie | Identity + resolved roles + resolved permissions |
| PATCH | `/api/auth/me` | access cookie | Partial profile update. Email is **not** editable here |
| POST | `/api/auth/me/change-password` | access cookie | Requires current password |
| POST | `/api/auth/forgot-password` | — | Always answers identically (no enumeration) |
| POST | `/api/auth/reset-password` | token | 1-hour token; clears lockout |
| POST | `/api/auth/accept-invitation` | token | Partner invitation → ACTIVE + signed in |
| GET | `/api/auth/google/authorize` · `/redirect` · `/callback` | — | SSO |

`whoami`, `admin/login`, `admin/me` and `admin/register` are **gone** — one table, one set of endpoints.

Email is not self-editable because changing it would break the link to a Google account and to any
outstanding invitation. It is an admin action.

---

## Frontend Integration

- **`GET /api/auth/me`** hydrates `authSlice` on mount, and returns `permissions` already resolved —
  with the super-admin bypass expanded server-side into the full catalog, so the UI never needs to
  know that super admins are special. Read it through `usePermissions()`.
- **`axiosInstance`** retries a 401 once through `/api/auth/refresh` and rejects with the *original*
  error on failure. `_retry` prevents a loop. Unchanged and still correct.
- **`middleware.ts`** checks only for cookie *presence*. It is UX, not security — an expired cookie
  passes it and is then rejected by the API.
- **Google SSO must be a full-page navigation** (`window.location.href = url`), never an XHR.

---

## Verification

`scratchpad/verify_auth.sh` exercises 41 checks end to end; all pass as of 2026-07-31. It covers:
login with a pre-migration password, enumeration parity, the approval gate, partner confinement,
self-protection rules, escalation attempts, token-type confusion, lockout, the full invitation
lifecycle, and immediate session death on suspension.

⚠️ It is a shell script, not a test suite. There is still no automated testing (PM-11) — and the auth
surface is now large enough that this is the highest-value remaining gap.

```bash
# Manual smoke
curl -s localhost:8002/health/ready
curl -s -c /tmp/c.txt -X POST localhost:8002/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"…","password":"…"}'
curl -s -b /tmp/c.txt localhost:8002/api/auth/me | python3 -m json.tool
```

---

## Common Issues and Solutions

| Symptom | Cause / Fix |
|---|---|
| 403 "awaiting administrator approval" after registering | Working as designed. An admin must approve, or invite instead. |
| 403 on `/api/auth/me` with a valid-looking cookie | Account is no longer ACTIVE. Status is re-read per request. |
| 429 on login | Account lockout. Wait it out, reset the password, or `POST /api/users/{id}/unlock`. |
| Google sign-in returns 503 | Not configured. Set the three `GOOGLE_*` variables. |
| Google sign-in 403 "limited to @…" | Non-staff address. Partners use credentials. |
| `/api/auth/refresh` 401 with a good session | The refresh cookie is path-scoped to that exact URL. No trailing slash, no proxy rewrite. |
| Change-password 400 on an SSO account | Correct — no password exists to verify. |
| Registration 400 "must sign in with Google" | Staff-domain address on `/register`. Intentional. |
| Registration 422 | Password policy: 8+ chars, one uppercase, one digit. |
| Two accounts for one person | Shouldn't happen — emails are lower-cased on write and lookup. |

---

## Related Documentation

- [`AUTHORIZATION.md`](./AUTHORIZATION.md) — roles, permissions, guards, protection rules
- [`USERS.md`](./USERS.md) — the unified table and the admin endpoints
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — where auth sits in the stack
- [`../planning/TECH_DEBT.md`](../planning/TECH_DEBT.md) — PM-2, PM-4, PM-26, PM-27, PM-28 remain open
