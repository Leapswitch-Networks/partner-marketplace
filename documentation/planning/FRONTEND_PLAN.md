# Frontend Plan — every page this product will have

**Status: NEW — 2026-08-17. Updated 2026-08-18** with the Justdial research the owner asked for —
**§§ 12–14**, the scale calibration this file did not have — and **§ 15**, the Wispr Flow colour
harvest that gives the public surface its palette. Every "built" mark below was
measured against `frontend/app/` on 2026-08-17, not copied from another register; the database counts
in § 13.1 were measured on 2026-08-18.

> ## What this file answers, and what it does not
>
> The page inventory already existed — scattered across §§ 14.2, 14.3, 14.4, 20.3, 20.6.1 and 20.6.3
> of a **2,847-line** document. You could not see the shape of the frontend without reading six
> tables in five places. **This file is the one register of routes.**
>
> | Question | File |
> |---|---|
> | **What pages exist, what pages are coming, who sees each one, is it built?** | **This file** |
| **How many partners must exist before a given page earns its place?** | **This file, § 13.3** |
| **Which pages do we build first, at the size we will actually launch at?** | **This file, § 14.5** |
| **What colour is anything on the public site — buttons, borders, cards, background?** | **This file, § 15** |
> | What must each public page contain, forbid, and show when empty? | `PARTNER_DIRECTORY_PLAN.md` § 20.4 |
> | What must each back-office page contain and forbid? | `PARTNER_DIRECTORY_PLAN.md` §§ 20.6.1–20.6.3 |
> | How is a page composed — layouts, Redux, the API layer, forms? | `system-design/NEXTJS_STANDARDS.md` |
> | What does a button, a table, a card look like? | `system-design/UI_PATTERNS.md` |
> | In what order is the whole product built, backend included? | `PARTNER_DIRECTORY_PLAN.md` § 15 |
>
> **This file never restates a page's contents.** The moment it does, it starts drifting from § 20
> and one of the two becomes a lie. It carries the route, the surface, the audience, the status and a
> pointer. Nothing else.
>
> ⚠️ **When this file and § 20 disagree about whether something is built, this file wins** — its
> statuses were measured. When they disagree about what a page must *contain*, § 20 wins.

---

## 1. Why this surface is the one that matters

The owner's framing, and it is correct: **the frontend is what the company is judged on.** A buyer
who has never heard of us forms their entire opinion of Leapswitch from a category page that took
four seconds to load, or a partner profile with a broken empty state, or a 404 with nothing on it.
The backend can be excellent and invisible. The frontend cannot be either.

Three consequences that change how this is built, not just how it looks:

1. **A stranger on a 4G phone in India is the reviewer.** The performance budget in
   `PARTNER_DIRECTORY_PLAN.md` § 20.2 is not aspirational — LCP < 2.5s, first-load JS < 150 kB per
   public route, one above-the-fold image.
2. **Empty is the launch condition, not the edge case.** A directory opens sparse. Every empty state
   is a designed screen, because "0 results" reads as broken software, and a visitor who concludes
   the site is broken does not come back to check whether it filled up.
3. **We are publishing pages about other companies.** A partner profile that outranks the partner's
   own website is a commercial injury to somebody who trusted us. § 9.1's commitments are frontend
   work — canonical tags and JSON-LD — not policy.

---

## 2. Four surfaces, and they are genuinely four different applications

The single easiest way to under-cost this is to read it as "some more pages on the dashboard".

| # | Surface | Route group | Auth | Rendering | Chrome | Shells |
|---|---|---|---|---|---|---|
| **A** | **Public directory** | `(public)` — **does not exist yet** | None. Anonymous | **Server**, via `INTERNAL_API_URL` | Marketing header/footer | Its own — `components/public/` |
| **B** | **Auth screens** | `(auth)` | Signing in | Client | Split-screen brand panel | Its own |
| **C** | **Partner back office** | `(app)` | Partner user, **scoped** | Client, via `axiosInstance` | Signed-in green chrome | `ResourceIndex` / `ResourceForm` / `ShowPage` |
| **D** | **Staff back office** | `(app)` | Staff, **unscoped** | Client, via `axiosInstance` | Signed-in green chrome | Same three shells |

**C and D share one route tree.** `/dashboard/listings` serves both; `apply_scope` decides what is in
it. This is settled and not to be re-litigated — `PARTNER_DIRECTORY_PLAN.md` § 20.6.0 ①. Do **not**
build `/partner/listings` and `/admin/listings`.

**A shares nothing with C and D.** Different fetch path, different actor, different caching,
different shells. § 20.1 ② states it so it is never a debate: **the three-page contract governs
`(app)` only.** A category page built out of `ResourceIndex` is the single most likely way this
surface ends up looking like a CRM.

---

## 3. Measured state — 2026-08-17

```bash
find frontend/app -name page.tsx | wc -l     # 48
grep -rl "redirect(" frontend/app --include=page.tsx   # 5 — retired stubs, not pages
```

| | Count |
|---|---:|
| `page.tsx` files in the tree | 48 |
| …of which are retired redirect stubs | 5 |
| **Real pages today** | **43** |
| Public pages today | **0** |
| Partner back-office pages today | **0** |

The 43 break down as **6** auth screens, **3** personal settings, **34** staff dashboard pages.

The five stubs are `/`, `/settings`, `/dashboard/profile`, `/dashboard/all-users`,
`/dashboard/add-user` — each also has a 307 in `middleware.ts`, because a server component's
`redirect()` is streamed and arrives late (see the comment in `middleware.ts`).

---

## 4. Surface A — the public directory · 13 pages, **none built**

New route group `app/(public)/`, sibling of `(auth)` and `(app)`. Full per-page specs — purpose,
data, must-have, must-NOT-have, empty state, SEO, done-when — are in `PARTNER_DIRECTORY_PLAN.md`
§ 20.4. **Read that before writing any of these.**

> ⚠️ **The `Phase` column below is the product-wide sequence, not a launch order.** At the number of
> partners we will actually open with, **three of these thirteen pages must not be built yet and one
> must be built first** — see **§ 14.1**. All thirteen still end up existing; the totals in § 7 are
> unchanged.

| # | Route | Page | Phase | Spec | Status |
|---|---|---|:---:|---|:---:|
| A1 | `/` | **Home** — proposition, search above the fold, verified-partner strip, trust bar. *Category grid omitted per § 14.2* | 5 | § 20.4 | ✅ **2026-08-18** |
| A2 | `/partners` | **Directory index** — every listed partner. *Facets, pagination and counts deferred to Band 2 per § 13.3* | 5 | § 20.4 | ✅ **2026-08-18** |
| A3 | `/partners/[slug]` | **Partner profile** — the credential page. The one we must not outrank | 5 | § 20.4 | ✅ **2026-08-18** |
| A4 | `/services` | **Category index** — the taxonomy as a browsable map | 5 | § 20.4 | ⬜ |
| A5 | `/services/[category]` | **Faceted listing index** — *the page that ranks.* Category × city is the atomic search unit | 5 | § 20.4 | ⬜ |
| A6 | `/services/[category]/[listing]` | **Listing detail** — **the most commercially important page on the site.** Enquiries are sent from here | 5 | § 20.4 | ⬜ |
| A7 | `/search` | **Search results** — Postgres FTS. Always `noindex,follow` | 5 | § 20.4 | ⬜ |
| A8 | `/enquiries/[reference]` | **Enquiry status** — a capability URL for a buyer with no account | 6 | § 20.4 | ⬜ |
| A9 | `/become-a-partner` | **Supply-side landing** — where growth comes from | 5 | § 20.4 | ✅ **2026-08-18** |
| A10 | `/about` | **About** — a directory with no "who runs this" reads as a scrape | 5 | § 20.4 | ✅ **2026-08-18** |
| A11 | `/contact` | **Contact** — the real Pune / Mumbai / Nashik addresses | 5 | § 20.4 | ✅ **2026-08-18** |
| A12 | `/terms` | **Terms** ⚠️ **not drafted by an engineer or an AI** | 6 | § 20.4 | 🔧 **structure built, unreviewed** |
| A13 | `/privacy` | **Privacy** — non-optional the moment a public form takes a name, email and phone | 6 | § 20.4 | 🔧 **structure built, unreviewed** |

**Not pages, but shipped with them:**

| File | What | Status |
|---|---|:---:|
| `app/(public)/layout.tsx` | Marketing header, footer, skip link. Server component | ✅ **2026-08-18** |
| `app/(public)/loading.tsx` · `error.tsx` | Skeletons at final dimensions · `error.digest`, **never `error.message`** | ✅ **2026-08-18** |
| `app/(public)/not-found.tsx` | Public 404 with a real search box — **NEW** | ✅ **2026-08-18** |
| `app/not-found.tsx` | Still the app's. ⚠️ **A genuinely unmatched URL falls through to it**, so a crawler gets the signed-in chrome. Open — see § 16 | 🔧 exists |
| `app/sitemap.ts` | Next 14 file convention, **not** a route handler | ✅ **2026-08-18** |
| `app/robots.ts` | Disallow `/dashboard`, `/settings`, `/sign-in`, `/api`, `/enquiries` | ✅ **2026-08-18** |

