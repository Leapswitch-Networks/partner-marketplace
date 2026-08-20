# ADR-0014 — Opus orchestrates and validates; Sonnet subagents implement

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-11 |
| **Recorded** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | Process |

## Context

A large share of this codebase is written with AI assistance, and the work divides unevenly. Some of
it is genuinely mechanical — repetitive CRUD, file moves, string and URL rewrites, boilerplate
routers, schemas and components generated from a spec. Some of it is not: migrations, RBAC, session
handling, `app/core/`, and any shared API boundary, where a plausible-looking mistake is expensive or
silent.

Running the most capable model over all of it is straightforward and costs a great deal per token for
work that does not need the judgement.

## Decision

Split by risk, not by volume.

**The orchestrator keeps for itself:** planning and architecture; writing the precise spec each
subagent works from; the risky code — Alembic migrations and any schema change, RBAC, permissions,
auth, sessions, cookies, `backend/app/core/`, API contracts and shared boundaries, and anything in
the Protected Files list; and **all validation and reconciliation.** It never rubber-stamps a
subagent's output — it verifies before accepting.

**Sonnet subagents take the volume:** bounded, well-specified, mechanical work, handed an explicit
and **non-overlapping** file list. Two workers must never hold the same file, and one atomic refactor
is never split across workers.

**Escalation:** if a subagent's output is wrong twice, or the task turns out to need real judgement,
the orchestrator takes it over rather than burning tokens on rework.

**External agents and local models are not the default.** Prefer in-session subagents — coordinated,
no hand-off, no working-tree collisions. Use an external model only when asked, isolated on its own
git worktree/branch with a disjoint file set; the orchestrator still validates. Treat a local Ollama
model as a text generator — docstrings, seed data, drafts — never an autonomous coding agent.

## Alternatives rejected

**One model for everything.** Simple and expensive. The mechanical majority does not need the
judgement it would be paying for.

**Delegate the risky code too, with careful review.** The review is the expensive part, and reviewing
a migration or an RBAC change properly costs about what writing it costs. The saving is illusory and
the failure mode is a silent authorization hole.

**Parallel agents on shared files with fine-grained coordination.** Merge conflicts and lost writes
in a working tree nobody is watching. Clear boundaries up front are cheaper than coordination
mid-flight.

## Consequences

- **Good:** cost tracks risk, and the security-critical surface has one author.
- **Cost:** the orchestrator must write a genuinely precise spec, and partition files before starting
  — real up-front work.
- **Cost:** validation is non-negotiable and non-trivial. A rubber-stamped subagent diff defeats the
  whole arrangement.
- **Follow-on:** none of this relaxes rule 1 — approved packages chain automatically, **committing
  never does.**

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Contract | root `AGENTS.md` § 2 | the tiering rules, in full |
| Contract | root `AGENTS.md` § 3 | multi-worker execution and file ownership |
| Contract | root `AGENTS.md` § 4 | the verification gate every package passes |
| Contract | root `AGENTS.md` § 1 | protected files; never commit without approval |

Enforcement is entirely by contract — **no tooling checks it.** It holds only as far as each session
follows `AGENTS.md`.
