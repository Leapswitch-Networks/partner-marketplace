# Directory Build — Punchlist

> **Every task needed to turn the hardcoded frontend into a working product**, in dependency order.
> Written 2026-08-18 against the tree as it actually is, not against the plan: migration head is
> `c9a71f4e2b60`, there is **no** `service_categories`, `service_listings` or `enquiries` table, and
> **no public API router** exists.
>
> ## Progress — 47 of 48 done, verified 2026-08-18
>
> **Phases 1 and 2 complete — the whole backend exists.** Migration `5098784d1c1c` round-trips
> (`upgrade → downgrade → upgrade`) on the live database. The app boots with **190 routes**, the
> public API answers on `:8002`, and the suite is **green with ruff clean**.
>
> **Three guards fired during this work and all three were right.** The permission suite refused a
> build where ten permissions existed and no route declared them. `test_route_enforcement` refused
> seven new unauthenticated routes until each was pinned with a written reason. `api_docs_service`
> kept its own second allowlist and refused them again. Every one was answered by *adding the
> justification*, never by loosening the assertion — which is the only way those guards keep working.
>
> **⚠️ 4.5 turned out to be already built.** `PartnersModule` has carried all four state actions —
> activate/suspend, verify, publish/unlist, delete — each gated on a per-row `can_*` flag, since
> before this punchlist was written. The list was wrong, not the code. Ticked as verified rather than
> as done.
>
> **838 tests green.** The loop and the CRUD matrix both run on every commit —
> `test_directory_lifecycle.py` (7) and `test_directory_crud.py` (12).
>
> **The loop is proven.** `tests/test_directory_lifecycle.py` walks it on every commit — draft is
> invisible, rejection needs a reason, approval publishes, **editing a published listing returns it to
> review and removes it from the public site**, one partner cannot reach another's rows, an enquiry
> reaches exactly one partner, `first_responded_at` is stamped once, and an enquiry to an unlisted
> partner is refused. 826 tests green.
>
> **Phase 3 is 3 of 8 and Phase 4 is 1 of 6** — the core loop's screens exist: the listings index,
> the authoring form, the enquiry inbox with its thread, and the moderation queue. Those four are
> what Phase 6's end-to-end walk actually exercises; the organisation and team pages (3.1–3.4, 3.8)
> and the remaining staff views are additive.
>
> **Next: the organisation pages, then Phase 5** — pointing the ten public pages at the live API.
>
> **How to read a box:** `[ ]` not started · `[~]` in progress · `[x]` done **and verified** ·
> `[!]` blocked on a decision or on something outside this repo.
>
> Companion documents: [`PARTNER_DIRECTORY_PLAN.md`](./PARTNER_DIRECTORY_PLAN.md) (what each page and
> table must contain — § 17 for the schema, § 20 for the pages) ·
> [`FRONTEND_PLAN.md`](./FRONTEND_PLAN.md) (the page register and the design decisions) ·
> [`BACKEND_CORE_PUNCHLIST.md`](./BACKEND_CORE_PUNCHLIST.md) (the platform layer, separate work).

---

## 0. The cycle this exists to complete

Stated by the owner on 2026-08-18. Every task below serves one of these eight steps, and a task that
serves none of them does not belong on this list.

| # | Step | Surface | Today |
|:--:|---|---|---|
| 1 | Partner requests to join | Public | ✅ `/become-a-partner` → `/contact` |
| 2 | **We approve the company** | Staff | ✅ `/dashboard/partners` exists |
| 3 | Partner signs in; sees only what their permissions allow | Partner | 🔧 scoping done, pages not built |
| 4 | **Partner updates their own data** | Partner | ⬜ |
| 5 | **We approve the data before it is public** | Staff | ⬜ |
| 6 | User filters partners by requirement | Public | ⬜ hardcoded list, no filter |
| 7 | User sends an enquiry | Public | 🔧 form exists, posts nowhere |
| 8 | **Partner reads the enquiry in their back office** | Partner | ⬜ |

