/**
 * Company-level content for the public pages that are not the home page.
 *
 * ============================================================================
 * EVERYTHING IN THIS FILE IS REAL, read from the three live sites on 2026-08-18
 * ============================================================================
 *
 * Sources — all public marketing pages:
 *   leapswitch.com · /about-us.php · /terms-of-service.php · /privacy-policy.php
 *   /service-level-agreement.php · /acceptable-usage-policy.php
 *   cloudpe.com · /contact        cloudjiffy.com · /contact/
 *
 * ## Two deliberate choices about what is NOT here
 *
 * **1. No individual's name, and that is not caution — it is what they do.**
 * All three sites publish *role* addresses: `grievance@`, `abuse@`, `legal@`,
 * `billing@`. Not one names a person. That is the correct pattern for a public
 * repository (operating contract rule 7) and it is also better operationally: a
 * role survives the person leaving. If a named Grievance Officer is ever
 * required by the DPDPA filing, it belongs in configuration, not in source.
 *
 * **2. No legal prose is copied.** The section *structure* below mirrors what a
 * comparable Indian service publishes — which is a fair reading of what a
 * document of this kind must cover — but the wording on our pages is written
 * for **our** business, which is materially different: we publish pages about
 * third-party companies and route enquiries to them. Neither page is authored
 * by an engineer or an AI, per `PARTNER_DIRECTORY_PLAN.md` § 20.4, and both
 * carry a review banner until somebody who owns compliance has signed them off.
 */

/* ── Contact ──────────────────────────────────────────────────────────────── */

/**
 * Role addresses, exactly as the three sites publish them.
 * ⚠️ These currently reach the *platform* team, not a directory team. Before
 * launch, decide whether the directory needs its own aliases — a buyer emailing
 * `support@` about a partner listing will otherwise reach hosting support.
 */
export const CONTACT_CHANNELS = [
  {
    key: "sales",
    label: "Sales and partnerships",
    body: "New listings, partner applications, and anything commercial.",
    email: "sales@leapswitch.com",
    response: "Within 24 hours",
  },
  {
    key: "support",
    label: "Support",
    body: "Something on this site is broken, or an enquiry did not arrive.",
    email: "support@cloudpe.com",
    response: "24×7 — average response under 2 hours",
  },
  {
    key: "billing",
    label: "Billing",
    body: "Invoices and payments for anything you buy from us directly.",
    email: "billing@leapswitch.com",
    response: "Within one business day",
  },
  {
    key: "abuse",
    label: "Abuse",
    body: "Report misuse of a service, or content that should not be listed.",
    email: "abuse@leapswitch.com",
    response: "Investigated on receipt",
  },
  {
    key: "grievance",
    label: "Grievance Officer",
    body: "Data-protection complaints under the DPDPA, 2023.",
    email: "grievance@leapswitch.com",
    response: "Acknowledged within the statutory period",
  },
  {
    key: "legal",
    label: "Legal",
    body: "Notices, takedown requests, and anything about these terms.",
    email: "legal@leapswitch.com",
    response: "Within 5 business days",
  },
] as const;

export const PHONE = { display: "+91 95996 56657", href: "tel:+919599656657" } as const;

/** Full addresses, from the About and Contact pages of all three brands. */
export const OFFICES = [
  {
    city: "Pune",
    role: "Head office",
    lines: [
      "Office 1104, 11th Floor, Gokhale Business Bay",
      "Opposite City Pride, Kothrud",
      "Pune 411038, Maharashtra",
    ],
  },
  {
    city: "Mumbai",
    role: "Regional office",
    lines: ["Udyog Bhavan, 320, Naigaon Cross Road", "Wadala West", "Mumbai 400031, Maharashtra"],
  },
  {
    city: "Nashik",
    role: "Regional office",
    lines: ["The Exchange, Near Ved Mandir", "Tidke Colony, Trimbak Road", "Nashik 422002, Maharashtra"],
  },
] as const;

/* ── Datacenters — counted off the live footprint list ────────────────────── */

