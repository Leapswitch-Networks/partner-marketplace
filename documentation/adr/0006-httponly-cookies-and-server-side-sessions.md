# ADR-0006 — Auth rides an httpOnly cookie backed by a server-side session table

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-03 |
| **Recorded** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | Auth |

## Context

The scaffold issued JWTs and trusted them until they expired. A line-by-line audit against the
LeapDesk reference on **2026-08-03** found enforcement coverage was already complete — every route
gated, every ungated one deliberately public — and that the real gap was **revocation**. A stateless
JWT cannot be withdrawn: a compromised token, a fired employee or a stolen laptop stays valid until
it expires, and shortening the expiry to compensate degrades every ordinary session.

Separately, storing the token where JavaScript can read it makes any XSS a credential theft.

## Decision

Three parts, decided together:

1. **The token travels in an `httpOnly` cookie**, not in `localStorage` and not in a header the
   frontend manages.
2. **A `user_sessions` table backs it**, so a session can be revoked server-side — by the user, by an
   admin, or by the system. Commit `ab9bac1`.
3. **Refresh tokens rotate, with reuse detection.** A refresh reissues rather than re-serves, and
   presenting a refresh token twice is treated as theft (PM-31, commit `f0e6243`).

**The consequence that catches people** is a frontend rule, recorded in the root operating contract's
layer table: an `httpOnly` cookie **cannot be forwarded from a Next.js server component**. Therefore
authenticated data is fetched **client-side**, and only public data is fetched server-side via
`INTERNAL_API_URL`. Getting the two backwards **fails silently** — the server component renders with
no data rather than erroring.

## Alternatives rejected

**Bearer token in `localStorage`.** The default shape in most SPA tutorials, and it makes
server-side rendering of authenticated pages easy. Rejected: any XSS becomes full account takeover,
and it still does not solve revocation.

**Stateless JWTs with a short expiry.** Cheap, no table, no lookup. Rejected because "short" is a
trade against usability and never actually reaches zero — there is always a window, and the audit
named revocation specifically.

**A denylist of revoked tokens instead of a session table.** Solves revocation alone, but gives no
session inventory — no "sign out my other devices", no admin view of active sessions, no lifetime
policy. The table gives all three for the same lookup cost.

## Consequences

- **Good:** sessions are revocable, enumerable and manageable; the admin 2FA reset and
  active-session screens exist because of this table.
- **Cost:** a database read on authenticated requests, and a table to maintain and prune.
- **Cost:** **authenticated pages cannot be server-rendered with data.** This is a permanent
  architectural constraint on the frontend, not a temporary one, and it is the source of the
  silent-failure trap above.
- **Follow-on:** the public directory surface, when it is built, is the one place server-side
  fetching applies — via `SERVER_API_BASE_URL` in `frontend/lib/utils/constants.ts`.

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Code | `backend/app/models/user_session.py` | the `user_sessions` table |
| Code | `backend/app/services/session_service.py` | issue, revoke, prune |
| Code | `backend/app/core/security.py` | typed token decode (PM-13) |
| Test | `backend/tests/test_refresh_rotation.py` | rotation and reuse detection |
| Test | `backend/tests/test_session_lifetime.py` | lifetime policy |
| Test | `backend/tests/test_token_types.py` | a token of the wrong type is refused |
| Code | `frontend/lib/utils/constants.ts` | `SERVER_API_BASE_URL` vs the browser base URL |
| Contract | root `AGENTS.md` § 5 | the client-side / server-side split |
| Doc | `documentation/core/AUTHENTICATION.md` | the full auth story |
