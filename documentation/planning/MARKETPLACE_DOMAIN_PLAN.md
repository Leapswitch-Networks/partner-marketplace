# Marketplace Domain Plan

**Status: DESIGN — awaiting review.** No migrations written yet, deliberately.

> ## ⚠️ Contested as of 2026-08-07 — read this before acting on anything below
>
> A brief given on 2026-08-07 describes a **different product**: a curated directory where partners
> list **their own** services and buyers find them — *"a Justdial, but only for our partners"*. This
> document models the opposite direction of trade: partners **reselling Leapswitch's** services at a
> discount tier, via quotes.
>
> **Both cannot be the v1.** The reconciliation, and a recommendation for which parts of this document
> survive either way, are in [`PARTNER_DIRECTORY_PLAN.md`](./PARTNER_DIRECTORY_PLAN.md) § 0.
>
> The short version: **§ Entities → `partners`, `users.partner_id`, `partner_tiers` and the whole of
> § Row-Level Scoping are unaffected and still correct.** The catalog, `quotes`, `quote_items` and the
> quote state machine are what is in question. **Nothing has been decided** — do not treat either
> document as settled.

> Scope was settled on 2026-07-31. This document is now the model to review, not a list of open
> questions. Nothing here is built; the § Build Sequence at the end is the order to build it in.
>
> Planning docs are reference only — once code exists, the code is the truth.

---

## The Four Decisions

| Question | Decision | Consequence |
|---|---|---|
| What is a partner? | **Channel partner reselling Leapswitch services** | Self-serve version of what QMAS already models as Partner Quotes at Partner Discount Tiers |
| One login or an organisation? | **Organisation with multiple logins** | `partners` table + `partner_id` on `users`; scoping keys off the *organisation* |
| Where does pricing come from? | **Design for both** — local catalog behind a thin interface | Ship without a QMAS dependency; QMAS can back it later without reshaping the domain |
| Does the end customer log in? | **Not in v1, but plan for it** | Customers are records. Ownership is modelled generically so a customer role can be added without reworking scoping |

The second decision is the expensive one and the reason to get this reviewed: retrofitting an
organisation layer after partner-owned rows exist means backfilling ownership on every table.

---

## What the Partner Actually Does

```
Partner signs in
   └── browses the service catalog, priced at THEIR tier
         └── picks products for one of their end customers
               └── builds a quote  (DRAFT)
                     └── submits it            (SUBMITTED)
                           ├── auto-approved if within their tier's discount authority
                           └── else queued for Leapswitch approval  (APPROVED | REJECTED)
                                 └── sends it to the customer       (SENT)
                                       └── customer accepts out-of-band  (ACCEPTED)
                                             └── converts to an order    (CONVERTED)
```

Leapswitch staff see everything, approve what needs approving, and manage the catalog and tiers.

---

## Entities

### `partners` — the reselling organisation

| Column | Type | Notes |
|---|---|---|
| `id` | `String(36)` PK | UUID |
| `name` | `String(255)` | Trading name, shown in the UI |
| `legal_name` | `String(255)` nullable | For documents |
| `slug` | `String(120)` unique | Stable URL/reference key |
| `tier_id` | FK → `partner_tiers` | Drives pricing and discount authority |
| `status` | enum | `PENDING` \| `ACTIVE` \| `SUSPENDED` |
| `gst_number`, `pan_number` | `String(30)` nullable | India-specific, as QMAS has |
| `billing_address`, `city`, `state`, `country`, `postal_code` | | For quote documents |
| `agreement_signed_at` | `DateTime(tz)` nullable | Reseller agreement |
| `onboarded_by` | FK → `users.id` nullable | Which staff member |
| `notes` | `Text` nullable | Internal only — never exposed to the partner |
| `created_by`, `updated_by`, `created_at`, `updated_at` | | Audit, matching `users` |

**A partner's `status` gates its users.** A user in a `SUSPENDED` partner cannot sign in even if their
own `users.status` is `ACTIVE` — otherwise suspending a reseller would mean hunting down every login.
This is an addition to `get_current_user`.

### `partner_tiers` — discount tiers

| Column | Notes |
|---|---|
| `id` | Integer PK — reference data, like roles |
| `name`, `display_name` | e.g. `bronze` / "Bronze" |
| `discount_percentage` | `Numeric(5,2)` — applied to catalog list price |
| `max_self_approve_discount` | `Numeric(5,2)` — extra discount the partner may grant without Leapswitch approval. **This is what makes the quote state machine branch.** |
| `sort_order`, `is_active` | |

Seeded like roles are, from a constant, so tier names referenced in code cannot drift.

### `users.partner_id` — the link

`String(36)` FK → `partners.id`, **nullable**. NULL means staff. This is the single column every
scoping rule reads.

### `customers` — the partner's end customers (records, not accounts)

| Column | Notes |
|---|---|
| `id` | UUID PK |
| `partner_id` | FK, **NOT NULL** — a customer always belongs to exactly one partner |
| `company_name`, `contact_name`, `email`, `phone` | |
| `gst_number`, address fields | For the quote document |
| `created_by`, `updated_by`, timestamps | |

