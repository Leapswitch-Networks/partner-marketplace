# ADR-NNNN — <the decision, as a statement>

> Copy this file to `NNNN-short-kebab-title.md`, keep every heading, and add the row to
> [`../ADR.md`](../ADR.md). Delete this quote block and the italic prompts as you fill them in.
>
> Title the record with the **decision**, not the topic — *"SQLAlchemy stays synchronous"*, not
> *"Database driver"*. A reader scanning the index should learn the answer without opening the file.

| | |
|---|---|
| **Status** | Proposed · Accepted · Superseded by ADR-NNNN · Deprecated |
| **Date** | YYYY-MM-DD — when the decision was *made* |
| **Recorded** | YYYY-MM-DD — when this file was written, if later |
| **Deciders** | who actually chose |
| **Area** | Backend · Frontend · Auth · Authz · Infra · Architecture · Contract · Process · Project |

## Context

*What forced a choice. The constraint, the deadline, the thing that broke, the two requirements that
would not both fit. Written so someone who was not there understands the pressure — a decision reads
as arbitrary the moment its context is missing.*

*State facts that were true **at the time**, and date them. Do not update this section later.*

## Decision

*What we chose, in the active voice and in one or two sentences. "We hash with bcrypt directly."*

*Then the specifics that bind: the exact version, the exact rule, the exact boundary.*

## Alternatives rejected

*One subsection per real alternative — the ones actually considered, not strawmen.*

**<The alternative>** — why it lost. Be concrete about the cost that killed it. If it is still
tempting, or would be the obvious default for someone arriving fresh, **say so explicitly**: that is
the sentence which stops this decision being re-litigated every few weeks.

## Consequences

*What this makes easy, and what it makes hard. Both halves — a record listing only benefits is
marketing.*

- **Good:** …
- **Cost:** …
- **Follow-on:** *what else had to change, or must change, because of this*

## Where this is enforced

*The point of the record. Real paths, checked before you write them.*

| Kind | Path | What it does |
|------|------|--------------|
| Code | `backend/app/…` | |
| Test | `backend/tests/test_….py` | fails if the decision is violated |
| Doc | `documentation/…` | the full explanation |

*If nothing enforces it, write **"Nothing enforces this — it holds by convention only."** That is a
useful, honest finding, and usually the beginning of the next task.*

## Notes

*Dated corrections only, appended — never rewrite the sections above. This is a record of what was
decided and what was known then, and editing it in place destroys the one question it answers.*

- **YYYY-MM-DD** — …