> ### Beyond the thirteen — three routes the register did not anticipate
>
> Built 2026-08-18 because the pages above link to them and a dead link on a
> trust surface is worse than a missing page:
>
> | Route | Why it exists |
> |---|---|
> | `/why-leapswitch` | **The page the directory rests on.** § 9 makes trust the differentiator, and § 12.4's lesson is that an unpublished standard is not a standard. It carries the criteria for all three badges *and* what verification explicitly does not promise |
> | `/for/[audience]` × 6 | § 15.7's by-audience idea. **The cheapest indexable surface we have** — no categories table, no listings, no threshold — which is why it stands in for the category pages § 14.1 defers |
> | *(`/services*`, `/search`, `/enquiries/*` remain deliberately unbuilt — §§ 13.3, 14.1)* | |

**Shared components — `components/public/`, which does not exist yet.** Build them there, **not** in
`components/common/`; that folder is the admin shell's. `PublicHeader` · `PublicFooter` · `SearchBar`
· `FacetGroup` · `PartnerCard` · `ListingCard` · `VerificationBadge` · `EnquiryForm` · `EmptyState` ·
`Breadcrumb` · `Pagination`. Notes on each: § 20.5.

**The enquiry form is a component, not a route.** It lives on A3 and A6. Making it its own page loses
the context the buyer was reading — § 6.4.

---

## 5. Surface B — auth screens · 6 pages, **all built**

| # | Route | Page | Status |
|---|---|---|:---:|
| B1 | `/sign-in` | Sign in — password, Google SSO, 2FA challenge | ✅ |
| B2 | `/sign-up` | Register — subject to the signup policy | ✅ |
| B3 | `/forgot-password` | Request a reset | ✅ |
| B4 | `/reset-password` | Set a new password from a token | ✅ |
| B5 | `/verify-email` | Confirm an address | ✅ |
| B6 | `/accept-invitation` | Join from an invitation | ✅ |

**One change is coming, and it is not cosmetic.** B6 must accept an invitation **into a partner
organisation** — `partner_id` comes from the token, never the form. That is backend module 4; the
page changes only in what it says.

⚠️ **A1 conflicts with the current front door.** `/` redirects to `/sign-in` in **two** places —
`middleware.ts`'s `pathname === "/"` branch and `app/page.tsx`'s `redirect()`. Both must go before a
public home page can render. See § 8.

---

## 6. Surfaces C & D — the back office · one tree, scoped

Both live in `(app)`, use the green signed-in chrome, and follow the three-page contract. **Who** is
the scoping column, not a second route tree.

### 6.1 Directory pages — 16 routes, **none built**

| # | Route | Page | Sees it | Phase | Spec | Status |
|---|---|---|:---:|:---:|---|:---:|
| C1 | `/dashboard` | **Overview** — partner: listings vs entitlement, new/unanswered enquiries, median response time | P | 4 | § 20.6.1 | 🔧 exists |
| C2 | `/dashboard/organisation` | **Their own partner record**, public half only. Never `notes` / `gst_number` / `pan_number` | P | 4 | § 20.6.1 | ⬜ |
| C3 | `/dashboard/organisation/branding` | **Logo and banner** — reuses the brand-asset pipeline, honours the 32px floor | P | 4 | § 20.6.1 | ⬜ |
| C4 | `/dashboard/organisation/areas` | **Service areas** — selects, never free text; it must be joinable | P | 4 | § 20.6.1 | ⬜ |
| C5 | `/dashboard/team` | **Their logins** — scoped to `partner_id` | P | 2 | § 20.6.1 | ⬜ |
| C6 | `/dashboard/team/invite` | Invite into **their** org. `partner_id` from the actor, never the form | P | 2 | § 20.6.1 | ⬜ |
| C7 | `/dashboard/entitlements` | **Tier and usage** — used of allowed. No checkout; no revenue decision exists | P | 4 | § 20.6.1 | ⬜ |
| S1 | `/dashboard/listings` | **Listings** — "My listings" for a partner, "All listings" for staff. **One component** | P + S | 4 | § 20.6.1 / .3 | ⬜ |
| S2 | `/dashboard/listings/[id]` | **Listing show** — status, moderation history, `rejection_reason` prominently | P + S | 4 | § 20.6.1 | ⬜ |
| C8 | `/dashboard/listings/new` | **The authoring form** — the one screen the supply side depends on | P | 4 | **§ 20.6.2** | ⬜ |
| C9 | `/dashboard/listings/[id]/edit` | Same form. Editing a `PUBLISHED` listing warns it returns to review | P | 4 | **§ 20.6.2** | ⬜ |
| S3 | `/dashboard/enquiries` | **Partner: the inbox** — the most important authenticated page in the product. **Staff: oversight**, and staff may never reply as the partner | P + S | 6 | § 20.6.1 / .3 | ⬜ |
| S4 | `/dashboard/enquiries/[id]` | **The thread** — reply on-platform. It is the only way response time is measurable | P + S | 6 | § 20.6.1 | ⬜ |
| S5 | `/dashboard/reviews` | Partner: reviews received + right of reply. Staff: moderation queue | P + S | 8 | § 20.6.1 / .3 | ⬜ |
| D1 | `/dashboard/categories` | **Taxonomy admin** — two levels only, drag to reorder, indexing threshold shown per category | S | 3 | § 20.6.3 | ⬜ |
| D2 | `/dashboard/moderation` | **The review queue.** Renders the listing exactly as the public sees it. **No bulk approve** — the whole value of curation is that somebody looked | S | 4 | § 20.6.3 | ⬜ |
| D3 | `/dashboard/market` | **Market dashboard** — § 16's measures. Page views and total listings must **not** appear | S | 7 | § 20.6.3 | ⬜ |

*P = partner · S = staff. `C1` is marked 🔧 because the route exists as the staff dashboard; the
partner variant of its content does not.*

### 6.2 Staff pages that already exist

| # | Route | Page | Status |
|---|---|---|:---:|
| D4 | `/dashboard/partners` | Partners index | ✅ |
| D5 | `/dashboard/partners/new` | Onboard an organisation | ✅ |
| D6 | `/dashboard/partners/[id]` | Partner show + the four state actions | ✅ |
| D7 | `/dashboard/partners/[id]/edit` | Edit details only | ✅ |
| D8 | `/dashboard/partner-tiers` | Tier entitlements | ✅ |

> ⚠️ **`PARTNER_DIRECTORY_PLAN.md` § 14.4 marks all five of these 🟡 "not built · API ✅". That is
> stale.** The pages exist and are wired to real modules — `PartnersModule`, `PartnerForm`,
> `PartnerShow`, `PartnerTiersModule` in `components/admin/`. Measured 2026-08-17.
>
> ⚠️ **And the route is `/dashboard/partner-tiers`, not `/dashboard/partners/tiers`** as § 14.4 and
> § 20.6.3 both write it. The code is the truth; the plan has the drift.

**Three of the five still need work**, but as additions, not builds: D4 needs a listing-count column,
D6 needs verification and publish as distinct actions once listings exist, D8 needs the entitlement
columns that replace the shelved discount fields.

### 6.3 Core admin — 29 pages, all built, three need a column

The platform layer. These are not directory pages; they are what makes the directory operable.

| Group | Routes | Status |
|---|---|:---:|
| **Users** | `/dashboard/users` · `/new` · `/[id]` · `/[id]/edit` | ✅ — **add `partner_id` as a column and filter** |
| **Roles** | `/dashboard/roles` · `/new` · `/[id]` · `/[id]/edit` · `/matrix` | ✅ |
| **Invitations** | `/dashboard/invitations` · `/new` | ✅ — **add `partner_id` as a column and filter** |
| **Activity** | `/dashboard/activity` | ✅ |
| **Access control** | `/dashboard/data-access` · `/security` · `/recycle-bin` | ✅ |
| **Platform ops** | `/dashboard/health` · `/worker` · `/errors` · `/webhooks` · `/feature-flags` · `/configuration` | ✅ |
| **API surface** | `/dashboard/api-docs` · `/api-consumers` · `/api-credentials` · `/api-credentials/providers` | ✅ |
| **Branding & search** | `/dashboard/branding` · `/search` · `/ai-assistant` | ✅ |
| **Dashboard home** | `/dashboard` | ✅ |
| **Personal settings** | `/settings/profile` · `/password` · `/appearance` | ✅ |

