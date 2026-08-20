# ADR-0011 — Machine callers are principals, never hidden user rows

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-12 |
| **Recorded** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | Authz |

## Context

Everything in the stack was typed `actor: User` — `get_current_user`, `require_permission`, every
function in `data_access_service`, and `activity_service.record`. Then **three independent
requirements in four days** each needed a caller that is not a user row:

| Where | The principal |
|---|---|
| `PARTNER_DIRECTORY_PLAN.md` | the **anonymous** visitor on a public directory |
| PM-5 / `MARKETPLACE_DOMAIN_PLAN.md` | a partner **organisation** as a tenant boundary |
| LeapDesk parity module 10 | a **machine consumer** holding an API token |

`LEAPDESK_PARITY_PLAN.md` § Module 10 explicitly asked for this to be decided once rather than three
times.

## Decision

Introduce `core/principal.py` — a type describing who is making a request when "who" is not always a
person. A machine consumer has no user row, no role and no permissions, **and must never acquire
them.**

Tokens issued to machine consumers are **hashed at rest**, like passwords (commit `0e9f937`).

## Alternatives rejected

**A hidden service `User` per integration.** This is the shortcut the type exists to refuse. It works
immediately — every existing guard, service and audit call keeps its `actor: User` signature
untouched. And it puts machine identities into user lists, RBAC screens and every
`SELECT * FROM users`; **one forgotten filter then turns an integration into a login.** It is the
obvious move under deadline pressure, which is exactly why it is written down as refused.

**Three separate solutions, one per requirement.** What would have happened by default. Three
overlapping notions of "caller" and three places to get scoping wrong.

**Copy the reference.** LeapDesk hangs tokens off an `ApiConsumer` and avoids the service-user
problem — but it applies no data scoping to its API at all, so there was nothing to copy for the
scoping half. This had to be designed rather than ported.

## Consequences

- **Good:** anonymous, organisation and machine callers are one concept, and scoping branches on it
  once — see [ADR-0010](0010-scoping-fails-closed.md).
- **Good:** a leaked consumer token cannot be read back out of the database.
- **Cost:** signatures typed `actor: User` had to widen. `CORE_EXTRACTION_PLAN.md` measures the
  remaining sweep at **258 signatures**, which is why the tenancy rename is sequenced before it.
- **Cost:** two auth paths to keep aligned — session cookie and consumer token.

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Code | `backend/app/core/principal.py` | the type, and the shortcut it refuses |
| Code | `backend/app/services/api_consumer_service.py` | registration and token hashing |
| Code | `backend/app/services/scoping.py` | branches on the principal |
| Test | `backend/tests/test_platform_api.py` | consumer auth and token handling |
| Test | `backend/tests/test_data_access.py` | grants and access paths |
| Doc | `documentation/planning/CORE_EXTRACTION_PLAN.md` | the 258-signature sweep |
