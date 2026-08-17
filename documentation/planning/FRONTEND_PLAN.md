# Frontend Plan — every page this product will have

**Status: NEW — 2026-08-17.** Every "built" mark below was measured against `frontend/app/` on that
date, not copied from another register.

> ## What this file answers, and what it does not
>
> The page inventory already existed — scattered across §§ 14.2, 14.3, 14.4, 20.3, 20.6.1 and 20.6.3
> of a **2,847-line** document. You could not see the shape of the frontend without reading six
> tables in five places. **This file is the one register of routes.**
>
> | Question | File |
> |---|---|
> | **What pages exist, what pages are coming, who sees each one, is it built?** | **This file** |
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

| # | Route | Page | Phase | Spec | Status |
|---|---|---|:---:|---|:---:|
| A1 | `/` | **Home** — proposition, search above the fold, category grid, verified-partner strip, trust bar | 5 | § 20.4 | ⬜ |
| A2 | `/partners` | **Directory index** — every listed partner, faceted by category · city · verification · tier | 5 | § 20.4 | ⬜ |
| A3 | `/partners/[slug]` | **Partner profile** — the credential page. The one we must not outrank | 5 | § 20.4 | ⬜ |
| A4 | `/services` | **Category index** — the taxonomy as a browsable map | 5 | § 20.4 | ⬜ |
| A5 | `/services/[category]` | **Faceted listing index** — *the page that ranks.* Category × city is the atomic search unit | 5 | § 20.4 | ⬜ |
| A6 | `/services/[category]/[listing]` | **Listing detail** — **the most commercially important page on the site.** Enquiries are sent from here | 5 | § 20.4 | ⬜ |
| A7 | `/search` | **Search results** — Postgres FTS. Always `noindex,follow` | 5 | § 20.4 | ⬜ |
| A8 | `/enquiries/[reference]` | **Enquiry status** — a capability URL for a buyer with no account | 6 | § 20.4 | ⬜ |
| A9 | `/become-a-partner` | **Supply-side landing** — where growth comes from | 5 | § 20.4 | ⬜ |
| A10 | `/about` | **About** — a directory with no "who runs this" reads as a scrape | 5 | § 20.4 | ⬜ |
| A11 | `/contact` | **Contact** — the real Pune / Mumbai / Nashik addresses | 5 | § 20.4 | ⬜ |
| A12 | `/terms` | **Terms** ⚠️ **not drafted by an engineer or an AI** | 6 | § 20.4 | ⬜ |
| A13 | `/privacy` | **Privacy** — non-optional the moment a public form takes a name, email and phone | 6 | § 20.4 | ⬜ |

**Not pages, but shipped with them:**

| File | What | Status |
|---|---|:---:|
| `app/(public)/layout.tsx` | Marketing header, footer, skip link. Server component | ⬜ |
| `app/(public)/loading.tsx` · `error.tsx` | Skeletons at final dimensions · `error.digest`, **never `error.message`** | ⬜ |
| `app/not-found.tsx` | **EDIT** — must serve the public 404 too. A crawled 404 is judged | 🔧 exists |
| `app/sitemap.ts` | Next 14 file convention, **not** a route handler | ⬜ |
| `app/robots.ts` | Disallow `/dashboard`, `/settings`, `/sign-in`, `/api`, `/enquiries` | ⬜ |

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
2. **Dark mode from day one.** `text-brand` on a dark card measures **2.83:1** and fails AA. Use
   `text-brand dark:text-brand-on-dark` as a unit. Retrofitting this is a sweep across every file.
3. **This is Next.js 14.2.35**, not 15 or 16. `sitemap.ts`, `robots.ts`, `generateMetadata` and
   `generateStaticParams` are the four conventions the public surface depends on — verify each
   against the installed tree, per the root `AGENTS.md`.

---

## Related Documentation

- [`PARTNER_DIRECTORY_PLAN.md`](./PARTNER_DIRECTORY_PLAN.md) — **§ 20** for per-page specs, § 15 for
  the product-wide order, § 17.3 for the public response allowlists
- [`../system-design/NEXTJS_STANDARDS.md`](../system-design/NEXTJS_STANDARDS.md) — page composition
- [`../system-design/UI_PATTERNS.md`](../system-design/UI_PATTERNS.md) — design atoms, the three-page
  contract, stat tiles
- [`../design/VIHO_THEME_REFERENCE.md`](../design/VIHO_THEME_REFERENCE.md) — the adopted theme
- [`PLANNING.md`](./PLANNING.md) — what is in flight now
- [`TECH_DEBT.md`](./TECH_DEBT.md) — known defects; don't re-report them as new
