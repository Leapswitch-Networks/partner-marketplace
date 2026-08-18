import type { Metadata } from "next";
import { ArrowRight, Ban, Send, ShieldCheck, TriangleAlert } from "lucide-react";

import CardRail from "@/components/public/CardRail";
import HeadingReveal from "@/components/public/HeadingReveal";
import PublicButton from "@/components/public/PublicButton";
import PartnerCard from "@/components/public/PartnerCard";
import SearchBar from "@/components/public/SearchBar";
import Reveal from "@/components/public/Reveal";
import SectionSlab from "@/components/public/SectionSlab";
import { fetchCategories, fetchPartners } from "@/lib/api/public";
import { AUDIENCES, HOW_IT_WORKS } from "@/lib/public/homeContent";
import { APP_NAME } from "@/lib/utils/constants";

/**
 * `/` — the public home page.
 *
 * A **server component**: no `"use client"` here, per § 20.2 rule 1. The three
 * interactive leaves — the search box and the header's menu — are the only
 * client code on the route, which is what keeps it inside the 150 kB first-load
 * budget.
 *
 * ## Section order, and why it is not § 20.4's
 *
 * § 20.4 asks for eight blocks in a fixed order. Seven are here. **The category
 * grid is omitted entirely**, and that is § 14.2's instruction rather than a
 * shortcut: the grid is *omitted, not shrunk*, until a category clears the
 * threshold of three listed partners — and today `service_categories` is not
 * even a table. An eight-tile grid over an empty taxonomy is the first failure
 * § 20.7 lists.
 *
 * In its place is **"Built for"**, the by-audience idea taken from the
 * reference's footer (§ 15.7). It needs no listings table to exist, which makes
 * it the cheapest real content available at Band 0.
 *
 * ## What is deliberately not on this page
 *
 * No animated counters · no stock-photo carousel · no testimonials we do not
 * have · no "trusted by" logos · no star ratings · no partner count · no
 * "responds in 2 hours". Each is either forbidden by § 20.4's *Must NOT have*
 * lines or by `ANTI_SLOP.md` § 1, and several are forbidden by both.
 *
 * 🔴 **No number belonging to the operating company is rendered either** —
 * datacenter counts, certifications and customer totals all came out on
 * 2026-08-18. On a page about partners they imply we supply the partners, which
 * is the inference the confidentiality rule in `homeContent.ts` forbids.
 */
export const metadata: Metadata = {
  title: `${APP_NAME} — verified companies for cloud, hosting and infrastructure work`,
  description:
    "Compare independent companies checked before listing, then send one enquiry to the one you picked.",
  alternates: { canonical: "/" },
};

