# Partner Directory Plan — "Justdial, but only for our partners"

**Status: R&D — no decision taken, nothing built.** This document exists to make the choice
reviewable, not to record one that has been made.

> **Brief, as given (2026-08-07):** *"my admin needs this project to be a Justdial but for our
> partners — because each of our Leapswitch partners offers different services, so we need this
> platform to launch where only our partners will be there."*
>
> Everything below is either research with a source, a measurement of this repo taken today, or a
> proposal clearly marked as one. Planning docs are reference only — once code exists, the code wins.

---

## 0. Read this first — the brief contradicts the existing plan

There is already a `MARKETPLACE_DOMAIN_PLAN.md` in this folder, scoped on 2026-07-31 and parked. It
models a **completely different business** from the one described in the brief. This is the most
important thing in this document, so it goes first.

| | `MARKETPLACE_DOMAIN_PLAN.md` (existing) | This brief (new) |
|---|---|---|
| What a partner *is* | A **reseller** of Leapswitch services | A **supplier** of their own services |
| Whose services are listed | **Leapswitch's**, priced at the partner's discount tier | **The partner's own** — "each partner offers different services" |
| Who the partner sells to | Their own end customer, off-platform | A buyer who finds them **on the platform** |
| The core object | A **quote** with a nine-state approval machine | A **listing** and the **enquiry** it generates |
| Leapswitch's role | Supplier and approver of discounts | **Convenor of a market** — curator, referee, traffic source |
| Where revenue comes from | Margin on Leapswitch services sold through the channel | Listing fees, lead fees, or commission — none of which exist in the other model |

**These are not two phases of one product. They are two products that happen to share the word
"partner".** The existing plan points value *outward from* Leapswitch through the channel. The brief
points value *inward toward* a market Leapswitch hosts but does not supply.

### The recommendation

**Build the directory; keep the existing plan's foundation; shelve its quoting half.** Concretely:

| From the existing plan | Verdict | Why |
|---|---|---|
| `partners` (the organisation) | **Keep, unchanged** | Both products need an organisation record. The columns already specified — GST, PAN, billing address, `status`, `agreement_signed_at` — are exactly what a directory needs for verification too |
| `users.partner_id` | **Keep, unchanged** | One nullable FK; NULL means Leapswitch staff. Both products key every ownership rule off it |
| `scoping.py` (PM-5) | **Keep — and it becomes more urgent, not less** | § 7 |
| `partner_tiers` | **Keep, repurpose** | Stops meaning "discount authority", starts meaning "listing entitlement" — how many listings, whether featured placement is available. Same table, different `Numeric` columns |
| `catalog_categories`, `products` | **Replace** | Those model *Leapswitch's* catalog at *Leapswitch's* list price. A directory needs partner-authored listings under a shared taxonomy. Different table, different owner, different pricing semantics |
| `quotes`, `quote_items`, the state machine | **Shelve** | Not wrong — genuinely not what was asked for. Costly to build and the most complex thing in that plan |
| `customers` | **Shelve, but re-read § 6.3** | A directory's "customer" is a buyer who contacts a partner. The existing table models a CRM record the partner owns, which is a different thing |

The expensive decision the existing plan flagged — *organisation with multiple logins, not one login
per partner* — is **still correct under the new brief and should not be revisited.** A directory
listing belongs to a company, not to whoever happened to sign up.

> **This section is a proposal, not a decision.** If the answer is "we want both eventually", say so
> and this plan changes only in its ordering, not its shape — see § 11.

---

## 1. What this repo actually has today — measured 2026-08-07

Not read from another register. Measured.

| Check | Result |
|---|---|
| Tables in the database | **11** — `users`, `roles`, `permissions`, `permission_groups`, `role_permissions`, `user_roles`, `user_sessions`, `user_invitations`, `activity_log`, `app_settings`, `alembic_version` |
| Marketplace-domain tables | **Zero** |
| Seeded permissions | **34** — none of them partner, listing, or enquiry related |
| `partner_id` / `partner_tier` anywhere in `backend/app/` | **No matches** |
| Row-level scoping (`app/services/scoping.py`) | **Does not exist** — PM-5 is open |