/**
 * ⚠️ Twelve cities, counted from their own list on 2026-08-18. Their About page
 * says "19 locations", their home page says "19" in one block and "18" in
 * another. `homeContent.ts` uses the About-page figure per the plan's standing
 * instruction; **this list is what can actually be enumerated**, which is why
 * the locations page renders the list rather than the number.
 */
export const DATACENTERS = [
  { region: "India", cities: ["Pune", "Mumbai", "Delhi"] },
  { region: "United States", cities: ["Asheville", "Dallas", "South Bend", "Orlando", "Los Angeles"] },
  { region: "Europe", cities: ["Lisbon", "Barcelona", "Kiev", "Frankfurt"] },
] as const;

/* ── About ────────────────────────────────────────────────────────────────── */

export const ABOUT_STORY = [
  {
    title: "Anyone can list themselves anywhere",
    body: "Which is why a listing on most directories tells you nothing. We check a company against public records before it appears here, and we publish exactly what that check covered.",
  },
  {
    title: "Your enquiry is not a lead we sell",
    body: "It goes to the one company you chose. Not to their competitors, not to a lead bank, not to anyone who paid for it. That is the whole design.",
  },
  {
    title: "Position here cannot be bought",
    body: "There is no sponsored slot and no paid ranking. The only thing that moves a company up this directory is passing checks that are published for anyone to read.",
  },
] as const;

/* ── Legal scaffolds ──────────────────────────────────────────────────────── */

/**
 * Section structure only. Bodies are plain-English summaries of what each
 * section must establish for *this* business — a directory that publishes pages
 * about third parties and forwards enquiries — not the hosting terms they were
 * modelled on.
 *
 * ⚠️ **Neither page is legal advice and neither is signed off.** Both render a
 * review banner while `LEGAL_REVIEWED` is false.
 */
export const LEGAL_REVIEWED = false;

export const TERMS_SECTIONS = [
  { n: 1, title: "Definitions", body: "Who counts as a visitor, a partner, and Leapswitch; and what a listing, a profile and an enquiry mean in these terms." },
  { n: 2, title: "What this directory is", body: "A publisher of information about independent companies. Leapswitch is not a party to any agreement a visitor reaches with a partner, and does not deliver the partner's services." },
  { n: 3, title: "What verification does and does not mean", body: "The checks each badge represents, published in full. Verification is not a warranty of a partner's work, pricing or availability." },
  { n: 4, title: "Enquiries", body: "An enquiry is forwarded to the single partner it names and to nobody else. It is not sold, resold or distributed to competitors." },
  { n: 5, title: "Partner obligations", body: "Accuracy of listed information, keeping it current, responding to enquiries, and what happens when a listing goes stale." },
  { n: 6, title: "Content and intellectual property", body: "Partners retain rights to what they submit and grant a licence to publish it. Leapswitch retains rights to the directory itself." },
  { n: 7, title: "Acceptable use", body: "No scraping, no bulk extraction of partner contact details, no misuse of the enquiry form." },
  { n: 8, title: "Removal and suspension", body: "The grounds on which a listing may be removed or suspended, and the notice a partner receives." },
  { n: 9, title: "Limitation of liability", body: "The limits of Leapswitch's responsibility for a partner's acts, omissions or representations." },
  { n: 10, title: "Indemnification", body: "What a partner is responsible for if its listed content causes a claim." },
  { n: 11, title: "Changes to these terms", body: "How changes are notified and when they take effect." },
  { n: 12, title: "Governing law and disputes", body: "Indian law; courts at Pune, Maharashtra." },
  { n: 13, title: "Contact", body: "How to reach us about anything in this document." },
] as const;

