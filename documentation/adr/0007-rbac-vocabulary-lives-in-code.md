# ADR-0007 — The RBAC vocabulary lives in code and is seeded into the database

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-07-31 |
| **Recorded** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | Authz |

## Context

Permissions and system roles have to exist in the database — roles are assigned to users, and the
roles UI renders them. The question is **where the authoritative list lives.** If the database is
authoritative, then a permission string referenced in code is only as correct as whatever a previous
seeder or an administrator happened to insert, and a typo becomes a permanently open route.

## Decision

`backend/app/core/permissions.py` is the single source of truth. It declares the permission catalog,
the role/permission matrix and the role descriptions as ordinary module-level dicts. The seeder
`app.db.seed_rbac` writes the database **from** that module and **reconciles** on every run.

Reconciliation is specific about what it will and will not touch:

- It brings permissions and **system** roles into line with the code, every run, idempotently.
- It **never** touches administrator-created roles.
- It creates the root account **only when no user exists at all** — there is no committed default
  credential, and an omitted `ROOT_PASSWORD` makes the seeder generate one and print it once.

Naming is inherited from LeapDesk: `{resource}-{action}`, resource **singular**, kebab-case —
`user-view`, `role-create`, `api-credential-update`.

A bad role matrix **fails loudly** rather than seeding a half-configured system (commit `16a9bd2`).

## Alternatives rejected

**Database as source of truth, managed through the roles UI.** Flexible, and it is what many admin
products do. Rejected: code referencing `"user-view"` would have no guarantee the row exists, drift
between environments would be invisible, and a permission rename would be a data migration rather
than a diff.

**Permissions in a migration.** They would be versioned, which is the appealing part. Rejected
because a permission set is not schema — it is reconciled state, and expressing "make reality match
this list" in Alembic means writing the reconciliation by hand in every revision.

**A config file (YAML/JSON).** Same authority as code with less type safety, no import graph, and
nothing stopping it drifting from the constants the guards actually reference.

## Consequences

- **Good:** the guards, the seeder and the UI all read one list. A permission that exists in code
  exists everywhere after a seeder run.
- **Good:** environments converge — a fresh database plus a seeder run equals production's RBAC
  shape.
- **Cost:** changing permissions requires a deploy plus a seeder run, not an admin click. That is
  the intended trade.
- **Follow-on:** this module later became an *assembly point* rather than one literal, so a domain
  could register its own permissions — see [ADR-0008](0008-core-domain-registration-seam.md).

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Code | `backend/app/core/permissions.py` | the catalog, matrix and descriptions |
| Code | `backend/app/core/roles.py` | role names, imported by everything |
| Code | `backend/app/db/seed_rbac.py` | reconciles the database against the module |
| Test | `backend/tests/test_role_hierarchy.py` | pins the hierarchy |
| Test | `backend/tests/test_route_enforcement.py` | every gated route refuses a stranger |
| Doc | `documentation/core/AUTHORIZATION.md` | roles, permissions, guards, protection rules |