> **Do not build a second users module for partner members.** It is the same table — § 20.6.3.

---

## 7. The total, in one table

| Surface | Built | To build | Ends at |
|---|---:|---:|---:|
| **A — Public directory** | 0 | 13 | 13 |
| **B — Auth** | 6 | 0 | 6 |
| **C/D — Directory back office** | 5 | 16 | 21 |
| **C/D — Core admin + settings** | 32 | 0 | 32 |
| **Total real pages** | **43** | **29** | **72** |

Plus 5 non-page files (`(public)/layout`, `loading`, `error`, `sitemap.ts`, `robots.ts`), 11 new
public components, and edits to `app/page.tsx`, `middleware.ts` and `app/not-found.tsx`.

**Where the cost actually is, and it is not proportional to the counts.** The 32 core-admin pages
took the longest to build and are done. Of the 29 remaining: the 13 public pages are architecture
this codebase has never produced, and **two** of the back-office pages — the listing authoring form
(C8/C9) and the enquiry inbox (S3) — carry more product risk than the other fourteen together. One
decides whether partners list anything; the other is the product.

---

## 8. Four things measured today that the plan gets wrong

Recorded here because each would cost time to rediscover.

**① The middleware default is *open*, not protected — the opposite of what § 20.3 says.**

§ 20.3 states: *"`middleware.ts` must be edited before any of this renders. Every route today is
protected. Add an explicit public allowlist — the default must remain protected."*

The matcher says otherwise:

```ts
matcher: ["/", "/admin/:path*", "/dashboard/:path*", "/dashboard",
          "/settings/:path*", "/settings"]
```

A route the matcher does not list **never reaches the middleware at all**. `/partners` and
`/services/*` would be public the moment the files exist — no allowlist, no edit. **So the public
surface is not blocked on middleware.** But the plan's principle is the right one and the code does
not implement it: a new authenticated route added outside those six patterns is unguarded at the edge
by default. That is worth fixing on its own terms, not as public-surface work.