So the entire domain in this document is greenfield. Nothing here is a refactor.

**What the core does already give us**, and it is more than it sounds: authentication with an
approval gate, RBAC with per-route guards, an activity log, server-driven navigation, user
invitations, a settings area, brand theming, and — as of the current uncommitted tree — an
`(app)` route group, a shared list pipeline (`ListSpec` / `run_list`) and a committed OpenAPI
contract. A directory is mostly CRUD plus search plus a lead pipe. The core covers the CRUD half.

---

## 2. R&D — what Justdial actually is

Worth being precise, because "a Justdial" is being used as shorthand and the shorthand hides the
part that is hard.

Justdial is a **local search engine and two-sided marketplace** connecting consumers looking for
local services with businesses that want customers, spanning services, retail, health and travel.
Four revenue streams:

| Stream | Mechanics |
|---|---|
| **Paid listings / subscriptions** | Businesses pay for visibility — top position, bold listing, highlighted profile within their category and city. ~1.5 million paid campaigns as of their Q1 2023 report |
| **Lead generation** | The important one. Businesses are **not** charged a fixed fee — they buy lead packages and are charged when Justdial sends a qualified lead (a call, enquiry or message). One consumer query is distributed to **four to seven competing providers** |
| **Advertising** | Display inventory on the site and app |
| **Transactions** | Commission where a purchase completes on-platform |

### The three mechanics worth copying

1. **The unit of value is the lead, not the listing.** A listing is inventory; a lead is the
   product. Everything about the schema in § 6 follows from this — the enquiry is a first-class
   entity with its own lifecycle, not a `mailto:` link.
2. **One enquiry fans out to several providers.** This is what makes the marketplace work for the
   buyer (choice, competitive response) and what makes it monetisable for the platform (the same
   query is sold several times). It also creates the response-time race that generates the
   engagement.
3. **Category × city is the atomic search unit.** Not "search". Justdial's index is a taxonomy
   crossed with geography, and the paid placement is sold against that pair.

### The one mechanic we cannot copy

**Justdial's demand side is the open Indian internet.** Its entire business rests on consumer
traffic it spent two decades acquiring. A platform where *"only our partners will be there"*
constrains **supply**. It says nothing about where **demand** comes from — and demand is the side
that fails. See § 3; this is the central risk in the brief.

