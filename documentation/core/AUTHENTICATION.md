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
| How they sign in | `auth_provider` | `password` \| `google`; a `google` account has `password = NULL` |
| What they may do | `roles` → `permissions` | See [`AUTHORIZATION.md`](./AUTHORIZATION.md) |

---

## Signup Policy

Configured, not hardcoded — `STAFF_EMAIL_DOMAINS`, `ALLOW_PARTNER_SELF_REGISTRATION`,
`NEW_USER_DEFAULT_STATUS`.

| Who | Route in | Lands as | Approval needed? |
|---|---|---|---|
| **Staff** (`@leapswitch.com`) | Google SSO, or an invitation | `staff`, role `User` | **Yes** — unless invited |
| **Partner** (anyone else) | `POST /api/v1/auth/register`, or an invitation | `partner`, role `Partner` | **Yes** — unless invited |

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
| `refresh_token` | `/api/v1/auth/refresh` | yes | config (`lax`) | **config** | `REFRESH_TOKEN_EXPIRE_DAYS` (7) |

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
- **`/refresh` rotates, with reuse detection** (PM-31, added 2026-08-03). Each session records the one
  `jti` currently valid. Presenting a superseded token outside a 30-second grace window **revokes the
  whole session** — if a superseded token is in play, either the client replayed it or somebody else has
  it, and neither should continue. The grace window exists because strict rotation would otherwise sign
  out anyone with two tabs open: the second concurrent refresh presents a token valid microseconds
  earlier and would be judged a replay.
- **Tokens minted before this change fail closed** — no `sid`, no entry. Accepting a token without one
  "for compatibility" would have left a permanent bypass of the whole mechanism.
- Session rows are never purged automatically. `session_service.purge_expired()` exists and nothing
  calls it, because there is no scheduler.

### Active sessions (added 2026-08-03)

`user_sessions` records `ip_address` and `user_agent` per sign-in, and the user can now see and end them:

| Method | Path | Effect |
|---|---|---|
| `GET` | `/api/v1/auth/me/sessions` | The caller's live sessions, newest activity first, with `is_current` |
| `DELETE` | `/api/v1/auth/me/sessions/{id}` | End one. **`404`, not `403`,** for an id that is not yours — `403` would confirm the id exists |
| `POST` | `/api/v1/auth/me/sessions/revoke-others` | "Sign out everywhere else", sparing the current session |

**LeapDesk has no equivalent** — Laravel's session table makes it possible but Fortify does not expose it —
so this is parity-plus rather than a port.

**No password confirmation on any of these, deliberately.** Signing a device out is a defensive act, and
friction in front of "I don't recognise this login" is how people give up on acting on it. The
confirmation gate exists for *weakening* security (disabling 2FA), not for strengthening it.

The UI shows a friendly device name derived from the user-agent — which is **untrusted self-reported text**,
rendered as text and never used for a decision — and offers no sign-out on the current session, since that
would log the user out of the page they are reading with no explanation.

### Admin 2FA reset

`POST /api/v1/users/{id}/reset-two-factor`, surfaced as a per-row action in the Users table and offered only
where `two_factor_enabled` is true. Clears the enrolment **and revokes every session** — if the phone was
stolen rather than lost, clearing only the secret would strip the second factor and leave the attacker
signed in.

---

## Two-Factor Authentication and Password Confirmation

**Added 2026-08-03 (PM-34).** Behavioural port of Laravel Fortify's
`twoFactorAuthentication(['confirm' => true, 'confirmPassword' => true])`, which is what LeapDesk
enables. **There is no Fortify for FastAPI** — `fastapi-users` is the nearest analogue, has no 2FA at
all, and would mean replacing an already-audited auth layer. So it is built directly on `pyotp`.

### Dependencies: one

`pyotp` only. Secret encryption uses **Fernet from `cryptography`**, already present as a
`python-jose` extra, so no separate crypto library. There is **no QR image library** — the API returns
the `otpauth://` URI and the frontend renders it, rather than pulling in `qrcode` + Pillow to draw a
picture the browser can draw itself.

### The three states, and why the middle one exists

