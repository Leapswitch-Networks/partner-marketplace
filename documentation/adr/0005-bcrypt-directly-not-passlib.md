# ADR-0005 — Hash passwords with bcrypt directly, never through passlib

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-07-31 |
| **Recorded** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | Auth |

## Context

The inherited scaffold **stored and compared passwords in plaintext** (`TECH_DEBT.md` PM-1). Fixing
that on 2026-07-31 meant choosing a hashing library, and the reflexive answer in Python is
`passlib.context.CryptContext` — it is what nearly every FastAPI tutorial uses, including the
official one.

`passlib` 1.7.4 reads `bcrypt.__about__.__version__`. **`bcrypt` removed that attribute in 4.1.** The
pair therefore emits a spurious `error reading bcrypt version` trap on import — noise at startup that
looks like a real fault and is not.

## Decision

Use the `bcrypt` package's own `hashpw`/`checkpw` directly. No passlib. Pinned `bcrypt==4.3.0`.

`backend/app/core/security.py` owns this, and its docstring carries two standing rules:

1. Plaintext storage must not be reintroduced.
2. **`verify_password` is deliberately the only place a supplied password meets a stored value.**
   Never write `stored == plain` anywhere else.

Cost is configurable via `BCRYPT_ROUNDS`, defaulting to **12** — matching the LeapDesk reference this
project ports from. `verify_password` returns `False` rather than raising when an account has no
password at all, because Google-only users have `password = NULL` and must not be able to sign in
with an empty string.

## Alternatives rejected

**passlib's `CryptContext`.** The default choice, and it would have worked — after suppressing a
warning caused by a library incompatibility that neither project intends to fix. It buys algorithm
agility we do not currently need, at the cost of a dependency that is already misbehaving.

**Argon2.** Stronger on paper. Rejected for parity: the reference implementation uses bcrypt at cost
12, and matching it keeps hashes portable between the two systems.

## Consequences

- **Good:** one fewer dependency, no import-time noise, and a single choke point for password
  comparison that is easy to audit and easy to test.
- **Cost:** no built-in rehash-on-login upgrade path — that would have to be written by hand if the
  cost factor changes.
- **Outstanding, and not closed by this decision:** credentials that existed **before** the
  2026-07-31 rebuild were readable in plaintext at the time. Those passwords should be rotated. This
  is the one live remnant of PM-1; the root `AGENTS.md` restates it.

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Code | `backend/app/core/security.py` | `hash_password` / `verify_password`, and the docstring rule |
| Test | `backend/tests/test_password_hashing.py` | asserts the hashing behaviour |
| Config | `backend/app/core/config.py` `BCRYPT_ROUNDS` | cost factor, default 12 |
| Dependency | `backend/requirements.txt` | `bcrypt==4.3.0`, with the passlib incompatibility in a comment |
| Doc | `documentation/core/AUTHENTICATION.md` | the auth story end to end |

## Notes

- **2026-08-17** — the root `AGENTS.md` previously described plaintext passwords as accepted debt.
  That line was stale by two and a half weeks and has been struck through. Passwords have been hashed
  since 2026-07-31. **Do not re-report plaintext storage as a discovery.**
