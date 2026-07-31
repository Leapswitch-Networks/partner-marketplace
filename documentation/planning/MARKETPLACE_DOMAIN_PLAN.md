# Marketplace Domain Plan

> **Status: BLOCKED — awaiting product scope.**
>
> This document is deliberately empty of a domain model. Nobody has yet defined what a partner is,
> what they list, or how a transaction works, and **inventing that would be worse than leaving it
> blank** — it would be cited later as a decision that was never made.
>
> Planning docs are reference only. Check the code for current state.

---

## What We Know

| Fact | Source |
|------|--------|
| The project is called **Partner Marketplace** | Folder renamed 2026-07-30 |
| The tech stack and folder structure are being kept | Explicit decision — the scaffold's value is the stack, not the product |
| The inherited test-platform domain stays for now | Explicit decision — nothing was stripped |
| Auth, dashboard shell, and infrastructure are reusable as-is | `../core/ARCHITECTURE.md` |

That is the entire set of known requirements. Everything below is an open question.

---

## Open Questions — Needed Before Any Code

### 1. Who are the participants?

- What **is** a partner here? A reseller? A channel partner selling Leapswitch services? A vendor
  listing their own products? Something else?
- Is there a second side to the market (buyers/customers), or do internal staff act as the demand side?
- Do partners self-register, or are they invited/onboarded by staff?
- Does a partner represent a **company** with multiple user logins, or is a partner one person?

The last question is the most structural. Multiple logins per partner organisation means a
`partners` ↔ `partner_users` split from day one; retrofitting it later is expensive.

### 2. What is listed and transacted?

- What does a partner list — products, services, quotes, leads, capacity?
- Is pricing fixed, negotiated, or tiered per partner?
- Is there an order/transaction object, or does the marketplace only broker introductions?
- Are commissions or margins tracked?
- Does anything need to integrate with existing systems (LeapDesk QMAS quoting, HubSpot, billing)?

### 3. What states does the core object move through?

Every marketplace has a lifecycle. Whatever the objects are, the state machine needs naming up front —
draft → submitted → approved → live → closed, or otherwise. Retrofitting a state machine onto rows
that already exist is one of the more painful migrations.

### 4. Who approves what?

- Do listings need internal approval before going live?
- Do partner registrations need approval?
- Who can see whose data — and this is the critical one, see § Required Regardless.

---

## The Partner Account Decision

The existing dual-table identity model (`users` + `admin_users`) forces a choice. Full analysis is in
[`../core/USERS.md`](../core/USERS.md) § Where Partners Fit. Summary:

| Option | Summary | Main cost |
|--------|---------|-----------|
| **A.** New `partners` table + third login endpoint | Matches the existing separation | `whoami` and `refresh` already probe two tables; a third makes it worse |
| **B.** Reuse `users` with a `partner` role | No new auth plumbing | `users` has no `is_active`, no lockout, no audit — partners need at least suspension |
| **C.** Single `accounts` table with a discriminator | Fixes the dual-table awkwardness properly | Largest refactor — every guard, `whoami`, `refresh`, both migrations |

**Leaning:** if partners are organisations with multiple logins, none of the three is sufficient
as-is — you need `partners` (the org) plus an account table for logins. Decide § 1's "company or
person" question first; it determines this one.

---

## Required Regardless of Domain

These are needed under every possible version of the product, and **none of them exist today**.

### 🔴 Row-level scoping — the biggest gap

A partner must see only their own records. **There is no pattern for this anywhere in the codebase.**
The inherited `candidates` and `categories` routers give every authenticated admin full CRUD over
every row, and the guards are bound to a throwaway `_` parameter precisely because no scoping is done:

```python
_: AdminUser = Depends(get_current_admin),
```

Design this **once, centrally**, before the first partner endpoint. Improvising it per-route is how
data leaks between tenants. It needs a decision on:

- Where the scope filter is applied — a shared query helper, a service-layer convention, or a
  SQLAlchemy global filter
- How "staff sees everything, partner sees own" is expressed without an `if` in every service
- What happens on a direct-ID fetch (`GET /listings/{id}`) — 404 or 403 for someone else's row
  (404 is usually right; 403 confirms the row exists)

### 🔴 Password hashing before a third account table

Do not extend the plaintext pattern to partners. See [`TECH_DEBT.md`](./TECH_DEBT.md) PM-1.

### 🟠 Suspension without deletion

Partners must be suspendable. `admin_users` has `is_active`; `users` does not.

### 🟠 Audit trail

Who changed which listing, and when. Nothing records this today. The `admin_users` table has audit
columns that are never written, so don't assume any groundwork exists.

### 🟠 Real permissions

The current model is two coarse role enums with no permission registry, no policies, and no
route→permission map (`../core/AUTHORIZATION.md` § What This System Does Not Have). A marketplace with
partners, staff, and approvers will outgrow that quickly.

---

## Recommended Sequence

Once § 1–4 are answered:

1. **Write the domain model into this document** — entities, relationships, state machines, and the
   partner-account decision, with reasoning. Then stop and get it reviewed.
2. **Design row-level scoping** as a standalone piece of work, before any domain endpoint.
3. **Fix password hashing** (`TECH_DEBT.md` PM-1) — cheapest now, before there is a third account table
   and production data.
4. **Build the partner account model**, including suspension.
5. **Build one vertical slice end to end** — one entity, model → migration → schema → service → router
   → API module → page — and use it to settle the conventions.
6. **Then fan out** to the remaining entities, following the slice.
7. **Retire the inherited domain** once its replacement is live —
   [`SCAFFOLD_CLEANUP_PLAN.md`](./SCAFFOLD_CLEANUP_PLAN.md).

Step 5 matters: settling conventions on one slice is much cheaper than discovering them across eight
entities simultaneously.

---

## How to Fill This In

When scope arrives, replace the § Open Questions section with:

- **Entities** — a table per entity: purpose, key columns, relationships
- **State machines** — the lifecycle of each stateful object, with allowed transitions and who may
  trigger them
- **Permissions matrix** — role × action × scope
- **API surface** — planned endpoints, matching the table in `../core/ARCHITECTURE.md`
- **Migration plan** — order of table creation, and interaction with the inherited tables
- **Decisions log** — what was chosen and *why*, so it isn't re-litigated

Keep the § Required Regardless section — it stays true whatever the domain turns out to be.

---

## Related Documentation

- [`../core/USERS.md`](../core/USERS.md) — the partner-account options in detail
- [`../core/AUTHORIZATION.md`](../core/AUTHORIZATION.md) — what the permission model can and can't do
- [`TECH_DEBT.md`](./TECH_DEBT.md) — what to fix before building on the scaffold
- [`SCAFFOLD_CLEANUP_PLAN.md`](./SCAFFOLD_CLEANUP_PLAN.md) — retiring the inherited domain
- [`../system-design/FASTAPI_STANDARDS.md`](../system-design/FASTAPI_STANDARDS.md) § 11 — the add-a-resource checklist
