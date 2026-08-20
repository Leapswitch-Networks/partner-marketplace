# ADR-0002 — Keep the inherited scaffold's stack and structure; replace only the product

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-07-30 |
| **Recorded** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | Project |

## Context

Partner Marketplace did not start empty. On **2026-07-30** the folder was renamed off a working
logic-test / recruitment platform, and the question was what to do with what was already there: a
Next.js + FastAPI + PostgreSQL application with authentication, an admin shell, a folder layout and a
migration chain — all of it built for a product we were not going to build.

The two obvious moves were to start clean, or to keep the whole thing and grow the new product
inside it.

## Decision

**Keep the tech stack and the folder structure; delete the product.** The scaffold's Next.js/FastAPI
/PostgreSQL choice, its `app/api` · `app/services` · `app/models` layering and its frontend layout
were adopted as-is. The inherited test/question/candidate domain — code, RBAC rows and database
tables — was **deleted on 2026-08-06** (commit `9af9e9a`).

Nothing was stripped from the documentation folder. The four inherited lowercase files
(`architecture.md`, `instruction.md`, `phases.md`, `planning.md`) were kept as a record of the
scaffold's intent, and are marked untrustworthy wherever they are listed.

## Alternatives rejected

**Greenfield.** Rebuilding auth, RBAC, migrations, containers and an admin shell would have cost
weeks to arrive at a worse version of something already working and already debugged.

**Keep the inherited domain and adapt it.** Tests, questions and candidates do not deform into
partners, tiers and listings. Adapting would have left the old vocabulary in table names, permission
strings and route paths permanently.

**Delete the inherited docs too.** Tempting, and it would have removed a whole class of confusion.
Rejected because the scaffold's original intent is occasionally the only explanation for why
something is shaped the way it is — but this is the decision with the highest ongoing cost, see
below.

## Consequences

- **Good:** a working authenticated application on day one, and 131 commits later the layering
  choice has held.
- **Cost:** **stale identity leaks for months.** The database is still named `test_platformDB`. The
  root `README.md` was wrong in twelve places (PM-12). `TECH_DEBT.md` PM-21 tracks the naming
  residue. The root `AGENTS.md` still has to say, in bold, *never call this a test/assessment
  platform* — because the folder's history says otherwise and every fresh reader infers it.
- **Cost:** the four inherited docs are a permanent trap. Three separate documents now carry a
  warning about them, which is itself evidence of the cost.
- **Follow-on:** because the inherited *code* is gone as of 2026-08-06, those four documents are the
  only trace of the old product left — which makes the warnings more necessary, not less.

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Doc | `documentation/INDEX.md` § Read This First | the trust table — which docs describe a dead product |
| Doc | `documentation/planning/SCAFFOLD_CLEANUP_PLAN.md` | what the deletion covered; tier 1 housekeeping remains |
| Doc | `documentation/planning/TECH_DEBT.md` PM-21 | the naming residue, ranked |
| Contract | root `AGENTS.md` § 0 | forbids describing this as a test platform |

Enforcement is documentary. **No test asserts the old vocabulary is gone**, and the database name is
still the inherited one.