export const PRIVACY_SECTIONS = [
  { n: 1, title: "Who we are", body: "LeapSwitch Networks Pvt. Ltd. is the Data Fiduciary for this directory under the Digital Personal Data Protection Act, 2023." },
  { n: 2, title: "What we collect", body: "What you type into an enquiry — name, email, and optionally phone, company, budget and timeline. Plus ordinary server logs." },
  { n: 3, title: "Why we collect it", body: "To pass your enquiry to the partner you chose, and to measure whether partners answer. Nothing else." },
  { n: 4, title: "Who we share it with", body: "The single partner you contacted receives your enquiry. That is the point of sending it, and it is the only routine disclosure." },
  { n: 5, title: "What we never do", body: "We do not sell enquiries, share them with a partner's competitors, or use them to advertise to you." },
  { n: 6, title: "Cookies", body: "What is set, what it is for, and how to refuse the non-essential ones." },
  { n: 7, title: "How long we keep it", body: "Retention periods for enquiries, logs and partner records, and what happens at the end of each." },
  { n: 8, title: "Where it is stored", body: "Indian datacenters. Any cross-border transfer, and the basis for it." },
  { n: 9, title: "Your rights as a Data Principal", body: "Access, correction, erasure, and withdrawal of consent under the DPDPA, 2023." },
  { n: 10, title: "Security", body: "The controls protecting your data, and the ISO certifications the platform holds." },
  { n: 11, title: "Breach notification", body: "What we do, and when you and the Data Protection Board of India are told." },
  { n: 12, title: "Grievance redressal", body: "Our Grievance Officer, how to complain, and your right to escalate to the Data Protection Board of India." },
  { n: 13, title: "Changes to this policy", body: "How changes are notified and when they apply." },
] as const;

/* ── Verification — the criteria, published ───────────────────────────────── */

/**
 * The one lesson taken from Justdial's monetisation page (`FRONTEND_PLAN.md`
 * § 12.4): it publishes exactly what earns its badge — KYC plus a 3.8-star
 * average. **A badge whose meaning is unpublished is decoration**, and this
 * directory's entire argument is that ours means something.
 *
 * ⚠️ These are the *proposed* criteria. They are written as concrete, checkable
 * claims so the page can be judged and so the checks can be argued with — not
 * because they have been agreed. Whoever owns partner onboarding has to sign
 * them off, and § 12 of the directory plan lists "who moderates, against what
 * standard" as still open.
 */
export const VERIFICATION_LEVELS = [
  {
    level: "listed" as const,
    label: "Listed",
    summary: "Company details confirmed. Verification not yet complete.",
    checks: [
      "Company name and registration number match public records",
      "A working business address and contact",
      "Partner agreement signed",
    ],
  },
  {
    level: "verified" as const,
    label: "Verified partner",
    summary: "Identity and standing checked against public records.",
    checks: [
      "Everything under Listed",
      "GST registration verified against the GSTIN portal",
      "Directors confirmed against MCA filings",
      "At least one named technical contact reachable",
    ],
  },
  {
    level: "certified" as const,
    label: "Certified partner",
    summary: "Work reviewed, not just paperwork.",
    checks: [
      "Everything under Verified",
      "At least one completed engagement reviewed by our team",
      "Named engineers with current certifications on the platforms they list",
      "Re-checked annually — the badge lapses if the review is not repeated",
    ],
  },
] as const;

/** What listing costs, and what it does not. § 10 — no revenue decision exists. */
export const PARTNER_TIERS = [
  {
    name: "Listed",
    price: "Free",
    note: "During launch",
    includes: ["A public profile", "Up to 3 service listings", "Enquiries forwarded to one address"],
  },
  {
    name: "Verified",
    price: "Free",
    note: "During launch",
    includes: [
      "Everything in Listed",
      "The verification badge on every card and profile",
      "Up to 10 service listings",
      "Response-time shown on your profile once measured",
    ],
  },
  {
    name: "Certified",
    price: "Free",
    note: "During launch · annual review",
    includes: [
      "Everything in Verified",
      "Certified badge, and priority ordering among equally-verified partners",
      "Unlimited service listings",
      "A named contact on our side",
    ],
  },
] as const;

/**
 * ⚠️ Every tier reads "Free". That is **§ 10's default, not a decision** — no
 * revenue model exists for this directory yet. When one does, this table and the
 * `partner_tiers` rows must change together, and the promise made here to
 * whoever signed up during launch has to be honoured.
 */