```
no secret                    →  2FA off
secret, confirmed_at NULL    →  enrolled but UNPROVEN — 2FA is NOT enforced
secret + confirmed_at        →  2FA on
```

The middle state is Fortify's `confirm => true`, and it prevents a self-inflicted lockout. If storing
a secret were enough to enforce 2FA, anyone who mis-scanned the QR — or scanned it into an app on a
phone they then wiped — would be required to produce codes nothing can generate, with no way back in.
**Verified:** while enrolment is pending, login still succeeds without a code.

### Endpoints

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Returns `{two_factor_required, challenge_token}` and **no cookies** when 2FA is on |
| `POST` | `/api/v1/auth/two-factor-challenge` | Exchange the token + a TOTP **or** a recovery code for a session |
| `GET` | `/api/v1/auth/me/two-factor` | Status, including `pending_confirmation` and codes remaining |
| `POST` | `/api/v1/auth/me/two-factor` | Begin enrolment — **password confirmation required** |
| `POST` | `/api/v1/auth/me/two-factor/confirm` | Prove a code; this is what enables it |
| `DELETE` | `/api/v1/auth/me/two-factor` | Disable — **password confirmation required** |
| `POST` | `/api/v1/auth/me/two-factor/recovery-codes` | Regenerate — **password confirmation required** |
| `POST` | `/api/v1/auth/me/confirm-password` | Re-prove the password |

### Design decisions

- **The challenge token carries `type: "two_factor"` and no `sid`.** `_decode_access_token` asserts
  `type == "access"`, which is the only thing between "passed the password" and "authenticated" — so it
  must never be relaxed to accept several types. Verified: the challenge token returns `401` at `/me`.
- **The TOTP secret and recovery codes are encrypted at rest.** In the clear, anyone with a database
  dump — a backup on a laptop, a restored snapshot, a reporting replica — can mint valid codes for every
  account with 2FA, and the second factor silently becomes no factor. Laravel encrypts these columns for
  the same reason.
- **Recovery codes are single-use, by deletion.** Eight at enrolment, each removed the moment it is
  used, so a code read over a shoulder is worth one login at most. Shown exactly once — the columns hold
  ciphertext and nothing decrypts them for display.
- **A wrong code counts against the same lockout the password uses.** A separate counter would hand an
  attacker who already knows the password a fresh, independent budget of guesses at the second factor —
  precisely the position 2FA exists to make hopeless.
- **`/two-factor-challenge` and `/me/confirm-password` are in the rate limiter's `sensitive` tier.** A
  six-digit code is one in a million per guess, which is only strong while guesses are limited.
- **Password confirmation is stored per session**, on `user_sessions.password_confirmed_at`, not on the
  user. It means "this browser proved it knows the password recently"; on the user, a confirmation from
  a laptop would authorise a sensitive action from a phone. Default window 180 minutes, matching
  Laravel.
- **Disabling 2FA requires password confirmation, and that is the whole point of the gate.** Without it,
  someone holding a stolen session could quietly remove the factor protecting the account.

### ⚠️ Rotating `SECRET_KEY` breaks 2FA for everyone

The encryption key is derived from `SECRET_KEY` via HKDF. Rotating that secret makes every stored TOTP
secret and recovery code undecryptable, and **every enrolled user must re-enrol**. `decrypt` returns
`None` rather than raising, which callers treat as "no secret" — so the failure is a refused code, not a
500. Rotation already invalidates every token and signs everyone out, so it was never routine; this
raises the stakes. The alternative — a separate `ENCRYPTION_KEY` — trades this for a second secret to
manage and lose.

### Verified 2026-08-03, full lifecycle against the running stack

Enrol refused with `403` until the password was confirmed · wrong password `422` · enrolment returned a
secret, an `otpauth://` URI and 8 codes · pending state reported `enabled=false` and **login still
worked without a code** · wrong confirm code `422`, real code enabled it · login then returned
`two_factor_required` with **zero `Set-Cookie` headers** · the challenge token was refused at `/me` ·
wrong TOTP `401`, real TOTP produced a working session · a recovery code signed in and dropped the count
8 → 7 · **reusing that code returned `401`** · disable `403` without confirmation and `200` with it,
clearing the secrets · login returned to normal afterwards.

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
with `POST /api/v1/users/{id}/unlock`.