Deliberately **not** globally unique on email: two partners may legitimately serve the same company,
and deduplicating across partners would leak the existence of one partner's customers to another.

### Catalog — `catalog_categories`, `products`

Behind a thin interface so QMAS can back it later (§ Pricing).

`products`: `id`, `category_id`, `sku` (unique), `name`, `description`, `unit`
(e.g. `per month`, `per GB`), `list_price` `Numeric(12,2)`, `billing_cycle` enum
(`monthly` \| `quarterly` \| `annual` \| `one_time`), `is_active`, plus:

| Column | Why it matters |
|---|---|
| `source` | enum `local` \| `qmas` — where this product's truth lives |
| `external_ref` | `String(120)` nullable — the QMAS identifier when `source = 'qmas'` |

`source`/`external_ref` are what let a QMAS-backed catalog arrive later without a schema change.

⚠️ The inherited `categories` table is **not** reused. It carries test-platform semantics and is
scheduled for deletion; a fresh `catalog_categories` keeps the new domain clean.

### `quotes`, `quote_items`

`quotes`: `id`, `quote_number` (unique), `partner_id` (NOT NULL), `customer_id`, `status`, `currency`
(default `INR`), `subtotal`, `discount_total`, `tax_total`, `grand_total` (all `Numeric(14,2)`),
`valid_until`, `partner_notes`, `internal_notes`, `submitted_at`, `reviewed_by`, `reviewed_at`,
`rejection_reason`, `sent_at`, `decision_at`, audit columns.

`quote_items`: `id`, `quote_id`, `product_id` (nullable — see below), `qty`, `unit_price`,
`discount_percentage`, `line_total`, `billing_cycle`, **plus a name/description/sku snapshot**.

**The snapshot is load-bearing.** A quote must render identically in a year even if the product is
renamed, repriced or deactivated — so the line stores what was quoted, and `product_id` is only a
back-reference (nullable, `ON DELETE SET NULL`).

`internal_notes` is staff-only and must never appear in a partner-facing response — enforced by using
a separate response schema, not by remembering to strip it.

### `orders` — phase 4, sketched only

`id`, `order_number`, `quote_id`, `partner_id`, `customer_id`, `status`
(`PLACED` → `PROVISIONING` → `ACTIVE` → `COMPLETED` \| `CANCELLED`), totals snapshot, `placed_at`.

---

## Relationships

```
partner_tiers ──< partners ──< users            (staff have partner_id = NULL)
                     │
                     ├──< customers
                     └──< quotes ──< quote_items >── products >── catalog_categories
                                │
                                └──< orders      (phase 4)
```

---

## State Machines

### Partner

```
PENDING ──approve──> ACTIVE <──unsuspend──> SUSPENDED
   └──reject──> (deleted, or left PENDING with a reason)
```

`PENDING` mirrors the account-level approval gate one level up: a self-registered partner user
creates a `PENDING` organisation, and Leapswitch activates the organisation, not just the login.

### Quote — the one that matters

```
DRAFT ──submit──> SUBMITTED ──┬─ within tier authority ──> APPROVED
                              └─ exceeds authority ──────> (staff review)
                                                             ├─approve─> APPROVED
                                                             └─reject──> REJECTED ──> DRAFT (revise)
APPROVED ──send──> SENT ──┬─accept──> ACCEPTED ──convert──> CONVERTED
                          ├─decline─> DECLINED
                          └─(expiry)─> EXPIRED
```

Rules to enforce in the service, not the router:

- **Only `DRAFT` and `REJECTED` are editable.** Everything else is immutable; revising means going
  back to `DRAFT`, which resets approval.
- **Totals are recomputed server-side on every write**, never trusted from the client.
- **`APPROVED` freezes the pricing snapshot.** A later catalog change must not alter a live quote.
- **Transitions are explicit endpoints** (`/submit`, `/approve`, `/reject`, `/send`, `/convert`), not
  a `PATCH status`. A state machine driven by a free-form status field is a state machine that will
  be driven into an invalid state.
- **Expiry is derived, not stored as a status** — a nightly job would be nice, but with no scheduler
  the read path treats `valid_until < now` as expired, the same trick `invitation_service` uses.

---

## Row-Level Scoping — PM-5, and the part to get right

This does not exist today and every partner-owned table depends on it. **Design it once, centrally.**

### The rule

| Actor | Sees |
|---|---|
| Staff with `has_admin_access` | everything |
| Staff without it | everything they have the permission for (no partner concept applies) |
| Partner user | **only rows whose `partner_id` matches their own** |
| *(future)* customer user | only rows whose `customer_id` matches theirs |

### The implementation

One module, `app/services/scoping.py`, and every list/read path calls it:

