import type { Metadata } from "next";

import PageHero from "@/components/public/PageHero";
import PublicButton from "@/components/public/PublicButton";
import SectionSlab from "@/components/public/SectionSlab";
import StepList from "@/components/public/StepList";
import { HOW_IT_WORKS } from "@/lib/public/homeContent";
import { ABOUT_STORY, OFFICES } from "@/lib/public/siteContent";

/**
 * `/about` — who runs this.
 *
 * § 20.4: *"a directory with no 'who runs this' reads as a scrape."*
 *
 * ## 🔴 Rewritten 2026-08-18 — what came out and why
 *
 * This page used to be about the operating company's infrastructure business:
 * datacenter counts, ISO certifications, uptime, three brand cards. **All of it
 * came out.** Presenting those on a directory of partners implies we supply the
 * partners, which is precisely the inference the confidentiality rule in
 * `lib/public/homeContent.ts` exists to prevent.
 *
 * What is left is about **the marketplace**: why it exists, how a listing gets
 * here, and where to find us. The operating entity is named on `/terms`,
 * `/privacy` and `/contact`, which is where a legal document has to name it —
 * and that discloses who runs the site, not where partners buy anything.
 *
 * ⚠️ Do not reintroduce a credentials block here. If this page ever needs to
 * argue that we are competent to verify, the argument is the published criteria
 * on `/verification`, not a certificate belonging to a different business.
 */
export const metadata: Metadata = {
  title: "About",
  description:
    "Why this directory exists, how a company gets listed on it, and how to reach the people who run it.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="A short list you can trust beats a long one you cannot."
        lede="Most directories will list anyone who fills in a form. This one checks a company before it appears, publishes exactly what was checked, and sends your enquiry to one company only."
      />

      <SectionSlab className="pt-14 sm:pt-20">
        <div className="grid gap-8 md:grid-cols-3">
          {ABOUT_STORY.map((item) => (
            <div key={item.title} className="border-t-2 border-[color:var(--public-ink)] pt-6">
              <h2 className="pub-display text-2xl leading-tight tracking-[-0.02em] sm:text-3xl">
                {item.title}
              </h2>
              <p className="pub-muted mt-3 text-[0.9375rem] leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </SectionSlab>

      <SectionSlab
        ground="ink"
        className="pt-14 sm:pt-20"
        innerClassName="px-6 py-12 sm:px-10 sm:py-16 lg:px-16"
      >
        <h2 className="pub-display max-w-3xl text-4xl leading-[0.98] tracking-[-0.03em] sm:text-5xl">
          How it works, from your side.
        </h2>
        <StepList steps={HOW_IT_WORKS} ground="dark" className="mt-12" />
      </SectionSlab>

      <SectionSlab className="pt-14 sm:pt-20">
        <h2 className="pub-display max-w-2xl text-3xl leading-[1.02] tracking-[-0.03em] sm:text-5xl">
          Where to find us.
        </h2>
        <div className="mt-8 grid gap-4 sm:gap-5 lg:grid-cols-3">
          {OFFICES.map((o) => (
            <address
              key={o.city}
              className="pub-border-thick rounded-[1.25rem] p-6 not-italic sm:rounded-[1.5rem]"
            >
              <p className="pub-deep text-xs font-semibold uppercase tracking-[0.12em]">{o.role}</p>
              <h3 className="pub-display mt-2 text-2xl leading-tight tracking-[-0.02em]">{o.city}</h3>
              <p className="pub-muted mt-3 text-sm leading-relaxed">
                {o.lines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </p>
            </address>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <PublicButton href="/contact" variant="primary" size="md">
            Get in touch
          </PublicButton>
          <PublicButton href="/verification" variant="secondary" size="md">
            What we check
          </PublicButton>
        </div>
      </SectionSlab>
    </>
  );
}
