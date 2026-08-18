import type { Metadata } from "next";

import FaqList from "@/components/public/FaqList";
import PageHero from "@/components/public/PageHero";
import PublicButton from "@/components/public/PublicButton";
import SectionSlab from "@/components/public/SectionSlab";
import StepList from "@/components/public/StepList";
import TierTable from "@/components/public/TierTable";

import { CONTACT_CHANNELS, PARTNER_FAQ, PARTNER_STEPS } from "@/lib/public/siteContent";

/**
 * `/become-a-partner` — the supply side, and **the most important page on the
 * site right now.**
 *
 * `FRONTEND_PLAN.md` § 14.1: at zero listed partners the demand side has nothing
 * to look at, and the only thing that moves us out of that state is partners
 * signing up. The plan originally had this near the end of the build; the
 * Justdial research moved it to first, on the evidence that the reference keeps
 * *Free Listing* and *Advertise* permanently in its top-level header (§ 12.2).
 *
 * ## The two rules § 20.4 sets for this page, both of which cost us something
 *
 * 1. **Honesty about scale.** No implied traffic, no promised lead volume, no
 *    invented success stories. We have none of those, and a partner who signs up
 *    on a promise we cannot keep is worse than one who never signs up.
 * 2. **Say what it costs.** It says "free during launch" — § 10's default — and
 *    the tier component carries the warning that this is an unmade commercial
 *    decision rather than a settled price.
 *
 * ⚠️ **The application form is not built.** It collects a name and an email,
 * which makes `/privacy` a hard prerequisite, and that page is still in legal
 * review. So this routes to the published sales address instead — which is
 * answered today, unlike a form that posts nowhere.
 */
export const metadata: Metadata = {
  title: "Become a partner",
  description:
    "List your company in a directory of verified infrastructure specialists. Free during launch. No paid placement, no lead resale.",
  alternates: { canonical: "/become-a-partner" },
};

const sales = CONTACT_CHANNELS.find((c) => c.key === "sales")!;

export default function BecomeAPartnerPage() {
  return (
    <>
      <PageHero
        eyebrow="Free during launch"
        title="Get in front of people who are already looking."
        lede="Advertise what you are good at, publish your own prices, and take enquiries directly from buyers who described exactly what they need. Listing is free during launch."
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <PublicButton href="#apply" variant="primary" size="lg">
            Apply to be listed
          </PublicButton>
          <PublicButton href="/verification" variant="secondary" size="lg">
            What verification involves
          </PublicButton>
        </div>
      </PageHero>

      {/* The honesty block. § 20.4 requires it, and it is the most persuasive
          thing on the page precisely because nobody else writes one. */}
      <SectionSlab className="pt-14 sm:pt-20">
        <div className="pub-border-thick max-w-3xl rounded-[1.5rem] p-6 sm:rounded-[2rem] sm:p-10">
          <h2 className="pub-display text-3xl leading-[1.02] tracking-[-0.03em] sm:text-4xl">
            What we are not going to tell you.
          </h2>
          <ul className="pub-muted mt-6 flex flex-col gap-4 text-[0.9375rem] leading-relaxed">
            <li>
              <strong className="pub-ink">How much traffic to expect.</strong> This directory is new.
              We do not have a number worth quoting, and any number we invented would be the reason
              you stopped trusting the rest of the page.
            </li>
            <li>
              <strong className="pub-ink">How many enquiries you will get.</strong> Same reason. What
              we can promise is where they go: to you, and to nobody else.
            </li>
            <li>
              <strong className="pub-ink">That everyone gets in.</strong> They do not. Listings are
              reviewed by a person before they publish, and a badge that everyone has is worth
              nothing to the people who earned it.
            </li>
          </ul>
        </div>
      </SectionSlab>

      <SectionSlab
        ground="ink"
        className="pt-14 sm:pt-20"
        innerClassName="px-6 py-12 sm:px-10 sm:py-16 lg:px-16"
      >
        <h2 className="pub-display max-w-3xl text-4xl leading-[0.98] tracking-[-0.03em] sm:text-5xl">
          Four steps, and we do most of them.
        </h2>
        <StepList steps={PARTNER_STEPS} ground="dark" className="mt-12" />
      </SectionSlab>

      <SectionSlab className="pt-14 sm:pt-20">
        <div className="max-w-3xl">
          <h2 className="pub-display text-4xl leading-[0.98] tracking-[-0.03em] sm:text-5xl">
            Three tiers. None of them purchasable.
          </h2>
          <p className="pub-muted mt-4 text-base leading-relaxed">
            Tiers govern how you appear in this directory. You move up by passing checks, not by
            paying — there is no sponsored slot on this site and there is not going to be one.
          </p>
        </div>
        <div className="mt-10">
          <TierTable />
        </div>
      </SectionSlab>

      <SectionSlab className="pt-14 sm:pt-20">
        <h2 className="pub-display max-w-3xl text-4xl leading-[0.98] tracking-[-0.03em] sm:text-5xl">
          The questions partners actually ask.
        </h2>
        <div className="mt-10">
          <FaqList items={PARTNER_FAQ} />
        </div>
      </SectionSlab>

      <SectionSlab
        id="apply"
        ground="deep"
        className="pt-14 sm:pt-20"
        innerClassName="px-6 py-12 text-center sm:px-10 sm:py-16 lg:px-16"
      >
        <h2 className="pub-display mx-auto max-w-3xl text-4xl leading-[0.98] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
          Apply.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[color:var(--public-cream-70)]">
          Tell us who you are and what you are good at. A person reads every one of these, and you
          will hear back {sales.response.toLowerCase()}.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {/* 🔴 Routes through /contact rather than a mailto.
              The sales address carries the operating company's domain, and this
              page is public — anyone browsing it would have the operator's
              identity, and from there the supply relationship, in one step.
              /contact names the operator because a contact page has to; that is
              a deliberate boundary, not an inconsistency. */}
          <PublicButton href="/contact" variant="primary" size="lg">
            Send us your details
          </PublicButton>
        </div>
        <p className="mx-auto mt-6 max-w-xl text-xs leading-relaxed text-[color:var(--public-cream-70)]">
          An application form is coming. It collects your details, so it ships once the privacy
          policy has been through review — not before.
        </p>
      </SectionSlab>
    </>
  );
}