⚠️ This is **per-account**, not per-IP. An attacker can still spray one attempt each across many
accounts — see TECH_DEBT PM-26.

---

## Google SSO

⚠️ **Implemented but never run against Google.** No credentials are configured, so
`settings.google_oauth_configured` is false and the endpoints return `503`. Treat the code as
untested until PM-28 is closed.

Implemented directly with `httpx` (three requests; an SDK would add a dependency for no gain).

```
GET /api/v1/auth/google/authorize   -> { authorization_url }   (or /redirect for a plain <a href>)
        │  browser navigates (MUST be a full navigation — Google blocks cross-origin XHR)
        ▼
Google consent
        │
        ▼
GET /api/v1/auth/google/callback?code=…&state=…
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
| POST | `/api/v1/auth/register` | — | Partner self-registration. **Does not sign you in.** |
| POST | `/api/v1/auth/login` | — | Single login for everyone |
| POST | `/api/v1/auth/logout` | — | Unauthenticated on purpose — must work with an expired token |
| POST | `/api/v1/auth/refresh` | refresh cookie | Rotates both cookies; re-checks status |
| GET | `/api/v1/auth/me` | access cookie | Identity + resolved roles + resolved permissions |
| PATCH | `/api/v1/auth/me` | access cookie | Partial profile update. Email is **not** editable here |
| POST | `/api/v1/auth/me/change-password` | access cookie | Requires current password |
| POST | `/api/v1/auth/forgot-password` | — | Always answers identically (no enumeration) |
| POST | `/api/v1/auth/reset-password` | token | 1-hour token; clears lockout |
| POST | `/api/v1/auth/accept-invitation` | token | Partner invitation → ACTIVE + signed in |
| GET | `/api/v1/auth/google/authorize` · `/redirect` · `/callback` | — | SSO |

`whoami`, `admin/login`, `admin/me` and `admin/register` are **gone** — one table, one set of endpoints.

Email is not self-editable because changing it would break the link to a Google account and to any
outstanding invitation. It is an admin action.

---

## Frontend Integration

- **`GET /api/v1/auth/me`** hydrates `authSlice` on mount, and returns `permissions` already resolved —
  with the super-admin bypass expanded server-side into the full catalog, so the UI never needs to
  know that super admins are special. Read it through `usePermissions()`.
- **`axiosInstance`** retries a 401 once through `/api/v1/auth/refresh` and rejects with the *original*
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
curl -s -c /tmp/c.txt -X POST localhost:8002/api/v1/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"…","password":"…"}'
curl -s -b /tmp/c.txt localhost:8002/api/v1/auth/me | python3 -m json.tool
```

---

## Common Issues and Solutions

| Symptom | Cause / Fix |
|---|---|
| 403 "awaiting administrator approval" after registering | Working as designed. An admin must approve, or invite instead. |
| 403 on `/api/v1/auth/me` with a valid-looking cookie | Account is no longer ACTIVE. Status is re-read per request. |
| 429 on login | Account lockout. Wait it out, reset the password, or `POST /api/v1/users/{id}/unlock`. |
| Google sign-in returns 503 | Not configured. Set the three `GOOGLE_*` variables. |
| Google sign-in 403 "limited to @…" | Non-staff address. Partners use credentials. |
| `/api/v1/auth/refresh` 401 with a good session | The refresh cookie is path-scoped to that exact URL. No trailing slash, no proxy rewrite. |
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

---

## Pending

> **Authentication work still outstanding.** Last audited **2026-08-06**. The feature set here is close
> to complete — hashing, sessions, rotation with reuse detection, 2FA, lockout, verification,
> invitations, SSO. What remains is mostly *unverified*, *unreachable from the UI*, or *operational*.

### 🟠 Implemented but never proven against the real thing