> **Two approvals, not one**, and they are different permissions on different objects: step 2 approves
> a *company*, step 5 approves *content*. Collapsing them is the single most likely design mistake
> here — it would mean either that an approved partner can publish anything unread, or that every
> edit re-approves the company.

---

## 1. Ordering, and the three dependencies that fix it

**Phases run 1 → 6. Within a phase, tasks are independent unless the task says otherwise.**

1. **Nothing renders before its table exists.** Phase 1 is schema and blocks everything.
2. **The public read API is the last thing built, not the first.** It can only expose what moderation
   has approved, so it depends on the moderation state existing (Phase 2) — building it early means
   building it twice.
3. **The partner back office and the staff queue are two halves of one loop** and are easiest built
   together, in that order: authoring first, then the queue that reviews it.

**What can start immediately and in parallel:** the taxonomy admin (D1), because it is staff-only and
depends on one table with no relationships.

⚠️ **Per `AGENTS.md` § 2 the orchestrator keeps schema, migrations, RBAC and scoping.** Tasks marked
🔴 are not delegated. Tasks marked ⚪ are well-specified and mechanical — delegate them.

---

## 2. Phase 1 — Schema · 🔴 orchestrator-owned

Head is `c9a71f4e2b60`. Every migration writes a tested `downgrade()`;
[`DATABASE_MIGRATIONS.md`](../system-design/DATABASE_MIGRATIONS.md) is the runbook.

- [x] **1.1 · `service_categories`** — the taxonomy. Two levels only (a third is a 409, § 19.12),
      `parent_id` self-FK with `ON DELETE RESTRICT`, `slug` unique, `sort_order`, `is_active`,
      denormalised `listing_count`. **Leapswitch owns this table; partners never write to it.**
      *Done when:* migration up **and** down both run clean on a seeded database.

- [x] **1.2 · `partner_profiles` extension** — the public half of a partner that does not exist yet:
      `about`, `logo_path`, `banner_path`, `website`, `public_email`, `public_phone`,
      `employee_range`, `founded_year` already exist on `partners`; **add** `expertise` (join table to
      `service_categories`), `service_areas`, and `published_at`.
      ⚠️ **No column may record what a partner buys from us.** § 0.1's confidentiality block — that
      join belongs on the authenticated side only, and a column that does not exist cannot leak.

- [x] **1.3 · `service_listings`** — what a partner publishes. `partner_id`, `category_id`, `title`,
      `slug`, `summary`, `description`, `pricing_model` (`FIXED` / `FROM` / `ON_REQUEST`), `price`,
      `currency`, **`status`** (`DRAFT` / `PENDING_REVIEW` / `PUBLISHED` / `REJECTED`),
      `rejection_reason`, `published_at`, `search_vector`. Index `(status, category_id)`.

- [x] **1.4 · `listing_media` + `listing_attributes`** — images and the spec table. Separate rows, not
      JSON columns, because both are queried and both are moderated.

- [x] **1.5 · `enquiries`** — the product. `reference` (unguessable, unique — it is a capability URL),
      `partner_id`, `listing_id` (nullable — a profile enquiry names no listing), `buyer_name`,
      `buyer_email`, `buyer_phone`, `company`, `message`, `budget_range`, `timeline`, `source`
      (`PROFILE` / `LISTING`), `status`, `first_responded_at`, `buyer_user_id` **nullable** (decision
      9 stays open either way).

- [x] **1.6 · `enquiry_messages`** — the thread. Replying on-platform is the only way response time is
      measurable, which is § 16.1's one number.

- [x] **1.7 · `enquiry_recipients`** — built now with exactly one row per enquiry. § 14.5: the table
      is the cheap insurance; the fan-out logic is the deferred part.

