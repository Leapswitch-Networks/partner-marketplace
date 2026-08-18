/**
 * ⚠️ EVERY VALUE IN THIS FILE IS HARDCODED PLACEHOLDER CONTENT.
 * ============================================================================
 *
 * The public surface is being designed before its backend exists. As of
 * 2026-08-18 the database holds **zero partners**, there is **no public API
 * route**, and `service_categories` / `service_listings` / `enquiries` are not
 * tables yet (`FRONTEND_PLAN.md` § 13.1). So the home page is built against
 * this file, the design gets approved, and only then does the backend work
 * start.
 *
 * ## Why it is one file
 *
 * Swapping to real data should be one import changing, not eleven components
 * being rewritten. Every shape below is deliberately the shape the API will
 * return — `PartnerSummary` mirrors the public allowlist in
 * `PARTNER_DIRECTORY_PLAN.md` § 17.3, and carries **nothing** that section marks
 * internal: no `notes`, no `gst_number`, no `pan_number`, no `status`.
 *
 * ## What is real and what is not
 *
 * | | |
 * |---|---|
 * | **Real** | Everything in `COMPANY` — from `PARTNER_DIRECTORY_PLAN.md` § 18.1 |
 * | **Invented** | Every partner. Names, cities, taglines, specialities, all of it |
 *
 * The split matters because § 20.2 rule 10 forbids rendering a number we cannot
 * back. The company facts can be backed. The partners cannot, which is why
 * `IS_PLACEHOLDER` exists and why the page renders a standing notice while it is
 * true — a stakeholder must never mistake this for live inventory.
 *
 * ## What is deliberately absent
 *
 * No ratings, no review counts, no "responds in 2 hours", no partner count, no
 * "10,000+ businesses". Those are all forbidden until the data exists
 * (§ 13.3, § 15) and inventing them here is how a fake number survives into
 * production — it would already look normal by then.
 */

/** Flips to false when this page reads a real API. Drives the standing notice. */
export const IS_PLACEHOLDER = true;

/* ── The company. All real — re-verified against the live sites 2026-08-18 ── */

/**
 * Read from `leapswitch.com`, `leapswitch.com/about-us.php`, `cloudpe.com` and
 * `cloudjiffy.com` on 2026-08-18, and cross-checked against
 * `PARTNER_DIRECTORY_PLAN.md` § 18.1 — which it confirms.
 *
 * ⚠️ **The marketing site contradicts itself on two numbers, and we pick a side.**
 * § 18.1 already flagged this; it is still live today:
 *
 * | Claim | Home page | About Us | Their own list |
 * |---|---|---|---|
 * | Locations | "19 locations world-wide" *and* "18 locations across 3 continents", in two blocks of the same page | **19** | **12 cities** |
 * | Uptime | 99.9% | **99.99%** | — |
 *
 * § 18.1's instruction is to treat About Us as current, so these are the About Us
 * values. **Confirm with marketing before launch** — § 20.2 rule 10 forbids a
 * number we cannot back, and "our own site disagrees with itself" is not backing.
 */
export const COMPANY = {
  operatingSince: 2006,
  legalName: "LeapSwitch Networks Pvt. Ltd.",
  usEntity: "Leapswitch Networks, Inc.",
  cin: "U30007PN2010PTC137171",
  proposition: "Experts in Cloud Services",
  headOffice: "Pune",
  datacenters: 19,
  continents: 3,
  customers: "20,000+",
  countries: "110+",
  nodes: "3,000+",
  networkCapacity: "80 Gbps",
  uptime: "99.99%",
  approvalRating: "97%",
  recognition: "Recognised by the Govt. of India as one of the top 100 SMEs in India",
  certifications: [
    "ISO/IEC 27001:2022",
    "ISO/IEC 27017:2015",
    "ISO/IEC 27018:2019",
    "ISO 20000-1:2018",
    "ISO 9001:2015",
    "MSME",
  ],
  /** From the About page. Public information, published on their own site. */
  offices: [
    { city: "Pune", label: "Head office", address: "Gokhale Business Bay, Kothrud, Pune 411038" },
    { city: "Mumbai", label: "Office", address: "Udyog Bhavan, Wadala West, Mumbai 400031" },
    { city: "Nashik", label: "Office", address: "The Exchange, Trimbak Road, Nashik 422002" },
  ],
  salesEmail: "sales@leapswitch.com",
  supportHours: "24×7×365 — call, chat, email and tickets",
} as const;

/**
 * What partners actually get asked for — taken from the real product catalogue
 * across the three brands rather than invented.
 *
 * This is the vocabulary a buyer will search with, so it has to match the
 * platform they are already on. It is **not** the taxonomy: `service_categories`
 * does not exist as a table yet (§ 13.1), and this list is the raw material for
 * one when it does.
 */