*(The backend guards every request independently, so this is a shell-serving concern, not an
authorization hole — as `middleware.ts`'s own docstring is careful to say.)*

**② `/` redirects to `/sign-in` in two places, and both must go for A1.**

`middleware.ts`'s `pathname === "/"` branch fires first and issues a 307. `app/page.tsx` is a second
`redirect()` behind it. Removing one leaves the other. The `"/"` entry in the matcher goes too.

**③ The five staff partner pages are built.** § 14.4 says they are not. See § 6.2 above.

**④ The route is `/dashboard/partner-tiers`.** Two sections of the plan write it as
`/dashboard/partners/tiers`. See § 6.2 above.

---

## 9. Build order for the frontend

The product-wide sequence is `PARTNER_DIRECTORY_PLAN.md` § 15 and it wins on ordering. This is the
frontend slice of it, and the dependency that fixes the order is blunt: **a page cannot be built
before the API it reads.**

| Step | What | Blocked on |
|---|---|---|
| 0 | **`components/public/` + the `(public)` shell** — layout, header, footer, `EmptyState`, `Breadcrumb`, `Pagination`. Build against fixtures | Nothing. **Can start today** |
| 1 | Core-admin additions — `partner_id` column and filter on users and invitations | Backend module 4 |
| 2 | C5 · C6 — partner team pages | Backend module 4 |
| 3 | D1 — taxonomy admin | `service_categories` |
| 4 | C2 · C3 · C4 · C7 — organisation, branding, areas, entitlements | `partners` extensions |
| 5 | **C8 · C9 — the authoring form.** Highest risk. Give it its own pass | `service_listings`, media, attributes |
| 6 | S1 · S2 · D2 — listings index, show, moderation queue | Same, plus module 10 |
| 7 | **A1–A7 · sitemap · robots · 404 — the public directory** | The public read API (module 11) |
| 8 | A8 · S3 · S4 + the enquiry form component | `enquiries`, `enquiry_messages` |
| 9 | D3 — market dashboard | Response metrics |
| 10 | S5 — reviews, both faces | `reviews` |

**A9–A13 (become-a-partner, about, contact, terms, privacy) have no backend dependency at all** and
can be written the moment step 0 has a shell to put them in. Terms and privacy need a human who owns
compliance, which is lead time, not build time — **start that conversation early, not at step 7.**

⚠️ **Step 0 is the one to start now, and it is genuinely unblocked.** Every other frontend step waits
on a table that does not exist. The shells and the eleven public components do not.

> **Step 7 is superseded for the launch window.** § 14.5 replaces it with a seven-step order in which
> `/become-a-partner` comes **first** and only one item has a backend prerequisite. **`Pagination`
> should also come out of step 0**, and `FacetGroup` stays unbuilt — § 13.3 says why.

---

## 10. What is deliberately not a page

| Not building | Why |
|---|---|
| An enquiry form route | It is a component on A3 and A6. A separate page loses the buyer's context — § 6.4 |
| `/partner/*` and `/admin/*` as separate trees | One tree, scoped. § 20.6.0 ① |
| A second users module for partner members | Same table — § 20.6.3 |
| Buyer account pages (sign-up, saved partners, enquiry history) | Decision 9 is open. `buyer_user_id` is nullable so either answer stays cheap |
| Checkout, wallet, billing | § 10 — no revenue decision exists (#8) |
| Quote pages | Shelved with the reseller product — § 0.1 |
| A public API console for partners | Nothing has asked for it |

---

## 11. The rules that govern every page

Not restated here — they live where they are enforced. But three are worth naming because each has a
matching entry in § 20.7's *"five ways this surface most plausibly fails"*:

1. **Public pages fetch on the server; authenticated pages fetch on the client.** Getting these
   backwards fails **silently** — `lib/branding.ts` falls back to defaults and nobody sees an error.
   `AGENTS.md` § 5, and `docker-compose.yml` documents the exact failure at length.
2. **Dark mode from day one — in `(app)` and `(auth)`.** `text-brand` on a dark card measures
   **2.83:1** and fails AA, so `text-brand dark:text-brand-on-dark` is written as a unit and
   retrofitting it is a sweep across every file.
   ⚠️ **Amended 2026-08-18: `(public)` is exempt — it ships light-only.** That is an owner decision
   (§ 15.8 ①), not a drift, and it holds **only** while the four reversibility conditions there are
   obeyed — chiefly that public components reference semantic tokens rather than raw hex, so a dark
   counterpart stays a ten-value change instead of the sweep this rule exists to prevent.
   **Never write a `dark:` variant on a public component**; a half-built dark mode reads as a bug.
3. **This is Next.js 14.2.35**, not 15 or 16. `sitemap.ts`, `robots.ts`, `generateMetadata` and
   `generateStaticParams` are the four conventions the public surface depends on — verify each
   against the installed tree, per the root `AGENTS.md`.

---

## 12. Justdial R&D — 2026-08-18

Requested by the owner as the reference for our public surface. Studied on 2026-08-18. **Read § 13
before drawing any conclusion from this section** — most of what makes Justdial's frontend work is a
consequence of its size, and we do not have its size.

### 12.1 What was actually fetched, and what was not

Honesty first, because a plan built on a half-read reference is worse than one that says so.

| Surface | Got it? | How |
|---|:--:|---|
| Homepage `/` | ✅ | Full HTML, 698 kB |
| `/Advertise` — the monetisation page | ✅ | Full HTML, 67 kB |
| `/robots.txt` | ✅ | Direct |
| The URL taxonomy | ✅ | ~70 distinct link patterns extracted from the homepage |
| Category / search-results pages | ❌ | Bot-challenged — returns a 14-byte body |
| Business detail pages | ❌ | Same |
| `/Free-Listing`, `/sitemap.xml` | ❌ | Same, and a 403 |

**Their `robots.txt` is worth knowing about for its own sake:** it `Allow`s `Claude-User`,
`Claude-SearchBot`, `anthropic-ai` and the OpenAI agents, and `Disallow`s `ClaudeBot` — the crawler.
So an agent fetching on a person's behalf is permitted and a crawler is not, which is a distinction
we will have to make on our own `robots.ts` eventually. It also disallows `/api/` and `/_next/`:
**Justdial is a Next.js application too.**

So: the category and detail page structures below are reconstructed from the homepage's link
taxonomy, the Advertise page's feature list, and secondary sources. **They are not first-hand and are
marked where that matters.** Do not treat them as measured the way this file's own status columns are.

### 12.2 The homepage, as measured

Section order, top to bottom:

1. **Utility bar** — language switcher (7 languages), *We are Hiring*, *Investor Relations*,
   **Advertise**, **Free Listing**, *Business*, *Login / Sign Up*
2. **Search**, above the fold, with the trust claim rendered *inside* it: *"Search across **5.6
   Crore+** Businesses, **6.2 Crore+** Products & Services"*
3. **Four promoted verticals** — Repairs & Services, Real Estate, Doctors, B2B Quick Quotes
4. **A ~20-tile category grid** — Restaurants, Hotels, Beauty Spa, Home Decor, Wedding, Education,
   Hospitals, Contractors, Pet Shops, PG/Hostels, Dentists, Gym, Loans, Driving Schools, Packers…
5. **"Popular Categories"** — the same taxonomy again, clustered into themes (Wedding Requisites,
   Beauty & Spa, Repairs & Services, Daily Needs)
6. **Adjacent verticals that are not a directory at all** — flight/bus/train/hotel/car booking
   (powered by EaseMyTrip), movie listings with review scores, loans, *Ask Astro (Beta)*
7. **Trending Searches Near You** · **Explore Top Tourist Places** · **Popular Searches** ·
   a seasonal block (*Rainy Day Essentials* → gum boots, dehumidifiers, windshield dealers)
8. **App download**, **social follow**, and a **long block of SEO prose** naming every major city

There is no product on this page. There is a search box, and then roughly 150 links into the
taxonomy. **The homepage is a sitemap with a search box on top**, and at 5.6 crore rows that is the
correct design.

### 12.3 The URL taxonomy — the most transferable finding, and the most dangerous

```
/{City}/{Category}/nct-{numeric_id}          /Mumbai/Dentists/nct-10156331
/{City}/{Category}/fil-{id}[-{sub_id}]       /Mumbai/Beauty-Parlours/fil-264-14117
/{City}/{Business-Name}/{id}_BZDET           the detail page
/{City}/{Movie}/mct-{id}                     an adjacent vertical, same shape
```

**City is the first path segment, not a filter.** Every category exists once per city, which is what
turns a taxonomy of a few thousand categories into millions of indexable pages. It is the engine
`PARTNER_DIRECTORY_PLAN.md` § 8 already identifies as the one transferable thing Justdial has.

**It is also the single most likely way we ruin our own SEO.** § 8 already anticipates this and sets
thresholds — ≥3 listed partners for a category page, ≥2 for a category × city pair. § 14 below turns
those thresholds from an *indexability* rule into an *existence* rule, which is the change this
research argues for.

### 12.4 The business model, read off the frontend

The `/Advertise` page states it plainly, and it explains most of the design decisions above:

| Mechanic | As Justdial words it |
|---|---|
| **Paid rank** | *"Rank Ahead of Your Competition"*, *"List in **Top 5** Guaranteed"*, *"1x Search Visibility"* |
| **Paid trust** | *Trust Stamp* / *Verified Seal*, requiring KYC **and an average rating of 3.8+** |
| **Sold leads** | *Lead Bank Access* — *"connect with up to 7 qualified leads per week"* |
| **Adversarial placement** | Mobile and website banners that *"promote your business on **competitor listings**"* |
| **Price** | Standard from **₹132/day** list, 25% off → **₹67/day**; 3-year plan 50% off → **₹23/day** |
| **Scale claims** | **6.3 Lakh+** advertisers, **19.2 Crore+** buyers |

**Three of these five are things we have already ruled out**, and it is worth noticing they are ruled
out on *product* grounds rather than taste: § 9.1 commitment 1 says an enquiry belongs to the partner
it named, which forbids the competitor banner; § 9 says a featured slot may never outrank a
verification failure, which forbids guaranteed top-5; and § 10 records that no revenue decision
exists at all, which forbids the price list.

**The one to steal is the badge criteria being published.** Justdial says exactly what earns a Trust
Stamp — KYC plus 3.8 stars. Our `VerificationBadge` has three levels and § 20.5 asks it to carry a
tooltip; **the tooltip has to state the criteria, not the level's name.** A badge whose meaning is
unpublished is decoration.

### 12.5 The thesis, in one line

> **Justdial's frontend is an architecture for abundance and for selling position within it. Ours has
> to be an architecture for scarcity and for defending a curated judgement.**

Almost every concrete difference in § 14 follows from that sentence.

### 12.6 The closer analogues, and they are not Justdial

Two directories that live at *our* order of magnitude were checked for contrast:

- **Shopify Partner Directory** — filters by service (~30), country (8 named), and **partner tier**
  (Select · Plus · Premier · Platinum). Tiering *is* the ranking signal, stated as being based on
  "history of experience and proven success". No counts are advertised anywhere on the landing page.
  **We already have `partner_tiers` with three rows seeded**, which is the same instrument.
- **Clutch** — per-company rows carry rating + review count, minimum project size, hourly-rate band,
  employee bracket, location, and a **service-focus percentage breakdown**. Its density comes from
  *depth per company*, not from row count, and it discloses that it "may earn a fee for some
  placements".

**Both answer the low-N problem the same way: make each row deep rather than making the list long.**
That is the design we should be copying, and `PARTNER_DIRECTORY_PLAN.md` § 0.1 already named Clutch
and the AWS/Salesforce template as the right references — this research confirms it against the
pages themselves rather than against the citation.

---

## 13. Our scale — measured, and the bands that decide the design

### 13.1 The measurement, 2026-08-18

Taken from the running database and the tree, not from the plan:

| | Count |
|---|---:|
| Rows in `partners` | **0** |
| …with `is_listed = true` | **0** |
| Rows in `partner_tiers` | 3 |
| Rows in `users` | 12 |
| Public pages in `frontend/app/` | **0** |
| Public API routes in `backend/app/api/` | **0** |
| Tables for categories, listings or enquiries | **none exist** |

**"Empty is the launch condition" is not a figure of speech.** § 1 states it as a principle; the directory currently has nothing in it at all, and the only publicly-renderable entity
in the schema is `partners`. There is no `service_categories`, no `service_listings`, no `enquiries`.

The consequence is sharper than the plan currently reads. **Four of the thirteen public pages —
A4, A5, A6 and A8 — have no data source that could exist**, because `service_categories`,
`service_listings` and `enquiries` are not in the schema. Those four include the two that § 20.4
weights most heavily: *"the page that ranks"* and *"the most commercially important page on the
site."* A fifth, `/search`, could technically run over `partners` but has nothing to sift.

### 13.2 The ratio that governs everything below

`PARTNER_DIRECTORY_PLAN.md` decision #3 answers "how many partners" with **300+**. Justdial's
homepage claims **5.6 crore** businesses.

> **Justdial is roughly 190,000× our planned ceiling, and infinitely larger than our launch.**

At that distance, a pattern is not "good design we should adopt" or "bad design we should avoid" —
it is an answer to a different question. Every mechanic on that homepage exists to make an
unmanageable inventory navigable. We have the opposite problem: making a small inventory look
deliberate rather than empty.

### 13.3 Four bands, and the trigger for each mechanic

The useful planning unit is **listed partners** (`partners.is_listed = true`), because that is what a
visitor counts.

| Band | Listed partners | Where we are |
|:--:|---|---|
| **0** | 0 | **Today** |
| **1** | 1 – 25 | Launch, and probably the first two quarters |
| **2** | 26 – 100 | The directory starts behaving like a directory |
| **3** | 100 – 300+ | Decision #3's number. Justdial's *shape* becomes partly relevant here and nowhere earlier |

**This is the table to argue with.** Each row is a mechanic from § 20.4 or from Justdial, and the
trigger is the condition under which it stops being harmful and starts being useful.

| Mechanic | Band 0–1 | Switches on at | Why the trigger is there |
|---|---|---|---|
| **Facets / filters** | **No.** Sort only | **Band 2**, or ≥3 values with ≥2 partners each | A facet over 12 rows produces mostly-empty combinations. Each is a URL, and § 20.4 asks for them to be crawlable — so filtering early *manufactures* thin pages |
| **Pagination** | **No.** One page, every partner | > 24 rows | Page 2 of 2 with three cards on it advertises the inventory |
| **Result counts** ("Showing 12 of 87") | **No** | **Band 2** | § 20.2 rule 10 forbids unverified counts; the inverse also holds — a *verified* count of 6 is worse than no count |
| **`/services/[category]` pages** | **Do not build** | Category has **≥3** listed partners (§ 8) | § 8 makes this an indexability rule. At Band 1 it must be an **existence** rule — see § 14.1 |
| **Category × city pages** | **Do not build** | Pair has **≥2** partners (§ 8) | The Justdial engine. Turning it on early shards a small inventory into dozens of one-row pages |
| **`/search`** | **Defer** | **Band 2**, or once listings exist | Search over 15 rows loses to a single browsable page, and it is `noindex` anyway — it earns nothing until there is something to sift |
| **Sponsored / featured slot** | **Never** | Requires a revenue decision (§ 10) that does not exist | And § 9 caps it permanently: featured may never outrank a verification failure |
| **Star ratings** | **No** | Reviews exist **and** are tied to a real enquiry (§ 16.2) | § 6.5 — unverified ratings read as astroturf. Justdial gates its own badge on 3.8★, which only works at review volume we will not have |
| **"Typically responds in X"** | **No** | § 16's response metrics exist (phase 6) | § 20.4 already says omit rather than fake. At Band 1 one slow partner defines the median |
| **Autocomplete on search** | **No** | Band 2+ | Suggesting from an inventory of 15 exposes the inventory |
| **Sitemap breadth** | `/`, `/partners`, each profile, the static pages | Categories and listings as thresholds are met | § 20.4's sitemap rule, held to |
| **Trust bar (Leapswitch's own credentials)** | **Yes, from day one** | — | **This is the scale inversion.** Justdial's trust signal is its inventory count. Ours cannot be. Ours is the vetting company: since 2006, the ISO stack, 19 locations, 20,000+ customers (§ 18.1) |

### 13.4 The assumption this section makes, stated rather than asked

**Planned as Band 1 at launch (1–25 listed partners), reaching Band 2 within a year.** The owner's
message says only that it will not be "lakhs of users and partners", which rules out Band 3+ but does
not pick between 0 and 25 and 60.

Band 1 is assumed because it is the **safe** direction: everything in § 13.3 is written as
"off until a measured trigger fires", so being wrong low costs nothing but a switch flipped early,
whereas being wrong high ships facets and category pages over an empty directory — which is exactly
the failure § 20.7 lists first. **If the real launch number is above 25, say so and the triggers move;
nothing in the page inventory changes.**

---

## 14. What the research changes in the page inventory

This is the part of the R&D that is this file's own job. § 12 and § 13 are the reasoning; this is the
register delta.

### 14.1 Three pages must not exist at launch — and one must come earlier

⚠️ **The `Phase` column in § 4 is the product-wide sequence from `PARTNER_DIRECTORY_PLAN.md` § 15. It
is not a launch order.** At Band 0–1 it puts four pages in the wrong place:

| # | Route | § 4 says | Band 0–1 verdict | Why |
|---|---|---|---|---|
| A4 | `/services` | Phase 5 | **Do not build.** Fold into `/partners` | A browsable map of a taxonomy with no listings in it. At Band 1 `/partners` *is* the map |
| A5 | `/services/[category]` | Phase 5 — *"the page that ranks"* | **Do not build** until a category clears § 8's ≥3 | It ranks only if it is not thin. One partner under a heading is what § 20.7 calls the thing that "defines us" |
| A6 | `/services/[category]/[listing]` | Phase 5 — *"most commercially important page"* | **Blocked regardless** — `service_listings` does not exist | True at any band. Recorded so the sequencing is honest |
| A7 | `/search` | Phase 5 | **Defer to Band 2** | § 13.3 |
| A9 | `/become-a-partner` | Phase 5 | **Build first, ahead of A1** | See below |

**A9 is the highest-value public page we can build, and the plan has it near the end.** At Band 0 the
demand side has nothing to look at, and the only thing that moves us to Band 1 is partners signing up.
Justdial agrees, and its own header is the evidence: **Free Listing** and **Advertise** are two of the
seven links in its top-level utility bar, permanently. Supply acquisition is not a footer page there,
and it should not be one here.

This does not change the totals in § 7 — thirteen public pages still end up existing. It changes
**which four we write first**, and it stops us shipping two of them into an empty directory.

### 14.2 The Band 0–1 public surface, and what goes on each page

Six pages. Every one is buildable against `partners` alone, or against no data at all.

| # | Route | What is on it at Band 1 | Data |
|---|---|---|---|
| **A9** | `/become-a-partner` | The proposition · **what verification requires, stated as criteria** (§ 12.4's lesson) · the three `partner_tiers` and their entitlements · what it costs — *"free during launch"* (§ 10) · an application form or a contact route · **honesty about scale**: no lead-volume promise, no invented success stories | `partner_tiers` (3 rows, real) |
| **A1** | `/` | `<h1>` proposition · search box above the fold · **the trust bar — Leapswitch's own credentials, which is what replaces Justdial's inventory count** · verified-partner strip · *"Search → Compare → Send one enquiry"* · partner CTA · footer. **The category grid is omitted entirely until a category qualifies** — § 20.4 says drop it to one row; at zero qualifying categories there is no row to drop to | `partners` |
| **A2** | `/partners` | The one browse page. Every listed partner, **no facets, no pagination, no count** · cards carrying logo, name, tagline, verification badge, city/Remote, and a `View profile` link · a sort control only · a one-line explanation of what verification means | `partners` |
| **A3** | `/partners/[slug]` | **The page that carries the weight at this band.** § 20.4's spec, unchanged — banner, logo, `<h1>`, verification block with date, founded year, employee range, location, `about`, service areas, primary `Send enquiry` CTA, website link `nofollow`, breadcrumb. Listings section renders *"Listings coming soon"* | `partners` |
| **A10 / A11** | `/about` · `/contact` | § 18.1's facts and the real Pune / Mumbai / Nashik addresses. **No backend dependency at all** | none |
| **A12 / A13** | `/terms` · `/privacy` | ⚠️ Not drafted by an engineer or an AI. Non-optional the moment A9's form takes a name and an email — **which is the first page we are building**, so this is on the critical path now, not at phase 7 | none |

**The design consequence of dropping facets, pagination and counts:** `/partners` and
`/partners/[slug]` have to carry the whole directory on depth. That is the Clutch and Shopify answer
from § 12.6 — **make each row deep rather than the list long** — and it is why A3's spec must be built
in full rather than trimmed because "there are only twelve of them".

### 14.3 What we copy from Justdial at any size

Short list, and each one survives the scale gap:

1. **The search box is the primary action, above the fold, not below a hero image.**
2. **A permanent supply-side CTA in the header.** Their *Free Listing*; our `/become-a-partner`.
3. **Publish the badge criteria, not the badge name** (§ 12.4). Their Trust Stamp says KYC + 3.8★.
4. **An FAQ block on the supply-side landing.** Their Advertise page ends with one, and it answers
   the objections a partner actually has ("what do I get", "how do I choose", "what is the badge").
5. **Plain, unclever category names.** *Plumbers*, *Dentists*, *Packers & Movers*. No invented
   vocabulary — a taxonomy is a search-term list, not a brand exercise.
6. **Static, crawlable URLs for every browsable state**, which our § 20.4 already requires.

### 14.4 What we never copy, and why it is a product rule rather than a preference

| Justdial mechanic | Why not |
|---|---|
| Guaranteed top-5 placement | § 9 — a featured slot may never outrank a verification failure. Absolute |
| Banners on competitors' listings | § 9.1 commitment 1 — the enquiry belongs to the partner it named |
| Selling leads by the week | The enquiry is the product (§ 2). Metering it destroys the one number in § 16.1 |
| A badge gated on a paid plan | It makes verification a purchase. Verification is the entire differentiator (§ 9) |
| Inventory counts as the trust signal | We do not have the inventory, and § 20.2 rule 10 forbids inventing it |
| Adjacent verticals (travel, movies, loans, astrology) | A directory that sells flights is not a credential page. This is what abundance does to focus |
| ~150 taxonomy links on the homepage | It is a sitemap with a search box. Correct at 5.6 crore rows, absurd at 15 |
| App-download interstitials, seasonal merchandising | No app exists, and merchandising over an empty catalogue reads as a template |

### 14.5 The revised build order for the public surface

Replaces step 7 of § 9 for the Band 0–1 window. The rest of § 9's order is unchanged, and every step
here is **unblocked today** — none of it waits on a table that does not exist.

| Step | What | Blocked on |
|:--:|---|---|
| 0 | `components/public/` + the `(public)` shell — layout, header, footer, `EmptyState`, `Breadcrumb`. **Not** `FacetGroup` or `Pagination`; § 13.3 says they are off | Nothing |
| 0a | Remove the two `/` → `/sign-in` redirects (§ 8 ②) | Nothing |
| 1 | **A9 `/become-a-partner`** — and start the terms/privacy conversation **the same day**, because A9's form collects personal data | `partner_tiers` — exists |
| 2 | A12 · A13 — terms and privacy | A human who owns compliance. **Lead time, not build time** |
| 3 | A10 · A11 — about, contact | Nothing |
| 4 | A2 · A3 — the directory index and the partner profile, built against the § 17.3 public allowlist | A **public read API for `partners`** — which does not exist yet either (§ 13.1). This is the one backend prerequisite in the whole list |
| 5 | A1 `/` — home. Last, because it is an index of everything above it | Steps 1–4 |
| 6 | `sitemap.ts` · `robots.ts` · the public `not-found.tsx` | Step 5 |
| — | A4 · A5 · A6 · A7 · A8 | Bands and tables, per § 14.1 |

⚠️ **Step 4 names the only genuinely new backend work this surface needs at Band 1:** a public,
unauthenticated read endpoint for listed partners, returning the § 17.3 allowlist and nothing else —
never `notes`, `gst_number`, `pan_number` or `status`. Everything else on the list is frontend-only.

### 14.6 Amendments this research owes to `PARTNER_DIRECTORY_PLAN.md` § 20.4

Recorded rather than silently diverging, because this file's own contract says **§ 20 wins on what a
page contains**. Until these land, §§ 13–14 above override § 20.4 *for Band 0–1 only*, and this note
is the marker that the two disagree on purpose.

- [ ] § 20.4 `/partners` — facets, pagination and the *"Showing 12 of 87"* count are Band 2 features
- [ ] § 20.4 `/` — the category grid is omitted, not shrunk, when no category qualifies
- [ ] § 20.4 `/services` and `/services/[category]` — § 8's threshold governs **existence**, not only
      indexability
- [ ] § 20.5 `VerificationBadge` — the tooltip states the **criteria**, not the level's name
- [ ] § 15 — `/become-a-partner` moves ahead of the demand-side pages, and terms/privacy move with it

## 15. The Wispr Flow palette — harvested 2026-08-18

The owner picked [wisprflow.ai](https://wisprflow.ai/) as the visual reference for our public
surface and asked for **the exact colours**. This section is that harvest: every token, every
component colour, measured — plus the four things adopting it will actually cost, because three of
them collide with rules written elsewhere in this repo.

> ## ✅ Adopted 2026-08-18 — this is the public surface's palette
>
> The owner approved the harvest and settled § 15.8's four collisions in the same breath. **Decisions
> are recorded in § 15.8 with what each one closes and what it costs.** The headline:
> **the public surface ships light-only — no dark mode for now**, against a standing rule, which is
> why § 15.8 ① now carries the conditions that keep the decision cheap to reverse.

### 15.1 How this was collected — so it can be re-run

Not eyeballed from screenshots. Wispr Flow is a **Webflow** site, so its entire design system ships
as CSS custom properties in one stylesheet, and that file is the source of truth:

```bash
curl -sL https://wisprflow.ai/ -o home.html
# every page on the site loads this one file (plus swiper for carousels)
curl -sL https://cdn.prod.website-files.com/682f84b3838c89f8ff7667db/css/flowsite-dev.webflow.shared.211a797d4.min.css
```

**All 32 pages in the header and footer were fetched** (every one HTTP 200) and scanned. The finding
that matters for us:

> **One stylesheet serves the entire site. Not a single page overrides the palette.** There is no
> per-page theme, no marketing-vs-product split, no section-level colour system beyond the tokens
> below. Thirty-two pages, one palette.

⚠️ **The hash in that URL will change** when they redeploy. If these values need re-checking, pull
the CSS link out of the homepage HTML first rather than reusing the URL above.

### 15.2 The base palette — eleven colours, and they are named, not numbered

Wispr names its colours rather than numbering them, and the names carry meaning. Ours are quoted
verbatim so the mapping in § 15.9 stays traceable.

| Their name | Hex | What it actually is | Frequency across all 32 pages |
|---|---|---|---:|
| **`vast`** | `#1a1a1a` | Near-black. Body text, borders, and the dark section/card fill | **252** |
| **`fathom`** | `#034f46` | Deep pine green. The "premium section" fill and every link hover | **127** |
| **`lumen`** | `#ffffeb` | **Warm cream — the page background of the entire site.** Not white | **120** |
| **`dawn`** | `#f0d7ff` | Lavender. **The primary button fill** | **78** |
| **`glow`** | `#ffa946` | Warm orange. Accent, and the footer link hover on dark | 40 |
| **`flare`** | `#ff6c4c` | Coral. Accent, display-size only | 39 |
| **`lumen-dark`** | `#e4e4d0` | Cream, one step down. **Borders on cream** and a secondary button fill | — |
| **`signal`** | `#ffbcf2` | Soft pink. Rare, accent only | 5 |
| **`pulse`** | `#7f1c34` | Deep wine. Error text | 6 |
| `white` | `#fff` | Used sparingly — the cream is the real background | 26 |
| `black` | `#000` | Only in the `is-text` button and gradients | 16 |

**Neutrals** — a plain grey ramp, used far less than the named colours:

`#000` · `#111` · `#222` · `#444` · `#666` · `#aaa` · `#ccc` · `#eee` · `#fff`
*(`--base-color-neutral--black` → `--white`, in that order.)*

**System colours**

| Role | Fill | Text-on-fill |
|---|---|---|
| Error | `#f8e4e4` | `#7f1c34` *(= `pulse`)* |
| Success | `#cef5ca` | `#114e0b` |
| Warning | `#fcf8d8` | `#5e5515` |
| **Focus ring** | — | `#2d62ff` |

**Alpha ramps** — two, one per ground. This is how they get every tint without new colours:

| Step | On light (`--alpha--dark--*`) | On dark (`--alpha--light--*`) |
|---:|---|---|
| 2% | `#1a1a1a05` | `#ffffeb05` |
| 5% | `#1a1a1a0d` | `#ffffeb0d` |
| 10% | `#1a1a1a1a` | `#ffffeb1a` |
| 15% | `#1a1a1a26` | `#ffffeb26` |
| 30% | `#1a1a1a4d` | `#ffffeb4d` |
| 50% | `#1a1a1a80` | `#ffffeb80` |
| 70% | `#1a1a1ab3` | `#ffffebb3` |
| 90% | `#1a1a1a` | `#ffffebe6` |

> **The single most transferable idea in the whole palette.** Every tint, border and overlay on the
> site is one of these sixteen values. There is no `grey-300` improvised anywhere. It is the same
> technique our own `--brand` alpha variants already use — theirs is just applied to the whole system.

### 15.3 The semantic layer — what the base colours are *for*

Wispr never uses a base colour directly in a component; it goes through a role. Copying the palette
without copying this indirection is how a design system rots in a month.

| Semantic token | Resolves to | Hex |
|---|---|---|
| `background--primary` | `lumen` | `#ffffeb` |
| `background--secondary` | `dawn` | `#f0d7ff` |
| `background--tertiary` | `vast` | `#1a1a1a` |
| `background--alternate` | `white` | `#fff` |
| `text--primary` | `vast` | `#1a1a1a` |
| `text--secondary` | `lumen` | `#ffffeb` *(i.e. text on dark)* |
| `text--tertiary` | `dawn` | `#f0d7ff` |
| `text--alternate` | `white` | `#fff` |
| `border--primary` | dark @ 30% | `#1a1a1a4d` |
| `border--secondary` | `vast` | `#1a1a1a` |
| `border--alternate` | neutral-darker | `#222` |
| `link--primary` | `dawn` | `#f0d7ff` |
| `link--secondary` | `vast` | `#1a1a1a` |
| `link--alternate` | `white` | `#fff` |

### 15.4 Component colours — measured, not inferred

#### Buttons — the signature component

The base button is **lavender with a hard 2px near-black border**. That combination is the single
most recognisable thing about the site.

```css
.button {
  background-color: #f0d7ff;        /* dawn */
  border: 2px solid #1a1a1a;        /* vast — 2px, not 1px */
  color: #1a1a1a;
  border-radius: 0.5rem;
  padding: 1rem 1.5rem;
  font-weight: 600;
  line-height: 1;
  transition: transform .2s, color .3s;
}
.button:hover { transform: scale(.98); }   /* shrinks. It does not lift, glow or change colour */
```

Nine variants, all measured:

| Variant | Background | Border | Text |
|---|---|---|---|
| **base** | `#f0d7ff` dawn | `2px #1a1a1a` | `#1a1a1a` |
| `.is-secondary` | `#ffffeb` lumen | `2px #1a1a1a` | `#1a1a1a` |
| `.is-secondary` *(green fill)* | `#034f46` fathom | `2px #ffffeb` | `#ffffeb` |
| `.is-secondary.is-transparent` | transparent | `2px #ffffeb` | `#ffffeb` |
| `.is-secondary.green-outline` | inherits | `#034f46` | `#034f46` |
| `.is-secondary.is-lumen-dark` | `#e4e4d0` | `2px #1a1a1a` | `#1a1a1a` |
| `.is-dark` | `#1a1a1a` vast | `2px #1a1a1a` | `#ffffeb` |
| `.is-text` | transparent | `2px transparent` | `#000` |
| `.no-border` | `#f0d7ff` | `#f0d7ff` *(border matches fill)* | `#1a1a1a` |
| `.is-small` | — | — | radius `.5rem`, padding `.6rem .75rem`, `14px` |

#### Navigation — a floating pill, not a bar

```css
.nav_container {
  background-color: #ffffeb;        /* lumen — same as the page */
  border: 2px solid #e4e4d0;        /* lumen-dark */
  border-radius: 0.6rem;
  max-width: 64rem;                 /* floats, centred, margin-top 1rem */
}
.nav_menu-link        { background: transparent; border: 2px solid transparent; border-radius: 1rem; }
.nav_menu-link:hover  { border-color: #1a1a1a; background-color: #fffdf9; }
```

> The nav link reserves its 2px border **transparent** and colours it on hover. That is why nothing
> shifts by 2px when you mouse over it — a detail worth copying exactly.

#### Cards — four distinct treatments, and the split is meaningful

| Card | Background | Border | Radius |
|---|---|---|---|
| Dark card (`workflow`, `download`, `security`) | `#1a1a1a` vast, text `#ffffeb` | `4px #ffffeb1a` *(security only)* | `2.5rem` / `32px` |
| Green card (`use-cases`, pricing pro) | `#034f46` fathom, text `#ffffeb` | — | `2rem` |
| Outlined cream card (`use-case`, `download.v2`) | `#ffffeb` lumen | **`4px solid #e4e4d0`** | `1.5–2rem` |
| Hero/device card | — | `4px solid #e4e4d0` | `40px` |

**Borders are 2px or 4px. Never 1px.** That is the whole reason the site looks confident rather than
delicate, and it is free to copy.

#### Sections — the page is a stack of coloured, heavily-rounded slabs

`background: #034f46` (fathom) or `#1a1a1a` (vast), `border-radius: var(--section-radius--large)`
→ **5rem on desktop, 2.5rem on mobile**, floating on the cream page background.

#### Footer

| | Link | Hover |
|---|---|---|
| On cream | `#1a1a1a` | **`#034f46`** fathom |
| On dark | `#ffffeb` | **`#ffa946`** glow |

### 15.5 Typography — a serif display face, and this is not a small detail

| | Family | Where |
|---|---|---|
| **Display** | **EB Garamond** — a *serif*, weight **400** | Every `h1`–`h4`, pull quotes, prices |
| **Body** | **Figtree** | Everything else |
| Mono | IBM Plex Mono · JetBrains Mono · Monaspace Neon | Code pages only |

```css
h1 { font-family:"Eb garamond"; font-weight:400; letter-spacing:-.05em; line-height:.85 }
h2 { font-family:"Eb garamond"; font-weight:400; letter-spacing:-.03em; line-height:.95 }
h3 { font-family:"Eb garamond"; font-weight:400;                        line-height:1.1 }
h4 { font-family:"Eb garamond"; font-weight:400; letter-spacing:-.03em; line-height:1.3 }
```

| Role | Desktop | Mobile |
|---|---|---|
| h1 | 6rem *(7.5rem on the widest breakpoint)* | 3.5rem |
| h2 | 4rem | 2.5rem |
| h3 | 3rem | 2rem |
| h4 | 2rem | 1.5rem |
| body regular / small / xsmall | 1rem / .875rem / .8125rem | same |

> **A light-weight serif at 96px with negative tracking and sub-1.0 line-height** is doing most of
> the work here. Adopting the colours and keeping a 600-weight sans for headings will *not* produce
> this look — it will produce a lavender admin panel. See § 15.8 ②.

### 15.6 Radius, spacing and shadow

**Radius** (desktop → mobile): x-tiny `1rem` · tiny `2rem → 1.5rem` · small `2.5rem → 1.5rem` ·
regular `3rem → 1.5rem` · medium `4rem → 2rem` · large `5rem → 2.5rem`. Buttons `.5rem`, nav `.6rem`.

**Section padding:** medium `6/4/2rem`, large `8/6/4rem`, x-large `10/8/6/4rem` (desktop → mobile).

**Shadow — almost absent, and the one signature is not a blur:**

```css
box-shadow: 0 2px 0 0 #1a1a1a;   /* hard 2px offset, ZERO blur — the "sticker" edge */
```
Plus one lavender glow stack for a single hero element
(`0 61px 24px #f0d7ff08, 0 34px 21px #f0d7ff1a, 0 15px 15px #f0d7ff2b, 0 4px 8px #f0d7ff33`).

> **This aligns with us for free.** Our `tailwind.config.ts` deliberately ships no brand shadow
> because Viho separates surfaces with borders. Wispr does the same thing — 2px and 4px borders,
> flat fills, no elevation. § 6 of the design worksheet can be answered "flat + border" with a
> reference behind it now.

### 15.7 The site's pages — every one in the header and footer

All fetched 2026-08-18, all HTTP 200, all served by the one stylesheet.

**Header — five links and one CTA.** `Dictation` (`/`) · `Notetaker` · `Business` · `Pricing` ·
`Lab` · **`Download for free`**.

> Worth noticing against § 12: **five links.** Justdial's homepage carries around 150. Wispr is at
> our order of magnitude for navigation complexity, which is a large part of why it is a better
> reference for us than Justdial was.

**Footer — seven groups.**

| Group | Pages |
|---|---|
| Product | Pricing · Privacy & Security · Web demo · Why Flow over built-in voice-to-text · Microphone guide |
| **By audience** | Leaders · Developers · Creators · Customer Support · Students · Lawyers · Accessibility · Sales |
| Resources | Case studies · Blog · Use cases · Web demo · AI prompting guide · Workflows · Vibe coding |
| Support | Talk to support · Talk to sales · Help center |
| Company | About · Careers · Trust center · Become an affiliate · Media kit · What's new |
| Legal | Terms · Privacy · Data Controls |
| Social | YouTube · Crunchbase · Instagram · X · LinkedIn |

> **The by-audience group is the structural idea worth stealing**, and it is free — eight pages that
> are the same product described to eight different readers. Our equivalent writes itself from the
> partner categories, and unlike a category page it needs **no listings table to exist** (§ 13.1).
> It is the cheapest indexable surface available to us at Band 0.

### 15.8 The four collisions — **all four decided 2026-08-18**

Measured, not speculative. Each needed a decision; the owner took all four.

#### ① Dark mode — **there is none, and we are not adding one** ✅ *Option A, owner's decision*

`prefers-color-scheme` appears **zero times** in their stylesheet. `.dark` and `.is-dark` are
section-inversion utilities, not a theme. The site is cream-only.

Our rule (§ 11, `UI_PATTERNS.md`) was **dark mode from day one**, because retrofitting it is a sweep
across every file.

| Option | Cost | |
|---|---|:--:|
| **A · Public surface is light-only** | Honest to the reference. Overrides a standing rule, and the app itself has a theme toggle — a visitor who signs in changes mode mid-journey | ✅ **chosen** |
| B · Derive a dark counterpart | The palette contains one — `vast` sections with `lumen` text — but it is a day of work and a second set of contrast checks for a surface that has no visitors yet | — |

**What this closes:** § 11 rule 2 is now **scoped to `(app)`**, not universal. See the amended rule.
**What it does not touch:** dark mode stays **mandatory** for the signed-in app. `UI_PATTERNS.md` is
unchanged, `text-brand dark:text-brand-on-dark` is still a unit, and the theme toggle stays.

> ##### The four conditions that keep this reversible — not optional, they are the decision
>
> "For now" is only true if the retrofit stays a token change instead of becoming the file sweep the
> rule was written to prevent. Four rules make that so, and they cost nothing today:
>
> 1. **Public components reference semantic tokens, never raw hex** — `bg-public-bg`, `text-public-ink`,
>    never `bg-[#ffffeb]`. A dark counterpart then redefines ~10 values in one file rather than
>    touching every component. **This is the whole reversibility argument; the other three are hygiene**
> 2. **The `(public)` layout sets `color-scheme: light` explicitly** and never receives the `dark`
>    class. `darkMode: "class"` means we opt out by not opting in — but a browser in dark mode will
>    still restyle form controls and scrollbars unless `color-scheme` says otherwise. Without this,
>    the enquiry form's inputs go dark on a cream page and nothing in our code did it
>    ⚠️ Note `app/(auth)/*` and `app/(app)/*` are unaffected — this is a `(public)`-only declaration
> 3. **No `dark:` variant is written on a public component.** A half-built dark mode is worse than
>    none: it reads as a bug rather than a choice, and it is what makes a later retrofit expensive
> 4. **The contrast audit in § 15.10 is re-run against the dark pairs before any dark mode ships** —
>    it is already computed for `vast`/`fathom` grounds, so the work exists; it is just not adopted
>
> **The cost we are accepting, stated plainly:** a visitor whose OS is in dark mode sees a cream site,
> then signs in and lands in a dark app. That is a real seam and there is no way to have it both ways
> without doing B. It is a defensible trade at zero traffic and gets less defensible as traffic grows.

#### ② Two font families, and neither is Montserrat

Wispr loads **EB Garamond** (display) + **Figtree** (body). We load Montserrat and the rule is
absolute: *"The existing Montserrat only. **No second family**"* — it sits in the performance budget.

And § 15.5's point stands: **the serif is the look.** Colours without it are not this design.

| Option | Cost | |
|---|---|:--:|
| A · Montserrat only | Free, keeps the budget. **Will not look like the reference** | — |
| **B · Add EB Garamond for display only** | One extra `next/font` family, `subsets: ["latin"]`, headings only. Body stays Montserrat, so Figtree is **not** needed. The highest-leverage single change on the list | ✅ **chosen** |
| C · Both | Two new families. Straightforwardly over budget for a page whose reviewer is on 4G | — |

✅ **Decided 2026-08-18 — option B.** The rule "no second family" is amended to **"one display face on
the public surface, Montserrat everywhere else"**. Conditions: `next/font/google`, latin subset,
weight 400 only, `display: "swap"`, and it is loaded in the `(public)` layout — **never in the root
layout**, or the signed-in app pays for a font it never renders.

#### ③ Runtime theming — we have it, they do not

Our brand colour is `rgb(var(--brand) / <alpha-value>)` with **eight presets**, and
`backend/app/core/theme.py` derives tints per theme. Wispr's palette is fixed hexes.

✅ **Decided 2026-08-18 — the public surface opts out of runtime theming and pins this palette.** It
is a marketing surface for *one* company: ours. Making it re-themeable serves nobody and would mean
contrast-checking eight variants of a design chosen precisely because it looks like itself.

⚠️ **This is a code change, not just a policy.** `lib/branding.ts` fetches branding server-side for
the root layout today. The `(public)` layout must not consume the themed CSS variables — and the
logo/app-name are a separate question from the palette, since those *should* still come from
branding. Settle that when the shell is built, not now.

#### ④ It is another company's palette

Our own [`../design/references/ANTI_SLOP.md`](../design/references/ANTI_SLOP.md) and
`DESIGN_MD.md` say to read a brand's system for technique and not to ship its tokens. That guidance
was written about copying *at random*; this is a deliberate owner decision about a company in an
unrelated market (voice dictation), and a colour palette on its own is not what makes trade dress.

✅ **Decided 2026-08-18 — proceeding, with two guardrails** that cost nothing and remove the real risk:

- **Do not also copy the wordmark, the logo, the illustration style, or the copy voice.** Palette plus
  all of those is the thing that reads as imitation
- The named tokens below get **our** names, not `lumen` / `fathom` / `dawn`. Shipping a public repo
  full of another company's internal colour names is the part that would look like a lift

### 15.9 Proposed mapping into our tokens

Not yet applied — this is the proposal § 15.8 has to be settled before adopting. Names are ours;
values are theirs exactly, as requested.

| Our token | Value | Was (Viho) | Role |
|---|---|---|---|
| `public.bg` | `#ffffeb` | `#f5f7fb` | **Page background — warm cream, not white** |
| `public.bg-alt` | `#e4e4d0` | — | Borders on cream, secondary button fill |
| `public.ink` | `#1a1a1a` | `#242934` | Body text, borders |
| `public.deep` | `#034f46` | — | Premium section fill, link hover. **Close to our `#24695c`** |
| `public.lilac` | `#f0d7ff` | — | **Primary button fill** |
| `public.amber` | `#ffa946` | — | Accent, footer hover on dark |
| `public.coral` | `#ff6c4c` | — | Accent, display sizes only |
| `public.blush` | `#ffbcf2` | — | Rare accent |
| `public.wine` | `#7f1c34` | `#d22d3d` | Error text |
| `public.focus` | `#2d62ff` | — | Focus ring |

**A genuinely useful coincidence:** their `fathom` `#034f46` and our brand `#24695c` are both dark
desaturated greens. The public surface will not look like a different company's site from the
signed-in app, which is the usual cost of giving a marketing surface its own palette.

### 15.10 Contrast audit — computed, and two of them fail

Every pair below is a real combination on their site, checked against the AA thresholds this project
already enforces.

| Pair | Foreground | Background | Ratio | AA text |
|---|---|---|---:|:--:|
| Body text | `#1a1a1a` | `#ffffeb` | **17.20** | ✅ |
| Text on dark card | `#ffffeb` | `#1a1a1a` | **17.20** | ✅ |
| **Primary button label** | `#1a1a1a` | `#f0d7ff` | **13.15** | ✅ |
| Lavender on dark | `#f0d7ff` | `#1a1a1a` | 13.15 | ✅ |
| Blush on dark | `#ffbcf2` | `#1a1a1a` | 11.38 | ✅ |
| Text on green card | `#ffffeb` | `#034f46` | 9.39 | ✅ |
| Link hover green | `#034f46` | `#ffffeb` | 9.39 | ✅ |
| Amber on dark *(footer hover)* | `#ffa946` | `#1a1a1a` | 9.13 | ✅ |
| Success / error / warning text | — | — | 8.28 / 8.12 / 7.02 | ✅ |
| Neutral secondary text | `#666` | `#ffffeb` | 5.68 | ✅ |
| Focus ring | `#2d62ff` | `#ffffeb` | 4.82 | ✅ |
| **Coral on cream** | `#ff6c4c` | `#ffffeb` | **2.77** | ❌ |
| **Amber on cream** | `#ffa946` | `#ffffeb` | **1.88** | ❌ |
| Border `lumen-dark` on cream | `#e4e4d0` | `#ffffeb` | 1.27 | n/a — below 3:1 for UI components |

**The palette is far healthier than ours was.** The core pairs clear AA with enormous margin, and
there is **no `brand-on-dark` problem** — the one that forced a mandatory paired-class rule on us.

**Two rules this audit produces, and they are not optional:**

1. **`coral` and `amber` are never text on cream.** Display sizes, fills and decoration only. Wispr
   uses them exactly that way; copy the restraint, not just the hex
2. **`#e4e4d0` borders are decorative.** Any border that conveys state — a focused input, a selected
   card — needs 3:1, so use `ink` at an alpha step from § 15.2 instead

### 15.11 What this does *not* settle

Colour is one of ten sections in a design spec
([`../design/references/DESIGN_MD.md`](../design/references/DESIGN_MD.md) § 2). This harvest answers
§ 2 completely and § 6 partially. **Layout, spacing, component anatomy and motion are still open**,
and § A of [`../design/references/PUBLIC_DESIGN_WORKSHEET.md`](../design/references/PUBLIC_DESIGN_WORKSHEET.md)
— the register the site should read in — is still unanswered.

One observation for that decision: Wispr Flow is **option A1, institutional restraint**, executed in
warm colours rather than cold ones. Cream over white, one serif, borders over shadows, hover states
that shrink rather than glow. That is a consistent answer to § A, and it is available now.

---

## Related Documentation

- [`DIRECTORY_BUILD_PUNCHLIST.md`](./DIRECTORY_BUILD_PUNCHLIST.md) — **the execution checklist.**
  This file says what the pages are; that one says what to build, in order, to make them real
- [`PARTNER_DIRECTORY_PLAN.md`](./PARTNER_DIRECTORY_PLAN.md) — **§ 20** for per-page specs, § 15 for
  the product-wide order, § 17.3 for the public response allowlists
- [`../system-design/NEXTJS_STANDARDS.md`](../system-design/NEXTJS_STANDARDS.md) — page composition
- [`../system-design/UI_PATTERNS.md`](../system-design/UI_PATTERNS.md) — design atoms, the three-page
  contract, stat tiles
- [`../design/references/`](../design/references/README.md) — **the three design references for
  Surface A**: the `DESIGN.md` format, the anti-slop pre-flight checklist, and the public site's
  design worksheet. Read before writing a public page
- [`../design/VIHO_THEME_REFERENCE.md`](../design/VIHO_THEME_REFERENCE.md) — the adopted theme
- [`PLANNING.md`](./PLANNING.md) — what is in flight now
- [`TECH_DEBT.md`](./TECH_DEBT.md) — known defects; don't re-report them as new

**Sources for §§ 12–14** — fetched 2026-08-18: [justdial.com](https://www.justdial.com/) ·
[justdial.com/Advertise](https://www.justdial.com/Advertise) ·
[justdial.com/robots.txt](https://www.justdial.com/robots.txt) ·
[Shopify Partner Directory](https://www.shopify.com/partners/directory) ·
[Clutch — developers, India](https://clutch.co/in/developers) ·
[UX review of justdial.com](https://medium.com/@RuthlessUx/ux-review-www-justdial-com-5e331de53e4b).
Justdial's category and business-detail pages are bot-challenged and were **not** read first-hand —
§ 12.1 marks exactly what that leaves reconstructed.
