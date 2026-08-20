# Architecture Decision Records

> **The register of decisions that are settled.** One line each below; one file each in
> [`adr/`](adr/). If a decision is listed here as **Accepted**, it is not an open question — build on
> it, or supersede it deliberately. Do not quietly re-open it.
>
> Read this file. Read a *record* only when you are about to touch the thing it decides.

---

## Why this register exists

This project already documents its reasoning unusually well — but it did so in four places, and
**none of them can answer "is this settled?"**

| Register | Answers | Cannot answer |
|----------|---------|---------------|
| `DAILY_CHANGES.md` | *What changed, and when* | Whether a choice is still binding — it is a narrative, newest-first, and never revisits |
| `planning/TECH_DEBT.md` | *What is broken* | Anything about a decision that is working as intended |
| `planning/*.md` | *What we intend to do* | Current state — the file's own header says it is intent, not reality |
| Module docstrings | *Why this file is written this way* | Anything cross-cutting, and nothing at all before you already know which file to open |

Module docstrings are the strongest of the four and this register does **not** replace them.
`core/registry.py`, `core/query.py`, `core/principal.py` and `services/scoping.py` carry better
reasoning than most ADRs would. The gap is that you have to already know the file exists to find it,
and a decision spanning six files belongs to none of them.

**So an ADR here is a pointer with a status on it**, not a re-explanation. Every record ends with
*Where this is enforced* — the code, test and doc that make the decision real. If a record and the
code disagree, **the code is right and the record is stale**; fix the record and say so in it.

### What this buys an agent, concretely

An assistant with recent training data will, unprompted and in good faith, write `async def`
endpoints, reach for `passlib`, add a generic `CRUDBase`, hand an integration its own hidden `User`
row, write `if actor is None: return stmt`, or run `npm run build` in the dev container. Every one of
those is already decided against here, with the reason and the blast radius. **Checking this file
costs one read; each of those mistakes costs a debugging session or a data leak.**

---

## What earns an ADR

A decision earns a record when it is **hard to reverse**, **cross-cutting**, or **surprising** —
ideally when it is more than one of those.

**Yes:**

- It constrains code that has not been written yet ("everything is synchronous")
- Undoing it means touching many files, or a migration
- A competent person — or model — would reasonably do the opposite by default
- It was contested, and the losing option is still tempting
- It is a security boundary whose failure mode is silent

**No — these belong elsewhere:**

| Not an ADR | Where it goes |
|------------|---------------|
| A bug, or a known defect | `planning/TECH_DEBT.md` |
| What shipped today | `DAILY_CHANGES.md` |
| What we plan to build | `planning/*.md` |
| A naming or formatting convention | `system-design/*_STANDARDS.md` |
| Why one function is written that way | The module's own docstring |

When in doubt: if the answer to *"why is it like this?"* is interesting a year from now, write the
record.

---

## Statuses

| Status | Meaning |
|--------|---------|
| **Accepted** | Binding. Build on it. Changing it requires a superseding record, not an edit |
| **Superseded** | Replaced. Kept verbatim, with a link forward. **Never delete a record** — the fact that we once decided otherwise is the point |
| **Proposed** | Written down, not yet agreed. Not binding on anyone |
| **Deprecated** | No longer applied, but nothing replaced it |

A record's text is **not rewritten when reality moves on.** It is a record of what was decided and
what was known at the time. Corrections go in a dated note at the bottom of the record — the same
convention `TECH_DEBT.md` and the root `AGENTS.md` already use, and for the same reason: a log you
edit in place cannot be trusted for the one question it exists to answer.

---

## Writing one

1. **Number it next**, zero-padded, never reuse a number — even for an abandoned draft.
2. **Name the file** `adr/NNNN-short-kebab-title.md`. The title states the decision, not the topic:
   *"SQLAlchemy stays synchronous"*, not *"Database driver"*.
3. **Copy [`adr/0000-template.md`](adr/0000-template.md).** Keep every heading.
4. **Fill *Alternatives rejected* honestly.** A record with no rejected alternative is a note, not a
   decision — and the rejected option is the half a future reader actually needs.
5. **Fill *Where this is enforced* with real paths.** A test that fails when the decision is violated
   is worth more than a paragraph. Say so when one exists — and say so when one does not.
6. **Add the row to the index below**, and to `INDEX.md`.
7. **Log it in `DAILY_CHANGES.md`** in the same change, per root `AGENTS.md` rule 9.