export default async function PublicHomePage() {
  // Server-side, in parallel. A failure here is deliberately NOT caught: the
  // route's `error.tsx` renders it. Falling back to placeholder content would
  // be how a page ships looking healthy while reading nothing — punchlist 6.2.
  const [partnerPage, categories] = await Promise.all([
    fetchPartners({ per_page: 6 }),
    fetchCategories(),
  ]);
  const partners = partnerPage.items;

  return (
    <>
      {/* ⚠️ Standing notice while the page runs on placeholder content. Not a
          design element — a guard, so nobody in a review mistakes invented
          partners for live inventory. It disappears with one boolean. */}
      {/* The directory is empty until partners are verified and listed. § 1:
          **empty is the launch condition, not the edge case** — so it is a
          designed line rather than a blank grid. */}
      {partners.length === 0 && (
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <p
            role="status"
            className="pub-bg-alt pub-ink mx-auto flex w-full max-w-[1400px] items-start gap-2.5 rounded-2xl border-2 border-[color:var(--public-ink-30)] px-4 py-3 text-sm font-medium"
          >
            <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>The directory is just opening.</strong> No partners have completed
              verification yet. If you do this work, this is a good moment to be the first.
            </span>
          </p>
        </div>
      )}

      {/* ── 1 · Hero ───────────────────────────────────────────────────────
          The search box is above the fold and is the primary action — it does
          not sit below a hero image. That is the one thing worth copying from
          Justdial at any size (§ 14.3), and § 20.4's done-when for this page is
          that a stranger can run a search without scrolling to find the box. */}
      <SectionSlab className="pt-10 sm:pt-16 lg:pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="pub-deep text-xs font-semibold uppercase tracking-[0.16em] sm:text-sm">
            Checked before listed · enquiries go to one company only
          </p>

          {/* The one <h1>. It names the proposition in a sentence a stranger
              understands, rather than a slogan — § 20.4. */}
          <h1 className="pub-display mt-5 text-[2.75rem] leading-[0.95] tracking-[-0.035em] sm:text-6xl lg:text-[5.5rem] lg:leading-[0.88]">
            {/* Split where the sentence breaks, not where the line wraps — the
                author decides the break, because measuring the visual wrap needs
                JavaScript and changes at every breakpoint. See HeadingReveal. */}
            <HeadingReveal text={["Find the right company.", "Send one enquiry."]} />
          </h1>

          <p className="pub-muted mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
            Every company listed here has been checked before it appeared. Compare what they do,
            what they charge and how they support it — then send one enquiry, to the one you picked.
          </p>

          <div className="mx-auto mt-9 max-w-2xl">
            <SearchBar />
          </div>

          {/* The vocabulary is the real product catalogue across the three
              areas partners advertise, not invented category names. Six of ten
              — the rest live on
              /partners, and a wall of chips under a search box is a taxonomy
              dump, which is § 12.2's criticism of the reference we rejected. */}
          <ul className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
            {categories.slice(0, 6).map((term) => (
              <li key={term.slug}>
                <a
                  href={`/partners?expertise=${encodeURIComponent(term.slug)}`}
                  className="pub-focus pub-muted pub-border-soft inline-block rounded-full px-3 py-1.5 text-xs font-medium no-underline transition-transform duration-200 hover:scale-[.98]"
                >
                  {term.name}
                </a>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PublicButton href="/partners" variant="secondary" size="md">
              Browse every partner
            </PublicButton>
            <PublicButton href="/become-a-partner" variant="text" size="md">
              Are you a partner? List your company
              <ArrowRight aria-hidden className="h-4 w-4" />
            </PublicButton>
          </div>
        </div>
      </SectionSlab>

      {/* ── 2 · Trust bar ──────────────────────────────────────────────────
          🔴 **This block used to carry the operating company's own credentials —
          datacenter count, ISO certifications, customer numbers.** It was removed
          on 2026-08-18: presenting those as *ours* on a page about partners
          implies we supply them, which is exactly the inference the
          confidentiality rule in `homeContent.ts` forbids.

          What replaces it is a promise about how the platform behaves, which is
          the honest trust argument for a directory this size anyway (§ 13.3):
          we cannot claim scale, so we claim conduct — and every line below is
          something a visitor can hold us to. */}
      <SectionSlab ground="deep" className="pt-14 sm:pt-20" innerClassName="px-6 py-10 sm:px-10 sm:py-14 lg:px-16">
        <h2 className="sr-only">How this directory works</h2>
        <Reveal>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
          {[
            {
              icon: ShieldCheck,
              stat: "Checked, then listed",
              body: "Nobody appears here automatically. Every company is verified against public records first, and the criteria are published.",
            },
            {
              icon: Send,
              stat: "One enquiry, one company",
              body: "Your enquiry goes to the company you named and to nobody else. We do not resell it, and we do not pass it to their competitors.",
            },
            {
              icon: Ban,
              stat: "Position is not for sale",
              body: "There is no sponsored slot and no paid ranking. Nothing a company pays changes where it appears on this page.",
            },
          ].map(({ icon: Icon, stat, body }) => (
            <div key={stat} className="flex flex-col items-start">
              <Icon aria-hidden className="h-7 w-7 text-[color:var(--public-amber)]" />
              <p className="pub-display mt-4 text-3xl leading-[1.05] tracking-[-0.02em] sm:text-4xl">
                {stat}
              </p>
              <p className="mt-2.5 text-sm leading-relaxed text-[color:var(--public-cream-70)]">
                {body}
              </p>
            </div>
          ))}
        </div>
        </Reveal>
      </SectionSlab>

      {/* ── 3 · The partners ───────────────────────────────────────────────
          Six cards. No count, no facets, no pagination — all Band 2 features
          (§ 13.3), and a verified count of six is worse than no count at all. */}
      <SectionSlab className="pt-16 sm:pt-24">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="pub-display text-4xl leading-[0.98] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Companies we checked before listing them.
            </h2>
            <p className="pub-muted mt-4 text-base leading-relaxed">
              Every badge below says exactly what was checked to earn it. Hover one to see the criteria.
            </p>
          </div>
          <PublicButton href="/partners" variant="outline" size="md" className="shrink-0">
            See all partners
            <ArrowRight aria-hidden className="h-4 w-4" />
          </PublicButton>
        </div>

        {/* A rail rather than a grid, on this page only.
            The home page is a preview — six cards in a grid at desktop widths
            reads as "that is all of them", which is the impression a directory
            at our size can least afford. A rail reads as a sample and invites
            the scroll. `/partners` keeps the grid, because there the point IS
            that you are seeing everything. */}
        <div className="mt-10">
          <CardRail label="Featured partners">
            {partners.map((partner) => (
              <li key={partner.slug} className="w-[280px] sm:w-[330px]">
                <PartnerCard partner={partner} />
              </li>
            ))}
          </CardRail>
        </div>
      </SectionSlab>

      {/* ── 4 · How it works ───────────────────────────────────────────────── */}
      <SectionSlab ground="ink" className="pt-16 sm:pt-24" innerClassName="px-6 py-12 sm:px-10 sm:py-16 lg:px-16">
        <h2 className="pub-display max-w-3xl text-4xl leading-[0.98] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
          Three steps, and no sales call in any of them.
        </h2>
        <Reveal>
        <ol className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
          {HOW_IT_WORKS.map(({ step, title, body }) => (
            <li key={step} className="border-t-2 border-[color:var(--public-cream-30)] pt-6">
              <span className="pub-display block text-5xl leading-none tracking-[-0.03em] text-[color:var(--public-amber)]">
                {step}
              </span>
              <h3 className="mt-4 text-xl font-semibold leading-snug">{title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-[color:var(--public-cream-70)]">
                {body}
              </p>
            </li>
          ))}
        </ol>
        </Reveal>
      </SectionSlab>

      {/* ── 5 · Built for ──────────────────────────────────────────────────
          Replaces § 20.4's category grid — see the note at the top of this file. */}
      <SectionSlab className="pt-16 sm:pt-24">
        <h2 className="pub-display max-w-3xl text-4xl leading-[0.98] tracking-[-0.03em] sm:text-5xl">
          Built for whoever is asking.
        </h2>
        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AUDIENCES.map((a) => (
            <li key={a.slug}>
              <div className="pub-bg-alt flex h-full flex-col rounded-[1.25rem] p-6 sm:rounded-[1.5rem]">
                <h3 className="pub-display text-2xl leading-tight tracking-[-0.02em]">{a.label}</h3>
                <p className="pub-muted mt-2 text-sm leading-relaxed">{a.blurb}</p>
              </div>
            </li>
          ))}
        </ul>
      </SectionSlab>

      {/* ── 6 · Supply-side CTA ────────────────────────────────────────────
          § 14.1: at zero partners the only thing that moves the number is
          partners signing up, which is why `/become-a-partner` is the first page
          being built and why it gets a full-width block here rather than a link
          in the footer. */}
      <SectionSlab ground="deep" className="pt-16 sm:pt-24" innerClassName="px-6 py-12 text-center sm:px-10 sm:py-16 lg:px-16">
        <h2 className="pub-display mx-auto max-w-3xl text-4xl leading-[0.98] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
          Do this work? Get listed.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[color:var(--public-cream-70)]">
          Advertise what you are good at, set your own prices, and take enquiries straight from
          the people who need it. We do not resell leads, and placement here is not for sale.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <PublicButton href="/become-a-partner" variant="primary" size="lg">
            Apply to be listed
          </PublicButton>
          <PublicButton href="/verification" variant="onDeep" size="lg">
            What verification involves
          </PublicButton>
        </div>
      </SectionSlab>
    </>
  );
}
