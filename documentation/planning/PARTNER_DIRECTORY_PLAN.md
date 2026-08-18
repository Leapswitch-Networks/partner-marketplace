# Partner Directory Plan — "Justdial, but only for our partners"

**Status: decided in shape, not yet built.** Decisions 1, 2 and 3 were taken by the owner on
**2026-08-10** — see § 0.1. The product is the **directory**, the demand side is the **public**
(reading A), and the partner count is **300+**. Eight decisions remain open in § 12; decision 4 is now
the one carrying the most risk.

> 🤖 **Building this? Start at [§ 19](#19-build-instructions-for-an-implementing-agent).**
>
> § 19 is the **backend** execution contract: reading order, non-negotiable rules, exact internal API
> signatures, the file manifest, the `Principal` and `scoping.py` specs, permissions and routes for
> every module, the state machines, **a default for every open decision so you never have to stop**,
> and the acceptance check.
>
> **[§ 20](#20-the-frontend-page-by-page) is the frontend contract** — every public page with what it
> must have, must not have, its empty state, its SEO, and when it is done.
>
> **Do not implement from §§ 1–18** — those are the reasoning. § 17 is the schema; § 15 is the order.

**Revised 2026-08-10.** § 1 re-measured against the running system (11 tables → 12); § 7.1 added
because the actor-type recommendation in § 7 was overtaken by a better one and by code that does the
opposite; § 0.1 added to record the owner's decisions and what they close; **§ 14** — the full
inventory of backend modules and frontend pages; **§ 15** — those 34 items sequenced; and **§ 2.1 —
new research on why platforms like Justdial reach millions, which concludes we should not try to be
one.** Phase 1's backend is built (migration `a9f2c71e5b64`); its staff UI is not.

**Acted on the research, same day.** § 2.1's findings were pushed into the plan rather than left as a
reading: **§ 9.1** (five commitments we publish to partners), **§ 16** (how we know it is working, and
the two numbers to distrust), **§ 15.2b** (a proposal to build the enquiry loop *before* the public
surface), plus amendments to § 6.4 (`CATEGORY_BROADCAST` is the B2B loop), § 8 (the SEO surface is the
taxonomy, not volume), § 10, § 12 and § 13. **One real gap surfaced: nothing enforces
`partner_tiers.max_listings` — a tier is currently a label** (§ 14.1 row 2b).

> **Brief, as given (2026-08-07):** *"my admin needs this project to be a Justdial but for our
> partners — because each of our Leapswitch partners offers different services, so we need this
> platform to launch where only our partners will be there."*
>
> Everything below is either research with a source, a measurement of this repo taken today, or a
> proposal clearly marked as one. Planning docs are reference only — once code exists, the code wins.

---

## 0. Why there were two plans — resolved 2026-08-10

**The contradiction this section was written to expose has been decided: the directory won.** See
§ 0.1 for the decision itself. This section is kept because *why* the two plans differed is still the
clearest one-page statement of what the product is and is not — and because someone will eventually
ask why `MARKETPLACE_DOMAIN_PLAN.md` is still in the folder.

There is a `MARKETPLACE_DOMAIN_PLAN.md` in this folder, scoped on 2026-07-31 and parked. It models a
**completely different business** from the one described in the brief.

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

### The recommendation — ✅ accepted in full, 2026-08-10

**Build the directory; keep the existing plan's foundation; shelve its quoting half.** The owner's
decision (§ 0.1) confirmed this without amendment, so every verdict in the table below is now the
plan of record rather than a proposal:

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

---

## 0.1 The decisions, as taken — 2026-08-10

The three blocking decisions were answered by the owner. Recorded verbatim in substance, then
translated into what they close and what they open. **This is § 11's Phase 0 deliverable.**

> **The brief, restated by the owner (2026-08-10):** *Leapswitch gives the whole frontend and backend
> to partners as a platform. Verified partners get a dedicated back office where they add their
> services — the detail they want shown on the frontend, and what they offer. Members of the public
> visiting our frontend contact the partner directly based on their requirement. Because Leapswitch
> offers the platform, Leapswitch monitors everything.*

> ## 🔴🔴 CONFIDENTIALITY — the supply relationship is not public. Set 2026-08-18
>
> **The public surface must never state, imply, or let a reader infer that partners buy their
> infrastructure from us.** The relationship exists and is why partners are here; it is **between us
> and them only.** Buyers are not told.
>
> This came *after* the correction below and supersedes how that correction was first implemented —
> the reseller framing was built into every public page on 2026-08-18 and then stripped out again the
> same day. What the public sees is a **Justdial-shaped directory**: partners advertise the expertise
> they have, buyers browse by requirement and send an enquiry through the platform, and the partner
> reads it in their back office here.
>
> | ❌ Never on a public page | ✅ Instead |
> |---|---|
> | "Verified by Leapswitch" | "Checked before listing" — the platform verifies, unattributed |
> | "What they carry from us" | Nothing. There is no such field and no such section |
> | Datacenter counts, ISO certs, uptime, customer totals as **ours** | Nothing. They imply we are the supplier |
> | Leapswitch / CloudPe / CloudJiffy as brands | Nothing |
> | An `@leapswitch.com` address anywhere in global chrome | Route through `/contact` |
>
> **The one permitted exception is the operating entity on `/terms`, `/privacy` and `/contact`.** A
> legal document must name who is behind it, and a marketplace naming its operator is ordinary —
> Justdial names Just Dial Ltd. That discloses *who runs the site*, not *where partners buy servers*.
> **Do not extend it beyond those three pages**, and specifically not into the footer, which renders
> everywhere.
>
> The enforcement that is not a rule: **there is no field in the frontend model for what a partner
> resells.** A column that does not exist cannot be rendered by a component somebody writes next
> month. Keep it that way when the schema is designed — the join belongs on the authenticated side.
>
> ---
>
> ## 🔴 Decision 1 was CORRECTED by the owner on 2026-08-18 — read this before the table
>
> The row below is **wrong as written**, and it was wrong for eight days. The owner's correction:
>
> > *"Our partners take services from us and then sell by their name."*
>
> **Partners are resellers and managed-service providers.** They buy Leapswitch infrastructure at
> wholesale, sell it under their own brand, and add their own support, packaging and billing on top.
> They are not independent consultancies that Leapswitch merely vouches for.
>
> | | Recorded 2026-08-10 | Correct, 2026-08-18 |
> |---|---|---|
> | What a partner sells | Their own services | **Our infrastructure, under their name, plus their own value on top** |
> | Who sets the buyer's price | n/a | **The partner.** They publish their own packaged prices, margin included |
> | What differentiates partners | Their specialities | **What they add** — the Leapswitch half is identical by definition |
>
> **What this does NOT reinstate:** the shelved `quotes` / `quote_items` / nine-state approval
> machine. This is a *reseller relationship*, not a quoting product — the buyer transacts with the
> partner directly and off-platform. § 0's recommendation to keep `partners`, `partner_tiers`,
> `users.organisation_id` and the scoping module still stands, unchanged.
>
> **What it does change:** the schema needs to express *which Leapswitch services a partner carries*
> and *what they add* as two different things — the frontend already models it that way in
> `frontend/lib/public/homeContent.ts`, and that file is currently the only written record of the
> corrected shape. It is a **join to a Leapswitch service catalogue**, which no table represents yet.
>
> ⚠️ **The pricing decision carries a stated risk the owner accepted.** Partners publishing their own
> prices makes this directory comparable on price between our own partners, which tends to push
> margins toward zero. It is mitigated in the UI, not in the data: nothing sorts or ranks by price,
> there is no comparison table, and a price only ever appears inside a partner's own card or profile.
> **Keep it that way** — a sortable price column would turn a trust directory into a race to the
> bottom, and it would be one line of code to add.

| # | Decision | Answer |
|---|---|---|
| 1 | Directory, reseller quoting, or both? | ~~**The directory.** Partners supply their *own* services~~ **CORRECTED 2026-08-18 — see above** |
| 2 | Who is the demand side? | **Reading A — the public.** Unauthenticated visitors browse and make contact |
| 3 | How many partners? | **300+** |

**This confirms § 0's recommendation without amendment.** `partners`, `partner_tiers`,
`users.partner_id` and the scoping module are kept; `quotes`, `quote_items` and the nine-state approval
machine are **shelved**; `catalog_categories` / `products` are **replaced** by partner-authored
listings under a Leapswitch-owned taxonomy. The "organisation with multiple logins" decision stands.

**The owner's three sentences are § 5's three surfaces**, which is a useful confirmation that the
document and the brief describe the same thing:

| Owner's words | § 5 surface | Status in this codebase |
|---|---|---|
| "a dedicated backend where they add their services" | Partner surface | Looks like the existing dashboard. **Scoped to one organisation — needs PM-5** |
| "public visiting our frontend contact them" | Public / buyer surface | **Never built here.** Every route today sits behind `middleware.ts` — § 8 |
| "we will monitor all things" | Staff surface | **Already exists in shape** — this is the admin shell the core builds |

### What these answers close

- **§ 3 is settled.** Reading A is chosen, so the public surface is in scope and § 8 is a real phase,
  not an optional one. B and C are no longer live readings.
- **§ 4's comparables become directly applicable** — Clutch's faceting and the AWS/Salesforce
  "vendor authors the fields, partner authors the content" template are the right references.
- **§ 6's schema needs no change.** It was deliberately identical under A, B and C, and it is.
- **The B-wedge remains available as a launch *tactic*, not a different product.** Nothing prevents
  lighting the same listings up for signed-in customers first; § 3 established that opening them to
  the public later is a routing and SEO change, not a schema change. **Not decided — noted as open.**
  **Strengthened 2026-08-10:** § 2.1 now argues for it on evidence rather than caution, and § 15.2b
  turns it into a concrete ordering proposal — build the enquiry loop before the public surface, so
  the one number in § 16.1 exists a phase earlier and decision #4 leaves the critical path.

### What these answers make harder, and it is not a small amount

| Consequence | Why the answers cause it |
|---|---|
| **§ 9 becomes the hardest section of the build** | 300+ partners is the band where the plan explicitly says you have a *ranking problem*. With ~2–5 listings each that is roughly 600–1,500 listings competing for position, and the ordering has to be defensible to 300 businesses who can all see it |
| **§ 7's anonymous branch stops being hypothetical** | Reading A means real requests with **no actor object at all**. § 7.1's `Principal` decision is now on the critical path, not adjacent to it |
| **§ 8's public surface is confirmed new architecture** | Indexable, cacheable, unauthenticated pages — a shape this app has never produced. Cost it as a phase |
| **Moderation becomes a standing staffing cost** | 300+ partners authoring listings into a `PENDING_REVIEW` queue. § 13 already warns that every curated directory that stopped moderating became an open directory with extra steps |
| **Decision 4 is now the biggest open risk** | See below |

> ### ⚠️ Decision 4 is now the most dangerous item in this document
>
> Reading A was chosen, which means **buyer acquisition is a real commitment and nobody owns it yet.**
> § 13's first risk is that demand, not supply, is the failure mode — and the brief solved supply
> completely while saying nothing about demand. A public directory of 300+ verified partners that no
> one visits is a worse outcome than a smaller directory with warm traffic, because the supply side
> will have done real work for nothing and will notice.
>
> **This does not block phases 1–4** — the partner back office and the staff shell are worth building
> under any answer. **It blocks phase 5 being worth shipping.** Name an owner for SEO and traffic
> before phase 5 starts, or adopt the B-wedge for launch and treat public as a later milestone.

### Still open

Decisions **4, 5, 6, 7, 8, 9 and 10** in § 12 are unanswered. Of those, **4 (buyer acquisition)** and
**7 (who moderates, against what standard)** are the ones that change whether the thing works rather
than what it looks like — and 300+ partners makes both heavier than they were when this plan was
written.

---

## 1. What this repo actually has today — re-measured 2026-08-10

Not read from another register. Measured against the running database and the working tree.

| Check | Result | Change since 2026-08-07 |
|---|---|---|
| Tables in the database | **12** — `users`, `roles`, `permissions`, `permission_groups`, `role_permissions`, `user_roles`, `user_sessions`, `user_invitations`, `activity_log`, `app_settings`, `data_access_grants`, `alembic_version` | **+1** — `data_access_grants` |
| Marketplace-domain tables | **Zero** | unchanged |
| Seeded permissions | **34** — none of them partner, listing, or enquiry related | unchanged |
| `partner_id` / `partner_tier` anywhere in `backend/app/` | **No matches** | unchanged |
| Row-level scoping (`app/services/scoping.py`) | **Does not exist** — PM-5 is open | unchanged |
| Anything row-scoping *shaped* | **Yes, and this is new** — `app/services/data_access_service.py`, 9 functions, still uncommitted. See § 7.1 | **New** |

So the entire domain in this document is greenfield. Nothing here is a refactor.

> **One measurement moved in a way that matters.** `data_access_service.py` is the first code in this
> repo to do row-level filtering, and it was written the same day as this plan. It is not `scoping.py`
> and does not close PM-5 — it scopes by *creator* via delegated grants, not by organisation — but it
> is the file the next developer will copy when they build `apply_scope`. § 7.1 records what it means
> for § 7's recommendation, which it contradicts.

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

> **§ 2.1 researches this further and reaches a sharper conclusion:** the two forces currently taking
> Justdial's business apart are *"Google is better at general"* and *"vertical specialists are better
> at specific"* — and a Leapswitch partner directory sits on the **specialist** side of that split.
> The brief's instinct is right; the platform it names is the loser in that fight, not the winner.

**Sources:** [StartupTalky — Justdial business model](https://startuptalky.com/justdial-business-model/) ·
[Vizologi — Justdial business model canvas](https://vizologi.com/business-strategy-canvas/justdial-business-model-canvas/) ·
[Work Theater — decoding Justdial](https://worktheater.com/decoding-the-business-model-of-justdial/) ·
[DCFmodeling — Just Dial history & how it makes money](https://www.dcfmodeling.com/blogs/history/justdialns-history-mission-ownership)

---

## 2.1 R&D — why these platforms reach millions, and what of it transfers

Researched 2026-08-10, on the question *"why is Justdial so famous and used by millions, and how do we
build something like that at Leapswitch?"* Sources at the end of each part.

**The headline finding is uncomfortable and worth stating before the evidence:** almost none of what
made Justdial famous is available to us, and **the part that is available is better than what they
have.** "Used by millions" is the wrong target for Leapswitch. Chasing it copies the weakest part of
their model at the exact moment it is failing them.

### 2.1.1 The four engines behind the fame

| # | Engine | What it actually was |
|:--:|---|---|
| 1 | **They were early, and the alternative did not exist** | Founded **1996**, ₹50,000, a garage, 5–6 people. The product was a *phone number* you called instead of leafing through a paper directory. India had effectively no consumer internet. Website 2000, app 2007 — each riding a wave of penetration rather than creating one |
| 2 | **Supply breadth became an SEO surface** | By 2012: **over 7 million listings** and **1.9 million calls a day**. Millions of listing pages is millions of indexable, long-tail pages — "plumber in Andheri" — which is a distribution machine no amount of advertising buys |
| 3 | **The lead, not the listing, is the product** | Businesses buy lead packages and are charged when a qualified lead arrives. One consumer query is distributed to **four to seven competing providers**, so the same demand is monetised several times over and the response race generates the engagement |
| 4 | **Brand recall and habit** | Two decades of a single memorable number and a defensible database. Their own moat is described as breadth of listings **plus brand recall** — and note the second half is the part money cannot rebuild quickly |

**Engine 1 is unavailable to anyone in 2026. Engine 4 takes twenty years.** Engines 2 and 3 are
mechanics, and mechanics transfer.

### 2.1.2 The model is under real pressure, right now

This matters more than the origin story, because the brief asks to build one *today*:

- **Google eats the horizontal case.** People increasingly search Google for the business directly
  rather than going to a directory first. Justdial's problem is structural: it must keep enough
  consumer traffic to justify SME subscriptions while Google gives businesses free listings, which
  narrows the perceived gap between a paid listing and a free one.
- **Vertical specialists eat the categories.** Zomato, Practo and Urban Company each took a slice
  that a horizontal directory used to own. A focused player beats a general one inside its own
  category — which is the single most relevant fact in this entire document, because **Leapswitch
  would be building a vertical, not a horizontal.**

> **Read that pairing carefully.** The two forces killing Justdial are "Google is better at general"
> and "specialists are better at specific". A Leapswitch partner directory sits on the *specialist*
> side of that split. The brief's instinct is sound; the analogy it reaches for is the loser in the
> fight, not the winner.

### 2.1.3 Three practices we must not copy — and one of them would be fatal here

Justdial is also a cautionary reference, and these are the reasons its own listed businesses complain:

| Practice | Why it is disqualifying for us |
|---|---|
| **Selling a lead that named you to your competitors** | When a buyer specifically contacts one business, that lead is reportedly also sold onward. Justdial's suppliers are strangers. **Ours are partners we have commercial relationships with.** Doing this to a Leapswitch partner is not a product decision, it is damaging a business relationship, and they will find out |
| **Ranking on a business's own brand keywords** | Directory profiles outranking the business's own site hijacks traffic the partner earned. A partner discovering that Leapswitch outranks them for their own company name would reasonably regard it as competing with them |
| **Paid placement as the primary ranking signal** | § 9 already says never let a paid slot outrank a verification failure. The research says why it matters: paid placement is precisely what made directories feel adversarial to the businesses on them |

**The fan-out mechanic in § 2 needs re-reading in this light.** One enquiry to four-to-seven competing
providers is correct for anonymous strangers and corrosive among a partner network of 300 who talk to
each other. `enquiry_recipients` should still be built from day one — it is cheap insurance — but
**decision #5 now has an argument attached to it, not just a schema cost.**

### 2.1.4 IndiaMART is the better reference than Justdial

Nobody named it in the brief, but it is the same country, the same lead-generation mechanic, and
**B2B** — which is what Leapswitch actually is:

| | Justdial | IndiaMART |
|---|---|---|
| Buyer | A consumer looking for a plumber | **A business with a requirement** |
| Core loop | Call / enquiry to local businesses | **Buyer posts a requirement, suppliers respond with quotations** |
| Revenue | Lead packages, paid listings, ads | **Supplier subscriptions ≈ 95% of revenue**, plus pay-per-lead and ads |
| Scale | 7M+ listings (2012) | 143M+ registered buyers, 6.4M+ suppliers, 71M+ products/services |

Two things to take from it directly:

1. **Subscription, not pay-per-lead, is where the money actually is.** IndiaMART's 95% figure is the
   clearest available evidence that recurring supplier revenue beats per-lead billing — and § 10
   already warns that lead disputes kill partner programmes and that we would need someone to
   adjudicate them. **This strengthens the tier-gated entitlement option in § 10 and weakens
   pay-per-lead.**
2. **The B2B loop is enquiry-and-respond, not browse-and-buy.** Which is exactly what § 6.4 models.
   The domain design is already aimed at the right reference.

### 2.1.5 The niche advantage — the strongest finding for us

Industry research on directory performance is blunt about where a small directory wins:

- **A niche directory with domain authority 45 routinely outperforms a horizontal one with DA 90**
  for a matched audience. Authority predicts *ranking*; it does not predict whether the visitor is
  your customer.
- **Leads from niche directories convert roughly 40% faster**, because the visitor is further along in
  deciding by the time they use a specialised platform.
- Industry-specific placements generate around **3.2× more qualified traffic** than general ones.

> **This reframes the target.** The measure of success for a Leapswitch partner directory is not
> visitors. It is **enquiries per listed partner per month**, and the response rate against them. A
> directory doing 2,000 well-matched visits a month that produces real enquiries beats one doing
> 200,000 that produces none — and only the second one looks like Justdial.

### 2.1.6 What Leapswitch has that Justdial had to spend twenty years buying

The honest asset inventory, which is more favourable than § 3's framing alone suggests:

| Asset | Justdial in 1996 | Leapswitch in 2026 |
|---|---|---|
| Verified supply | None — cold-called into existence | **300+ partners already in a commercial relationship** |
| Trust in the curator | None | **The host brand vouches, and § 9 calls this "the whole product — nobody else can offer it"** |
| A first audience | None | **Existing Leapswitch customers**, already authenticated, already transacting |
| A defined niche | None — everything, everywhere | **Infrastructure and adjacent services**, a real vertical |
| Reason for supply to keep the listing current | Paid for it | **The channel relationship already exists** |

What we do **not** have, and cannot buy quickly: consumer traffic, brand recall in search, and any
reason for a stranger to visit. That is decision #4, and no amount of engineering substitutes for it.

### 2.1.7 So what does "build something like that" mean here — a proposal

**Marked as a proposal, not a decision.** Three ways to read the ambition, ordered by how much of the
research supports them:

| | Interpretation | Verdict on the evidence |
|---|---|---|
| **A** | *"Be a vertical directory that dominates its niche"* | **Strongly supported.** Niche beats horizontal on conversion; verticals are what is beating Justdial; we already hold the supply and the trust |
| **B** | *"Be a Justdial — a horizontal destination with mass traffic"* | **Contradicted.** That is the position Google is currently taking apart, and we would start with none of the four engines |
| **C** | *"Be an IndiaMART for infrastructure services"* | **Supported, and it is A with a revenue model attached** — supplier subscriptions via tiers, enquiry-and-respond as the loop |

**Recommendation: A, monetised eventually like C, and explicitly not B.** Concretely, and all of it
already fits the build order in § 15:

1. **Seed demand from the existing customer base first** — the B-wedge in § 3. It is the only
   demand that costs nothing to acquire, and IndiaMART's buyer side is business requirements, not
   browsing.
2. **Make the SEO surface the taxonomy, not the volume.** Engine 2 was millions of long-tail pages.
   Our equivalent is `category × city` (§ 8's atomic unit) across a real service taxonomy — hundreds
   of genuinely useful pages, not millions of thin ones.
3. **Instrument the enquiry loop before optimising traffic.** Response rate and time (§ 9, phase 7)
   are the trust signals, and they are also the only honest evidence of whether the directory works.
4. **Price it as entitlement, not per lead** — § 10's tier-gated option, which IndiaMART's 95%
   supports and which avoids the dispute process § 10 warns about.
5. **Publish the ranking rule** (§ 9), and never sell a named partner's lead onward (§ 2.1.3).

### 2.1.8 The honest verdict

**Justdial is famous because it was the only option for a decade in a market that was going online,
and it monetised the lead rather than the listing.** The first half is gone forever. The second half
is a mechanic we can copy, and § 6.4 already does.

**Leapswitch cannot build "a Justdial", and should be glad.** What it can build is the thing currently
taking Justdial's categories away from it: a focused, vetted, vertical directory where the curator's
endorsement is the product. That is a smaller, better business than the one the brief reached for —
and every piece of it is already specified in this document.

**The one thing this research does not solve is still § 3.** Every finding above assumes somebody
brings buyers. Nothing here answers decision #4, and § 2.1.6 is precise about why: traffic is the one
asset on that table we do not already hold.

**Sources:** [StartupTalky — Justdial business model](https://startuptalky.com/justdial-business-model/) ·
[StartupTalky — Justdial success story](https://startuptalky.com/justdial-success-story/) ·
[The Business Rule — Justdial case study](https://thebusinessrule.com/justdial-case-study-how-it-became-indias-no-1-local-search-engine/) ·
[AIMA Case Research — Justdial's network-effect defence](https://www.caseresearchaima.in/frontend/product_display/50) ·
[Sramana Mitra — Justdial needs to dial up innovation](https://www.sramanamitra.com/2017/08/24/indias-local-search-engine-justdial-needs-to-dial-up-innovation/) ·
[Mamits — Justdial SEO and Google rank 2025](https://www.mamits.com/justdial-seo-google-rank-2025/) ·
[StartupTalky — IndiaMART business model](https://startuptalky.com/indiamart-business-model/) ·
[AlphaStreet — IndiaMART overview](https://alphastreet.com/india/everything-you-need-to-know-about-indias-largest-b2b-marketplace-indiamart-intermesh-ltd/) ·
[Markhub24 — IndiaMART supplier subscription model](https://www.markhub24.com/post/indiamart-s-supplier-subscription-business-model) ·
[Jasmine Directory — niche vs general business listings](https://www.jasminedirectory.com/blog/niche-directories-vs-general-business-listings/) ·
[Shopify — how the Partner Directory works](https://help.shopify.com/en/partners/grow-your-business/partner-directory/how-it-works) ·
[Virto Commerce — vertical B2B marketplaces](https://virtocommerce.com/blog/vertical-b2b-marketplaces)

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

> **✅ DECIDED 2026-08-10: reading A — the public.** The owner's answer was that members of the public
> visit the platform's frontend and contact partners based on their requirement. B and C are ruled
> out. § 8's public surface is therefore **in scope and load-bearing**, not optional.
>
> **The B-wedge survives as a launch tactic, not as the product.** Nothing stops the same listings
> being lit up for signed-in Leapswitch customers first and opened to the public at phase 5 — that is
> a routing and SEO change, not a schema change. It is worth considering precisely because reading A
> makes § 13's demand risk real. **Not decided; see § 0.1.**
>
> The schema in § 6 was deliberately identical under all three readings, so this answer changes no
> table. What it changes is scope: § 4, § 8 and § 10 all stay at full size.

### The number that decides the shape

**How many partners does Leapswitch have?** This is not rhetorical — it changes the build:

| Partner count | What you are actually building | |
|---|---|---|
| ~10–30 | A **showcase page**. Search and faceting are over-engineering; a well-designed grid with filters is the whole product | |
| ~50–300 | A **directory**. Everything in this plan applies | |
| 300+ | A **marketplace** with a ranking problem, and § 9 becomes the hardest section | **✅ This one** |

**✅ ANSWERED 2026-08-10: 300+.** So this is a marketplace, not a directory and certainly not a
showcase. Two things follow immediately:

- **§ 9 is the hardest section of the build**, and its instruction to *publish the ranking rule* stops
  being good practice and becomes necessary. 300+ partners can all see their own position, and every
  one of them is a business relationship rather than an anonymous user.
- **§ 8's "do not reach for a search engine yet" still holds, but with less headroom than it reads.**
  At ~2–5 listings per partner that is roughly 600–1,500 listings — comfortably inside what Postgres
  full-text search with real facet columns carries, and well short of the few-thousand mark where the
  advice says to revisit. Revisit on a **measured slow query**, not on the partner count.

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

> **This section describes the domain in prose. [§ 17](#17-data-dictionary--every-table-every-column-every-foreign-key)
> is the implementable version** — every column with its exact name, type, nullability and default,
> every foreign key with its `ON DELETE`, every index, constraint and enum type. Build from § 17;
> read § 6 to understand *why* it is shaped that way. Where the two differ, § 17 is newer.

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
> **[§ 18.5](#185-a-proposed-starting-taxonomy) now offers a 15-category draft** derived from what
> Leapswitch actually sells and the vocabulary of its own Managed Services catalogue. It is a starting
> point for that interview, **not a substitute for it.**
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
| `source` | enum `LISTING` \| `PROFILE` \| `CATEGORY_BROADCAST`. **`CATEGORY_BROADCAST` is more important than it looks** — see below |
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

**Two `source` values are two different products, and § 2.1.4 says the second is the B2B one.**

| `source` | The buyer's act | Fan-out |
|---|---|---|
| `LISTING` / `PROFILE` | *"I read your page and I am contacting **you**."* | **Never.** Commitment 1 in § 9.1 — this enquiry belongs to the partner it named |
| `CATEGORY_BROADCAST` | *"I have a requirement. Who can do it?"* — the buyer never named anyone | **This is where fan-out legitimately lives**, because nothing is being taken from anyone |

IndiaMART's core loop is the second one: a buyer posts a requirement and suppliers respond with
quotations, and it is the larger B2B marketplace in the same country by a wide margin (§ 2.1.4). Our
schema already supports it — `CATEGORY_BROADCAST` was in the enum from the first draft. **What changed
on 2026-08-10 is the expectation that it may be the main path rather than a variant**, and that the
listing-detail enquiry is the *narrower* case rather than the default.

> This does not add a table or change a column. It changes what phase 6 should be measured against,
> and it makes decision #5 answerable: **support broadcast requirements, never redistribute a named
> enquiry.**

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

> ### ⛔ STOP — do not implement from this paragraph
>
> An earlier version of this section said *"design `apply_scope` to take `Optional[User]`"*. **That is
> superseded. Do not build it.** [§ 7.1](#71-the-optionaluser-recommendation-has-been-overtaken--three-registers-now-disagree)
> explains why, and **[§ 19.6](#196-scopingpy--the-exact-contract) is the signature to implement.**
>
> What survives from the original paragraph, unchanged and still the requirement: **the anonymous
> branch must be the most restrictive, not the least**, and a test proving a non-user actor cannot see
> a `DRAFT` listing must exist **before the first listing row does**. This is the one place in the
> whole plan where a mistake is a public data breach rather than a bug.

PM-5 is already the highest open priority in `TECH_DEBT.md` and the hard gate in front of the
marketplace domain. The brief does not change that — it raises the cost of getting it wrong from
"one partner sees another's quotes" to "the internet sees unpublished listings".

### 7.1 The `Optional[User]` recommendation has been overtaken — three registers now disagree

Added 2026-08-10. The paragraph above is the earliest of three positions on the same question, and it
is no longer the best one. Stated plainly so the next person does not implement the oldest.

| Register | Says the actor should be | Written |
|---|---|---|
| § 7 above | `Optional[User]` — a nullable user, anonymous as the `None` branch | 2026-08-07 |
| `LEAPDESK_PARITY_PLAN.md` Module 10 · `DAILY_CHANGES.md` 2026-08-10 | A **`Principal` union**, introduced **once, before** any of its callers exist | 2026-08-10 |
| **The code** | `actor: User`, hard-typed | 2026-08-07, uncommitted |

**Measured today, not assumed:** 75 `actor: User` annotations across 12 files; **zero** occurrences of
`Principal` anywhere in `backend/app/`. The codebase already carries *both* habits —
`activity_service.py` types `actor: User | None` and branches on `if actor is None`, while
`data_access_service.py` hard-types `actor: User` in all 9 of its functions.

**Why the `Principal` position wins.** The anonymous directory visitor is not a special case, it is
the third known caller that is not a `User` — after the machine consumer in the Module 10 research and
the tenant boundary in PM-5. `Optional[User]` models one of those three and forces the other two to be
bolted on later. A union models all three, with anonymous as the most restrictive branch **by
construction** rather than by remembering to write the branch.

**The concrete risk this creates, and it is not hypothetical.** `data_access_service.narrow_to_creators`
is already `apply_scope`-shaped — it takes a statement and an actor, and returns the statement filtered.
It is the nearest thing in the tree, it is uncommitted, and it is what someone will copy when they
build the real `scoping.py`. Copying it also copies `actor: User`, which is precisely the signature
§ 7 warns against, in the one place where the failure mode is public disclosure.

> **Revised recommendation, superseding the `Optional[User]` line above:** settle the `Principal` type
> **before** phase 2, not during it. Everything else in § 7 stands unchanged — in particular the test
> that a non-user actor cannot see a `DRAFT` listing, written before the first listing exists. That
> test is the requirement; the type is how it is made cheap to keep passing.
>
> This is a **core-platform decision, not a directory one.** It should be taken in
> `CORE_HARDENING_PLAN.md` and merely consumed here. Recording it in this document only, where it
> would be found by whoever builds the directory and by nobody else, is how it gets decided three
> separate times.

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

### The SEO surface is the taxonomy, not the volume

Added 2026-08-10 from § 2.1.1. Justdial's second engine was **millions of long-tail pages** — 7M+
listings, each an indexable answer to a specific query. That is a distribution machine no advertising
budget buys, and it is the one transferable engine of the four.

**We cannot have millions of pages and must not fake them.** With 300+ partners at a few listings
each, the honest surface is **`category × city`** — § 2's atomic search unit — crossed over a real
taxonomy. Hundreds of pages that each genuinely answer a question, not tens of thousands of thin
permutations that read as generated, which is what a programmatic-SEO approach degenerates into at
this scale.

| Page kind | Roughly | Earns its place when |
|---|---|---|
| `/services/[category]` | one per category and subcategory | The category has ≥3 listed partners |
| `/services/[category]` × city | category × served city | The pair has ≥2 listed partners in that city |
| `/partners/[slug]` | one per listed partner | Always — but see § 9.1 commitment 2: **canonical to the partner's own site** where they have one, so we never outrank them for their own name |
| `/services/[category]/[listing-slug]` | one per published listing | Always |

**The thresholds are the point.** § 4's warning about a UI that looks broken when empty applies
doubly to an indexed page: a category page with one partner on it is worse than no page, because it
is what a search engine and a buyer both judge the whole directory by. Generate the page when the
threshold is met, `noindex` it until then.

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

### 9.1 What we bind ourselves to — the partner-facing commitments

Added 2026-08-10 out of § 2.1.3. **These are product rules, and they should be published to partners
in the same document as the ranking rule.** Every one of them is a practice that made Justdial's own
listed businesses hostile to it, and the asymmetry matters: Justdial's suppliers are strangers to it,
while **ours are 300+ organisations we hold commercial relationships with, who talk to each other.**

| # | Commitment | What it forbids |
|:--:|---|---|
| 1 | **A lead that named you is yours.** | Selling or re-broadcasting an enquiry addressed to one partner to their competitors. This is the practice most complained about, and among a partner network it is a relationship problem long before it is a product one |
| 2 | **We will not compete with a partner for their own name.** | Letting a directory profile outrank the partner's own site on their brand terms. Practically: `noindex` on thin profiles, canonical pointing at the partner's site where they have one, and never bidding on partner brand keywords |
| 3 | **The ranking rule is published and mechanical.** | Unexplained ordering. § 9. In a closed directory the aggrieved party is a business relationship, not an anonymous user |
| 4 | **Paid placement is labelled, and capped below verification.** | A suspended or unverified partner buying the top slot |
| 5 | **A partner can see every enquiry they received and what happened to it.** | Opaque lead accounting — which is what makes pay-per-lead disputes unresolvable (§ 10) |

> **Commitment 1 is the one with a schema consequence.** It does not stop `enquiry_recipients` being
> built in phase 6 — that table is cheap insurance and should exist regardless — but it means
> **fan-out, if it ever happens, must be for enquiries that were never addressed to one partner in
> the first place** (`source = CATEGORY_BROADCAST`), never a redistribution of a `source = LISTING`
> enquiry. Decision #5 should be read as *"do we support broadcast requirements?"*, not *"do we
> resell leads?"*

---

## 10. Monetisation — options, not a recommendation

The brief did not mention revenue, so this section is deliberately a menu. It matters now only
because two of the four options change the schema.

| Model | Schema impact | Fit |
|---|---|---|
| **Free** — a value-add for the channel | None | **Most likely correct for v1.** Prove the loop before pricing it |
| **Tier-gated entitlements** — listing count, featured slots by tier | Small — columns on `partner_tiers` | **Now the recommended eventual model.** The table exists and is built. § 2.1.4: **subscriptions are ≈95% of IndiaMART's revenue** — the closest comparable there is — which is the strongest evidence available that recurring supplier revenue beats per-lead billing in B2B |
| **Pay-per-lead** — Justdial's model | **Large** — a wallet, ledger, lead pricing, and a dispute process | Only with real volume. Lead disputes kill partner programmes; do not build this without deciding who adjudicates. **§ 2.1.3 adds a second objection**: the practice that makes Justdial's own listed businesses hostile is selling a lead onward after a buyer named them. Among 300 partners who talk to each other, that is a relationship problem, not a pricing one |
| **Commission on transactions** | **Largest** — payments, invoicing, tax, refunds | Not without on-platform transactions, which the brief does not describe |

> **`enquiries` should carry a nullable `billable_amount` / `billed_at` from the start.** Two columns
> now; a migration of the highest-volume table later. Everything else can wait.

---

## 11. Build sequence

Each phase ends with something demonstrable. Ordering is deliberate — **the two riskiest things
(scoping, and whether anyone actually uses it) come first, not last.**

> **This table is the coarse shape. [§ 15](#15-the-order-of-work--every-item-sequenced) breaks it into
> 34 numbered steps** — every module and page from § 14, with its blockers. Work from § 15; if the two
> disagree, this table's phase boundaries win.

| # | Phase | Ends with | Depends on |
|---|---|---|---|
| **0** | ~~**Decide.** § 0 reconciliation, § 3 reading, and the partner count~~ | **✅ Done 2026-08-10 — § 0.1.** Directory · public · 300+ | — |
| 1 | ~~`partners` + `partner_tiers` + `users.partner_id`, staff CRUD, approve/suspend, org-status gate in `get_current_user`~~ | **✅ Backend done 2026-08-10** — migration `a9f2c71e5b64`, 9 permissions, 11 routes, the org gate, 31 smoke assertions. **Staff UI outstanding** | Phase 0 |
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

| # | Decision | Status | Blocks | Cost of deciding late |
|---|---|---|---|---|
| 1 | **Directory, reseller quoting, or both?** (§ 0) | **✅ Directory — 2026-08-10** | — | — |
| 2 | **Who is the demand side — A, B or C?** (§ 3) | **✅ A, the public — 2026-08-10** | — | — |
| 3 | **How many partners?** (§ 3) | **✅ 300+ — 2026-08-10** | — | — |
| 4 | **Who owns buyer acquisition?** | 🔴 **Open — now the highest risk** | Whether reading A is viable at all | A directory with no traffic, and 300+ partners who did real work for nothing |
| 5 | **One enquiry → one partner, or fan-out to several?** (§ 6.4) | 🟡 Open — **now has an argument, not just a schema cost** | Phase 6 schema | Migrating the busiest table. *Mitigated by building `enquiry_recipients` from day one.* **§ 2.1.3**: fan-out is what makes Justdial adversarial to its own listed businesses. It is defensible among anonymous strangers and corrosive among 300 partners who know each other |
| 6 | **Do partners set prices publicly, or is everything `ON_REQUEST`?** | 🟡 Open | Listing form, facets | Rework of the primary filter |
| 7 | **Who moderates listings, and against what standard?** | 🔴 **Open — heavier at 300+** | Phase 4 is undeliverable without an owner | A review queue nobody drains |
| 8 | **Revenue model** (§ 10) | 🟡 Open — **evidence now favours tier entitlements** (§ 2.1.4) | Phase 8 only | Low — two nullable columns cover it |
| 9 | **Does a buyer get an account?** | 🟡 Open | Phase 6 | Medium — `buyer_user_id` is already nullable |
| 10 | **Does this replace or sit beside the existing project name?** | 🟡 Open | Branding | Low — `DYNAMIC_BRANDING_PLAN.md` already makes identity configurable |
| 11 | **Which partner population is listable?** (§ 18.3) — Leapswitch already has **affiliates** and **resellers**; the directory partner is a third thing | 🔴 **New 2026-08-10** | The 300+ figure in § 0.1, and therefore § 3's shape | Building faceted search for a supply base that turns out to be a different, smaller set |
| 12 | **Do we list categories Leapswitch competes in?** (§ 18.7) — we sell web design and SEO ourselves | 🔴 **New 2026-08-10** | The taxonomy — it removes or keeps whole branches | Rebuilding the category tree, and a partner discovering we outrank them |

**Decisions 1–3 were taken on 2026-08-10 — see § 0.1.** They confirmed § 0's recommendation without
amendment and settled § 3's reading, which is why the public surface is now in scope.

**Decision 4 inherited their weight and is now the single most dangerous open item.** Choosing reading
A made buyer acquisition a commitment rather than an option, and § 13's first risk — that demand, not
supply, is the failure mode — became live the moment the answer was "the public". **Decision 7 is
second**, because 300+ partners authoring into a moderation queue is a standing staffing cost that
nobody has been named for. Neither is technical, and neither is resolved by engineering.

**One technical decision now sits outside this table:** the `Principal` actor type (§ 7.1). It belongs
in `CORE_HARDENING_PLAN.md` because three separate workstreams need it, and reading A put it on the
critical path.

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
- **Supply engagement is not solved just because the partners already exist.** Added 2026-08-10 from
  § 2.1.2. Justdial's structural problem is that Google gives businesses a free listing, which narrows
  the perceived gap between a paid listing and a zero-cost one — and **every one of our 300+ partners
  already has a Google Business Profile.** Having a commercial relationship gets us the sign-up; it
  does **not** get us a maintained, current listing. A directory of stale profiles is worse than none,
  because the enquiry goes to a number nobody answers. **The only durable answer is enquiry volume**,
  which puts this back on decision #4 as well.
- **Measuring the wrong thing is its own risk.** § 2.1.5: the temptation is to report visitors,
  because that number is available on day one and rises with any marketing spend. Enquiries per listed
  partner is the number that says whether the thing works, and it stays at zero for a long time.
  § 16 exists so the honest metric is agreed before there is any pressure to report the flattering
  one.
- ~~**90 uncommitted paths.**~~ **Resolved.** Measured 2026-08-10: `git status --porcelain | wc -l`
  returns **8**, and all but one are documentation edits from today. The tree `PLANNING.md` § 2 called
  "the largest and most urgent item" was shipped. **This gate is lifted — phase 1 is no longer blocked
  on it.** Two caveats: `PLANNING.md` § 2 still says 90 and is now stale, and
  `backend/app/services/data_access_service.py` remains **untracked**, which is the file § 7.1 warns
  will be copied into the scoping module.
- **The demand side is unowned.** Reading A was chosen on 2026-08-10 (§ 0.1) and decision 4 was not.
  This is the same first risk as above, now with the answer that makes it bite: a public directory of
  300+ verified partners that nobody visits fails on the demand side exactly as § 3 predicted.

---

## 14. The build inventory — every backend module and every page

Added 2026-08-10, after the decisions in § 0.1. This is the **surface area** — what exists at the end.
It exists so the size of the thing is visible in one place rather than inferred from a domain model.

> **Three registers, and each one answers a different question. Do not let them drift.**
>
> | Section | Answers |
> |---|---|
> | § 11 | *What are the phases, and what does each end with?* — the coarse shape |
> | § 14 (here) | *What is the total surface area?* — every module, every page |
> | **§ 15** | ***In what order is it built?*** — the sequenced work list, keyed to § 11's phases |
>
> § 15 is the one to work from day to day. If it and § 11 ever disagree, § 11's phase boundaries win
> and § 15 is wrong.
>
> ⚠️ **Since 2026-08-17 there is a fourth register, and for the frontend it is the one to trust.**
> [`FRONTEND_PLAN.md`](./FRONTEND_PLAN.md) consolidates the page tables in § 14.2, § 14.3, § 14.4,
> § 20.3, § 20.6.1 and § 20.6.3 into a single route register with **measured** build statuses. The
> tables below are kept because they carry the phase and module mapping — but where one of them says
> a page is or is not built, **`FRONTEND_PLAN.md` wins**; where they say what a page must *contain*,
> § 20 still wins. Two rows in § 14.4 were already stale when the measurement was taken.

Legend used throughout:

| Mark | Meaning |
|---|---|
| ✅ | Built and verified today |
| 🟡 | Specified in this document (§ 6, § 8, § 9) — not built |
| 🔵 | **Proposed here, not previously in this plan.** Flagged so it can be cut rather than absorbed silently |

> **Three surfaces, and § 5 already warned they are genuinely different applications.** The public
> site shares almost nothing with the admin shell — different rendering strategy, different auth,
> different caching. Counting them as "some more pages on the dashboard" is the single easiest way to
> under-cost this.

### 14.1 Backend modules

Each row is a module in the sense `FASTAPI_STANDARDS.md` § 11 means it: a model, a schema module, a
service, a router, and a row in the permission catalog.

| # | Module | Tables | Writes | Reads | Phase | Status |
|---|---|---|---|---|:---:|:---:|
| 1 | **Partners** — the organisation | `partners` | create · update · status · verify · publish · delete | staff list/detail, scoped to own org for a partner | 1 | ✅ |
| 2 | **Partner tiers** — entitlement reference data | `partner_tiers` | update what a tier grants | list | 1 | ✅ |
| 2b | **Entitlement enforcement** — `max_listings` / `featured_slots` actually checked | *(none)* | refuse publish past the tier's limit | usage vs allowance | 4 | 🔵 |
| 3 | **Scoping** — *not CRUD, and the gate in front of everything below* | none | none | `apply_scope` / `assert_can_read` | **2** | 🟡 |
| 4 | **Partner members** — the logins inside an organisation | `users`, `user_invitations` | invite into a partner · set org role · remove | list scoped to the org | 2 | 🔵 |
| 5 | **Service categories** — the shared taxonomy | `service_categories` | staff-only CRUD, 2 levels, reorder | tree, public | 3 | 🟡 |
| 6 | **Service listings** — the core object | `service_listings` | partner draft/submit · staff approve/reject/archive · feature | partner's own, staff all, public `PUBLISHED` only | 4 | 🟡 |
| 7 | **Listing media** | `listing_media` | upload · caption · reorder · delete | with the listing | 4 | 🟡 |
| 8 | **Listing attributes** — display-only facets | `listing_attributes` | set/unset per listing | with the listing | 4 | 🟡 |
| 9 | **Service areas** — category × geography | `service_areas` | set per partner or listing | filter input | 4 | 🟡 |
| 10 | **Moderation** — the staff review queue | *(view over `service_listings`)* | approve · reject with reason · bulk | queue, filtered by `PENDING_REVIEW` | 4 | 🟡 |
| 11 | **Public directory** — the anonymous read API | *(reads 5–9)* | **none, ever** | browse · facet · search · listing detail · partner profile | **5** | 🟡 |
| 12 | **Enquiries** — the actual product | `enquiries`, `enquiry_recipients` | create (often anonymous) · view · respond · close · mark spam | partner inbox, staff oversight, buyer's own | 6 | 🟡 |
| 13 | **Enquiry messages** — the on-platform thread | `enquiry_messages` | post as buyer / partner / staff | thread | 6 | 🟡 |
| 14 | **Response metrics** — what feeds ranking | *(derived from 12)* | recompute on write | partner's own, staff all | 7 | 🟡 |
| 15 | **Ranking** — *not CRUD; one ordering function* | none | none | applied by 11 | 7 | 🟡 |
| 16 | **Market dashboard** — staff oversight aggregates | *(reads 6, 12, 14)* | none | staff only | 7 | 🟡 |
| 17 | **Reviews** | `reviews` | submit · moderate · partner response | public on a listing | 8 | 🟡 |

**Four of these are not CRUD and will be mis-scoped if the list is read as seventeen identical
modules.** #3 is one file that every other module calls. #11 is a read API with no writes and a
different actor type. #15 is a single ordering function whose *politics* cost more than its code
(§ 9). #16 is aggregation over tables that must exist first.

**#4 is proposed, not previously specified.** Phase 1's stated end state is "staff can onboard a
partner org **and its logins**", and nothing in § 6 says how a person gets into an organisation. The
existing `user_invitations` module is the natural home — it needs a `partner_id` and a scoped list —
but that is an addition to a shipped module, so it is called out rather than assumed.

### 14.2 Public-facing frontend — the pages an anonymous visitor sees

**This whole section is new architecture.** Every route in the app today sits behind `middleware.ts`;
§ 8 is explicit that indexable, cacheable, unauthenticated pages are a shape this codebase has never
produced, and that the rendering strategy is a real decision to be made against
`node_modules/next/dist/docs/` rather than from memory.

Suggested route group: `app/(public)/`, a sibling of the existing `(auth)` and `(app)`.

| Route | Page | Why it exists | Phase | Status |
|---|---|---|:---:|:---:|
| `/` | **Home / landing** | Today this redirects straight to `/sign-in`. Under reading A it becomes the front door: search box, top categories, featured partners, the trust proposition | 5 | 🟡 |
| `/partners` | **Partner directory index** | Browse every listed partner. Facets: category, city, verification, tier | 5 | 🟡 |
| `/partners/[slug]` | **Partner profile** | The credential page — about, service areas, all their listings, contact CTA. § 4: decision-critical information goes **on** the page, not behind a click | 5 | 🟡 |
| `/services` | **Category index** | The taxonomy as a browsable tree — the other half of "category × city is the atomic search unit" | 5 | 🟡 |
| `/services/[category]` | **Category listing index** | Faceted results within a category. The four filter types in § 8 all land here | 5 | 🟡 |
| `/services/[category]/[listing-slug]` | **Listing detail** | The page an enquiry is sent from. Canonical URL, structured data | 5 | 🟡 |
| `/search` | **Search results** | Free-text across listings and partner names, Postgres FTS behind it | 5 | 🟡 |
| *(on the listing/profile page)* | **Enquiry form** | Deliberately **not** its own route — § 6.4 makes the enquiry the product, and a separate page loses the context the buyer was reading | 6 | 🟡 |
| `/enquiries/[reference]` | **Enquiry status** | A buyer with no account needs a link to see whether anyone replied. Depends on decision 9 | 6 | 🔵 |
| `/become-a-partner` | **Supply-side landing** | How a business joins. § 13's supply ceiling is real at 300+; this is where growth comes from | 5 | 🔵 |
| `/about`, `/contact` | **Static pages** | A directory with no "who runs this" reads as a scrape | 5 | 🔵 |
| `/terms`, `/privacy` | **Legal** | Non-optional the moment the public submits a form carrying name, email and phone | 6 | 🔵 |
| `not-found.tsx` | **404** | A public site gets crawled; a broken 404 is an SEO liability | 5 | 🔵 |
| `sitemap.xml`, `robots.txt` | **Crawl surface** | § 8: *"a directory nobody links to ranks nowhere."* Route handlers, not pages | 5 | 🔵 |

> **Six of these fifteen are marked 🔵 — proposed, not in the plan before today.** None is invention
> for its own sake: they are what a public site needs to *function* as one (legal, 404, sitemap,
> a supply-side door). But if **decision 4 (who owns buyer acquisition)** is never answered, the SEO
> rows in particular are effort spent on traffic nobody is going to send. Cut them together with the
> decision, not one at a time.

### 14.3 Back office — the partner's own surface

Authenticated, scoped to one organisation, and it looks like the existing dashboard. This is the
"dedicated backend" from the owner's brief.

| Route | Page | Backend module | Phase | Status |
|---|---|---|:---:|:---:|
| `/dashboard` | **Partner overview** — listing count vs entitlement, new enquiries, response time | 1, 14 | 4 | 🟡 |
| `/dashboard/organisation` | **Their partner record** — the public-facing half only. Never `notes`, never `status` | 1 | 4 | 🔵 |
| `/dashboard/organisation/branding` | **Logo and banner upload** — reuses the existing brand-asset pipeline (§ 6.1) | 1 | 4 | 🔵 |
| `/dashboard/organisation/areas` | **Service areas** — where they operate, remote or not | 9 | 4 | 🟡 |
| `/dashboard/team` · `/team/invite` | **Their logins** — invite, assign an org role, remove | 4 | 2 | 🔵 |
| `/dashboard/listings` | **Their listings** — index with status, views, enquiry count | 6 | 4 | 🟡 |
| `/dashboard/listings/new` · `/[id]/edit` | **Listing authoring** — the form the whole product depends on. § 4: *their* forms are enormous, ours should not be | 6, 7, 8 | 4 | 🟡 |
| `/dashboard/listings/[id]` | **Listing detail** — status, rejection reason, media, performance | 6 | 4 | 🟡 |
| `/dashboard/enquiries` | **The inbox.** The single most important authenticated page in the product | 12 | 6 | 🟡 |
| `/dashboard/enquiries/[id]` | **Enquiry thread** — reply on-platform, which is the only way response time is measurable rather than self-reported | 13 | 6 | 🟡 |
| `/dashboard/reviews` | **Reviews received**, and the right of reply | 17 | 8 | 🟡 |
| `/dashboard/entitlements` | **Tier and usage** — listings used of allowed, featured slots | 2 | 4 | 🔵 |
| `/settings/*` | **Personal settings** — profile, password, appearance | *(exists)* | — | ✅ |

### 14.4 Back office — Leapswitch staff only

Authenticated, **unscoped**, and this is almost exactly the admin shell the core already builds. The
owner's *"we will monitor all things"*.

| Route | Page | Backend module | Phase | Status |
|---|---|---|:---:|:---:|
| `/dashboard/partners` | **Partners index** — status, verification, tier, listing count | 1 | 1 | ✅ *(listing-count column still to add)* |
| `/dashboard/partners/new` | **Onboard a partner** | 1 | 1 | ✅ |
| `/dashboard/partners/[id]` | **Partner detail** — with activate / suspend / verify / publish as distinct actions, because they are distinct permissions | 1 | 1 | ✅ |
| `/dashboard/partners/[id]/edit` | **Edit a partner** — cannot reach status, verification or listing | 1 | 1 | ✅ |
| **`/dashboard/partner-tiers`** | **Tier entitlements** | 2 | 1 | ✅ *(entitlement columns still to add)* |
| `/dashboard/categories` | **Taxonomy admin** — the tree, reordering, activation. Leapswitch owns this table and partners never write to it (§ 6.2) | 5 | 3 | 🟡 |
| `/dashboard/moderation` | **The review queue.** § 4 and § 13 both warn: a queue nobody drains turns a curated directory into an open one with extra steps | 10 | 4 | 🟡 |
| `/dashboard/listings` | **All listings** — oversight across every partner | 6 | 4 | 🟡 |
| `/dashboard/enquiries` | **All enquiries** — response times, unanswered, conversion | 12, 14 | 6 | 🟡 |
| `/dashboard/reviews` | **Review moderation** | 17 | 8 | 🟡 |
| `/dashboard/market` | **Market dashboard** — the § 5 diagram's bottom line: every enquiry, response time and conversion | 16 | 7 | 🟡 |
| `/dashboard/users` · `/roles` · `/invitations` · `/activity` | **Existing core admin** — needs `partner_id` shown and filterable | *(exists)* + 4 | 2 | ✅ / 🟡 |
| `/settings/branding` etc. | **Application settings** | *(exists)* | — | ✅ |

**The staff surface is the cheapest of the three**, and that is worth saying plainly: rows 1–5 already
have their API, and the rest are `ListSpec`-driven index pages of the kind this codebase now builds
repeatably. The expensive surfaces are §14.2 (new architecture) and the listing authoring form.

> **Corrected 2026-08-17 — rows 1–5 are further along than "they have their API".** All five pages
> are built and wired to `PartnersModule`, `PartnerForm`, `PartnerShow` and `PartnerTiersModule` in
> `components/admin/`; the statuses above said otherwise until they were measured. The tier route is
> **`/dashboard/partner-tiers`**, not `/dashboard/partners/tiers` as this table and § 20.6.3 both
> wrote it. Both fixed above; § 20.6.3's copy still carries the old path.

### 14.5 What is deliberately NOT on these lists

| Not building | Why |
|---|---|
| Quotes, quote items, the nine-state approval machine | Shelved with the reseller product — § 0.1 |
| *(everything below is deferred, not refused — each names the decision it waits on)* | |
| A local catalog (`catalog_categories`, `products`) | Replaced by partner-authored listings |
| `customers` as a partner-owned CRM | A directory's buyer is not a CRM record the partner owns (§ 0) |
| Payments, wallet, lead billing, invoicing | § 10 — only two nullable columns on `enquiries` are needed now; the rest waits for a revenue decision (#8) |
| Elasticsearch / Meilisearch | § 8 — Postgres FTS carries this comfortably at the expected volume. Revisit on a **measured** slow query, never on a listing count |
| Buyer accounts | Decision 9 is open; `buyer_user_id` is already nullable so either answer is cheap |
| Enquiry fan-out to several partners | Decision 5. **`enquiry_recipients` gets built in phase 6 regardless**, with one row in it — the table is the cheap insurance, the fan-out logic is the deferred part |
| A public API for partners | Nothing has asked for it. Module 10 of the LeapDesk parity research is a separate question |

---

## 15. The order of work — every item, sequenced

> ⚠️ **Superseded as the working list, 2026-08-18.** This section is still the reasoning for *why* the
> order is what it is. The list actually being worked from is
> [`DIRECTORY_BUILD_PUNCHLIST.md`](./DIRECTORY_BUILD_PUNCHLIST.md) — 48 tasks written against the tree
> as measured, with the owner's eight-step lifecycle at the top of it. Where the two disagree about
> what exists, the punchlist wins; where they disagree about sequencing rationale, this one does.

Added 2026-08-10. § 14 lists *what*; this lists *when*, as **34 numbered steps** grouped under § 11's
phases. Work top to bottom.

### 15.1 What fixes the order — dependency, not preference

Only four things actually constrain the sequence. Everything else is arrangement:

1. **A table cannot be scoped by a module that does not exist.** Scoping precedes the first
   partner-owned table. Not "should" — the alternative is writing the hand-rolled filter §7.1 warns
   about, then finding every copy of it later.
2. **A listing cannot exist without a category to sit in**, and a category tree cannot be designed
   from the schema — § 6.2 says design it backwards from what buyers search for.
3. **The public surface has nothing to show until listings are published.** Building it earlier
   produces a directory of empty categories, which is § 4's warning about a UI that looks broken when
   empty.
4. **An enquiry that does not reach the partner is a lead lost.** PM-27 (email) gates phase 6, and it
   is currently blocked on the owner choosing a provider.

Everything else — the static pages, the metrics, the review system — could move. Where an item is
ordered by preference rather than dependency, it says so.

### 15.2 The sequence

`BE` backend · `FE` frontend · `DEC` a decision only the owner can take · `CORE` platform work that
belongs in `CORE_HARDENING_PLAN.md` and is merely consumed here.

#### Phase 1 — the organisation *(in progress)*

| # | Step | Kind | Blocked by | Status |
|:--:|---|:--:|---|:--:|
| 1 | `partners` + `partner_tiers` + `users.partner_id`, migration `a9f2c71e5b64`, 9 permissions, service, router, org gate in `get_current_user` | BE | — | ✅ |
| 2 | **Staff UI: partners index → detail → new/edit → tiers.** The API exists and nothing renders it | FE | 1 | ⬅ **next** |
| 3 | Surface `partner_id` in the existing users / invitations admin — a column and a filter | FE | 1 | |

> **Step 2 is the immediate next action.** It closes phase 1's stated end state — *"staff can onboard
> a partner org and its logins"* — and it needs no decision from anyone. Step 3 can run alongside it.

#### Phase 2 — scoping, the gate in front of everything else

| # | Step | Kind | Blocked by | Status |
|:--:|---|:--:|---|:--:|
| 4 | **Decide the `Principal` actor type** — anonymous / user / machine, anonymous most restrictive by construction. § 7.1 | CORE·DEC | — | 🔴 |
| 5 | `app/services/scoping.py` — `apply_scope` / `assert_can_read`, taking `Principal`, 404 never 403 | BE | 4 | |
| 6 | **The tests for step 5, and only step 5** — anonymous actor, wrong-partner actor, staff actor, `DRAFT` vs `PUBLISHED`. Written *before* the first listing exists | BE | 5 | |
| 7 | Replace the two `# PM-5` hand-rolled filters in `partner_service` | BE | 5 | |
| 8 | Partner members — `user_invitations` carries `partner_id`; partner team UI | BE·FE | 5 | |

> **Steps 4–6 are the highest-leverage work in the whole plan.** This is the only place where a
> mistake is a public data breach rather than a bug (§ 7), and step 6 is the narrow testing ask § 11
> makes — roughly half a day, against the one subsystem whose failure mode is a headline.

#### Phase 3 — the taxonomy

| # | Step | Kind | Blocked by | Status |
|:--:|---|:--:|---|:--:|
| 9 | Interview whoever handles partner enquiries today; write down the words **buyers** use, not the words partners use (§ 6.2). **Start from § 18.5's 15-category draft** rather than a blank page — and settle decisions #11 and #12 first, since they add or remove whole branches | DEC | — | |
| 10 | `service_categories` — model, migration, service, router. Staff writes only | BE | 5, 9 | |
| 11 | Staff taxonomy admin UI — tree, reorder, activate | FE | 10 | |

> Step 9 is not engineering and can start **now**, in parallel with phases 1–2. It is the cheapest
> item on this list and the one most likely to be skipped.

#### Phase 4 — listings: the supply side becomes real

| # | Step | Kind | Blocked by | Status |
|:--:|---|:--:|---|:--:|
| 12 | **Decide #7 — who moderates listings, against what standard** | DEC | — | 🔴 |
| 13 | `service_listings` + `listing_media` + `listing_attributes` + `service_areas` — one migration group | BE | 5, 10 | |
| 14 | Media upload for logos, banners and listing images — reuse the existing brand-asset pipeline | BE·FE | 13 | |
| 15 | **Partner listing authoring UI** — the one screen the whole supply side depends on. § 4: theirs are enormous, ours must not be | FE | 13, 14 | |
| 16 | Staff moderation queue — approve, reject with a reason, bulk | BE·FE | 13 | |
| 17 | Partner overview dashboard + entitlements page (listings used of allowed) | FE | 13 | |

> **Step 12 blocks step 16 being deliverable, not buildable.** A queue with no owner is § 13's
> "curated directory that became an open one with extra steps". Decide it before 16 ships, not after.
>
> **Step 13 also owes entitlement enforcement** (§ 14.1 row 2b), which the plan had not previously
> called for. `partner_tiers.max_listings` and `featured_slots` are columns that **nothing checks**
> today — a tier is currently a label. If tier-gated entitlement is the revenue model § 2.1.4 now
> favours, the check has to exist before it can be sold, and it belongs on the publish path in
> `service_listings` rather than in the UI. Until then, § 14.3's entitlements page reports a limit
> that is not applied.

#### Phase 5 — the public surface *(new architecture)*

| # | Step | Kind | Blocked by | Status |
|:--:|---|:--:|---|:--:|
| 18 | **Decide #4 — who owns buyer acquisition** | DEC | — | 🔴 |
| 19 | Rendering strategy — read `node_modules/next/dist/docs/` first; this is **not** the Next.js in anyone's training data | BE·FE | — | |
| 20 | `middleware.ts` splits public from protected. **The default stays protected** | FE | 19 | |
| 21 | Public read API — `tsvector` + GIN, real columns for every facet, `ListSpec` reuse, anonymous `Principal` | BE | 5, 13, 19 | |
| 22 | Public pages — `/`, `/partners`, `/partners/[slug]`, `/services`, `/services/[category]`, `/services/[category]/[listing-slug]`, `/search` | FE | 20, 21 | |
| 23 | Canonical URLs, structured data, `sitemap.xml`, `robots.txt`, `not-found.tsx` | FE | 22 | |
| 24 | Static pages — `/about`, `/contact`, `/become-a-partner`, `/terms`, `/privacy` | FE | 20 | |

> **Step 18 does not block building any of 19–24. It decides whether they are worth shipping.** A
> public directory of 300+ verified partners that nobody visits fails on the demand side exactly as
> § 3 predicted — after the supply side has done real work. If the answer is "nobody owns it", take
> the B-wedge (§ 3) instead: light the same listings up for signed-in Leapswitch customers, and 23
> drops out entirely.

#### Phase 6 — enquiries: the actual product

| # | Step | Kind | Blocked by | Status |
|:--:|---|:--:|---|:--:|
| 25 | **PM-27 — email.** A hard blocker on the core value loop, currently waiting on a provider | DEC | — | 🔴 |
| 26 | `enquiries` + `enquiry_recipients` + `enquiry_messages`. **Build `enquiry_recipients` now with exactly one row in it** — the table is cheap insurance, the fan-out is the deferred part (decision #5) | BE | 5, 13 | |
| 27 | Public enquiry form, on the listing and profile pages — not its own route | FE | 22, 26 | |
| 28 | Partner enquiry inbox + thread. **The most important authenticated page in the product** | FE | 26 | |
| 29 | Staff enquiries oversight | FE | 26 | |

> `enquiries` also gets nullable `billable_amount` / `billed_at` at step 26 — two columns now against
> a migration of the highest-volume table later (§ 10). Decision #9 (buyer accounts) stays cheap
> because `buyer_user_id` is already nullable.

#### Phase 7 — trust becomes real

| # | Step | Kind | Blocked by | Status |
|:--:|---|:--:|---|:--:|
| 30 | Response metrics, derived from `first_viewed_at` / `first_responded_at` | BE | 26 + ~4 weeks of traffic | |
| 31 | Ranking — verification → featured → response rate → rating → recency. **Publish the rule to partners** | BE | 30 | |
| 32 | Staff market dashboard | BE·FE | 30 | |

> Step 31 is where a partner directory becomes political. At 300+ partners every one can see their own
> position, and the aggrieved party is a business relationship rather than an anonymous user. **Never
> let a paid slot outrank a verification failure** (§ 9).

#### Phase 8 — after the loop works

| # | Step | Kind | Blocked by | Status |
|:--:|---|:--:|---|:--:|
| 33 | Reviews — submission tied to an enquiry, moderation, partner right of reply | BE·FE | 26 | |
| 34 | Then fan-out (decision #5), then monetisation (decision #8) | BE | 33 | |

### 15.2b ⚠️ An ordering the research argues for — swap phases 5 and 6

**Proposed 2026-08-10 out of § 2.1. Not adopted — this is the owner's call, and it is the single most
consequential thing in § 15.**

The order above builds the **public surface (steps 18–24) before the enquiry loop (25–29)**, which was
right when the plan was written: reading A had been chosen, and the public surface is what reading A
means. § 2.1 makes the opposite case:

| Argument | From |
|---|---|
| The measure of success is **enquiries per listed partner**, not visitors — and no step in phase 5 produces one | § 2.1.5, § 16.1 |
| The B2B loop that works is **enquiry-and-respond**, and it does not require an anonymous visitor to exist | § 2.1.4 |
| Response rate and time are the trust signals, and they need **~4 weeks of real traffic** before they say anything. Starting that clock earlier is free | § 9, § 2.1.7 |
| Existing Leapswitch customers are demand that **costs nothing to acquire** and is already authenticated | § 3, § 2.1.6 |
| Phase 5 is the most expensive phase — new architecture, a rendering decision, an SEO commitment — and it is the one **blocked on a decision nobody has taken** (#4) | § 8, § 15.5 |

**The proposal:** build steps 25–29 (enquiries, on the authenticated surface, for signed-in
Leapswitch customers) **before** steps 18–24. The first working loop then costs a fraction of what it
otherwise would, produces the one number in § 16.1, and does it without waiting on decision #4.

**What this is not:** it is **not** a reversal of decision 2. The destination stays public — § 3
established that opening the same listings to the public later is a routing and SEO change, not a
schema change, and § 6's tables are identical either way. It changes *when* the public surface is
built, not *whether*.

| | Cost | Benefit |
|---|---|---|
| **Keep the order** | Phase 5 completes before anyone can tell whether the loop works | Delivers the owner's stated product soonest |
| **Swap** | Public launch lands later; `/become-a-partner` and the SEO work slip | The one number exists ~one phase earlier, decision #4 stops being on the critical path, and phase 5 gets built against evidence about what buyers actually search for |

**Recommendation: swap.** The strongest argument is the last one — building the public surface after
the enquiry loop means building it knowing which categories generate enquiries, which is exactly the
input § 6.2 says the taxonomy needs and § 8 says the facets need.

### 15.3 The critical path

**2 → 4 → 5 → 10 → 13 → 21 → 22 → 26 → 28 → 30 → 31**

Eleven steps. Everything else hangs off this chain, and the two places it can stall are both
decisions rather than engineering: **step 4** (the `Principal` type, which is ours to take) and
**step 25** (email, which is the owner's).

### 15.4 What can run in parallel

Not everything is a chain, and treating it as one wastes the cheapest work available:

| Can run alongside | While the main line is on |
|---|---|
| Step 3 (`partner_id` in existing admin) | Step 2 |
| **Step 9 (taxonomy interviews)** | Anything — start it now, it needs no code |
| Steps 12, 18, 25 (the three open decisions) | Anything — none blocks its phase from *starting* |
| Step 24 (static pages) | Steps 22–23 |
| Step 29 (staff oversight) | Step 28 |
| Step 19 (rendering research) | Phases 3–4 |

### 15.5 The three things that stop the line

| # | Gate | Stops | Whose call |
|:--:|---|---|---|
| 4 | The `Principal` actor type | Everything from step 5 onward | **Ours** — settle it in `CORE_HARDENING_PLAN.md` |
| 25 | PM-27, email | Phase 6, which is the value loop | Owner — a provider must be chosen |
| 18 | Who owns buyer acquisition | Whether phase 5 is worth shipping | Owner |

Steps 12 (moderation owner) and 9 (taxonomy) are not gates but are the two most commonly skipped,
and both are cheap now and expensive later.

---

## 16. How we will know it is working — the measures

Added 2026-08-10 from § 2.1.5. The plan had no definition of success, which is how a project ends up
reporting the number that is available rather than the number that matters.

### 16.1 The one number

> **Enquiries per listed partner per month**, and the share of them answered within the SLA.

Everything else is diagnostic. § 2.1.5 is the reason: niche directories win on **conversion and
audience match, not volume** — a niche site at domain authority 45 outperforms a horizontal one at
DA 90 for a matched audience, and niche leads convert around 40% faster. A directory doing 2,000
well-matched visits a month that produces real enquiries beats one doing 200,000 that produces none,
**and only the second one looks like Justdial.**

### 16.2 The ladder, by phase

Each is measurable from data the schema already carries. No new tables.

| Phase | Measure | Healthy looks like | Source |
|:--:|---|---|---|
| 4 | **Listing completion rate** — partners onboarded who publish at least one listing | Most of them. A low number means the authoring form is too heavy (§ 4) | `partners` ↔ `service_listings` |
| 4 | **Time from onboarding to first published listing** | Days, not weeks | `partners.created_at` → `service_listings.published_at` |
| 4 | **Moderation queue age** — oldest item in `PENDING_REVIEW` | Bounded. An unbounded queue *is* the failure in § 13 | `service_listings` |
| 5 | **Category coverage** — categories meeting the § 8 indexing threshold | Rising. Falling means the taxonomy is wrong, not that partners are lazy | `service_categories.listing_count` |
| 6 | **Enquiries per listed partner per month** | **The one number.** Non-zero and rising | `enquiries` |
| 6 | **Response rate**, and **median time to first response** | Already the trust signal in § 9 | `enquiries.first_responded_at` |
| 6 | **Unanswered enquiry rate** | Near zero. Every one is a buyer who will not come back | `enquiries` where `first_responded_at IS NULL` |
| 7 | **Enquiry → self-reported win rate** | Any signal at all; it is self-reported and directional only | `enquiries.status = WON` |
| 8 | **Reviews tied to a real enquiry** | Most of them. Untied reviews read as astroturf (§ 6.5) | `reviews.enquiry_id` |

### 16.3 Two numbers to distrust

| Number | Why it misleads |
|---|---|
| **Page views / unique visitors** | Rises with any spend and says nothing about match. It is the metric § 2.1.5 explicitly argues against, and the one that will be easiest to produce |
| **Total listings** | A supply-side vanity number. 300 partners publishing one stale listing each is a worse directory than 60 publishing four current ones, and it scores higher |

### 16.4 The honest zero

**Every measure above reads zero until phase 6**, because none of them can exist before enquiries do.
That is not a gap in the instrumentation — it is what it means that the enquiry is the product (§ 2,
mechanic 1). The phase-4 and phase-5 rows are leading indicators for a number that does not exist yet,
and they should be read as such rather than as success.

---

## 17. Data dictionary — every table, every column, every foreign key

Added 2026-08-10. § 6 describes the domain in prose; **this is the implementable version** — exact
column names, types, nullability, foreign keys and their `ON DELETE` behaviour, indexes and
constraints, module by module.

**The two built tables are documented from the database, not from the model file.** Measured
2026-08-10 with `information_schema.columns`. Everything else is a specification.

### 17.1 Conventions — assume these, so each table spec stays short

From `FASTAPI_STANDARDS.md` § 4 and the existing tables. **A table spec below only mentions these when
it departs from them.**

| Concern | Rule |
|---|---|
| Domain primary key | `id String(36)`, `default=lambda: str(uuid.uuid4())` |
| Reference-data primary key | `id Integer` autoincrement — **only** for code-seeded lists (`roles`, `permissions`, `partner_tiers`) |
| Timestamps | `DateTime(timezone=True)`, `default=lambda: datetime.now(timezone.utc)`; `updated_at` also `onupdate=`. **Never naive `utcnow`** |
| Money | `Numeric(12,2)` for a price, `Numeric(14,2)` for a total. Never `Float` |
| Audit block | `created_by`, `updated_by` → `users.id` `ON DELETE SET NULL`, plus `created_at`, `updated_at` |
| Enums | Module-level `Enum(..., name="snake_case_type")`, reused verbatim by the migration. Postgres does **not** drop the type with the table — every `downgrade` must `sa.Enum(name=...).drop(op.get_bind(), checkfirst=True)` |
| Ownership | **Every partner-owned table carries a real `partner_id` column**, even where it is reachable through a join. Derived ownership makes the filter a join, and a join easy to forget |
| Nullability | `Mapped[str]` = NOT NULL, `Mapped[str \| None]` = nullable; keep `nullable=` explicit so it matches |
| Denormalised counters | Recomputed on write, never aggregated at query time. Ranking reads them (§ 9) |
| Index rule | Index every FK, every column a facet filters on, and every `status`-like enum |

### 17.2 The foreign-key map

```
users ──────────────┐  (partner_id → membership; NULL = Leapswitch staff)
  │                 ▼
  │            partner_tiers ──< partners
  │                              │  ▲ ▲ ▲ ▲
  │  (verified_by, onboarded_by, │  └─┴─┴─┴── audit + verification FKs back to users
  │   created_by, updated_by) ───┘
  │                              ├──< service_areas          (partner_id XOR listing_id)
  │                              ├──< service_listings ──> service_categories ──┐
  │                              │        │                        ▲            │
  │                              │        │                        └── parent_id (self, 2 levels)
  │                              │        ├──< listing_media
  │                              │        ├──< listing_attributes
  │                              │        └──< enquiries
  │                              │                 ├──< enquiry_messages
  │                              │                 └──< enquiry_recipients >── partners
  │                              └──< reviews ──> service_listings
  └── buyer_user_id, sender_user_id, reviewer_user_id, moderated_by (all nullable)
```

Every foreign key in the domain, and why each `ON DELETE` is what it is:

| Table.column | References | ON DELETE | Reasoning |
|---|---|---|---|
| `users.partner_id` | `partners.id` | **SET NULL** | Deleting an organisation must not delete its people — and it must not silently make them look like staff either, which is why `partner_service.delete_partner` refuses while members remain ✅ |
| `partners.tier_id` | `partner_tiers.id` | **SET NULL** | Deleting a tier must not delete its partners. Tier-less falls back to the most restrictive entitlement ✅ |
| `partners.verified_by` · `onboarded_by` · `created_by` · `updated_by` | `users.id` | **SET NULL** | A partner outlives the staff member who touched it ✅ |
| `user_invitations.partner_id` | `partners.id` | **SET NULL** | An invitation to a deleted organisation is spent, not deleted 🟡 |
| `service_categories.parent_id` | `service_categories.id` | **RESTRICT** | Deleting a parent must not orphan children silently. Force the staff member to move them first |
| `service_listings.partner_id` | `partners.id` | **CASCADE** | A listing has no meaning without its partner, and `delete_partner` already refuses while users exist |
| `service_listings.category_id` | `service_categories.id` | **RESTRICT** | A published listing must never end up uncategorised — it would vanish from every browse path |
| `service_listings.reviewed_by` | `users.id` | **SET NULL** | Moderation history outlives the moderator |
| `listing_media.listing_id` | `service_listings.id` | **CASCADE** | Media is part of the listing |
| `listing_attributes.listing_id` | `service_listings.id` | **CASCADE** | Same |
| `service_areas.partner_id` | `partners.id` | **CASCADE** | Same |
| `service_areas.listing_id` | `service_listings.id` | **CASCADE** | Same |
| `enquiries.partner_id` | `partners.id` | **RESTRICT** | **Deliberately not CASCADE.** An enquiry is a business record and the unit the platform is measured on (§ 16). Deleting a partner must fail rather than erase the leads it received |
| `enquiries.listing_id` | `service_listings.id` | **SET NULL** | A listing may be archived or removed; the enquiry it produced stays, with a snapshot of the title |
| `enquiries.buyer_user_id` | `users.id` | **SET NULL** | Nullable throughout — most enquiries are anonymous |
| `enquiry_recipients.enquiry_id` | `enquiries.id` | **CASCADE** | A recipient row without its enquiry is meaningless |
| `enquiry_recipients.partner_id` | `partners.id` | **RESTRICT** | Same reasoning as `enquiries.partner_id` |
| `enquiry_messages.enquiry_id` | `enquiries.id` | **CASCADE** | The thread is part of the enquiry |
| `enquiry_messages.sender_user_id` | `users.id` | **SET NULL** | The message stays when the account goes |
| `reviews.partner_id` | `partners.id` | **CASCADE** | A review of a deleted partner has no subject |
| `reviews.listing_id` | `service_listings.id` | **SET NULL** | The review is about the partner; the listing is context |
| `reviews.enquiry_id` | `enquiries.id` | **SET NULL** | The verification link. Losing it downgrades the review, it does not delete it |
| `reviews.reviewer_user_id` | `users.id` | **SET NULL** | |
| `reviews.moderated_by` | `users.id` | **SET NULL** | |

> **Two `RESTRICT`s are the load-bearing ones.** `enquiries.partner_id` and
> `enquiry_recipients.partner_id` mean a partner carrying enquiries cannot be deleted at all. That is
> intentional: § 16 makes enquiries the measure of the whole platform, and a CASCADE there would let
> one admin action erase the evidence.

### 17.3 Table specifications

#### `partner_tiers` — module 2 · phase 1 · ✅ **BUILT** (measured 2026-08-10)

Reference data, seeded from `app/core/partner_tiers.py`. Integer PK because it is a code-seeded list.

| Column | Type | Null | Default | Notes |
|---|---|:--:|---|---|
| `id` | `Integer` | NO | serial | |
| `name` | `String(50)` | NO | — | **UNIQUE**, indexed. The key the code references |
| `display_name` | `String(100)` | NO | — | |
| `description` | `Text` | YES | — | |
| `max_listings` | `Integer` | YES | — | **NULL = unlimited.** Not a `-1` sentinel |
| `featured_slots` | `Integer` | NO | `0` | `0` = featured placement unavailable |
| `sort_order` | `Integer` | NO | `0` | |
| `is_active` | `Boolean` | NO | `true` | |
| `created_at` | `DateTime(tz)` | NO | — | |
| `updated_at` | `DateTime(tz)` | NO | — | `onupdate=` |

No foreign keys. ⚠️ `max_listings` and `featured_slots` are **not enforced anywhere yet** — § 14.1 row 2b.

#### `partners` — module 1 · phase 1 · ✅ **BUILT** (measured 2026-08-10)

| Column | Type | Null | Default | Notes |
|---|---|:--:|---|---|
| `id` | `String(36)` | NO | uuid4 | PK |
| `name` | `String(255)` | NO | — | Indexed. Trading name |
| `legal_name` | `String(255)` | YES | — | |
| `slug` | `String(120)` | NO | — | **UNIQUE**, indexed. Permanent public URL — **never reused** |
| `tier_id` | `Integer` | YES | — | **FK →** `partner_tiers.id` |
| `status` | `partner_status` | NO | `PENDING` | Indexed. `PENDING\|ACTIVE\|SUSPENDED`. **Gates login** |
| `tagline` | `String(200)` | YES | — | |
| `about` | `Text` | YES | — | |
| `logo_path` | `String(255)` | YES | — | |
| `banner_path` | `String(255)` | YES | — | |
| `website` | `String(255)` | YES | — | |
| `public_email` | `String(255)` | YES | — | Displayed. **Not a login** |
| `public_phone` | `String(30)` | YES | — | |
| `founded_year` | `Integer` | YES | — | |
| `employee_range` | `String(50)` | YES | — | |
| `verification_level` | `partner_verification_level` | NO | `UNVERIFIED` | Indexed. `UNVERIFIED\|VERIFIED\|PREMIER` |
| `verified_at` | `DateTime(tz)` | YES | — | Cleared when set back to UNVERIFIED |
| `verified_by` | `String(36)` | YES | — | **FK →** `users.id` |
| `is_listed` | `Boolean` | NO | `false` | Indexed. **Gates visibility.** Independent of `status` |
| `gst_number` | `String(30)` | YES | — | |
| `pan_number` | `String(30)` | YES | — | |
| `billing_address` | `Text` | YES | — | |
| `city` | `String(100)` | YES | — | Indexed once faceting exists (§ 8) |
| `state` | `String(100)` | YES | — | |
| `country` | `String(100)` | YES | — | |
| `postal_code` | `String(20)` | YES | — | |
| `agreement_signed_at` | `DateTime(tz)` | YES | — | |
| `onboarded_by` | `String(36)` | YES | — | **FK →** `users.id` SET NULL |
| `notes` | `Text` | YES | — | **INTERNAL ONLY** — never in a partner-facing or public schema |
| `created_by` | `String(36)` | YES | — | **FK →** `users.id` SET NULL |
| `updated_by` | `String(36)` | YES | — | **FK →** `users.id` SET NULL |
| `created_at` | `DateTime(tz)` | NO | — | |
| `updated_at` | `DateTime(tz)` | NO | — | `onupdate=` |

#### `users` — additions · module 4 · ✅ / 🟡

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `partner_id` | `String(36)` | YES | ✅ **BUILT.** **FK →** `partners.id` SET NULL, indexed. **NULL = Leapswitch staff.** The single column every scoping rule reads |

`user_invitations` needs the same column (🟡 phase 2) so an invitation can carry someone into an
organisation: `partner_id String(36)` nullable, **FK →** `partners.id` SET NULL, indexed.

#### `service_categories` — module 5 · phase 3 · 🟡

**Leapswitch owns this table. Partners never write to it** (§ 6.2). Two levels, no more.

| Column | Type | Null | Default | Notes |
|---|---|:--:|---|---|
| `id` | `String(36)` | NO | uuid4 | PK. UUID not Integer — staff-authored content, not a code-seeded list |
| `parent_id` | `String(36)` | YES | — | **FK →** `service_categories.id` RESTRICT. NULL = top level. **Enforce two levels in the service**, not the schema |
| `name` | `String(120)` | NO | — | Indexed |
| `slug` | `String(140)` | NO | — | **UNIQUE**, indexed. Public URL segment |
| `description` | `Text` | YES | — | |
| `icon` | `String(80)` | YES | — | Icon key, not a path |
| `sort_order` | `Integer` | NO | `0` | |
| `is_active` | `Boolean` | NO | `true` | Indexed |
| `listing_count` | `Integer` | NO | `0` | Denormalised. Drives the § 8 indexing threshold |
| audit block | | | | |

#### `service_listings` — module 6 · phase 4 · 🟡 — **the core object**

| Column | Type | Null | Default | Notes |
|---|---|:--:|---|---|
| `id` | `String(36)` | NO | uuid4 | PK |
| `partner_id` | `String(36)` | NO | — | **FK →** `partners.id` CASCADE, indexed. **The ownership anchor `scoping.py` reads** |
| `category_id` | `String(36)` | NO | — | **FK →** `service_categories.id` RESTRICT, indexed |
| `title` | `String(200)` | NO | — | |
| `slug` | `String(220)` | NO | — | **UNIQUE per partner**, not globally — `UniqueConstraint(partner_id, slug)` |
| `summary` | `String(300)` | YES | — | |
| `description` | `Text` | YES | — | |
| `pricing_model` | `listing_pricing_model` | NO | `ON_REQUEST` | `FIXED\|HOURLY\|MONTHLY\|FROM\|ON_REQUEST` |
| `price_from` · `price_to` | `Numeric(12,2)` | YES | — | **Nullable is the common case.** Forcing a number fills the column with lies |
| `currency` | `String(3)` | NO | `INR` | |
| `status` | `listing_status` | NO | `DRAFT` | Indexed. `DRAFT\|PENDING_REVIEW\|PUBLISHED\|REJECTED\|ARCHIVED` |
| `rejection_reason` | `Text` | YES | — | |
| `published_at` | `DateTime(tz)` | YES | — | |
| `reviewed_by` | `String(36)` | YES | — | **FK →** `users.id` SET NULL |
| `reviewed_at` | `DateTime(tz)` | YES | — | |
| `is_featured` | `Boolean` | NO | `false` | Indexed. Tier- or payment-granted (§ 10) |
| `featured_until` | `DateTime(tz)` | YES | — | |
| `view_count` · `enquiry_count` | `Integer` | NO | `0` | Denormalised counters |
| `search_vector` | `TSVECTOR` | YES | — | **GIN index.** Maintained by trigger over title/summary/description (§ 8) |
| audit block | | | | |

**Composite index:** `(status, category_id)` — the public browse path filters on both, every time.

#### `listing_media` — module 7 · phase 4 · 🟡

| Column | Type | Null | Default | Notes |
|---|---|:--:|---|---|
| `id` | `String(36)` | NO | uuid4 | PK |
| `listing_id` | `String(36)` | NO | — | **FK →** `service_listings.id` CASCADE, indexed |
| `path` | `String(500)` | NO | — | Stored path, not a URL |
| `kind` | `listing_media_kind` | NO | `image` | `image\|document` |
| `caption` | `String(255)` | YES | — | |
| `sort_order` | `Integer` | NO | `0` | |
| `created_at` | `DateTime(tz)` | NO | — | |

#### `listing_attributes` — module 8 · phase 4 · 🟡

**Display only.** Anything you filter on is a real column — faceting over this degrades into
unindexable EAV (§ 6.3).

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `id` | `String(36)` | NO | PK |
| `listing_id` | `String(36)` | NO | **FK →** `service_listings.id` CASCADE, indexed |
| `key` | `String(80)` | NO | `UniqueConstraint(listing_id, key)` |
| `value` | `String(500)` | NO | |
| `sort_order` | `Integer` | NO | default `0` |

#### `service_areas` — module 9 · phase 4 · 🟡

Category × geography is the atomic search unit (§ 2), so this must be joinable, never free text.

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `id` | `String(36)` | NO | PK |
| `partner_id` | `String(36)` | YES | **FK →** `partners.id` CASCADE, indexed |
| `listing_id` | `String(36)` | YES | **FK →** `service_listings.id` CASCADE, indexed |
| `country` | `String(100)` | NO | default `India` |
| `state` | `String(100)` | YES | indexed |
| `city` | `String(100)` | YES | indexed |
| `is_remote` | `Boolean` | NO | default `false` — "delivered remotely, geography irrelevant" |

> **`partner_id` and `listing_id` are exclusive, and the database must say so:**
> `CheckConstraint("(partner_id IS NULL) <> (listing_id IS NULL)", name="ck_service_area_owner")`.
> An area row belongs to a whole organisation **or** to one listing, never both and never neither. §
> 6.3 writes this as "`partner_id` *or* `listing_id`"; without the check that is a comment rather
> than a rule.

#### `enquiries` — module 12 · phase 6 · 🟡 — **the actual product**

| Column | Type | Null | Default | Notes |
|---|---|:--:|---|---|
| `id` | `String(36)` | NO | uuid4 | PK |
| `reference` | `String(20)` | NO | — | **UNIQUE**, indexed. Human-quotable |
| `partner_id` | `String(36)` | NO | — | **FK →** `partners.id` **RESTRICT**, indexed. Denormalised **on purpose** — scoping must never depend on a join |
| `listing_id` | `String(36)` | YES | — | **FK →** `service_listings.id` SET NULL, indexed |
| `listing_title_snapshot` | `String(200)` | YES | — | So the enquiry still reads correctly after the listing changes or goes |
| `buyer_user_id` | `String(36)` | YES | — | **FK →** `users.id` SET NULL. **NULL when the buyer was anonymous** |
| `buyer_name` | `String(150)` | NO | — | Captured inline |
| `buyer_email` | `String(255)` | NO | — | Indexed |
| `buyer_phone` | `String(30)` | YES | — | |
| `buyer_company` | `String(255)` | YES | — | |
| `subject` | `String(200)` | YES | — | |
| `message` | `Text` | NO | — | |
| `budget_range` | `String(60)` | YES | — | Optional qualifiers — they raise lead quality sharply |
| `timeline` | `String(60)` | YES | — | |
| `source` | `enquiry_source` | NO | `LISTING` | Indexed. `LISTING\|PROFILE\|CATEGORY_BROADCAST`. **See § 6.4 — these are two different products** |
| `status` | `enquiry_status` | NO | `NEW` | Indexed. `NEW\|VIEWED\|RESPONDED\|WON\|LOST\|CLOSED\|SPAM` |
| `first_viewed_at` | `DateTime(tz)` | YES | — | **The two timestamps the whole trust system depends on** |
| `first_responded_at` | `DateTime(tz)` | YES | — | Feeds response rate and time → ranking (§ 9), and § 16's measures |
| `closed_at` | `DateTime(tz)` | YES | — | |
| `outcome_note` | `Text` | YES | — | Self-reported |
| `billable_amount` | `Numeric(12,2)` | YES | — | **Add now, use later** (§ 10) — two columns beat migrating the busiest table |
| `billed_at` | `DateTime(tz)` | YES | — | |
| `ip_address` | `String(45)` | YES | — | Abuse control. A public form **will** be scraped |
| `user_agent` | `String(500)` | YES | — | |
| `created_at` · `updated_at` | `DateTime(tz)` | NO | — | |

**Composite index:** `(partner_id, status)` — the partner inbox's default query.

#### `enquiry_recipients` — module 12 · phase 6 · 🟡

**Build it from day one with exactly one row per enquiry.** The cost is one join; the alternative is
migrating the busiest table in the system.

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `id` | `String(36)` | NO | PK |
| `enquiry_id` | `String(36)` | NO | **FK →** `enquiries.id` CASCADE, indexed |
| `partner_id` | `String(36)` | NO | **FK →** `partners.id` **RESTRICT**, indexed |
| `notified_at` | `DateTime(tz)` | YES | |
| `viewed_at` | `DateTime(tz)` | YES | |
| `responded_at` | `DateTime(tz)` | YES | |
| `is_winner` | `Boolean` | NO | default `false` |

`UniqueConstraint(enquiry_id, partner_id)` — one partner cannot be a recipient twice.

> **When fan-out is switched on, ownership moves here** and scoping follows it. § 9.1 commitment 1
> bounds what may ever be fanned out: `CATEGORY_BROADCAST` only, never a redistributed `LISTING`
> enquiry.

#### `enquiry_messages` — module 13 · phase 6 · 🟡

Keeps the thread on-platform, which is the only way response time is measurable rather than
self-reported.

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `id` | `String(36)` | NO | PK |
| `enquiry_id` | `String(36)` | NO | **FK →** `enquiries.id` CASCADE, indexed |
| `sender_kind` | `enquiry_sender_kind` | NO | `buyer\|partner\|staff` |
| `sender_user_id` | `String(36)` | YES | **FK →** `users.id` SET NULL. NULL for an anonymous buyer |
| `body` | `Text` | NO | |
| `is_internal` | `Boolean` | NO | default `false` — a staff note the buyer never sees |
| `created_at` | `DateTime(tz)` | NO | |

#### `reviews` — module 17 · phase 8 · 🟡

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `id` | `String(36)` | NO | PK |
| `partner_id` | `String(36)` | NO | **FK →** `partners.id` CASCADE, indexed |
| `listing_id` | `String(36)` | YES | **FK →** `service_listings.id` SET NULL |
| `enquiry_id` | `String(36)` | YES | **FK →** `enquiries.id` SET NULL. **Nullable but strongly preferred** — a review with a verifiable interaction behind it is a trust signal; without one it is a comment box |
| `reviewer_user_id` | `String(36)` | YES | **FK →** `users.id` SET NULL |
| `rating` | `Integer` | NO | `CheckConstraint("rating BETWEEN 1 AND 5")` |
| `title` | `String(200)` | YES | |
| `body` | `Text` | YES | |
| `status` | `review_status` | NO | default `PENDING`, indexed. `PENDING\|PUBLISHED\|REJECTED` |
| `moderated_by` | `String(36)` | YES | **FK →** `users.id` SET NULL |
| `partner_response` | `Text` | YES | |
| `partner_responded_at` | `DateTime(tz)` | YES | |
| audit block | | | |

`UniqueConstraint(enquiry_id, reviewer_user_id)` where `enquiry_id` is set — one review per
interaction.

#### `partners` — the deferred metric columns · module 14 · phase 7 · 🟡

Omitted from the phase 1 migration deliberately (nothing writes them until enquiries and reviews
exist). **They arrive in phase 7, in their own migration**, and § 9's ranking reads them so they must
be denormalised rather than aggregated at query time:

| Column | Type | Null | Default | Written by |
|---|---|:--:|---|---|
| `avg_rating` | `Numeric(3,2)` | YES | — | Reviews (module 17) |
| `review_count` | `Integer` | NO | `0` | Reviews |
| `response_rate` | `Numeric(5,2)` | YES | — | Response metrics (module 14) |
| `avg_response_minutes` | `Integer` | YES | — | Response metrics |

### 17.4 Modules with no tables of their own

| Module | What it is instead |
|---|---|
| 3 · Scoping | One file, `app/services/scoping.py`. Reads `partner_id` on every table above |
| 10 · Moderation | A filtered view over `service_listings` where `status = PENDING_REVIEW` |
| 11 · Public directory | A read API over modules 5–9 with an anonymous actor |
| 15 · Ranking | One ordering function reading `verification_level`, `is_featured`, `response_rate`, `avg_rating` |
| 16 · Market dashboard | Aggregates over `service_listings` and `enquiries` |

### 17.5 Postgres enum types

Every one needs an explicit drop in its migration's `downgrade` — see § 17.1.

| Type name | Values | Table | Status |
|---|---|---|:--:|
| `partner_status` | `PENDING` `ACTIVE` `SUSPENDED` | `partners` | ✅ |
| `partner_verification_level` | `UNVERIFIED` `VERIFIED` `PREMIER` | `partners` | ✅ |
| `listing_status` | `DRAFT` `PENDING_REVIEW` `PUBLISHED` `REJECTED` `ARCHIVED` | `service_listings` | 🟡 |
| `listing_pricing_model` | `FIXED` `HOURLY` `MONTHLY` `FROM` `ON_REQUEST` | `service_listings` | 🟡 |
| `listing_media_kind` | `image` `document` | `listing_media` | 🟡 |
| `enquiry_source` | `LISTING` `PROFILE` `CATEGORY_BROADCAST` | `enquiries` | 🟡 |
| `enquiry_status` | `NEW` `VIEWED` `RESPONDED` `WON` `LOST` `CLOSED` `SPAM` | `enquiries` | 🟡 |
| `enquiry_sender_kind` | `buyer` `partner` `staff` | `enquiry_messages` | 🟡 |
| `review_status` | `PENDING` `PUBLISHED` `REJECTED` | `reviews` | 🟡 |

### 17.6 Three things a reader should not take from this section

1. **These are specifications, not decisions.** Column lists do not settle § 12 — decision #5 still
   shapes what goes in `enquiry_recipients`, #6 shapes whether `price_from` is ever populated, #9
   shapes how often `buyer_user_id` is non-NULL.
2. **Nothing here should be migrated ahead of its phase.** § 15 is the order, and every table below
   `service_categories` depends on scoping existing first.
3. **The built tables are the truth; this section is a copy.** If `partners` and this table ever
   disagree, the database wins and this section is stale. It was measured on 2026-08-10 —
   re-measure before trusting it:

```bash
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' <<'SQL'
select table_name, column_name, data_type, is_nullable, coalesce(column_default,'-')
from information_schema.columns
where table_name in ('partners','partner_tiers')
order by table_name, ordinal_position;
SQL
```

> **Verified 2026-08-10:** the two built specs above were diffed against that query's output —
> **39 columns in the database, 39 documented, none missing in either direction.** Each column also
> gets **its own row**: no `a` · `b` grouping, so the tables parse mechanically as well as read well.

---

## 18. Leapswitch Networks — who we are, and the taxonomy that follows

Researched 2026-08-10 by visiting the live estate — **[leapswitch.com](https://leapswitch.com/)** plus
its [About](https://leapswitch.com/about-us.php),
[Affiliate](https://leapswitch.com/affiliate-program.php),
[Reseller Hosting](https://leapswitch.com/reseller-hosting/),
[Dedicated](https://leapswitch.com/dedicated/), [VPS](https://leapswitch.com/vps/),
[Shared Hosting](https://leapswitch.com/shared-hosting/),
[Colocation](https://leapswitch.com/colocation/), [GPU](https://leapswitch.com/gpu.php),
[Email](https://leapswitch.com/email-hosting/) and
[Managed Services](https://leapswitch.com/managed-services-add-ons.php) pages — and the sibling
brands **[cloudpe.com](https://www.cloudpe.com/)**, **[cloudjiffy.com](https://cloudjiffy.com/)** and
`lacehost.com`. Cross-checked against the marketing site source at `/opt/lampp/htdocs/leapswitch`
(read-only).

**Why this section exists:** § 6.2 says the taxonomy must be designed from what buyers search for, and
§ 15 step 9 makes that a prerequisite for building `service_categories`. You cannot design categories
for a partner directory without knowing what the host company does — because **the partners' services
are defined relative to ours.**

### 18.1 The company, as stated

| | |
|---|---|
| Operating since | **2006**. `LeapSwitch Networks Pvt. Ltd.` · CIN `U30007PN2010PTC137171` |
| Head office | **Pune** — Gokhale Business Bay, Kothrud, 411038 |
| Other offices | **Mumbai** (Wadala) · **Nashik** (Trimbak Road) |
| Footprint | **19 datacenter locations, 3 continents, 10 countries** |
| Scale | **20,000+ customers** from **110+ countries** · **3,000+ nodes deployed** · **80 Gbps** network capacity |
| Availability | **99.99% uptime**, 24×7×365 support |
| Certifications | **ISO/IEC 27001:2022** · **ISO/IEC 27017:2015** · **ISO/IEC 27018:2019** · **ISO 20000-1:2018** · **ISO 9001:2015** · MSME · GST |
| Recognition | *"Recognized by the Govt. of India as one of the top 100 SME in India"* · **97%** client approval |

Location pages published on the site: **Pune · Mumbai · Delhi** (India) · **Asheville · Dallas ·
Orlando · Los Angeles · South Bend** (USA) · **Lisbon · Barcelona · Kiev · Frankfurt** (Europe).

> ⚠️ **The site disagrees with itself on two numbers**, worth knowing before either is quoted in the
> directory's own copy: the home page says *"19 locations world-wide"* while listing **12**; About Us
> says **99.99%** uptime and the home page says **99.9%**; and the affiliate page still says *"12
> worldwide locations in 3 continents in 5 countries"*. **Treat About Us as current** and confirm with
> marketing before the directory repeats any of it.

### 18.2 The brand architecture — three storefronts, not one

Visited 2026-08-10: `leapswitch.com` (home, about, affiliate, reseller, dedicated, vps, shared,
colocation, gpu, email, managed services), `cloudpe.com`, `cloudjiffy.com`, `lacehost.com`.

| Brand | What it is | Stated relationship |
|---|---|---|
| **Leapswitch** | Hosting, bare metal, colocation, GPU, web hosting, email, domains, SSL | The parent — `Leapswitch Networks Pvt. Ltd.`, plus a US entity, **`Leapswitch Networks, Inc.`** |
| **CloudPe** — [cloudpe.com](https://www.cloudpe.com/) | Modern **IaaS**: VMs, GPUs on demand, Kubernetes, S3, VPC, load balancers | *"CloudPe is a Brand of Leapswitch Networks Pvt. Ltd."* |
| **CloudJiffy** — [cloudjiffy.com](https://cloudjiffy.com/) | **PaaS** — deploy an app, not a server | Copyright *"Leapswitch Networks Pvt Ltd. & Leapswitch Networks, Inc."* |
| ~~Lacehost~~ | Former shared-hosting sub-brand | **`lacehost.com` now 301-redirects to `leapswitch.com`** — folded in. The affiliate page still names it, and is stale |

**CloudPe has its own datacenter footprint, separate from the 19 locations in § 18.1**: Navi Mumbai
(dual zones, operational), New Delhi (launching March 2026), Chennai (coming soon). It positions
directly against the hyperscalers — *"60% less than AWS, 55% less than GCP, 50% less than Azure"*.

### 18.2b The product catalogue, with real prices

Prices are the published starting points, read from the pages on 2026-08-10.

| Product | Detail | From |
|---|---|---|
| **Shared hosting** | Linux (cPanel) / Windows (Plesk) | **₹119** / **₹180** per month |
| **Reseller hosting** | White-label, private nameservers, overselling, WHM / Plesk | **₹275** / **₹549** per month |
| **VPS — self-managed** | Linux / Windows. KVM, NVMe, free Acronis backup, cPanel · DirectAdmin · Virtualmin · Plesk · WebsitePanel | **₹700** / **₹850** per month |
| **VPS — managed** | Adds monitoring, patching, firewall, 15-day backup retention | **₹1,999** / **₹2,499** per month |
| **Bare metal** | AMD EPYC 3rd/4th gen to 128c/256t · Intel Gold · Ryzen 9000. **Up to 256 cores, 2TB RAM, 24 drives** | **₹16,420** → ₹93,974 per month |
| **GPU** | NVIDIA A4000 · L4 · A5000 · RTX 6000 ADA · A6000 · A40 · L40S · H100 PCIe · A100 80GB · **H200**. 16–141GB VRAM | **₹16,523** → ₹274,000 per month |
| **CloudPe VMs** | | **₹930**/month |
| **CloudPe S3** | **Zero egress fees** | **₹3.10**/GB/month |
| **Colocation** | 1U · 2U · 10U (quarter) · 22U (half) · 42U (full rack). 10 Gbps from major Indian telcos | **₹4,000** → ₹40,000 per month |
| **Business email** | **SmarterMail** ₹75 / ₹100 · **Google Workspace** ₹200/user · **Microsoft 365** ₹140 → ₹1,750/user | ₹75/month |
| **Also** | Domain registration & domain reseller · SSL · Backup & DR (ransomware-protected) | |

> **We are ourselves a reseller of other people's products.** Business email is SmarterMail, Google
> Workspace and Microsoft 365 resold; the stacks run on cPanel, Plesk, DirectAdmin, Virtualmin,
> Acronis, HAProxy and Nginx. That is worth noticing before we design a directory of resellers —
> **it is the same shape of business, one layer up**, and it validates a licensing/control-panel
> category that would otherwise look like filler.

**The Managed Services catalogue is the most useful artefact for taxonomy work**, because it is the
vocabulary Leapswitch already uses with paying customers. **Three service tiers** —
`Self-Managed` (excluded from everything below), `Semi-Managed` ("we share the work") and
`Fully-Managed` ("we do it all") — across three groups:

- **Monitoring** — hardware · network devices · system/OS · ports · website · storage · SSL certificates
- **Maintenance** — OS (install + hardening) · SSL · antivirus/antimalware · ACL · email (SPF/DKIM/DMARC) · control panel · backup jobs & retention · load balancer (HAProxy, Nginx) · VLAN · infra cost analysis · **APM**
- **Troubleshooting** — applications · database (SQL/MySQL/PostgreSQL) · websites · disaster recovery · VPN · routing · MPLS/P2P · backup restoration · firewall

> **The scope note at the bottom of that page is the commercial gap the directory exists to fill:**
> *"Any additional requests or services outside this scope will be handled separately and billed as
> one-time engagements."* Everything outside that catalogue is work Leapswitch either declines or
> prices ad hoc — **which is precisely the demand a partner directory should be routing.**

### 18.3 ⚠️ "Partner" already means three different things at Leapswitch

**This is the most important finding in this section, and it changes how § 0 should be read.**

| # | Existing meaning | What they do | Live today? |
|:--:|---|---|:--:|
| 1 | **Affiliate** | Refer customers, earn monthly commission. Tiered by volume: reseller hosting **5% / 7.5% / 10%**, managed cloud **7.5% / 10% / 12.5%**, self-managed **5% / 7.5% / 10%** at 2–6 / 7–11 / 12+ sales per month | **Yes** |
| 2 | **Reseller** | Buy hosting wholesale, **white-label it** (private nameservers, own control panel), sell to their own clients. Dedicated servers carry a **tiered discount** structure | **Yes** |
| 3 | **Directory partner** | Supplies **their own** services to buyers who find them on our platform | **No — this is what we are building** |

Two consequences, and both matter:

**§ 0's shelved reseller plan was not hypothetical.** `MARKETPLACE_DOMAIN_PLAN.md` modelled partners
reselling Leapswitch services at discount tiers with quote approval — and **meaning 2 above is exactly
that, already running.** Shelving it for v1 remains correct (it is not what the brief asked for), but
the plan should stop describing it as a different *business* and start describing it as **a different
existing programme we are not automating yet.** If it is ever revived, there is a live commission and
discount structure to model against rather than a blank page.

**The three populations overlap, and the directory must not assume they are the same list.** The
reseller programme's stated audience is *"entrepreneurs and business owners"* who want to *"start your
own web hosting business"* — which is very likely a large share of the 300+ partners in § 0.1. A
reseller is not automatically a directory-worthy service supplier, and a service supplier is not
automatically a reseller.

> **New question for the owner, and it belongs with decisions 1–4:** *which of the three populations
> is eligible to be listed in the directory?* All partners, resellers only, or a vetted subset? It
> changes the 300+ number that § 0.1 answered, and therefore § 3's "what are you actually building"
> table. **Recorded as decision #11 in § 12.**

### 18.4 What directory partners would actually supply

The useful frame is **complement, not duplicate**: Leapswitch sells infrastructure, so the directory's
value is the layer of expertise *around* it that Leapswitch does not sell at scale.

| Leapswitch provides | The partner gap a buyer still has |
|---|---|
| The server, the cloud, the network | Somebody to design, migrate, build and run what goes on it |
| Monitoring and managed add-ons | Application-level ownership, DevOps practice, on-call |
| ISO-certified, compliant facilities | The customer's *own* compliance work — audits, policies, evidence |
| Backup and DR products | DR strategy, drills, and someone accountable when it is used |

### 18.5 A proposed starting taxonomy

**Marked as a proposal and a starting point, not a validated tree.** § 6.2 and § 15 step 9 are
unchanged: this must be checked against the words *buyers* use before `service_categories` is built.
It is offered so that step 9 starts from a draft rather than a blank page.

Top level, with representative second-level entries:

| # | Category | Second level (examples) |
|:--:|---|---|
| 1 | **Managed Infrastructure & NOC** | 24×7 monitoring · OS patching · capacity planning · white-label helpdesk |
| 2 | **Cloud Migration & DevOps** | Lift-and-shift migration · Kubernetes · CI/CD · infrastructure-as-code · SRE retainers |
| 3 | **Security & Compliance** | Security audit · penetration testing · ISO 27001 / SOC 2 / PCI readiness · WAF & DDoS · SIEM |
| 4 | **Backup, DR & Continuity** | Backup design · DR drills · ransomware recovery · RPO/RTO consulting |
| 5 | **Database Services** | DBA retainers · performance tuning · HA & replication · database migration |
| 6 | **Application Development** | Web apps · mobile apps · APIs & integrations · legacy modernisation |
| 7 | **E-commerce & CMS** | Magento · WooCommerce · Shopify · WordPress support & performance |
| 8 | **ERP, CRM & Business Systems** | Implementation · integration · custom modules |
| 9 | **Networking & Connectivity** | MPLS / P2P · VPN · SD-WAN · routing · load balancer configuration |
| 10 | **Email & Collaboration** | Email migration · deliverability · M365 / Google Workspace |
| 11 | **Data Centre & Hardware** | Rack & stack · smart hands · hardware supply · colocation adjacent services |
| 12 | **Licensing & Control Panels** | cPanel · Plesk · DirectAdmin · Virtualmin · WebsitePanel · Acronis · Microsoft & OS licensing · antivirus — **the exact stack § 18.2b shows we already run on** |
| 13 | **Design & UX** | UI/UX · branding · front-end |
| 14 | **Digital Marketing & SEO** | SEO · performance marketing · content — ⚠️ **see § 18.7** |
| 15 | **Training & Consulting** | Cloud training · architecture review · vendor-neutral advisory |

**Categories 1–5 are the strongest fit** — they sit directly on top of what Leapswitch sells, the
buyer is already our customer, and the vocabulary in § 18.2b shows we already talk to customers in
those words. **Two levels, no more**, per § 6.2 and § 17.3's `service_categories` spec.

> **The sharpest test for whether a category belongs is already written on our own pricing page.**
> The Managed Services catalogue ends with *"any additional requests or services outside this scope
> will be handled separately and billed as one-time engagements"*. **A category earns its place if it
> is work a Leapswitch customer needs, that falls outside that catalogue.** That is a far better
> filter than intuition, and it can be applied by whoever runs the step 9 interviews without any
> product knowledge.

**Three demand pools, not one.** CloudPe and CloudJiffy are separate storefronts with their own
customers (§ 18.2). A directory seeded only from Leapswitch hosting customers ignores two of them —
and CloudPe's audience in particular (startups, developers, Kubernetes and GPU users) maps onto
categories 2, 3 and 5 more strongly than the legacy hosting base does.

### 18.6 Service geography — real, not invented

`service_areas` (§ 17.3) should be seeded from the actual footprint rather than a generic country
list. The natural first cut:

| Tier | Values |
|---|---|
| Primary (India) | Pune · Mumbai · Delhi/NCR · Nashik — the three DC cities plus the third office |
| CloudPe regions | **Navi Mumbai** (live) · **New Delhi** (March 2026) · **Chennai** (announced) — a separate footprint from the list above, § 18.2 |
| International DC cities | Asheville · Dallas · Orlando · Los Angeles · South Bend · Lisbon · Barcelona · Kiev · Frankfurt |
| Remote | `is_remote = true` — and for categories 2, 5, 6, 8, 14 this is likely the **majority** case |

Bare metal is published for a narrower set than the full footprint — **Pune, Mumbai, Delhi, Asheville,
Los Angeles, Lisbon, Kiev** — and VPS for **Pune, Mumbai, Asheville, Dallas, Spain, Portugal, Germany,
Ukraine**. If service areas are ever pre-seeded per partner, seed from the product they actually
resell rather than from the company-wide list.

> **`is_remote` matters more here than in a consumer directory.** Justdial's atomic unit is
> category × city because a plumber must be local. A Kubernetes consultant does not. If most listings
> are remote-capable, city faceting is a secondary filter rather than the primary axis — which
> partially weakens § 2's third mechanic for our vertical, and is worth measuring before the facet UI
> is designed.

### 18.7 ⚠️ Where we would be competing with our own listings

The affiliate page states Leapswitch itself provides *"website design and development, SEO"* alongside
hosting. That puts categories **13 and 14** — and arguably **6** — in direct conflict with our own
service lines.

Three options, none free:

| Option | Consequence |
|---|---|
| **Exclude those categories** | Cleanest, and honest. Costs the directory some of its most commonly-requested services |
| **List them and compete** | § 9.1 commitment 3 (published, mechanical ranking) becomes load-bearing — the first partner to notice Leapswitch ranking above them will say so |
| **List them, and exclude ourselves from the directory entirely** | Recommended. The host convenes the market and does not trade in it, which is the posture every comparable in § 4 takes |

**Decision needed before the taxonomy is built**, because it removes or keeps whole branches.
**Recorded as decision #12 in § 12.**

### 18.8 What this changes elsewhere in the plan

| Section | Change |
|---|---|
| § 0 / § 0.1 | The shelved reseller model is a **live Leapswitch programme**, not a rejected alternative. Recorded above |
| § 3 | The 300+ figure needs qualifying — decision #11 asks *which* partners |
| § 6.2 / § 15 step 9 | Now starts from a 15-category draft instead of nothing. **Still requires buyer validation** |
| § 8 | If most listings are remote-capable, **city faceting is secondary** — measure before designing the facet UI |
| § 9 | Leapswitch's own ISO 27001 / 27017 / 27018 / 20000-1 / 9001 certifications are a **trust asset the directory can borrow**, and a credential vocabulary partners can be asked for |
| § 12 | Two new decisions: **#11** which partner population is listable, **#12** whether we list categories we compete in |
| § 17.3 | `service_areas` seeds from the real 12-city footprint; `partners.employee_range` and `founded_year` gain obvious buyer-facing meaning in a B2B services context |

---

## 19. Build instructions for an implementing agent

Added 2026-08-10. **This section exists so that an agent handed this file can build every backend
module without asking a question.** Everything above is analysis and specification; this is the
execution contract. Where anything above is ambiguous, **this section decides.**

### 19.1 Reading order, and which section wins

Read in this order. Do not read the whole file first — it is 2,000 lines and most of it is *why*.

| Step | Read | For |
|:--:|---|---|
| 1 | **§ 19** (this section) | The rules, the APIs, the file manifest |
| 2 | **§ 17** | The exact schema of the table you are building |
| 3 | **§ 15** | Which step you are on, and what blocks it |
| 4 | The module's row in **§ 14.1** | What the module is for |
| 5 | `documentation/system-design/FASTAPI_STANDARDS.md` | The house style. **Non-optional** |

**Conflict resolution, highest authority first:**

1. **The running database and the code** — always. If `partners` disagrees with § 17, the table wins.
2. **§ 19** — this section.
3. **§ 17** — the data dictionary.
4. **§ 15** — the order.
5. Everything else, which is reasoning rather than instruction.

> ⚠️ **Three places in this document are superseded and must not be implemented from:** § 7's
> `Optional[User]` paragraph (use § 19.6), § 6.3/§ 6.4's column prose (use § 17.3), and
> `MARKETPLACE_DOMAIN_PLAN.md`'s quoting half (shelved — § 0.1).

### 19.2 Rules that are not negotiable

Breaking any of these means the work is wrong even if it runs.

| # | Rule | Why |
|:--:|---|---|
| 1 | **Everything is synchronous.** `def`, never `async def`. `psycopg2` is a sync driver and `asyncpg` is not installed | An `async def` endpoint doing a sync query blocks the event loop |
| 2 | **Routers are thin.** No queries, no `if` on domain state. Logic lives in `app/services/` | `FASTAPI_STANDARDS.md` § 2 |
| 3 | **`db` first, `actor` last** in every service signature, `actor` keyword-only at the call site | § 3 of the same |
| 4 | **Scoping reaches the SQL.** Never post-filter a page | Post-filtering corrupts the count — the caller is told 40 and handed 12 |
| 5 | **Never filter on a Python `@property`** | `is_active`, `is_verified`, `publicly_visible` are computed. Filter on the real column |
| 6 | **`response_model` on every route**, and annotate the return type | It is what stops a field leaking |
| 7 | **Hand-write migrations. Do not `--autogenerate`** | It emits ~84 unrelated `alter_column`s against `activity_log`, `app_settings`, `permissions`, `permission_groups` and `users` — pre-existing drift. Two shipped migrations say so |
| 8 | **Every enum gets an explicit drop in `downgrade`** | Postgres does not drop the type with the table; a downgrade-then-upgrade fails on "type already exists" |
| 9 | **Register every model** in `app/models/__init__.py` **and** `app/db/migrations/env.py` | Miss the first and mapper configuration fails; miss the second and Alembic cannot see it |
| 10 | **Regenerate the API contract** after any route change: `python -m app.tools.export_openapi`, then the frontend types | `--check` runs in CI and will fail otherwise |

### 19.3 The internal APIs you will need — exact signatures

**Read this before writing a service.** These were verified against the source on 2026-08-10. Getting
them wrong is the most likely way to waste a cycle — the first implementation of `partner_service`
called a non-existent `activity_service.log()` and had to be rewritten.

```python
# app/core/crud.py — fetch or 404
get_or_404(db: Session, model: type[ModelT], pk: object, label: str | None = None) -> ModelT

# app/core/query.py — the ONE list pipeline. Never hand-roll search/sort/count/paginate.
ListSpec(sortable: dict[str, InstrumentedAttribute],   # allowlist — the only sortable columns
         default_sort: str,                            # must be a key of `sortable`
         tiebreak: InstrumentedAttribute,              # REQUIRED, must be unique (the PK)
         searchable: Sequence[InstrumentedAttribute] = (),
         default_order: "asc"|"desc" = "desc",
         default_per_page: int = 15, max_per_page: int = 100)
ListParams(page=1, per_page=15, sort_by=None, sort_order="desc", search=None)
run_list(db, stmt: Select, spec: ListSpec, params: ListParams) -> tuple[list[T], int]
page_count(total: int, per_page: int) -> int      # 0 rows -> 0 pages, NOT 1

# app/services/activity_service.py — NOTE: `record`, not `log`. It commits on its own and never raises.
record(db, *, description: str, event: str | None = None, log_name: str = LOG_DEFAULT,
       subject_type: str | None = None, subject_id: str | None = None,
       actor: User | None = None, causer_id: str | None = None,
       properties: dict | None = None, batch_uuid: str | None = None) -> None
record_created(db, *, subject_type: str, subject_id: str, values: dict, actor: User | None, label: str) -> None
record_deleted(db, *, subject_type: str, subject_id: str, values: dict, actor: User | None,
               label: str, batch_uuid: str | None = None) -> None
record_change(db, *, subject_type: str, subject_id: str, before: dict, after: dict,
              actor: User | None, label: str, batch_uuid: str | None = None) -> None
# Event constants live in app/models/activity_log.py:
#   EVENT_CREATED EVENT_UPDATED EVENT_DELETED EVENT_STATUS_CHANGED
#   EVENT_LOGIN EVENT_LOGOUT EVENT_FAILED_LOGIN EVENT_ROLES_CHANGED

# app/services/session_service.py
revoke_all(db: Session, user_id: str, reason: str) -> int          # returns how many ended
revoke_all_except(db, user_id: str, keep_session_id: str, reason: str) -> int

# app/db/session.py — for a flow that writes MORE THAN ONE table
with unit_of_work(db):
    ...   # the services called inside must NOT commit themselves

# app/schemas/common.py
Page[T](items: list[T], total: int, page: int, per_page: int, pages: int)

# app/core/dependencies.py
get_db · get_current_user · require_permission(p) · require_any_permission(*p)
require_roles(*names) · require_super_admin · require_admin_access
```

**Two traps this codebase sets:**

- **`activity_service` commits on its own and swallows its exceptions.** Do not wrap it in
  `unit_of_work` and do not "fix" it — failing an operation because an audit write failed turns
  observability into an outage.
- **Never read `user.permission_names` directly.** It does *not* apply the super-admin bypass. Always
  `user.has_permission(name)`.

### 19.4 File manifest — what to create for one module

For a module called `listing`, in this order:

```
backend/app/models/service_listing.py              # model, SQLAlchemy 2.0 typed style
backend/app/models/__init__.py                     # EDIT: import + __all__
backend/app/db/migrations/env.py                   # EDIT: import app.models.service_listing
backend/app/db/migrations/versions/<rev>_create_service_listings.py   # HAND-WRITTEN
backend/app/core/permissions.py                    # EDIT: constants + PERMISSION_CATALOG + role matrix
backend/app/schemas/listing.py                     # Create/Update/Response/PublicResponse
backend/app/services/listing_service.py            # ListSpec, predicates, decorate(), the rules
backend/app/api/listings.py                        # thin router, prefix="/listings", tags=["listings"]
backend/app/main.py                                # EDIT: import + include_router(..., prefix=settings.API_PREFIX)
backend/openapi.json                               # REGENERATE
frontend/types/api.d.ts                            # REGENERATE
documentation/DAILY_CHANGES.md                     # EDIT: one entry
```

Commands, all from the project root:

```bash
docker compose run --rm backend alembic upgrade head            # run, NOT exec — exec skips the entrypoint
docker compose run --rm backend python -m app.db.seed_rbac      # after touching permissions.py
docker compose run --rm --no-deps backend sh -c "pip install -q pytest ruff && ruff check app/ && python -m pytest -q"
docker compose run --rm --no-deps backend python -m app.tools.export_openapi
docker compose cp backend/openapi.json frontend:/tmp/openapi.json
docker compose exec -T -e OPENAPI_SCHEMA=/tmp/openapi.json frontend npm run codegen:api
docker compose exec -T frontend npm run typecheck
```

⚠️ **Never run `npm run build` in the dev container** — it clobbers the dev server's `.next` volume
and every chunk then 404s. Use `typecheck` and `lint`.

### 19.5 The `Principal` type — the concrete spec

§ 7.1 says this must be settled before phase 2. **It is settled here.** Create
`backend/app/core/principal.py`:

```python
@dataclass(frozen=True)
class Principal:
    """Who is making this request. The ONLY actor type scoping accepts.

    Three kinds, and anonymous is the DEFAULT branch by construction — a new kind
    added later inherits the most restrictive behaviour, not the least.
    """
    kind: Literal["anonymous", "user", "machine"]
    user: User | None = None          # set iff kind == "user"
    partner_id: str | None = None     # denormalised from user.partner_id; None = staff OR anonymous
    has_admin_access: bool = False    # False for anonymous, ALWAYS

    @classmethod
    def anonymous(cls) -> "Principal":
        return cls(kind="anonymous")

    @classmethod
    def of(cls, user: User) -> "Principal":
        return cls(kind="user", user=user,
                   partner_id=user.partner_id,
                   has_admin_access=user.has_admin_access)

    @property
    def is_anonymous(self) -> bool:
        return self.kind == "anonymous"
```

**Rules:**

1. `Principal.anonymous()` must be constructible with **no arguments**, so the safe case is the easy
   one to write.
2. `has_admin_access` is a plain field, **never** re-derived from `user` inside scoping — an
   anonymous principal has no user to derive from, and that is exactly where the bug would be.
3. Add a dependency `get_principal()` in `app/core/dependencies.py` that returns
   `Principal.of(user)` for an authenticated request and `Principal.anonymous()` when there is no
   valid cookie — **it must never raise**, unlike `get_current_user`.
4. Existing services keep `actor: User`. **Do not refactor them.** `Principal` is required only where
   an anonymous caller is possible: scoping, and every public read path.

### 19.6 `scoping.py` — the exact contract

Create `backend/app/services/scoping.py`. **This is step 5 and nothing partner-owned may be built
before it.**

```python
def apply_scope(stmt: Select, model, principal: Principal) -> Select:
    """Restrict a query to what `principal` may see. The ONLY place ownership is decided."""

def assert_can_read(obj, principal: Principal) -> None:
    """Raise 404 — never 403 — if `principal` may not read `obj`."""

def owner_partner_id(principal: Principal) -> str:
    """The partner_id a WRITE must be stamped with. Raises 403 for anonymous/staff-less."""
```

The matrix `apply_scope` implements, in this order — **the first matching row wins**:

| Order | Principal | Sees |
|:--:|---|---|
| 1 | `is_anonymous` | Only rows that are **publicly visible**: `status == PUBLISHED` **and** the owning partner `is_listed` **and** partner `status == ACTIVE`. If the model has no public concept at all → **return nothing** |
| 2 | `has_admin_access` | Everything |
| 3 | `partner_id is not None` | `model.partner_id == principal.partner_id` |
| 4 | Anything else (a staff user without admin access and without a partner) | **Nothing** — `where(model.id.is_(None))` |

> **Row 4 is the one that will be got wrong.** Scoping such a user on `partner_id` matches *every*
> row, because their `partner_id` is `NULL` and so is nothing else's. The conservative branch has to
> be the default. `partner_service.list_partners` already implements exactly this and is the
> reference.

**Three rules from `MARKETPLACE_DOMAIN_PLAN.md` § Row-Level Scoping, still binding:**

1. Never write `where(partner_id == ...)` in a service — call `apply_scope`.
2. Every partner-owned model carries a **real** `partner_id` column, even when it is reachable by join.
3. Writes take `partner_id` from the **actor**, never the request body.

**Then do step 7**: replace the two `# PM-5` comments in `partner_service.py`
(`list_partners`, `get_partner_for`) with calls to these functions.

### 19.7 Permission names for every remaining module

Add to `app/core/permissions.py` in the same `{resource}-{action}` convention, singular, kebab-case.
**Adding to `PERMISSION_CATALOG` grants it to Admin automatically** — `ROLE_ADMIN` is `"*"`.

| Module | Constants |
|---|---|
| Categories | `category-view` `category-create` `category-update` `category-delete` |
| Listings | `listing-view` `listing-create` `listing-update` `listing-delete` `listing-submit` `listing-moderate` `listing-feature` |
| Enquiries | `enquiry-view` `enquiry-respond` `enquiry-close` `enquiry-assign` |
| Reviews | `review-view` `review-moderate` `review-respond` |

**Grants:** Staff gets the `-view` of each. Partner gets `listing-view` `listing-create`
`listing-update` `listing-delete` `listing-submit`, `enquiry-view` `enquiry-respond` `enquiry-close`,
`review-view` `review-respond`. **Partner never gets `listing-moderate`, `listing-feature` or
`review-moderate`** — those are the curator's, and § 9 is why.

> ⚠️ `listing-submit` is split from `listing-update` deliberately: editing a draft and putting it in
> front of a moderator are different acts, and the same split this codebase already draws between
> `user-update` and `user-approve`.

### 19.8 Route tables for every remaining module

`prefix` is the resource; `settings.API_PREFIX` (`/api/v1`) is added once in `main.py` — **never write
the version into a router.**

| Method | Route | Permission | Notes |
|---|---|---|---|
| GET | `/categories` | `category-view` | Tree. Public variant is a separate route, § 19.9 |
| POST · PATCH · DELETE | `/categories` · `/categories/{id}` | `category-create` · `-update` · `-delete` | Two levels max — enforce in the service, 409 on a third |
| GET | `/listings` | `listing-view` | Scoped. Partner sees own, staff see all |
| POST | `/listings` | `listing-create` | Always `DRAFT`. `partner_id` from the actor |
| GET · PATCH · DELETE | `/listings/{id}` | `listing-view` · `-update` · `-delete` | 404 not 403 across partners |
| POST | `/listings/{id}/submit` | `listing-submit` | `DRAFT`/`REJECTED` → `PENDING_REVIEW` |
| POST | `/listings/{id}/moderate` | `listing-moderate` | `{decision: "approve"\|"reject", reason?}` |
| POST | `/listings/{id}/feature` | `listing-feature` | Checks the tier's `featured_slots` |
| POST · DELETE | `/listings/{id}/media` · `/media/{media_id}` | `listing-update` | |
| GET · POST · DELETE | `/service-areas` | `listing-update` | |
| POST | `/enquiries` | **none — anonymous** | The public form. Rate-limited, captures IP/UA |
| GET | `/enquiries` | `enquiry-view` | Scoped by `partner_id` |
| GET | `/enquiries/{id}` | `enquiry-view` | |
| POST | `/enquiries/{id}/messages` | `enquiry-respond` | Sets `first_responded_at` if unset |
| POST | `/enquiries/{id}/close` | `enquiry-close` | `{outcome: "WON"\|"LOST"\|"CLOSED"\|"SPAM", note?}` |
| GET | `/reviews` | `review-view` | |
| POST | `/reviews/{id}/moderate` | `review-moderate` | |
| POST | `/reviews/{id}/response` | `review-respond` | Partner's right of reply |

**Public routes** are a separate router, `app/api/public.py`, `prefix="/public"`, **every endpoint
taking `Principal` via `get_principal`, never `get_current_user`**:

| Method | Route | Returns |
|---|---|---|
| GET | `/public/categories` | The tree, active only, `listing_count > 0` |
| GET | `/public/partners` · `/public/partners/{slug}` | `PartnerPublicResponse` only |
| GET | `/public/listings` · `/public/listings/{slug}` | `PUBLISHED` only, via `apply_scope` |
| GET | `/public/search` | Postgres FTS over `search_vector` |

### 19.9 State machines — implement as explicit transition maps

Never a `PATCH status`. A state machine driven by a free-form field will be driven into an invalid
state. Copy the `_STATUS_TRANSITIONS` pattern from `partner_service.py`.

**Listings:**

| From | May become | Via |
|---|---|---|
| `DRAFT` | `PENDING_REVIEW` · `ARCHIVED` | submit · delete |
| `PENDING_REVIEW` | `PUBLISHED` · `REJECTED` | moderate |
| `REJECTED` | `PENDING_REVIEW` · `ARCHIVED` | resubmit |
| `PUBLISHED` | `ARCHIVED` · `PENDING_REVIEW` | archive · edit-then-resubmit |
| `ARCHIVED` | `DRAFT` | restore |

**Publishing rules, all enforced in the service:**

- Only `listing-moderate` may reach `PUBLISHED`.
- Publishing requires the owning partner to be `status == ACTIVE` **and** `is_listed == true`.
- Publishing checks the tier: count of `PUBLISHED` listings must stay `< tier.max_listings`
  (`NULL` = unlimited). **This is § 14.1 row 2b** — the enforcement that does not exist yet.
- An edit to a `PUBLISHED` listing sends it back to `PENDING_REVIEW`. Moderation means nothing if a
  partner can publish and then rewrite.

**Enquiries:** `NEW → VIEWED → RESPONDED → WON | LOST | CLOSED | SPAM`. `SPAM` is reachable from any
state. `first_viewed_at` and `first_responded_at` are **write-once** — never overwrite them, they are
what § 16's measures are computed from.

### 19.10 Defaults for every open decision — do not stop and ask

An open decision in § 12 is **not** a reason to halt. Build the default, leave the seam:

| Decision | Build this | Seam left |
|:--:|---|---|
| #5 fan-out | `enquiry_recipients` with **exactly one row** per enquiry | Table exists; fan-out is a service change, not a migration |
| #6 public prices | `pricing_model` defaults to `ON_REQUEST`, `price_from`/`price_to` nullable and usually null | Populating them later is data, not schema |
| #7 moderation owner | Build the queue. Route it to anyone with `listing-moderate` | Assignment is a later column |
| #8 revenue | Nothing billing-related. `billable_amount`/`billed_at` exist and stay NULL | Two columns, already there |
| #9 buyer accounts | Anonymous enquiry is the primary path. `buyer_user_id` nullable, set when signed in | Already nullable |
| #11 which partners | **Every `partners` row is listable** once ACTIVE + `is_listed` | Eligibility is a filter, not a schema change |
| #12 competing categories | **Seed the taxonomy without** categories 13 and 14 (§ 18.5) | Adding a category is one INSERT |
| § 15.2b order swap | **Follow § 15.2 as written** unless the owner has adopted the swap | Ordering only |

### 19.11 Acceptance check per module

A module is done when all of these pass. **Report the actual output, not a claim.**

```bash
# 1. lint + the existing suite must still pass
docker compose run --rm --no-deps backend sh -c "pip install -q pytest ruff && ruff check app/ && python -m pytest -q"
# 2. the contract is regenerated and matches
docker compose run --rm --no-deps backend python -m app.tools.export_openapi --check
# 3. migration round-trips
docker compose run --rm backend alembic downgrade -1 && docker compose run --rm backend alembic upgrade head
# 4. frontend still typechecks after codegen
docker compose exec -T frontend npm run typecheck
```

Plus a **smoke script** exercising the service layer, run as
`docker compose run --rm -T backend python - < smoke.py`. It must assert, at minimum:

1. Create produces the documented default state.
2. Every **forbidden** state transition raises 409.
3. Every **cross-partner** read returns **404, not 403**.
4. An **anonymous** principal sees nothing non-public — for listings specifically, that a `DRAFT` is
   invisible.
5. The list endpoint's total is correct **with scoping applied** (the count bug).
6. Clean up after itself.

`partner_service`'s 31-assertion smoke test is the reference; phase 1's is in the session scratchpad.

### 19.12 Ambiguities resolved here, so you do not have to guess

| Question you would have asked | Answer |
|---|---|
| UUID or Integer primary key? | `String(36)` UUID for everything in this domain. Integer **only** for code-seeded reference data (`partner_tiers`) |
| Where do slugs come from? | Service-generated from the name, uniqueness-suffixed (`-2`, `-3`), **never reused, never editable**. Copy `_unique_slug` from `partner_service.py`. Listing slugs are unique **per partner**; category and partner slugs are globally unique |
| Two-level category limit — schema or service? | **Service.** Raise 409 on a third level. A self-FK cannot express depth |
| `service_areas` — one column or two? | Two nullable, plus `CheckConstraint("(partner_id IS NULL) <> (listing_id IS NULL)")`. Exactly one, guaranteed by the database |
| Who maintains `search_vector`? | A Postgres trigger, created in the same migration. Not application code |
| Who updates the denormalised counters? | The service that causes the change, in the same transaction. `listing_count`, `view_count`, `enquiry_count`, `review_count` |
| Do I need `unit_of_work`? | Only when writing **more than one table**. Most of these modules write one |
| Which enum values exactly? | § 17.5. Copy them character for character — they become Postgres types |
| Do partners get an `enquiries` row for a broadcast? | Yes, via `enquiry_recipients`. § 9.1 commitment 1 forbids redistributing a **named** enquiry, not serving a broadcast one |
| What if a partner is deleted with enquiries? | It cannot be. Those FKs are `RESTRICT` by design — § 17.2 |
| Should I build the public routes now? | **Only at step 21+**, and only after `scoping.py` and `Principal` exist. Before that there is no safe way to serve an anonymous request |
| The frontend? | **Not in scope for a backend module.** § 14.2–14.4 lists the pages and **§ 20 specifies every one of them** — separate work, separate contract |

> **If something is still genuinely undecided after all of the above, do not invent a rule.** Build
> the rest of the module, leave a `# TODO(decision-N)` comment naming the decision in § 12, and say so
> in the report. Silence about a gap is worse than the gap.

---

## 20. The frontend, page by page

Added 2026-08-10. **This is the surface the world judges us on**, and § 8 already warns it is
architecture this codebase has never produced. § 14.2–14.4 listed the pages; this specifies them.

Read alongside `system-design/NEXTJS_STANDARDS.md` (composition) and `system-design/UI_PATTERNS.md`
(atoms). Neither is restated here — where this section is silent, they decide.

> **This section stays authoritative for what a page must contain, forbid, and show when empty.** For
> *which* pages exist and *whether* they are built, use [`FRONTEND_PLAN.md`](./FRONTEND_PLAN.md) —
> added 2026-08-17, statuses measured against `frontend/app/`. It does not duplicate the specs below;
> it points at them.

### 20.1 Two things to settle before writing a single page

**① Public pages MUST render on the server, and the pattern already exists.**

`NEXTJS_STANDARDS.md` § 2 rule 4 says *"don't fetch API data in a server component"* — and that rule
is about **authenticated** data, because the `httpOnly` cookie cannot be forwarded from the server.
**Public directory data has no cookie**, so the objection does not apply, and the mechanism is already
in the tree:

```ts
// lib/utils/constants.ts — exists today, used by lib/branding.ts
export const SERVER_API_BASE_URL = process.env.INTERNAL_API_URL ?? API_BASE_URL;
```

| Surface | Fetch from | Why |
|---|---|---|
| Public pages (§ 20.3) | **Server**, via `SERVER_API_BASE_URL` → `http://backend:8002` | Indexable, cacheable, fast first paint. No cookie involved |
| Authenticated pages | **Client**, via `axiosInstance` | The `httpOnly` cookie must go with the request |

⚠️ `SERVER_API_BASE_URL` is container-internal and **must never leak into a client bundle**.
`NEXT_PUBLIC_API_URL` is browser-resolved and stays `localhost:8002`. Getting these the wrong way
round is the failure `docker-compose.yml` already documents at length — it fails *silently*, falling
back to defaults.

**② The public surface does NOT use the three-page contract.**

`UI_PATTERNS.md` mandates Index / Form / Show via `ResourceIndex`, `ResourceForm` and `ShowPage*` for
**every module**. Those shells are the signed-in admin chrome — full-height flex, dense tables, bulk
actions, a sidebar. **They are wrong for a public marketing surface** and must not be reused there.

> **Stated so it is never a debate:** the three-page contract governs `(app)`. The public group `(public)`
> has its own shells (§ 20.7). A partner listing page is not a `ShowPage`. Reusing the admin table for
> a category page is the single most likely way this surface ends up looking like a CRM.

### 20.2 Rules for every public page

| # | Rule |
|:--:|---|
| 1 | **Server-rendered.** No `"use client"` on a `page.tsx`. Interactive bits are leaf client components |
| 2 | **Every page exports `metadata`** (or `generateMetadata`) — title, description, canonical, OpenGraph |
| 3 | **One `<h1>` per page**, and it says what the page is |
| 4 | **No layout shift.** Every image has explicit `width`/`height`; skeletons match final dimensions |
| 5 | **Works with JavaScript disabled** for reading. Filtering and the enquiry form may require it |
| 6 | **Empty states are designed, not accidental.** § 4: a UI that looks broken when empty is worse than no UI |
| 7 | **Dark mode from day one.** `text-brand dark:text-brand-on-dark` as a unit — `#24695c` on a dark card is **2.83:1** and fails AA |
| 8 | **Keyboard reachable, visible focus ring** (`focus:ring-brand`), landmarks, skip link |
| 9 | **Never render a price we do not have.** `ON_REQUEST` is the common case (§ 17.3) — show "Price on request", never "₹0" or "—" |
| 10 | **Never show a count we have not verified.** No animated counters, no "10,000+ happy customers" unless § 18.1 backs it |

**Performance budget**, because this is judged by strangers on Indian mobile networks:

| Metric | Budget |
|---|---|
| LCP | < 2.5s on 4G |
| CLS | < 0.1 |
| First-load JS per public route | < 150 kB gzipped |
| Above-the-fold images | ≤ 1, `priority`, sized |
| Web fonts | The existing Montserrat only. **No second family** |

### 20.3 Route map

```
frontend/app/
├── (public)/                     ← NEW group. Its own layout: marketing header + footer
│   ├── layout.tsx                   server component; header, footer, skip link
│   ├── page.tsx                     /                       Home
│   ├── partners/
│   │   ├── page.tsx                 /partners               Directory index
│   │   └── [slug]/page.tsx          /partners/<slug>        Partner profile
│   ├── services/
│   │   ├── page.tsx                 /services               Category index
│   │   └── [category]/
│   │       ├── page.tsx             /services/<cat>         Faceted listings
│   │       └── [listing]/page.tsx   /services/<cat>/<slug>  Listing detail
│   ├── search/page.tsx              /search
│   ├── enquiries/[reference]/page.tsx
│   ├── become-a-partner/page.tsx
│   ├── about/page.tsx
│   ├── contact/page.tsx
│   ├── terms/page.tsx
│   ├── privacy/page.tsx
│   ├── loading.tsx
│   └── error.tsx
├── not-found.tsx                 ← EDIT: must serve the public 404 too
├── sitemap.ts                    ← NEW  (Next 14 file convention, not a route handler)
└── robots.ts                     ← NEW
```

⚠️ **`middleware.ts` must be edited before any of this renders** (§ 15 step 20). Every route today is
protected. Add an explicit public allowlist — **the default must remain protected**, so a new route is
private until someone says otherwise.

> **Corrected 2026-08-17 — the first two sentences are wrong, and in the direction that matters.**
> `middleware.ts`'s matcher is `["/", "/admin/:path*", "/dashboard/:path*", "/dashboard",
> "/settings/:path*", "/settings"]`. **A route outside those six patterns never reaches the middleware
> at all**, so `/partners` and `/services/*` are public the moment the files exist — no allowlist, no
> edit. The default today is *open*, not protected.
>
> The rule this section states is still the right one; the code just does not implement it. Treat
> "make the default protected" as its own piece of work, not as a prerequisite for the public pages.
>
> **What the public surface genuinely does need from the middleware** is narrower: the
> `pathname === "/"` branch and the `"/"` matcher entry both have to go, together with
> `app/page.tsx`'s `redirect("/sign-in")` — two redirects, and removing one leaves the other.
> Measured in the tree; see [`FRONTEND_PLAN.md`](./FRONTEND_PLAN.md) § 8.

> **On "this is not the Next.js you know":** `AGENTS.md` says to read `node_modules/next/dist/docs/`
> first. **That directory does not exist** in this install — checked on host and in the container on
> 2026-08-10; the version is **14.2.35**. So verify each API against the running app rather than
> assuming. `sitemap.ts` / `robots.ts` as file conventions, `generateMetadata`, and
> `generateStaticParams` are the three this section depends on.

### 20.4 The public pages

Each page below states **Purpose · Data · Must have · Must NOT have · Empty state · SEO · Done when.**

---

#### `/` — Home

**Purpose:** answer "what is this and can I trust it" in one screen, then send the visitor into search.

**Data (server):** `GET /public/categories` (top 8 by `listing_count`), `GET /public/partners?verified=true&per_page=6`.

**Must have, in this order:**

1. **`<h1>` naming the proposition** — *"Verified partners for everything around your infrastructure"*. Not a slogan; a sentence a stranger understands.
2. **Search, above the fold** — one free-text input + a category select. It is the primary action; it does not sit below a hero image.
3. **Category grid**, 8 tiles, each with its real `listing_count`. A tile links to `/services/<slug>`.
4. **Verified partners strip** — 6 cards, logo, name, tagline, verification badge, city.
5. **How it works**, three steps: *Search → Compare verified partners → Send one enquiry*.
6. **The trust bar — this is the differentiator (§ 9).** Leapswitch since **2006**, **ISO/IEC 27001:2022 · 27017 · 27018 · ISO 20000-1 · ISO 9001**, **20,000+ customers in 110+ countries**, **19 datacenter locations**. Every figure from § 18.1, and none quoted that § 18.1 flags as contradictory.
7. **Partner CTA** → `/become-a-partner`.
8. **Footer** — categories, company, legal, contact.

**Must NOT have:** a stock-photo carousel · animated counters · testimonials we do not have · a chat widget on load · a cookie banner that blocks content · autoplaying anything · "trusted by" logos without permission.

**Empty state:** fewer than 8 categories meeting the § 8 threshold → render the ones that qualify and drop the grid to a single row. **Never render an empty tile.**

**SEO:** `title` = `{APP_NAME} — verified partners for cloud, hosting and infrastructure services`. `description` ≤ 155 chars. `Organization` JSON-LD using § 18.1's facts. Canonical `/`.

**Done when:** a visitor with no context can state what the site is and run a search, without scrolling past the fold to find the search box.

---

#### `/partners` — Directory index

**Purpose:** browse every listed partner; the page a buyer lands on from "leapswitch partners".

**Data (server):** `GET /public/partners` — paginated, facets from query string.

**Must have:** `<h1>` "Partner directory" + a one-line explanation of what verification means · **facets** (category, city, verification level, remote-capable) as real links, so each combination is a crawlable URL · result count *"Showing 12 of 87 partners"* · **partner cards** — logo/monogram, name, tagline, verification badge, city or "Remote", top 3 categories, listing count, and a single `View profile` link · pagination as `<a>` links, not a button that mutates state · sort control (Verified first · Most listings · Recently joined).

**Must NOT have:** infinite scroll (kills pagination crawlability and the back button) · a contact button on the card (contact happens on the profile, where the buyer has context) · star ratings before reviews exist (§ 6.5 — unverified ratings read as astroturf) · the admin `ResourceIndex` table.

**Empty state:** *"No partners match these filters"* + a one-click **Clear filters** + the three most populated categories as an escape hatch. **Never a bare "0 results".**

**SEO:** facet combinations are indexable **only above the § 8 threshold**; below it, `noindex,follow`. Canonical always points at the unfiltered `/partners` for paginated pages beyond 1.

**Done when:** every facet combination is a shareable URL that renders server-side with the correct count.

---

#### `/partners/[slug]` — Partner profile

**Purpose:** the credential page. § 4: decision-critical information belongs **on** this page, not behind a click.

**Data (server):** `GET /public/partners/{slug}` → `PartnerPublicResponse` (§ 17.3 — the allowlist). `generateStaticParams` over listed partners; revalidate on a timer.

**Must have:** banner + logo, name as `<h1>`, tagline · **verification block** — level, "Verified by Leapswitch", `verified_at` as a date · founded year, employee range, city/state/country, remote flag · `about` · **their listings**, grouped by category, each linking to its detail page · service areas · **a single primary CTA — `Send enquiry`** opening the § 20.5 form with `source = PROFILE` · website link (`rel="nofollow noopener"`) · breadcrumb `Home › Partners › <name>`.

**Must NOT have:** `notes`, `gst_number`, `pan_number`, or any audit column — § 17.3 marks these internal, and the public schema is the enforcement · the partner's account email (`public_email` is a different field, deliberately) · a competitor strip ("partners like this") on the profile — that is what the category page is for, and putting it here monetises a partner's own page against them · **`status`** — showing that a suspended partner exists is a disclosure.

**Empty state:** a partner with no published listings still gets a full profile with *"Listings coming soon"* — they are `is_listed` because staff published them, and a broken-looking page reflects on us.

**SEO:** `title` = `{name} — {tagline} | {APP_NAME}`. **`Organization` + `LocalBusiness` JSON-LD.**
⚠️ **§ 9.1 commitment 2: we do not compete with a partner for their own name.** Where the partner has
a `website`, emit `<link rel="canonical" href="{their site}">`. If that is judged too strong, the
minimum is `noindex` on profiles with no listings — **do not silently outrank them.**

**Done when:** a buyer can decide whether to contact this partner without leaving the page.

---

#### `/services` — Category index

**Purpose:** the taxonomy as a browsable map; the second entry point after search.

**Data (server):** `GET /public/categories` — the tree, `listing_count > 0` only.

**Must have:** `<h1>` "Services" · top-level categories as cards, each with its description, icon and **live count**, and its subcategories as links beneath · a short line explaining that everything listed is a Leapswitch-verified partner.

**Must NOT have:** categories with zero listings (§ 8's threshold) · a three-level tree — the schema is two (§ 17.3) · alphabetical ordering that ignores `sort_order`.

**Empty state:** if no category qualifies, this page **should not be linked from the header at all** — hide the nav item rather than shipping an empty map.

**SEO:** `CollectionPage` JSON-LD. Canonical `/services`.

---

#### `/services/[category]` — Faceted listing index

**Purpose:** the page that ranks. Category × city is § 2's atomic search unit.

**Data (server):** `GET /public/listings?category=<slug>&…`.

**Must have:** `<h1>` = category name · category description, one paragraph, genuinely useful — this is the page's ranking content · **facets**: subcategory, city, remote, verification, price model · **listing cards**: title, partner name + verification badge, summary, price (or "Price on request"), city/Remote, `View details` · **sorted by § 9's rule**: verification → featured (**labelled** "Featured") → response rate → rating → recency · pagination · breadcrumb.

**Must NOT have:** a featured slot that outranks a verification failure (**§ 9, absolute**) · an unlabelled sponsored listing · client-side-only filtering (the URL must carry the state) · a price range slider when most listings are `ON_REQUEST`.

**Empty state:** below the § 8 threshold this page is `noindex` and shows *"We're still building this category"* + a link to `/become-a-partner`. **A thin category page is worse than none — it is what a buyer judges the whole directory by.**

**SEO:** `title` = `{Category} partners and services | {APP_NAME}`, with city appended when a city facet is active. `ItemList` JSON-LD. Self-canonical when above the threshold.

---

#### `/services/[category]/[listing]` — Listing detail

**Purpose:** the page an enquiry is sent from. **The most commercially important page on the site.**

**Data (server):** `GET /public/listings/{slug}`.

**Must have:** `<h1>` = listing title · **partner attribution above the fold** — logo, name, verification badge, link to profile. The buyer is choosing a *company* as much as a service · price block honouring `pricing_model` · full description · media gallery (`listing_media`, sized, lazy below the first) · `listing_attributes` as a spec table · service areas / remote · **the enquiry form, or a button that reveals it without navigating** (`source = LISTING`) · *"Typically responds in X"* once § 16's metrics exist — **omitted entirely until then, never faked** · related listings **from the same partner** · breadcrumb.

**Must NOT have:** competing partners' listings on the page (§ 9.1 commitment 1 — this enquiry belongs to the partner it named) · a countdown or fake scarcity · a review count of 0 rendered as "0 reviews" — omit the block · the enquiry form behind a login wall (decision #9's default is anonymous, § 19.10).

**SEO:** `Service` + `Offer` JSON-LD, `Product` only if a real price exists. `title` = `{title} by {partner} | {APP_NAME}`.

**Done when:** a buyer can send a qualified enquiry without creating an account or leaving the page.

---

#### `/search` — Results

**Data (server):** `GET /public/search?q=` — Postgres FTS over `search_vector` (§ 17.3).

**Must have:** the query echoed in `<h1>` and in `title` · mixed results, **labelled by type** (Partner / Listing) · the same facets as the category page · result count · **a genuinely helpful zero state**: *"Nothing matched 'kubernetes consultant in Nashik'"* + spelling suggestion + the nearest categories + a `/become-a-partner` link.

**Must NOT have:** a raw SQL error surfaced on a bad query · `noindex` missing — **search result pages are `noindex,follow`**, always. They are near-duplicate content and Google penalises them.

---

#### The enquiry form — a component, not a route

**Lives on** the listing and profile pages. § 6.4: making it its own page loses the context the buyer was reading.

**Fields:** name\* · email\* · phone · company · message\* · budget range · timeline. The last two are optional and **raise lead quality sharply** (§ 6.4).

**Must have:** RHF + Zod, per `NEXTJS_STANDARDS.md` § 7 · inline per-field errors, not a toast · a disabled submit while in flight with a busy label · **a success state that names what happens next** — *"Sent. {Partner} typically replies within X. Your reference is ENQ-1234."* · the reference shown and linked to `/enquiries/<reference>` · honeypot + client throttle (**the backend rate limit is the real control**) · a link to `/privacy` next to the submit button.

**Must NOT have:** a captcha before we have a spam problem · required fields beyond the three marked · a redirect away from the page on success (it destroys context and the back button) · silent failure — a 4xx must render a message the buyer can act on.

---

#### `/enquiries/[reference]` — Enquiry status

**Purpose:** an anonymous buyer needs to see whether anyone replied. Depends on decision #9.

**Must have:** the reference, the partner contacted, sent date, status in **plain words** (*"Waiting for {Partner}"* / *"{Partner} replied"*), and the message thread. **Access is by the unguessable `reference` alone** — it is a capability URL.

**Must NOT have:** anything about other enquiries, other partners, or the buyer's identity beyond what they typed · an indexable URL — **`noindex, nofollow` and excluded from the sitemap.**

---

#### `/become-a-partner` — Supply-side landing

**Must have:** what listing gets them (qualified enquiries from Leapswitch customers) · what verification requires · what it costs (or *"free during launch"* — § 10's default) · the tier entitlements table from `partner_tiers` · a short application form or a mailto/contact route · **honesty about scale** — do not imply traffic we do not have (§ 13).

**Must NOT have:** invented partner-success stories · a promise of lead volume.

---

#### `/about` · `/contact`

**About must have:** who Leapswitch is, from § 18.1 — since 2006, Pune HQ, 19 locations, the ISO stack, 20,000+ customers · why we vet partners · a link to leapswitch.com.
**Contact must have:** the real Pune, Mumbai and Nashik addresses (§ 18.1), a form or address, and support-vs-sales routing.
**Must NOT have:** a map embed that loads a third-party script on first paint · a phone number nobody answers.

---

#### `/terms` · `/privacy`

**Non-optional the moment a public form collects a name, email and phone.** Must state what is
collected, that it is shared **with the partner contacted**, retention, and a contact for deletion.
Reviewed by whoever owns compliance — **not drafted by an engineer or an AI**, and flagged as such.

---

#### `not-found.tsx` · `error.tsx` · `loading.tsx`

**404 must have:** a real search box, the top categories, and a link home. A crawled 404 is judged.
**`error.tsx` must have:** a human sentence and a retry. Show `error.digest`, **never `error.message`** — Next replaces server messages with a digest deliberately (`NEXTJS_STANDARDS.md` § 3).
**`loading.tsx`:** skeletons matching final dimensions, or CLS blows the budget.

---

#### `sitemap.ts` · `robots.ts`

**Sitemap includes:** `/`, `/partners`, every listed partner profile, `/services`, every category **above the § 8 threshold**, every published listing, and the static pages.
**Excludes:** `/search`, `/enquiries/*`, anything `noindex`, and every below-threshold category.
**`robots.ts`:** disallow `/dashboard`, `/settings`, `/sign-in`, `/api`, `/enquiries`. Point at the sitemap.

### 20.5 Shared components the public surface needs

Build in `components/public/`, **not** `components/common/` — the latter is the admin shell's.

| Component | Notes |
|---|---|
| `PublicHeader` · `PublicFooter` | Marketing chrome. Not the signed-in green chrome (`UI_PATTERNS.md`) |
| `SearchBar` | Client. Category select + free text; navigates, not fetches |
| `FacetGroup` | Renders facets **as links** so each state is a URL |
| `PartnerCard` · `ListingCard` | Fixed height. A ragged grid reads as broken |
| `VerificationBadge` | Three levels + a tooltip explaining what verification means. **The trust signal — one component, one meaning** |
| `EnquiryForm` | Client. RHF + Zod |
| `EmptyState` | Illustration-free, always offers a next action |
| `Breadcrumb` | Emits `BreadcrumbList` JSON-LD |
| `Pagination` | `<a>` links with real `href`s |

### 20.6 The authenticated surfaces

Partner back office and staff admin both live in the existing `(app)` group, use the green signed-in
chrome, and follow `UI_PATTERNS.md`'s three-page contract. The shells decide the layout, so what
follows specifies **content and rules**, not markup.

#### 20.6.0 Three structural decisions, so they are never re-litigated

**① One route tree, scoped — not two.** `/dashboard/listings` serves a partner *and* a staff member.
`apply_scope` (§ 19.6) decides what is in it: the partner sees their own rows, staff see all.

> **Do not build `/partner/listings` and `/admin/listings`.** Two trees means two components, two sets
> of permission checks and two places to forget one. The scoping module exists precisely so the route
> does not have to know who is asking. The same applies to `/dashboard/enquiries` and
> `/dashboard/reviews`.

**② One sidebar, filtered on the server.** `navigation_service.build_sections()` assembles every item
and filters by permission **before** it reaches the browser — the frontend renders what it receives
and keeps no parallel copy of the rules. **Adding a module means adding an item there**, not writing
`{can('listing-view') && <NavLink/>}` in React.

⚠️ The nav is a *visibility* filter, not a guard. Every route still needs its own
`require_permission`, and every page still needs `usePermission` gating for its buttons.

**③ A partner user is not a second-class staff user.** They get the same shells, the same table
density, the same keyboard behaviour. The difference is scope and vocabulary — a partner sees
"My listings", staff see "All listings" — never a cut-down UI.

#### 20.6.1 Partner back office — 13 pages

| Route | Purpose · must have | Must NOT have |
|---|---|---|
| `/dashboard` | **Partner overview.** Four tiles: published listings **of** entitlement, new enquiries, unanswered enquiries, median response time. Then the newest 5 enquiries and any listing in `REJECTED` with its reason | Vanity totals (§ 16.3). A chart before there is data to chart |
| `/dashboard/organisation` | **Their own partner record** — `ResourceForm`, sections Profile / Contact / Address. Shows verification level and status **read-only**, with a line explaining who changes them | `notes`, `gst_number`, `pan_number` in an editable field they do not own; **any control that writes `status`, `verification_level` or `is_listed`** (§ 19.8 — three separate permissions they do not hold) |
| `/dashboard/organisation/branding` | **Logo and banner upload.** Reuses the brand-asset pipeline. Shows the exact public card preview at both sizes, and the 32px floor from `design/LOGO_BRIEF.md` | An upload that accepts anything — enforce type and dimensions client *and* server side |
| `/dashboard/organisation/areas` | **Service areas.** Add city/state/country rows, or tick **Remote**. Seeded suggestions from § 18.6 | A free-text city field — it must be joinable (§ 17.3), so it is a select |
| `/dashboard/team` | **Their logins.** `ResourceIndex` scoped to `partner_id`: name, email, role, last login, status | The ability to see or invite outside their own organisation |
| `/dashboard/team/invite` | Invite into **their** organisation. `partner_id` comes from the actor, never the form (§ 19.6 rule 3) | A partner-selector field |
| `/dashboard/listings` | **My listings.** Status chip, category, views, enquiries, updated. Filters: status, category. Primary action `New listing` — **disabled with an explanation when the tier is at its cap** (§ 19.9) | A publish button. Only `listing-moderate` reaches `PUBLISHED` |
| `/dashboard/listings/new` · `/[id]/edit` | **The authoring form — the one screen the supply side depends on.** See § 20.6.2 | See § 20.6.2 |
| `/dashboard/listings/[id]` | **Listing show.** 2:1 with sticky sidebar: status, moderation history, `rejection_reason` **prominently** when rejected, view/enquiry counts. Main column renders it as the public sees it | Metrics invented before phase 7 |
| `/dashboard/enquiries` | **The inbox — the most important authenticated page in the product.** Unread is visually distinct. Columns: buyer, listing, received, status, **time-to-respond clock**. Default filter is `NEW`+`VIEWED`, newest first | A generic table treated as one more CRUD list. Marking read on hover — `first_viewed_at` is write-once and feeds § 16 |
| `/dashboard/enquiries/[id]` | **The thread.** Buyer details, original message, budget/timeline, full `enquiry_messages` thread, reply box, and a close action taking `WON`/`LOST`/`CLOSED`/`SPAM` | Staff-internal messages (`is_internal`) shown to the partner. An off-platform "reply by email" link — the thread is the only way response time is measurable (§ 6.4) |
| `/dashboard/reviews` | Reviews received, with the right of reply | The ability to delete or hide a review |
| `/dashboard/entitlements` | **Tier and usage.** Listings used of allowed, featured slots used, what the next tier grants | A checkout flow — no revenue decision exists (#8) |

#### 20.6.2 The listing authoring form — specified separately because it decides the supply side

**§ 4's lesson: the comparable vendors' listing forms are enormous, and ours must not be.**

**Must have:** four `FormSection`s and no more — **Basics** (title, category, summary, description) ·
**Pricing** (`pricing_model` first, and the price fields **appear only when it is not `ON_REQUEST`**) ·
**Media** (drag-order, first image is the card image, captions optional) · **Where** (service areas or
Remote) · a **live preview of the public listing card** beside the form · **autosave to draft**, with
the saved time shown · character counts on `summary` (300) and `title` (200) · `Save draft` and
`Submit for review` as two distinct actions · on edit of a `PUBLISHED` listing, a **warning that
submitting returns it to review** (§ 19.9).

**Must NOT have:** a required price — `ON_REQUEST` is the common case and a forced number gets filled
with lies (§ 17.3) · more than two levels of category selection · a rich-text editor that emits
arbitrary HTML into a public page — Markdown or a constrained toolbar · a submit that silently
discards unsaved media · validation that only fires on submit.

#### 20.6.3 Leapswitch staff — 13 pages

| Route | Purpose · must have | Must NOT have |
|---|---|---|
| `/dashboard/partners` | **Partners index.** Name, status, verification, tier, users, listings, city. Filters: status, verification, tier, listed. **API exists today** | Delete as a row action — it 409s while users exist (§ 19.8); put it on the show page with the reason |
| `/dashboard/partners/new` | Onboard an organisation. Always creates `PENDING` | A status selector |
| `/dashboard/partners/[id]` | **Partner show**, and the four state actions as **four distinct buttons** — Activate/Suspend, Set verification, Publish/Unpublish, Delete — each gated on its own permission and each explaining its consequence. Suspension warns that it **signs out every user in the organisation** | The four actions collapsed into one status dropdown (§ 19.9) |
| `/dashboard/partners/[id]/edit` | Edit details only | Any field that reaches status, verification or listing |
| **`/dashboard/partner-tiers`** *(corrected 2026-08-17 — not `/dashboard/partners/tiers`)* | Tier entitlements, editable. Shows partners on each tier | An editable `name` — it is the key the code references (§ 17.3) |
| `/dashboard/categories` | **Taxonomy admin.** Two-level tree, drag to reorder, activate/deactivate, live `listing_count`, and **the § 8 indexing threshold shown per category** so staff can see which are publicly visible | A third level — 409 (§ 19.12) · deleting a parent with children (FK is `RESTRICT`) |
| `/dashboard/moderation` | **The review queue.** Oldest first. Renders the listing **exactly as the public would see it**, beside the partner's verification level. Approve, or reject with a **mandatory reason the partner will read**. Queue age visible — § 16.2 measures it | A bulk approve. The whole value of curation is that somebody looked |
| `/dashboard/listings` | All listings across partners. Same route as the partner's, unscoped | A second component |
| `/dashboard/enquiries` | **Oversight**, not an inbox. Response rate and unanswered count by partner; the ability to see a thread but **not to reply as the partner** | A reply-as-partner control — it would corrupt `first_responded_at`, which § 16 depends on |
| `/dashboard/reviews` | Moderation queue for reviews | Editing review text |
| `/dashboard/market` | **§ 16's measures.** Enquiries per listed partner per month, response rate, unanswered rate, category coverage, moderation queue age | **§ 16.3's two distrusted numbers — page views and total listings — must not appear** |
| `/dashboard/users` · `/roles` · `/invitations` · `/activity` | Existing core admin. **Add `partner_id` as a column and a filter** on users and invitations | A second users module for partner members — it is the same table |
| `/settings/*` | Existing application settings | |

#### 20.6.4 What the partner must never be able to reach

Worth listing explicitly, because each is one forgotten guard away:

| Surface | Why |
|---|---|
| Another organisation's anything | 404, never 403 (§ 19.6) |
| `partners.notes`, `gst_number`, `pan_number` of any org — **including their own, as editable** | Internal, and staff-owned |
| Their own `status`, `verification_level`, `is_listed` | Three separate permissions they do not hold (§ 19.7) |
| The moderation queue | `listing-moderate` is the curator's |
| Staff-internal enquiry messages | `enquiry_messages.is_internal` |
| `/dashboard/market`, `/dashboard/categories`, `/dashboard/partners` | Staff surfaces; the nav hides them and the routes refuse them |

### 20.7 The five ways this surface most plausibly fails

Written down because each is easy, and each is judged:

1. **It looks like a CRM.** Reusing `ResourceIndex` for a category page. § 20.1 ②.
2. **Thin category pages get indexed.** One partner under a heading, crawled, and it defines us. § 8's threshold exists for this.
3. **It ships light-mode only.** `text-brand` on a dark card is 2.83:1. Half the visitors see unreadable links.
4. **Empty states look like bugs.** A directory launching with sparse categories renders "0 results" and the visitor concludes it is broken rather than new.
5. **We outrank our own partners.** The profile page ranks for the partner's brand name. § 9.1 commitment 2 — and the partner *will* notice.

---

## Related Documentation

- [`MARKETPLACE_DOMAIN_PLAN.md`](./MARKETPLACE_DOMAIN_PLAN.md) — **the plan this one contradicts.** Read § 0 before either
- [`PLANNING.md`](./PLANNING.md) — current state, the two queues, and the uncommitted tree
- [`TECH_DEBT.md`](./TECH_DEBT.md) — PM-5 (scoping), PM-11 (tests), PM-27 (email)
- [`CORE_HARDENING_PLAN.md`](./CORE_HARDENING_PLAN.md) — the platform layer beneath all of this
- [`../core/AUTHORIZATION.md`](../core/AUTHORIZATION.md) — the RBAC this extends, and § Data Visibility
- [`../core/USERS.md`](../core/USERS.md) — why `partner_id` belongs on `users`
- [`../system-design/NEXTJS_STANDARDS.md`](../system-design/NEXTJS_STANDARDS.md) — before building any public surface