To change a decision: write a **new** record, set the old one to **Superseded** with a link forward,
and link back from the new one. Two edits, both small, and the history survives.

---

## The index

**Records 0001–0015 were written on 2026-08-18**, retroactively, from the code and the commit
history — not from memory. The *Date* column is when the decision was **made**, as evidenced by the
commit named in the record; the decisions predate this register. Each was verified against the code
as it stands today before being written down. Where a record asserts something is enforced, that
path was opened and checked.

**ADR-0016 is different**: it records a decision taken *on* 2026-08-18, in the same change that
applied it. It is the first record written the way the rest are meant to be — alongside the work,
not after it.

| # | Decision | Status | Date | Area |
|---|----------|:------:|------|------|
| [0001](adr/0001-record-architecture-decisions.md) | We record architecture decisions in this log | Accepted | 2026-08-18 | Process |
| [0002](adr/0002-keep-the-inherited-scaffold.md) | Keep the inherited scaffold's stack and structure, replace only the product | Accepted | 2026-07-30 | Project |
| [0003](adr/0003-sqlalchemy-stays-synchronous.md) | SQLAlchemy stays synchronous — `def` endpoints, psycopg2, no asyncpg | Accepted | 2026-07-30 | Backend |
| [0004](adr/0004-pin-next-14-react-18.md) | Pin Next.js to 14.2.35 and React to 18.3.1 | Accepted | 2026-07-31 | Frontend |
| [0005](adr/0005-bcrypt-directly-not-passlib.md) | Hash with bcrypt directly, never through passlib | Accepted | 2026-07-31 | Auth |
| [0006](adr/0006-httponly-cookies-and-server-side-sessions.md) | Auth rides an httpOnly cookie backed by a server-side session table | Accepted | 2026-08-03 | Auth |
| [0007](adr/0007-rbac-vocabulary-lives-in-code.md) | The RBAC vocabulary lives in code and is seeded into the database | Accepted | 2026-07-31 | Authz |
| [0008](adr/0008-core-domain-registration-seam.md) | The domain registers into the core; the core never imports the domain | Accepted | 2026-08-17 | Architecture |
| [0009](adr/0009-shared-list-pipeline-no-crud-base-class.md) | One shared list pipeline and one fetch-or-404 — but no CRUD base class | Accepted | 2026-08-07 | Backend |
| [0010](adr/0010-scoping-fails-closed.md) | Row-level scoping fails closed, in SQL, with 404 and never 403 | Accepted | 2026-08-17 | Authz |
| [0011](adr/0011-machine-callers-are-principals.md) | Machine callers are principals, never hidden user rows | Accepted | 2026-08-12 | Authz |
| [0012](adr/0012-frontend-types-generated-from-openapi.md) | Frontend types are generated from a committed OpenAPI document | Accepted | 2026-08-07 | Contract |
| [0013](adr/0013-compose-is-development-only.md) | Docker Compose is development-only, and the dev container never builds | Accepted | 2026-07-31 | Infra |
| [0014](adr/0014-opus-orchestrates-sonnet-implements.md) | Opus orchestrates and validates; Sonnet subagents implement | Accepted | 2026-08-11 | Process |
| [0015](adr/0015-ai-assistant-boundaries.md) | The AI assistant is lazily imported and cannot write to the database | Accepted | 2026-08-12 | AI |
| [0016](adr/0016-one-agent-contract.md) | One agent contract, at the repository root | Accepted | 2026-08-18 | Process |

---

## Where this sits

Root [`AGENTS.md`](../AGENTS.md) is the **operating contract** — the rules you may not violate,
always in context, and since 2026-08-18 the *only* agent contract in the repository
([ADR-0016](adr/0016-one-agent-contract.md)). This register is the **decision history** — why the
codebase is shaped the way it is, read when you are about to change that shape.

They do not overlap, by design. `AGENTS.md` § 4 tells you never to run `npm run build` in the dev
container; [ADR-0013](adr/0013-compose-is-development-only.md) records why that is true, what was
rejected, and what changing it would cost. **The contract states the rule; the record holds the
reasoning.** When a rule in `AGENTS.md` earns a "but why?", the answer belongs here rather than as
another paragraph in a file every session loads in full.

The four lowercase files in `documentation/` (`architecture.md`, `instruction.md`, `phases.md`,
`planning.md`) describe a **deleted** product. Nothing in this register cites them, and nothing
should.