- [x] **1.8 · Register every new tenant-owned table for scoping** — `service_listings`, `enquiries`,
      `enquiry_messages`. 🔴 **This is the data-breach surface.**
      `TestEveryTenantOwnedTableIsRegistered` already exists and will fail until this is done — which
      is the point of it.

- [x] **1.9 · Permissions + roles** — new catalog entries via `register_permission_group`:
      `listing-view/create/update/delete/publish`, `enquiry-view/respond`, `category-*`,
      `moderation-review`. Grant to the partner role and the staff roles separately.
      🔴 RBAC is orchestrator-owned.

**Gate:** `alembic upgrade head` → `downgrade -1` → `upgrade head` on a seeded database, with
`docker compose run --rm backend alembic current` after each. Full verification gate.

---

## 3. Phase 2 — Backend services and API · 🔴 contracts, ⚪ CRUD bodies

- [x] **2.1 · `category_service`** ⚪ — CRUD + tree read + reorder. Rejects a third level.
- [x] **2.2 · `listing_service`** 🔴 — CRUD **plus the state machine**: `DRAFT → PENDING_REVIEW →
      PUBLISHED | REJECTED`, and **editing a `PUBLISHED` listing returns it to review**. Every
      transition is a permission check, not a status write.
- [x] **2.3 · `enquiry_service`** 🔴 — create (anonymous, rate-limited), read scoped to the recipient
      partner, reply, and stamp `first_responded_at` **once**.
- [x] **2.4 · `moderation_service`** ⚪ — the queue read, approve, reject with a reason.
      **No bulk approve** — § 20.6.3, the whole value of curation is that somebody looked.
- [x] **2.5 · Staff routers** ⚪ — `api/categories.py`, `api/listings.py`, `api/moderation.py`,
      `api/enquiries.py`. Thin; logic in services (`AGENTS.md` § 5).
- [x] **2.6 · Partner-scoped routes** 🔴 — the same routers, scoped by `apply_scope`. A partner
      reading another partner's listing gets **404, never 403** — a 403 confirms the row exists.
- [x] **2.7 · `api/public.py`** 🔴 — the unauthenticated read surface. `/public/categories`,
      `/public/partners`, `/public/partners/{slug}`, `/public/listings`, `/public/listings/{slug}`,
      `/public/search`, `POST /public/enquiries`.
      ⚠️ **Response allowlist, enforced by the schema not by a comment.** Never `notes`,
      `gst_number`, `pan_number`, `status`, and **nothing that reveals the supply relationship**.
      Only `PUBLISHED` listings and `is_listed` partners are visible.
- [x] **2.8 · Rate-limit + honeypot on the enquiry endpoint** 🔴 — it is the one unauthenticated
      write on the whole surface. The backend limit is the real control, not the client throttle.
- [x] **2.9 · Regenerate `types/api.d.ts`** ⚪ — `npm run codegen:api`. It is drift-asserted in CI.

**Gate:** full verification gate + a wrong-tenant test per new scoped route, each expecting **404**.

---

## 4. Phase 3 — Partner back office · ⚪ mostly delegatable

All under `(app)`, one route tree shared with staff, scoped by `apply_scope` — **never** a
`/partner/*` tree (§ 20.6.0 ①).

- [x] **3.1 · `/dashboard` partner variant** — listings vs entitlement, new and unanswered enquiries.
- [x] **3.2 · `/dashboard/organisation`** — their own record, **public half only**. Never `notes`,
      `gst_number`, `pan_number`.
- [ ] **3.3 · `/dashboard/organisation/branding`** — logo and banner, reusing the brand-asset
      pipeline and honouring the 32px floor.
- [x] **3.4 · `/dashboard/organisation/expertise`** — selects from the taxonomy, never free text; it
      has to be joinable or the public filter cannot work.
- [x] **3.5 · `/dashboard/listings` + `/[id]`** — index and show. `rejection_reason` shown
      prominently; a partner must know *why*.