- [ ] **PM-28 — Google SSO has never run against Google.** The whole flow exists (signed `state`, code
      exchange, `email_verified` check, domain gate, three-step account resolution) and
      `settings.google_oauth_configured` is false, so the endpoints return `503`. **Treat this code as
      untested.** Needs an OAuth client, then `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` /
      `GOOGLE_REDIRECT_URI=http://localhost:8002/api/v1/auth/google/callback`, then walk the flow.
- [ ] **Email deliverability is unproven.** The SMTP protocol path was verified against a purpose-built
      fake relay, so *sending* works. **Nothing has ever landed in a real inbox** — SPF, DKIM and DMARC
      are unconfigured, and authentication against a real provider is untested. The protocol is proven;
      deliverability is not.
- [ ] **The `accept_url`-withheld branch was never exercised live.** `smtp` + successful send →
      `accept_url: null` is a two-term boolean asserted by reading, not by running.

### 🟠 Backend exists, no way for a user to reach it

- [ ] **PM-34 — 2FA has no frontend for enrolment.** Five endpoints work and
      `TwoFactorSettings.tsx` / `TwoFactorChallenge.tsx` exist, but confirm the whole path is wired end
      to end — enrol → scan → confirm → recovery codes → sign out → challenge → recover. This is the
      feature most likely to lock a real user out if a step is missing.
- [ ] **`GET /api/v1/activity/export` has no UI button.** It is an API call only. Note it also needs
      `LONG_TIMEOUT_MS` from `lib/api/axiosInstance.ts` — the 5s default kills a working export.

### 🟡 Operational and lifecycle

- [ ] **`SECRET_KEY` rotation is destructive and has no procedure.** Rotating it signs everyone out
      **and permanently breaks 2FA for every enrolled user**, because TOTP secrets are Fernet-encrypted
      with a key derived from it — see § *Rotating `SECRET_KEY` breaks 2FA for everyone*. A real
      rotation must re-encrypt those secrets under the new key inside one transaction. Write the
      procedure before anyone needs it in an incident.
- [ ] **PM-4 — the four inherited accounts still hold pre-migration passwords.** Those values were
      stored readable before migration `e7b41c9a2d10` hashed them in place. **Rotate them.** The code
      is fixed; the credentials are still historically exposed.
- [ ] **`MAIL_BACKEND=console` must never reach a deployed environment.** It writes password-reset
      links — live credentials — to the log. **Now enforced**: `APP_ENV=production` refuses to boot on
      it (PM-37). No further code needed; the pending part is remembering to set `APP_ENV`.
- [ ] **Sends are synchronous.** A slow relay holds the worker; `SMTP_TIMEOUT_SECONDS` bounds it at 10s
      rather than removing it. A queue is the real answer if invitation volume grows (PM-44).
- [ ] **No email HTML or branding.** Plain text, which every client renders and nothing can break.
      A product decision, not a defect.

### 🟡 Hardening not yet designed

- [ ] **No CSRF token.** `samesite=lax` is the only protection. It is adequate while the frontend and
      API are same-site; it is **not** if `COOKIE_SAMESITE` ever becomes `none` for a split-origin
      deployment. Decide alongside the topology question, not after it.
- [ ] **Rate-limit counters are per process (PM-44).** N workers multiply every limit by N and a
      restart clears them. Today this is a speed bump against spraying, **not** an authorisation
      control — and per-IP limiting does nothing against a botnet, which is what the per-account
      lockout is for. The two are complements; neither replaces the other.
- [ ] **`TRUST_PROXY_HEADERS` must be enabled in the same change that deploys a proxy — never before.**
      Enabling it without one restores a measured bypass exactly: 14 requests through a limit of 10.
      Deliberately left as a warning rather than auto-corrected by PM-37's validator.
- [ ] **PM-11 — no test covers a full login round trip.** The 74 tests added 2026-08-06 cover token
      *types*, refresh *classification* and password *hashing* as pure logic. Nothing exercises
      `POST /login` → cookie → `/me` → `/refresh` → `/logout` against a database. That is the next
      suite, and it is the one that would have caught the `set_auth_cookies` signature mismatch on the
      invitation path — which was found by reading the file, not by a test.
