# ADR-0010 — Row-level scoping fails closed, reaches SQL, and answers 404 rather than 403

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-17 |
| **Recorded** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | Authz |

## Context

`MARKETPLACE_DOMAIN_PLAN.md` laid down the rule *"never write `where(organisation_id == ...)` in a
service"* — and that rule was **right and unenforceable from the day it was written**, because the
module it named did not exist (`TECH_DEBT.md` PM-5). Meanwhile the product is heading for a public
directory: the same query serves an anonymous visitor, a partner seeing their own rows, and staff
seeing everything.

`PARTNER_DIRECTORY_PLAN.md` § 7 identified the specific trap. The obvious implementation —

```python
if actor is None:
    return stmt          # anonymous: nothing to scope
```

— **serves unfiltered rows to the internet.** It reads as a harmless early return.

This is the one area where a mistake is a data breach rather than a bug.

## Decision

`backend/app/services/scoping.py` is the single place scoping is expressed, and it encodes three
rules:

1. **Anonymous is the most restrictive branch by construction.** The default for every principal that
   is not a scoped human is `false()`. A model must *opt in* to public visibility by registering a
   `public_predicate`; a model registering nothing is invisible to anonymous callers. **Forgetting to
   think about the public case fails closed.**
2. **404, never 403.** A 403 confirms the row exists — in a directory that tells one partner a
   competitor is on the platform before publication. `assert_can_read` raises 404 with a generic
   message for both "no such row" and "not yours".
3. **The filter reaches SQL.** `apply_scope` returns a modified `Select`, so `run_list` counts what
   it returns. Post-filtering a page corrupts the count: the caller is told there are 40 rows and
   handed 12.

A model registers **one column** naming the owning organisation.

## Alternatives rejected

**Scope in each service.** The status quo the rule was written against. It is one forgotten `where`
away from a leak, in a codebase with dozens of list endpoints.

**Allow-by-default with an explicit deny.** Every failure mode is a disclosure. The inverse — deny by
default, opt into public — makes the dangerous case the one you have to write on purpose.

**403 for "not yours".** More honest as an HTTP status, and standard practice. Rejected because on a
public directory the existence of a row is itself the confidential fact.

**Filter after fetching.** Simple to write and it corrupts pagination counts, which is how the bug
reaches the UI rather than the logs.

## Consequences

- **Good:** the dangerous default is unreachable, and the reasoning is in one file.
- **Cost:** a model must be registered before it is scoped — an unregistered model is invisible to
  anonymous callers, which is correct but can read as "the endpoint is broken" during development.
- **Cost:** 404-for-forbidden is harder to debug. That is the accepted trade.
- **Follow-on, and the reason this is dated 2026-08-17 rather than earlier:** applying the module
  revealed that **the user list was scoped while the user writes were not** (commit `d54e769`).
  Reads and writes need scoping applied separately; a scoped index does not imply a scoped update.

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Code | `backend/app/services/scoping.py` | `apply_scope`, `assert_can_read`, `register_scope` |
| Code | `backend/app/core/principal.py` | who the caller is when it is not a person |
| Test | `backend/tests/test_scoping.py` | the scoping rules |
| Test | `backend/tests/test_visibility_paths.py` | proves each visibility path serves what it should |
| Test | `backend/tests/test_search_security.py` | search does not bypass the scope |
| Doc | `documentation/system-design/FASTAPI_STANDARDS.md` § 12 | why the filter must reach SQL |
| Doc | `documentation/planning/TECH_DEBT.md` PM-5 | resolved 2026-08-17 |