```python
def apply_scope(stmt: Select, model, actor: User) -> Select:
    """Restrict a query to what `actor` may see. The ONLY place ownership is decided."""
    if actor.partner_id is None:          # staff
        return stmt
    return stmt.where(model.partner_id == actor.partner_id)


def assert_can_read(obj, actor: User) -> None:
    """404, never 403 — a 403 would confirm the row exists."""
    if actor.partner_id is not None and obj.partner_id != actor.partner_id:
        raise HTTPException(404, "Not found")
```

Three rules that make this hold:

1. **Never write `where(partner_id == ...)` in a service.** Call `apply_scope`. A hand-rolled filter
   is how one endpoint ends up leaking across tenants.
2. **Every partner-owned model has a `partner_id` column**, even where it is derivable through a
   join. Derived ownership makes the filter a join and the filter easy to forget.
3. **Writes are scoped too** — creating a quote sets `partner_id` from the *actor*, never from the
   request body, or a partner could file a quote against another partner.

Generalising for the future customer role means changing `apply_scope` alone: it becomes a lookup of
"which column, which value" per actor kind. That is why it is a function rather than a mixin.

---

## Permissions to Add

Same names for staff and partners — **the permission says what the action is, the scope says which
rows.** That is the whole reason scoping is separate from RBAC.

| Group | Permissions |
|---|---|
| `partners` | `partner-view`, `-create`, `-update`, `-delete`, `-approve` |
| `partner-tiers` | `partner-tier-view`, `-create`, `-update`, `-delete` |
| `customers` | `customer-view`, `-create`, `-update`, `-delete` |
| `catalog` | `product-view`, `-create`, `-update`, `-delete` |
| `quotes` | `quote-view`, `-create`, `-update`, `-delete`, `quote-submit`, `quote-approve`, `quote-send` |

Role grants:

| Role | Additions |
|---|---|
| `Partner` | `product-view`, `customer-*`, `quote-view/create/update/submit`, and their own partner record read-only |
| `Staff` | `partner-view`, `customer-view`, `product-view`, `quote-view` |
| `Admin` | everything (already wildcard) |

`quote-approve` is deliberately separate from `quote-update`: approving is a commercial decision that
should be delegable without granting edit rights.

---

## Build Sequence

Each step ends with something demonstrable. **Step 2 before any partner-owned table exists.**

| # | Step | Why here |
|---|---|---|
| 1 | `partner_tiers` + `partners` + `users.partner_id`, seeded tiers, partner CRUD + approve, org-status gate in `get_current_user` | The ownership anchor everything else references |
| 2 | **`scoping.py` + the permissions above** | Must exist before the first scoped row, not after |
| 3 | `customers` — the first partner-owned table, and the proof that scoping works | Smallest possible thing to validate step 2 against |
| 4 | Catalog: `catalog_categories`, `products`, tier-priced read endpoints | Partners need something to quote |
| 5 | `quotes` + `quote_items` + the full state machine | The core object |
| 6 | Partner-facing UI — the RBAC admin half is **done** (2026-08-03) | Partner side is still unbuilt |
| 7 | `orders`, then QMAS-backed catalog via `source`/`external_ref` | Deferrable without reshaping anything |

### Automated tests come after step 7, not alongside step 1

**Owner's decision, 2026-08-03**, overriding this document's earlier recommendation. Tests are slow to
write and slow to run, and that cost would be paid on every step above.

The reason the original recommendation existed still holds, so build steps 2 and 3 with it in mind:
scoping is exactly the kind of rule a shell script will not protect, and a silent regression leaks one
partner's rows to another rather than raising an error. Until PM-11 lands, step 3 (`customers`) is the
**only** proof that step 2 works — so verify it by hand against at least two partner organisations and
one staff account, and record what was run in [`../DAILY_CHANGES.md`](../DAILY_CHANGES.md).

See [`TECH_DEBT.md`](./TECH_DEBT.md) § Suggested Order of Work for the full cost and the mitigation.

---

## Still Open

Genuinely undecided, and none of it blocks steps 1–3:

- **Quote numbering format.** QMAS uses `LS/JAN/2026/DK/0001`. Partner quotes presumably want a
  partner-identifying segment. Needs a decision before step 5.
- **Tax.** `tax_total` is modelled but GST rules (rate per product? per state? reverse charge?) are not.
- **Currency.** `INR` assumed. Multi-currency would change every money column's meaning.
- **Commission vs. discount.** This model assumes partners buy at a discount and resell. If Leapswitch
  instead pays commission on a sale, `orders` needs a commission ledger.
- **Who sends the quote to the customer?** Step 5 assumes the partner sends it out-of-band, because
  there is no mail transport (PM-27). An in-app send needs that first.

---

## Related Documentation

- [`../core/AUTHORIZATION.md`](../core/AUTHORIZATION.md) — the RBAC this extends, and § Data Visibility
- [`../core/USERS.md`](../core/USERS.md) — why `partner_id` on `users` rather than a separate table
- [`TECH_DEBT.md`](./TECH_DEBT.md) — PM-5 (scoping), PM-11 (tests), PM-27 (email)
- [`SCAFFOLD_CLEANUP_PLAN.md`](./SCAFFOLD_CLEANUP_PLAN.md) — the inherited tables this replaces