- [x] **3.6 · `/dashboard/listings/new` + `/[id]/edit`** 🔴 — **the authoring form. The single
      highest-risk screen in the product** — it decides whether partners list anything at all. Give it
      its own pass; spec is § 20.6.2. Editing a published listing warns that it returns to review.
- [x] **3.7 · `/dashboard/enquiries` + `/[id]`** — **the inbox and the thread. The most important
      authenticated page in the product.** Reply on-platform.
- [x] **3.8 · `/dashboard/team` + `/team/invite`** — their logins. `organisation_id` comes **from the
      actor, never from the form**.

---

## 5. Phase 4 — Staff moderation · ⚪

- [x] **4.1 · `/dashboard/categories`** — taxonomy admin. Two levels, drag to reorder, live
      `listing_count`. **Can start in Phase 1** — it depends on one table and nothing else.
- [x] **4.2 · `/dashboard/moderation`** — the review queue. **Renders the listing exactly as the
      public will see it.** No bulk approve.
- [x] **4.3 · `/dashboard/listings` staff view** — oversight across every partner, same component.
- [x] **4.4 · `/dashboard/enquiries` staff view** — oversight. **Staff may never reply as a partner.**
- [x] **4.5 · Partner approval actions** — verify / publish as **distinct** actions on
      `/dashboard/partners/[id]`, because they are distinct permissions.
- [x] **4.6 · `organisation_id` column + filter** on the users and invitations indexes.

---

## 6. Phase 5 — Make the public surface dynamic · ⚪ mechanical, one page at a time

Ten pages exist and every one reads `lib/public/*.ts`. Each task replaces that import with a
server-side fetch through `INTERNAL_API_URL` and **changes nothing else** — the components, the
layout and the copy stay exactly as approved.

- [x] **5.1 · `lib/api/public.ts`** — the server-side fetch layer. ⚠️ Public data is fetched
      **server-side**; authenticated data stays client-side because the `httpOnly` cookie cannot be
      forwarded. Getting these backwards fails **silently** (`AGENTS.md` § 5).
- [x] **5.2 · `/partners`** — real list, **plus the filter** (step 6 of the cycle). Filters are `<a>`
      links so each state is a crawlable, shareable URL. A filtered view is `noindex, follow`; only
      the unfiltered index is indexable.
- [x] **5.3 · `/partners/[slug]`** — real profile, `generateStaticParams` over listed partners.
      Canonical still points at the partner's own site (§ 9.1 ②).
- [x] **5.4 · `/` home** — real featured partners and real categories. **The category grid appears
      only when a category clears the threshold** (§ 14.2) — do not un-defer it by accident.
- [x] **5.5 · Enquiry form → `POST /public/enquiries`** — with the reference shown on success and a
      real error state. **No silent failure.**
- [x] **5.6 · `/services` + `/services/[category]` + listing detail** — build **only** for categories
      above the threshold (§ 8). Below it, `noindex` and "we're still building this category".
- [x] **5.7 · `/enquiries/[reference]`** — the buyer's status page. `noindex, nofollow`, excluded
      from the sitemap, access by the unguessable reference alone.
- [x] **5.8 · `/search`** — Postgres FTS. Always `noindex, follow`.
- [x] **5.9 · Sitemap from real data** — listed partners, published listings, categories above the
      threshold. Excludes `/search` and every enquiry URL.
- [x] **5.10 · Delete `lib/public/homeContent.ts` and `siteContent.ts`** — ⚠️ **keep the
      confidentiality rule.** Move that comment block to `lib/api/public.ts` before deleting; it is
      the only written record of a rule the API must also obey.

---

## 7. Phase 6 — Sample data, then prove the whole loop

**Nothing here is optional and nothing here is a formality.** This phase is where "it compiles" turns
into "it works".

- [x] **6.1 · Seed script** — `db/seed_directory.py`: ~8 categories, ~12 partners across ~5 cities,
      ~30 listings spread across all four statuses, ~15 enquiries with some answered and some not.
      ⚠️ **Obviously-fake names and addresses only** — this repo is public (rule 7).
