# ADR-0001 — We record architecture decisions in this log

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | Process |

## Context

By 2026-08-18 this project carried 39 documents, 131 commits and a codebase whose module docstrings
explain themselves better than most projects' architecture guides. It was nonetheless possible — and
happening — for a contributor to re-open a settled question, because **no register recorded a
decision as settled.**

`DAILY_CHANGES.md` narrates what changed. `TECH_DEBT.md` tracks what is broken. `planning/*.md`
states intent and warns in its own header that it is not current state. Module docstrings explain one
file to someone who already found it. A question like *"can I use `async def` here?"* had a correct
answer, buried in § 10 of a 540-line standards document, and no index pointing at it.

The pressure that made this urgent is AI contributors. This project's operating contract already
assumes them (root `AGENTS.md` § 2 tiers Opus against Sonnet). A model brings confident defaults from
its training data, and this codebase deliberately contradicts several of them. Every session that
starts without knowing which contradictions are intentional pays for that in rework.

## Decision

We keep an ADR log at [`documentation/ADR.md`](../ADR.md), with one file per record in
`documentation/adr/`. A record states a decision, its status, the alternatives rejected, and **where
the decision is enforced in code**.

Records are **pointers with a status on them**, not re-explanations. Where a module docstring or a
standards section already explains the reasoning well, the record links to it and does not restate
it. Records are never rewritten in place; corrections are appended, dated.

## Alternatives rejected

**Keep relying on module docstrings alone.** They are genuinely good here, which made this tempting.
But a docstring cannot hold a decision spanning six files, and it is unreachable until you already
know the file exists. `core/registry.py`'s import-cycle rule is excellent and invisible to anyone who
has not opened it.

**Put the decisions in `AGENTS.md`.** That file is loaded into *every* session's context. It is
already the reason `documentation/AGENTS.md` is deliberately not imported. Adding fifteen decision
histories would tax every turn to carry material that matters a few times per task.

**A single `ADR.md` holding every record inline.** Simplest, and it was the literal request. Rejected
because `INDEX.md` § For AI Agents already tells readers to load only what the task needs, and one
file of fifteen records would be ~900 lines — read in full or not at all. The register-plus-records
split keeps the index loadable every session and each record loadable on demand.

**A GitHub Discussions or issue-tracker convention.** Decisions would live outside the repo, so a
checkout would not carry them and an offline agent could not read them.

## Consequences

- **Good:** one place to check before re-opening a question, and one place to look when the code
  looks wrong but is not.
- **Cost:** a seventeenth through thirty-third file in a documentation tree that already tracks its
  own file count. `INDEX.md` and `README.md` both had to be updated, and must be kept in step.
- **Cost:** discipline. A register nobody adds to is worse than none, because it looks authoritative
  while going stale.
- **Follow-on:** the root `AGENTS.md` § 6 table should point here. That file is protected and needs
  the owner's approval before it is edited.

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Doc | [`../ADR.md`](../ADR.md) | the register, the process, the index |
| Doc | [`0000-template.md`](0000-template.md) | the shape every record keeps |
| Doc | `documentation/INDEX.md` | routes readers here |

**Nothing automated enforces this** — no CI check asserts that a structural change arrives with a
record. It holds by convention and by review only. A pre-commit or CI rule could plausibly flag a
diff touching `core/` with no ADR change, and that is left as a future option rather than built now.