export const SERVICE_VOCABULARY = [
  "Cloud migration",
  "Kubernetes & containers",
  "Managed hosting",
  "AI & GPU workloads",
  "Security & compliance",
  "DevOps & automation",
  "Networking & colocation",
  "E-commerce platforms",
  "Backup & disaster recovery",
  "24×7 managed support",
] as const;

/* ── Partner data lives in the API now ─────────────────────────────────────── */

/**
 * **The invented partners are gone.** They were removed on 2026-08-18 once
 * `/public/partners` went live — `lib/api/public.ts` is the only source of
 * partner data, and keeping a second one would guarantee the two disagreed.
 *
 * 🔴 **The confidentiality rule moved with them, to `lib/api/public.ts`.** It is
 * the rule that matters most in this codebase and it had to land where it can
 * still be broken: no response rendered to an anonymous visitor may state,
 * imply, or let a reader infer that partners source anything from the company
 * operating this platform. Read it there before adding a field to any public
 * page.
 *
 * What remains in this file is **editorial copy** — headings, the audience list,
 * the three steps, the navigation. That is written content, not placeholder
 * inventory, and it has no business in a database.
 */

/* ── "Built for" — the by-audience idea, § 15.7 ────────────────────────────── */

/**
 * Taken from the reference's footer, where eight pages describe the same
 * product to eight different readers. It is the cheapest indexable surface
 * available to us: **it needs no listings table to exist** (§ 13.1).
 *
 * This replaces the category grid on the home page. § 14.2 is explicit that the
 * grid is *omitted, not shrunk*, until a category clears § 8's threshold of
 * three listed partners — and today no category exists at all. Rendering an
 * eight-tile grid over an empty taxonomy is the exact failure § 20.7 lists
 * first.
 */
export const AUDIENCES = [
  {
    slug: "startups",
    label: "Startups",
    blurb: "Launch on infrastructure that scales, without hiring an ops team first.",
  },
  {
    slug: "developers",
    label: "Developers",
    blurb: "APIs, CLI tooling and one-click provisioning — with somebody to call.",
  },
  {
    slug: "enterprise",
    label: "Enterprises",
    blurb: "Compliance evidence, custom SLAs and named accountability.",
  },
  {
    slug: "smb",
    label: "Small business",
    blurb: "Hosting, email and backup handled by someone who answers the phone.",
  },
  {
    slug: "agencies",
    label: "Agencies & resellers",
    blurb: "White-label delivery your clients never need to know the source of.",
  },
  {
    slug: "public-sector",
    label: "Public sector",
    blurb: "Data residency in Indian datacenters, with the audit trail to prove it.",
  },
] as const;

/* ── How it works ──────────────────────────────────────────────────────────── */

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Tell us what you need",
    body: "Describe the workload in your own words. No account, no sales call, no form maze.",
  },
  {
    step: "02",
    title: "Compare what they add",
    body: "Every company here has been checked before listing. Compare what they do, how they support it, and what they charge.",
  },
  {
    step: "03",
    title: "Buy from the one you pick",
    body: "They invoice you, they support you. We keep the servers running underneath. Your enquiry goes to them and nobody else.",
  },
] as const;

/* ── Navigation ────────────────────────────────────────────────────────────── */

/**
 * Five links and one call to action, matching the reference's header exactly.
 * Worth holding to: Justdial's homepage carries around 150 taxonomy links
 * (§ 12.2), and the difference is most of why one reads as a directory you can
 * trust and the other as a directory you have to survive.
 *
 * ⚠️ Only `/` exists today. The rest are the routes in § 4's register and will
 * 404 until they are built — which is correct for a design review and must not
 * survive into anything a stranger can reach.
 */
export const HEADER_LINKS = [
  { href: "/partners", label: "Find a partner" },
  { href: "/verification", label: "Why us" },
  { href: "/become-a-partner", label: "Become a partner" },
  { href: "/about", label: "About" },
] as const;

export const FOOTER_GROUPS = [
  {
    title: "Directory",
    links: [
      { href: "/partners", label: "All partners" },
      { href: "/partners?verification=certified", label: "Certified partners" },
      { href: "/verification", label: "What verification means" },
    ],
  },
  {
    title: "Built for",
    links: AUDIENCES.slice(0, 4).map((a) => ({ href: `/for/${a.slug}`, label: a.label })),
  },
  {
    title: "Partners",
    links: [
      { href: "/become-a-partner", label: "Become a partner" },
      { href: "/sign-in", label: "Partner sign in" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: "/contact", label: "Contact" },
      // 🔴 The sales address is deliberately NOT here. It carries the operating
      // company's domain, and the footer renders on every page — which would
      // put the supply relationship one search away from every visitor. It
      // lives on /contact, where naming the operator is unavoidable anyway.
      { href: "/verification", label: "What we check" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
] as const;