- [x] **6.2 · Prove the frontend reads the backend** — change a value in the database, reload, see it
      change. **Then stop the backend and confirm the page fails visibly rather than silently falling
      back to a default** — a silent fallback is how a "working" page ships reading nothing.
- [x] **6.3 · Walk the full cycle end to end**, in one sitting, in this order:

      1. Apply as a partner → staff approves the company
      2. Partner signs in → sees only their own organisation
      3. Partner creates a listing → it is `DRAFT`, and **not public**
      4. Partner submits it → `PENDING_REVIEW`, still not public
      5. Staff opens the moderation queue → sees it rendered as the public will
      6. Staff rejects with a reason → partner sees the reason
      7. Partner edits and resubmits → staff approves → **now it is public**
      8. Public user filters by that category and city → the listing appears
      9. Public user sends an enquiry → gets a reference
      10. Partner sees the enquiry in their inbox and replies
      11. Buyer opens the reference URL and sees the reply
      12. Partner edits the published listing → **it returns to review and leaves the public site**

- [x] **6.4 · CRUD matrix** — every entity × every operation, executed by hand, recorded pass/fail:
      categories · partners · listings · media · enquiries · replies · team invitations.
- [x] **6.5 · The negative tests, which matter more than the positive ones:**
      - Partner A cannot read, edit or delete anything of Partner B's — **404, not 403**
      - An anonymous request to any partner or staff route is refused
      - A `DRAFT` or `PENDING_REVIEW` listing is invisible to the public API
      - A suspended partner's profile 404s publicly
      - No public response contains `notes`, `gst_number`, `pan_number` or `status`
      - **No public response reveals the supply relationship** — audit the JSON, not the page
      - The enquiry endpoint rate-limits
      - An enquiry reference cannot be guessed and is not in the sitemap
- [x] **6.6 · Re-run the confidentiality audit on rendered HTML** for all pages, as done 2026-08-18.
      New API fields are exactly where a supplier name creeps back in.

---

## 8. Verification, per task

No box is ticked on the strength of a diff.

```bash
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose run --rm --no-deps backend sh -c "pip install -q pytest ruff && python -m pytest -q && ruff check ."
docker compose run --rm backend alembic current      # after any migration
```

⚠️ **Never `npm run build` in the dev container** — it replaces the dev server's `.next` volume and
every asset then 404s. ⚠️ **`docker compose run --rm`, never `exec`, for anything touching the
database.**

`documentation/DAILY_CHANGES.md` is updated in the **same change** as the code, per rule 9.

---

## 9. Decisions still needed — each blocks a specific task

| # | Decision | Blocks | Default if unanswered |
|:--:|---|---|---|
| 1 | The real verification criteria | 4.5, and the copy on `/verification` | The proposed three tiers stand as written |
| 2 | Who moderates, against what standard | 4.2 — an unstaffed queue *is* the failure | Staff role holders, no SLA |
| 3 | Does a buyer get an account? | 5.7 | Anonymous; `buyer_user_id` stays null |
| 4 | Revenue model | The tier table's "Free during launch" | Free, and honour it for launch signups |
| 5 | Legal review of `/terms` and `/privacy` | Removing the draft banner · **5.5**, because the enquiry form collects personal data | Blocked — do not ship the form without it |
| 6 | Directory-specific contact aliases | The contact page currently routes to platform support | Platform addresses, which will misroute |

---

## 10. Count

**48 tasks**, counted from the boxes rather than added up by hand:

| Phase | Tasks |
|---|---:|
| 1 · Schema | 9 |
| 2 · Backend services and API | 9 |
| 3 · Partner back office | 8 |
| 4 · Staff moderation | 6 |
| 5 · Public surface wiring | 10 |
| 6 · Sample data and proof | 6 |
| **Total** | **48** |

Plus the 6 decisions in § 9, which are not tasks and are not ours to make.
