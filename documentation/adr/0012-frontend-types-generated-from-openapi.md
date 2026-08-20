# ADR-0012 — Frontend types are generated from a committed OpenAPI document

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-07 |
| **Recorded** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | Contract |

## Context

The backend defines every request and response with Pydantic v2 schemas. The frontend consumed those
shapes through hand-written TypeScript interfaces. Two definitions of one contract drift, and they
drift **silently** — TypeScript happily type-checks against a description of an API that no longer
exists, and the failure surfaces at runtime as an undefined field.

This was not hypothetical. Asserting twelve more response schemas later found real drift already
present (commit `1a448c1`).

## Decision

FastAPI's OpenAPI document is **committed** as `backend/openapi.json`, and
`frontend/types/api.d.ts` is **generated from it** with `openapi-typescript`. Both files are tracked
in git.

`npm run codegen:check` regenerates and then asserts two things: that `types/api.d.ts` is committed,
and that regenerating it produces no diff. A stale file fails the check with the reason printed.

The script is deliberately **honest when it cannot run** (commit `0c912d1`): inside the frontend
container `../backend` does not exist, so it prints the exact `docker compose cp` command needed
rather than failing obscurely, and it skips the git-based checks when no git directory is visible —
which is expected in a container — saying so rather than passing silently. CI runs the real check.

## Alternatives rejected

**Hand-written interfaces.** The status quo. Zero tooling, and it had already drifted.

**Generate at build time without committing.** No diff to review, so a breaking API change lands
invisibly in a frontend build. Committing the artefact makes the contract change **show up in code
review**, which is the point.

**A shared schema language (protobuf, or hand-maintained JSON Schema).** A third definition to keep
in step with Pydantic, which is already authoritative.

**Runtime validation only (zod at the boundary).** Zod is used for forms, and it validates what
arrives rather than what the API promises. It catches drift after deploy, not in review.

## Consequences

- **Good:** the API contract is a reviewable diff, and frontend type errors appear the moment a
  schema changes.
- **Cost:** two generated artefacts must be regenerated and committed whenever a schema changes —
  forget, and CI fails. That failure is the feature.
- **Cost:** the container/host path split makes the command non-obvious, which is why the script
  prints it.

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Artefact | `backend/openapi.json` | the committed contract |
| Artefact | `frontend/types/api.d.ts` | generated; committed |
| Script | `frontend/package.json` → `codegen:api`, `codegen:check` | regenerate; fail if stale or uncommitted |
| Doc | `documentation/system-design/NEXTJS_STANDARDS.md` | how the API layer consumes the types |

Frontend data access goes through `frontend/lib/api/*` — never an inline `fetch()` in a component
(root `AGENTS.md` § 5).
