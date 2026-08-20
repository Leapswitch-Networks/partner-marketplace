# ADR-0015 — The AI assistant is lazily imported and cannot write to the database

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-12 |
| **Recorded** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | AI |

## Context

LeapDesk parity module 9 is an AI assistant that answers staff questions by querying application
data. Two risks arrive with it. First, a model that builds SQL can build the **wrong** SQL, and no
amount of care in a query builder is a guarantee. Second, an SDK dependency imported at module scope
makes the entire application fail to boot when it is missing — for a feature most installs never
enable.

The reference solves the first with a dedicated SELECT-only database user, and calls it *"the only
control that holds if the query builder is ever wrong."*

## Decision

Four boundaries:

1. **A read-only connection.** `backend/app/db/readonly.py` sets
   `default_transaction_read_only = on` for every session it opens. **Postgres enforces it, not our
   code:** an `INSERT`, `UPDATE`, `DELETE`, `CREATE` or `DROP` fails with
   `cannot execute ... in a read-only transaction` whatever SQL reaches it and however it was built.
   The module is explicit about what this does *not* give you — it is the **same database role**, so
   it has the same `SELECT` reach.
2. **Lazy import.** `anthropic` is imported inside `app/ai/client.py`'s functions, not at module
   scope. An install that never enables the assistant never loads the SDK, and a missing SDK fails
   **one endpoint** rather than the whole application at boot. Pinned `anthropic==0.121.0`, written
   against the installed tree rather than from memory.
3. **A deterministic output guard** runs on **every** reply, including replies built purely from
   already-redacted tool output — defence in depth on purpose. It blocks the two things that should
   never appear: credential material, and money quoted in the wrong currency. **PII is deliberately
   not blocked** — this is an internal staff tool and staff legitimately need a customer's email or
   phone number; a guard that redacted them would make the assistant useless for its job. A currency
   mismatch **flags without redacting**, because silently deleting a figure from an answer is worse
   than surfacing one for review.
4. **The SDK's `tool_runner` drives the tool loop**, replacing a hand-written
   `while stop_reason == "tool_use"` loop — the part of an agent integration easiest to get subtly
   wrong, where a missed `tool_result` block is an infinite loop. `stop_reason == "refusal"` is
   checked **before** the content is read, since a refusal carries no assistant text and reading
   `content[0].text` first turns a policy decline into a 500.

## Alternatives rejected

**Reuse `SessionLocal` and rely on the query builder.** One fewer module, and it makes every future
tool's correctness the only thing standing between a model and a write.

**A separate SELECT-only Postgres role.** Strictly better, and it is what the reference does. Not
done here — the module says so plainly rather than implying more isolation than exists. **This is the
obvious next hardening step.**

**Import `anthropic` at module scope.** Conventional, and it couples every install's boot to an
optional feature's dependency.

**Block PII in the guard.** Safer-sounding and it would break the tool's actual purpose.

**Hand-write the tool loop.** More control, and a well-known source of infinite loops.

## Consequences

- **Good:** the strongest control is enforced by the database, not by our code.
- **Cost:** the read-only connection shares the application's role, so its `SELECT` reach is
  unrestricted — **row-level scoping, not the connection, is what limits what it can read.**
- **Cost:** a lazily imported SDK means an import error surfaces at first use rather than at boot.
- **Cost:** `anthropic` is pinned to a version whose `beta_tool` and `tool_runner` are **beta
  surfaces** that can move between minor releases. Upgrading needs a deliberate check.

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Code | `backend/app/db/readonly.py` | the read-only connection, and its stated limits |
| Code | `backend/app/ai/client.py` | lazy import, pinned SDK, refusal handling |
| Code | `backend/app/ai/guard.py` | the deterministic output pass |
| Code | `backend/app/ai/tools.py`, `ai/registry.py` | the tools the model may call |
| Test | `backend/tests/test_ai_safety.py` | asserts the safety behaviour |
| Dependency | `backend/requirements.txt` | `anthropic==0.121.0`, with the lazy-import rationale |