export const PARTNER_FAQ = [
  {
    q: "What does it cost?",
    a: "Nothing during launch. There is no paid placement and no plan that moves you up this directory — passing the checks is the only thing that does, which is the whole point of them.",
  },
  {
    q: "Do you sell my enquiries to competitors?",
    a: "No. An enquiry goes to the single partner it names and to nobody else. We do not resell leads and we do not run a lead bank.",
  },
  {
    q: "How long does verification take?",
    a: "Most of it is document checks against public registries, so days rather than weeks. Certified takes longer because it involves reviewing actual work.",
  },
  {
    q: "Do I have to work exclusively through this platform?",
    a: "No. This directory lists what you are good at so buyers can find you. Everything else you do elsewhere is your business.",
  },
  {
    q: "Who sets the price the buyer sees?",
    a: "You do. You publish your own packaged prices, and we never rank or sort partners by price.",
  },
  {
    q: "Who decides what gets published?",
    a: "We review every listing before it goes live. There is no auto-publish and no bulk approval — somebody reads each one.",
  },
] as const;

/** The application steps, for the supply-side landing. */
export const PARTNER_STEPS = [
  { step: "01", title: "Apply", body: "Tell us who you are and which services you want to carry. One form, no sales call." },
  { step: "02", title: "We check", body: "Registration, GST and directors against public records. Certified adds a review of how you actually run what you sell." },
  { step: "03", title: "You publish", body: "Write your listings and set your own prices in your back office. We review each one before it goes live." },
  { step: "04", title: "Enquiries arrive", body: "Buyers describe what they need and send it straight to you. You see every one in your back office here." },
] as const;

/* ── Audience pages ───────────────────────────────────────────────────────── */

/**
 * One page per audience — the structural idea taken from the reference site's
 * footer (`FRONTEND_PLAN.md` § 15.7), where eight pages describe the same
 * product to eight different readers.
 *
 * **It is the cheapest indexable surface available to us**, because it needs no
 * listings table and no categories: it is the same directory, addressed to
 * somebody specific. `needs` are drawn from the real product catalogue.
 */
export const AUDIENCE_PAGES = {
  startups: {
    label: "Startups",
    headline: "Ship before you can afford an ops team.",
    lede: "You need infrastructure that will not fall over at launch and will not cost a salary to run. These partners set that up and hand you the keys.",
    needs: ["kubernetes", "cloud-migration", "ai-gpu"],
  },
  developers: {
    label: "Developers",
    headline: "APIs, CLIs, and somebody to call at 3am.",
    lede: "Provisioning you can script, and partners who will take the pager when you would rather be shipping.",
    needs: ["devops", "kubernetes", "support"],
  },
  enterprise: {
    label: "Enterprises",
    headline: "Procurement-ready, with the paperwork to prove it.",
    lede: "Compliance evidence, custom SLAs and named accountability — from partners whose credentials we have actually checked.",
    needs: ["security", "networking", "backup"],
  },
  smb: {
    label: "Small business",
    headline: "Hosting, email and backup, handled.",
    lede: "You should not have to become a systems administrator to run a business. These partners do it for you.",
    needs: ["email-collab", "managed-hosting", "backup"],
  },
  agencies: {
    label: "Agencies & resellers",
    headline: "White-label delivery you can put your name on.",
    lede: "Reseller hosting and managed infrastructure your clients never need to know the source of.",
    needs: ["ecommerce", "email-collab", "managed-hosting"],
  },
  "public-sector": {
    label: "Public sector",
    headline: "Data residency, with the audit trail.",
    lede: "Indian datacenters, documented controls, and partners who have been through a procurement process before.",
    needs: ["security", "networking", "managed-hosting"],
  },
} as const;

export type AudienceSlug = keyof typeof AUDIENCE_PAGES;

/**
 * ⚠️ `needs` are **expertise keys**, not display labels — they match against a
 * partner's `expertise`, so the filter is a real join rather than a string
 * comparison against prose.
 */