**Sources:** [StartupTalky — Justdial business model](https://startuptalky.com/justdial-business-model/) ·
[Vizologi — Justdial business model canvas](https://vizologi.com/business-strategy-canvas/justdial-business-model-canvas/) ·
[Work Theater — decoding Justdial](https://worktheater.com/decoding-the-business-model-of-justdial/) ·
[DCFmodeling — Just Dial history & how it makes money](https://www.dcfmodeling.com/blogs/history/justdialns-history-mission-ownership)

---

## 3. The question this plan cannot answer for you — who is the demand side?

**Restricting supply to Leapswitch partners is a coherent and defensible product decision. It is
also only half a marketplace.** The brief specifies the supply side completely and the demand side
not at all.

Liquidity means that when a buyer searches, a relevant seller is there at the right time, place and
price. Without it, buyers hit empty or mismatched results, leave, and tell no one to come back —
which discourages supply, which further kills demand. The literature is blunt that the cold start is
the *easy* half; **sustaining liquidity once both sides exist is the hard one.**

Three readings of the brief, each of which produces a different product:

| Reading | Who searches | What it really is | Viability |
|---|---|---|---|
| **A. Curated public directory** | Anyone on the internet | A Leapswitch-vetted marketplace of partner services, open to the world | The literal Justdial analogue. **Needs a traffic strategy — SEO, and someone owning it.** Highest ceiling, highest cost |
| **B. Customer-facing partner finder** | Existing Leapswitch customers, signed in | "You already buy from us; here are vetted partners for the things we don't do" | **Lowest risk, warmest demand, smallest build.** Demand already exists and is already authenticated |
| **C. Partner-to-partner exchange** | Partners themselves | A closed trading floor where partners buy each other's services | Literally matches *"only our partners will be there"*. **Weakest liquidity** — supply and demand drawn from the same small pool |

> **Working assumption for the rest of this document: A, with B as the launch wedge.** Build the
> directory so it *can* be public, but light it up first for signed-in Leapswitch customers, where
> the demand already exists and does not need to be bought. This is the standard curated-marketplace
> play — seed vetted supply narrowly, prove one transaction loop, defer everything else — and it is
> reversible: opening the same listings to the public later is a routing and SEO change, not a
> schema change.
>
> **If the intent was B or C, say so and § 4, § 8 and § 10 shrink substantially.** The schema in § 6
> is deliberately the same under all three.

### The number that decides the shape

**How many partners does Leapswitch have?** This is not rhetorical — it changes the build:

| Partner count | What you are actually building |
|---|---|
| ~10–30 | A **showcase page**. Search and faceting are over-engineering; a well-designed grid with filters is the whole product |
| ~50–300 | A **directory**. Everything in this plan applies |
| 300+ | A **marketplace** with a ranking problem, and § 9 becomes the hardest section |

**Nobody should write a migration before this number is known.**

**Sources:** [Reforge — beat the cold start problem](https://www.reforge.com/guides/beat-the-cold-start-problem-in-a-marketplace) ·
[RaftLabs — why two-sided marketplaces fail after launch](https://www.raftlabs.com/blog/two-sided-marketplace-failure-rate) ·
[The Marketplace Guide — cold start pattern](https://themarketplaceguide.com/patterns/cold-start/) ·
[Internet Mango — which side to seed first](https://internetmango.com/insights/marketplace-cold-start-strategy/)

---

## 4. Comparables — closed and curated partner directories

Justdial is the *mechanic* reference. These are the *posture* reference, because all of them are
what the brief describes: a vendor convening a directory of its own vetted partners.

| Platform | What to steal | What to avoid |
|---|---|---|
| **Clutch** | Faceted comparison on the axes buyers actually use — reviews, budget, location, services, project size, past work. ~350K providers across 2,000+ categories, and the facets still work | Review volume is its moat; we will not have that on day one, so do not design a UI that looks broken when empty |
| **HubSpot Solutions Directory / Shopify Experts** | Tiering as a visible trust signal, region + specialisation filters, and a listing that reads as a **credential**, not an advert | Tier badges become political fast; the tier rule must be published and mechanical |
| **AWS / Salesforce partner directories** | A structured listing template — the vendor authors the *fields*, the partner authors the *content*. Keeps quality even across uneven partners | Their listing forms are enormous. Ours should not be |
| **Monday.com partners page** | When there are several partnership types, name them plainly and give each its own CTA rather than blending them | — |

The consistent lesson across all of them: **make it easy to find, align it with your brand, keep
navigation simple, and put the decision-critical information on the listing page itself** — not
behind a click.

**Sources:** [Webstacks — what a partner marketplace is, with examples](https://www.webstacks.com/blog/how-to-build-a-partner-marketplace) ·
[Webstacks — partner page design examples](https://www.webstacks.com/blog/partners-page-examples) ·
[W3Era — B2B directory sites 2026](https://www.w3era.com/blog/seo/b2b-business-directory-sites/) ·
[Rigby — services marketplace feature checklist](https://www.rigbyjs.com/blog/services-marketplace-features)

---

## 5. What the product is, in one page

```
Leapswitch staff                          Partner                        Buyer
      │                                      │                             │
      ├─ invites / approves a partner ──────>│                             │
      │                                      ├─ completes profile          │
      │                                      ├─ publishes service listings │
      ├─ verifies & approves listings <──────┤                             │
      │                                      │                             │
      │                                      │      browses by category ───┤
      │                                      │      filters by service     │
      │                                      │      area, tier, rating     │
      │                                      │                             │
      │                                      │<───── sends an enquiry ─────┤
      │                                      ├─ responds (SLA clock)       │
      │                                      │                             │
      ├─ sees every enquiry, response time,  │                             │
      │  and conversion ─────────────────────┴─────────────────────────────┘
      │
      └─ ranks, features, suspends, and reports on the whole market
```

**Three surfaces, and they are genuinely different applications:**

1. **The public/buyer surface** — browse, search, listing detail, enquiry form. Mostly unauthenticated
   (reading A), needs to be fast and indexable, and shares almost nothing with the admin shell.
2. **The partner surface** — profile, listings, enquiry inbox, response metrics. Authenticated,
   scoped to one organisation, and looks like the existing dashboard.
3. **The staff surface** — approve partners, moderate listings, manage the taxonomy, watch the
   market. Authenticated, unscoped, and is *exactly* the admin shell the core already builds.

> **The first surface is the one this codebase has never built.** Every route today is behind
> `middleware.ts` and the auth gate. A public, indexable, cacheable surface is a new architectural
> shape for this app — not hard, but do not cost it as "another page".

---

## 6. Proposed domain model

Same conventions as the existing plan: UUID `String(36)` PKs, `Numeric` for money, `DateTime(tz)`,
and `created_by` / `updated_by` / `created_at` / `updated_at` on everything.

### 6.1 `partners` — reused from `MARKETPLACE_DOMAIN_PLAN.md`, plus a directory face

Take that table as specified and add the fields a listing page needs:

| Column | Type | Notes |
|---|---|---|
| `tagline` | `String(200)` nullable | One line under the name |
| `about` | `Text` nullable | The profile body |
| `logo_path`, `banner_path` | `String(255)` nullable | Reuse the brand-asset upload pipeline that already exists |
| `website`, `public_email`, `public_phone` | | **Deliberately separate from the account email.** What is displayed is a business decision; the login is an identity |
| `founded_year`, `employee_range` | | Standard buyer filters |
| `verification_level` | enum | `UNVERIFIED` \| `VERIFIED` \| `PREMIER` — see § 9 |
| `verified_at`, `verified_by` | | Who vouched, and when |
| `is_listed` | `Boolean` | Publicly visible. **Separate from `status`** — a partner can be `ACTIVE` (can sign in) but unlisted (still drafting) |
| `avg_rating`, `review_count`, `response_rate`, `avg_response_minutes` | | Denormalised, recomputed on write. Ranking reads these; it must not aggregate at query time |

**`status` gates login; `is_listed` gates visibility. Do not conflate them.** The existing plan's
rule — a user in a `SUSPENDED` partner cannot sign in regardless of their own status — still holds.

### 6.2 `service_categories` — the shared taxonomy

**Leapswitch owns this table. Partners never write to it.** That single rule is what keeps the
directory searchable when partners offer genuinely different things.

`id`, `parent_id` (self-FK — two levels, no more), `name`, `slug` (unique), `description`,
`icon`, `sort_order`, `is_active`, `listing_count` (denormalised).

> Taxonomy should be designed **from buyer search behaviour, working backwards to the fields**, not
> up from the schema. Practically: interview whoever handles partner enquiries today and write down
> the words *buyers* use — not the words partners use to describe themselves.
>
> ⚠️ The inherited `categories` table is **not** reused — same reasoning as the existing plan. It
> carries test-platform semantics and is scheduled for deletion.

### 6.3 `service_listings` — the core object

| Column | Notes |
|---|---|
| `id` | UUID PK |
| `partner_id` | FK, **NOT NULL** — the ownership anchor `scoping.py` reads |
| `category_id` | FK → `service_categories` |
| `title`, `slug`, `summary` (`String(300)`), `description` (`Text`) | `slug` unique **per partner**, not globally |
| `pricing_model` | enum `FIXED` \| `HOURLY` \| `MONTHLY` \| `FROM` \| `ON_REQUEST` |
| `price_from`, `price_to` | `Numeric(12,2)` nullable — **nullable is the common case.** Most B2B services are `ON_REQUEST`, and a schema that forces a number will be filled with lies |
| `currency` | default `INR` |
| `status` | enum `DRAFT` \| `PENDING_REVIEW` \| `PUBLISHED` \| `REJECTED` \| `ARCHIVED` |
| `rejection_reason` | `Text` nullable |
| `published_at`, `reviewed_by`, `reviewed_at` | |
| `is_featured`, `featured_until` | Paid or tier-granted placement (§ 10) |
| `view_count`, `enquiry_count` | Denormalised counters |

**Listings are moderated, not self-published.** `PENDING_REVIEW` is the whole reason a curated
directory is worth more than an open one — it is the product, not red tape. Budget for the staff
queue that implies.

Supporting tables:

- **`listing_media`** — `listing_id`, `path`, `kind` (`image` \| `document`), `caption`, `sort_order`
- **`listing_attributes`** — `listing_id`, `key`, `value`. The escape hatch for facets that only apply
  to one category. **Keep facets you filter on as real columns**; this table is for display only, or
  faceting degrades into unindexable EAV queries
- **`service_areas`** — `partner_id` *or* `listing_id`, `country`, `state`, `city`, `is_remote`.
  Category × geography is Justdial's atomic search unit and needs to be a joinable table, not a
  free-text field

### 6.4 `enquiries` — the actual product

This is the entity the business runs on. It gets the most care.

| Column | Notes |
|---|---|
| `id` | UUID PK |
| `reference` | Human-quotable, unique |
| `listing_id`, `partner_id` | `partner_id` denormalised **on purpose** — scoping must never depend on a join |
| `buyer_user_id` | FK → `users`, **nullable** — null when the buyer was not signed in |
| `buyer_name`, `buyer_email`, `buyer_phone`, `buyer_company` | Captured inline for anonymous enquiries |
| `subject`, `message` | |
| `budget_range`, `timeline` | Optional qualifiers; they raise lead quality sharply |
| `source` | enum `LISTING` \| `PROFILE` \| `CATEGORY_BROADCAST` |
| `status` | `NEW` → `VIEWED` → `RESPONDED` → `WON` \| `LOST` \| `CLOSED` \| `SPAM` |
| `first_viewed_at`, `first_responded_at` | **The two timestamps the entire trust system depends on** — they produce response rate and response time, which feed ranking (§ 9) |
| `closed_at`, `outcome_note` | Self-reported |
| `ip_address`, `user_agent` | Abuse control. A public form **will** be scraped and spammed |

- **`enquiry_messages`** — `enquiry_id`, `sender_kind` (`buyer` \| `partner` \| `staff`), `sender_user_id`
  nullable, `body`, `created_at`. Keeps the thread on-platform, which is the only way response time
  is measurable rather than self-reported.
- **`enquiry_recipients`** — for the fan-out model (§ 2, mechanic 2): `enquiry_id`, `partner_id`,
  `notified_at`, `viewed_at`, `responded_at`, `is_winner`.

> **Decide fan-out before writing the migration.** One-enquiry-to-one-partner and
> one-enquiry-to-N-partners are different tables. Retrofitting N onto a 1:1 schema means rewriting
> every enquiry query. **Recommendation: build the `enquiry_recipients` table from day one and put
> exactly one row in it.** The cost is one join; the alternative is a migration of the busiest table
> in the system. Note this makes `enquiries.partner_id` a denormalised convenience for the 1:1 case —
> when fan-out is switched on, ownership moves to `enquiry_recipients` and scoping follows it there.

### 6.5 `reviews` — phase 3, but design the constraint now

`id`, `partner_id`, `listing_id` nullable, `enquiry_id` **nullable but strongly preferred**,
`reviewer_user_id`, `rating` (1–5), `title`, `body`, `status` (`PENDING` \| `PUBLISHED` \| `REJECTED`),
`partner_response`, `partner_responded_at`.

**Tie a review to an enquiry wherever possible.** A review with a verifiable interaction behind it is
the difference between a trust signal and a comment box. Unverified reviews on a small directory are
worse than no reviews — they read as astroturf whether or not they are.

### 6.6 Relationships

```
partner_tiers ──< partners ──< users                     (staff: partner_id = NULL)
                     │
                     ├──< service_areas
                     ├──< reviews
                     └──< service_listings >── service_categories (self-nesting, 2 levels)
                               │
                               ├──< listing_media
                               ├──< listing_attributes
                               └──< enquiries ──< enquiry_messages
                                        └──< enquiry_recipients >── partners
```

---

## 7. Row-level scoping — PM-5, and why the brief raises its priority

`MARKETPLACE_DOMAIN_PLAN.md` § *Row-Level Scoping* already specifies this correctly, and **none of it
changes under the new brief.** One module, `app/services/scoping.py`; `apply_scope()` on every list
path; `assert_can_read()` returning **404, never 403**, because a 403 confirms the row exists. Three
rules: never hand-roll `where(partner_id == ...)`; every partner-owned model carries a real
`partner_id` column; writes take `partner_id` from the **actor**, never the request body.

**What the directory adds is a second axis the existing spec does not cover: public reads.**

| Actor | Sees |
|---|---|
| Staff with `has_admin_access` | Everything |
| Partner user | Their own rows only — every table in § 6 |
| **Signed-in buyer** | **`PUBLISHED` listings of `is_listed` partners, plus their own enquiries** |
| **Anonymous visitor** | **`PUBLISHED` listings of `is_listed` partners. Nothing else. No actor object at all** |

The last row is the dangerous one. Every scoping function in the existing spec takes `actor: User`.
**A public directory has requests with no user**, and `actor.partner_id` on `None` raises
`AttributeError` — which in FastAPI is a 500, not a leak, so it fails safe. But the *tempting* fix is
`if actor is None: return stmt` — returning **everything unfiltered to the anonymous internet**.

> **Design `apply_scope` to take `Optional[User]` from the first line of code, with the anonymous
> branch being the most restrictive, not the least.** Add a test that a `None` actor cannot see a
> `DRAFT` listing before there is a single listing in the database. This is the one place in the
> whole plan where a mistake is a public data breach rather than a bug.

PM-5 is already the highest open priority in `TECH_DEBT.md` and the hard gate in front of the
marketplace domain. The brief does not change that — it raises the cost of getting it wrong from
"one partner sees another's quotes" to "the internet sees unpublished listings".

---

## 8. Search, taxonomy and the public surface

**Start from what buyers filter on, not from the schema.** Four filter types cover essentially all
buyer decision patterns:

| Type | In this domain |
|---|---|
| Categorical inclusion | Category, service area, partner tier, verification level |
| Numeric range | Price from/to, rating, years in business |
| Binary availability | Remote-capable, verified, currently accepting enquiries |
| Hierarchical | Category → subcategory; country → state → city |

Every one of those is a real indexed column in § 6 — deliberately. Faceting over `listing_attributes`
would not be.

### Do not reach for a search engine yet

Postgres full-text search over `title`, `summary`, `description` and partner name, combined with real
columns for every facet, carries this to a few thousand listings comfortably. Adding Elasticsearch or
Meilisearch to a stack that today has **no queue, no scheduler, no cache and no production topology**
buys a search feature and a second datastore to operate. `CORE_HARDENING_PLAN.md` PM-44 has not even
introduced Redis yet.

- Add a `tsvector` column with a GIN index, maintained by trigger.
- Reuse `ListSpec` / `run_list` (`app/core/query.py`) — the sortable allowlist and required tiebreak
  are exactly right for a public listing index and already prevent the `sort_by` injection class.
- **Revisit only when a measured query is slow**, not when the listing count reaches a round number.

### The public surface is new architecture

Reading A needs pages that are **indexable and cacheable** — which this app has never produced. Every
existing route sits behind `middleware.ts`. Before costing it:

- `middleware.ts` must distinguish public from protected paths, and the default must stay *protected*
- Listing and profile pages want stable canonical URLs — `/partners/<slug>` and
  `/services/<category>/<listing-slug>` — plus `JobPosting`-style structured data for rich results
- Rendering strategy is a real decision (this is **not** the Next.js in your training data — read
  `node_modules/next/dist/docs/` before choosing), and it interacts with the brand-theming layer
- **The SEO half is a marketing commitment, not a build task.** A directory nobody links to ranks
  nowhere. If no one owns that, choose reading B and skip this entire subsection

**Sources:** [Lowcode Agency — search & filtering design for marketplaces](https://www.lowcode.agency/blog/search-filtering-system-design-for-marketplace-apps) ·
[WisePIM — product search facets](https://wisepim.com/ecommerce-dictionary/product-search-facets)

---

## 9. Trust — the actual differentiator

An open directory earns trust through scale and reputation systems it takes years to accumulate. **A
closed one can borrow it from the host brand on day one.** That is the single strongest argument for
the brief, and it should be built deliberately rather than assumed.

| Signal | Source | Available at launch? |
|---|---|---|
| **Leapswitch verification** | Staff approved the partner and their listings | **Yes — and it is the whole product.** Nobody else can offer it |
| **Partner tier** | `partner_tiers`, already modelled | Yes |
| **Response rate / time** | Derived from `enquiries.first_responded_at` | After ~4 weeks of traffic |
| **Reviews** | § 6.5 | No — needs completed enquiries first |
| **Years in business, credentials** | Partner profile, staff-checked | Yes |

### Ranking — publish the rule

Search order is where a partner directory becomes political. Whatever the formula, **write it down
and show it to partners.** An unexplained ordering will be read as favouritism, and in a closed
directory the aggrieved party is a business relationship, not an anonymous user.

Suggested default, in order: verification level → featured (paid or tier-granted, **and labelled as
such**) → response rate → rating → recency of activity. Sponsored placement improves the platform's
economics *and* the buyer's match rate, but only when it is visibly marked.

**Never let a paid slot outrank a verification failure.** The moment a suspended or unverified partner
can buy the top position, the trust that justified the closed model is gone.

---

## 10. Monetisation — options, not a recommendation

The brief did not mention revenue, so this section is deliberately a menu. It matters now only
because two of the four options change the schema.

| Model | Schema impact | Fit |
|---|---|---|
| **Free** — a value-add for the channel | None | **Most likely correct for v1.** Prove the loop before pricing it |
| **Tier-gated entitlements** — listing count, featured slots by tier | Small — columns on `partner_tiers` | Natural fit; the table already exists |
| **Pay-per-lead** — Justdial's model | **Large** — a wallet, ledger, lead pricing, and a dispute process | Only with real volume. Lead disputes kill partner programmes; do not build this without deciding who adjudicates |
| **Commission on transactions** | **Largest** — payments, invoicing, tax, refunds | Not without on-platform transactions, which the brief does not describe |

> **`enquiries` should carry a nullable `billable_amount` / `billed_at` from the start.** Two columns
> now; a migration of the highest-volume table later. Everything else can wait.

---

## 11. Build sequence

Each phase ends with something demonstrable. Ordering is deliberate — **the two riskiest things
(scoping, and whether anyone actually uses it) come first, not last.**

| # | Phase | Ends with | Depends on |
|---|---|---|---|
| **0** | **Decide.** § 0 reconciliation, § 3 reading, and the partner count | A one-paragraph answer in this file | **The owner. Nothing starts without it** |
| 1 | `partners` + `partner_tiers` + `users.partner_id`, staff CRUD, approve/suspend, org-status gate in `get_current_user` | Staff can onboard a partner org and its logins | Phase 0 |
| 2 | **`scoping.py` + permissions, with the `Optional[User]` anonymous branch and its test** | A partner user provably cannot see another partner's rows; an anonymous request provably sees nothing | Phase 1. **Must precede the first partner-owned table** |
| 3 | `service_categories` + staff taxonomy admin | Staff can build the category tree | Phase 2 |
| 4 | `service_listings` + media + partner authoring UI + staff moderation queue | A partner drafts a listing; staff publish it | Phase 3 |
| 5 | **Buyer surface** — browse, facet, listing detail | Someone outside the company can find a partner | Phase 4 |
| 6 | `enquiries` + `enquiry_recipients` + `enquiry_messages` + partner inbox | A buyer contacts a partner and the partner replies on-platform | Phase 5, **and PM-27** |
| 7 | Response metrics, ranking, staff market dashboard | The trust signals in § 9 become real | Phase 6 + ~4 weeks of traffic |
| 8 | Reviews; then fan-out; then monetisation | — | Phase 7 |

### Two hard dependencies outside this plan

1. **PM-27 — email.** Phase 6 is worthless without it. An enquiry that does not reach the partner by
   email is a lead lost, and there is no mail transport today. **This is a blocker on the core value
   loop, not a nice-to-have.** It is currently listed as blocked on the owner, awaiting a provider.
2. **PM-5 — scoping.** Phase 2. Already the highest open priority in the register.

### On tests, and a request to revisit the standing decision

`MARKETPLACE_DOMAIN_PLAN.md` records the owner's 2026-08-03 decision that automated tests come after
the build, not alongside it. **That decision was taken for a private, authenticated reseller portal.**
Phase 5 puts unauthenticated pages on the public internet, where a scoping regression is a disclosure
rather than an inconvenience.

**The narrow ask: test phase 2, and only phase 2.** A handful of cases — anonymous actor, wrong-partner
actor, staff actor, `DRAFT` vs `PUBLISHED` — is perhaps half a day, and it is the only part of this
system whose failure mode is a headline. The rest of the standing decision can stand. The suite exists
and CI runs it; note that it cannot currently be run locally (`pytest` is absent from the backend dev
image — `PLANNING.md` § 4.2).

---

## 12. Open decisions — the owner, not effort

Ordered by how much rework the wrong answer costs.

| # | Decision | Blocks | Cost of deciding late |
|---|---|---|---|
| 1 | **Directory, reseller quoting, or both?** (§ 0) | Everything | Building the wrong product |
| 2 | **Who is the demand side — A, B or C?** (§ 3) | Phase 5, and whether the public surface exists at all | An entire surface built for nobody |
| 3 | **How many partners?** (§ 3) | The shape of phases 5 and 8 | Faceted search over 20 listings |
| 4 | **Who owns buyer acquisition?** | Whether reading A is viable | A directory with no traffic |
| 5 | **One enquiry → one partner, or fan-out to several?** (§ 6.4) | Phase 6 schema | Migrating the busiest table. *Mitigated by building `enquiry_recipients` from day one* |
| 6 | **Do partners set prices publicly, or is everything `ON_REQUEST`?** | Listing form, facets | Rework of the primary filter |
| 7 | **Who moderates listings, and against what standard?** | Phase 4 is undeliverable without an owner | A review queue nobody drains |
| 8 | **Revenue model** (§ 10) | Phase 8 only | Low — two nullable columns cover it |
| 9 | **Does a buyer get an account?** | Phase 6 | Medium — `buyer_user_id` is already nullable |
| 10 | **Does this replace or sit beside the existing project name?** | Branding | Low — `DYNAMIC_BRANDING_PLAN.md` already makes identity configurable |

**Decisions 1–4 are not technical.** No amount of engineering resolves them, and every one of them
changes what gets built. They are the correct next action.

---

## 13. Honest risks

- **Demand, not supply, is the failure mode.** § 3. The brief solves supply and is silent on demand.
- **A closed directory has a supply ceiling.** Curation is the moat *and* the cap. If Leapswitch has
  30 partners, a buyer who finds no match once will not return — and unlike an open directory, there
  is no long tail to catch them.
- **Two products competing for one small team.** LeapDesk parity is 2 of 9 modules and is the current
  stated focus. This is a second product, not a feature. `PLANNING.md` § 5 already warns that
  confusing the two queues is how work stalls — this adds a third.
- **The public surface is new architecture**, not another page. § 8.
- **Moderation is an ongoing staffing cost**, not a build. Every curated directory that stopped
  moderating became an open directory with extra steps.
- **90 uncommitted paths.** `PLANNING.md` § 2 calls shipping the existing tree the largest and most
  urgent item. **Nothing in this plan should start before that is resolved.**

---

## Related Documentation

- [`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md) — **the plan this one contradicts.** Read § 0 before either
- [`PLANNING.md`](./PLANNING.md) — current state, the two queues, and the uncommitted tree
- [`TECH_DEBT.md`](./TECH_DEBT.md) — PM-5 (scoping), PM-11 (tests), PM-27 (email)
- [`CORE_HARDENING_PLAN.md`](./CORE_HARDENING_PLAN.md) — the platform layer beneath all of this
- [`../core/AUTHORIZATION.md`](../core/AUTHORIZATION.md) — the RBAC this extends, and § Data Visibility
- [`../core/USERS.md`](../core/USERS.md) — why `partner_id` belongs on `users`
- [`../system-design/NEXTJS_STANDARDS.md`](../system-design/NEXTJS_STANDARDS.md) — before building any public surface
