import type { Metadata } from "next";
import { Check, X } from "lucide-react";

import Breadcrumb from "@/components/public/Breadcrumb";
import PageHero from "@/components/public/PageHero";
import PublicButton from "@/components/public/PublicButton";
import SectionSlab from "@/components/public/SectionSlab";
import VerificationBadge from "@/components/public/VerificationBadge";

import { VERIFICATION_LEVELS } from "@/lib/public/siteContent";

/**
 * `/verification` — what verification means, in full.
 *
 * ## Why this page exists at all
 *
 * It is the page the whole directory rests on. § 9 makes trust the
 * differentiator rather than selection — we will never have the most partners,
 * so the argument has to be that ours have been checked. **An unpublished
 * standard is not a standard**, and § 12.4 records the one thing worth taking
 * from Justdial's monetisation page: it states exactly what earns its badge.
 * Ours has to as well, or the badge is decoration.
 *
 * ## The "what it is not" block is the most important on the page
 *
 * A verification claim that does not say what it excludes is a claim that will
 * eventually be read as a guarantee — and the first time a partner disappoints
 * somebody, that reading becomes our problem. Saying plainly that we check who a
 * company is and not how good its work is costs a little persuasiveness now and
 * saves the credibility of every badge later.
 *
 * ⚠️ The criteria are **proposed, not agreed** — § 12 of the directory plan
 * still lists "who moderates, against what standard" as an open decision. They
 * are written as concrete checkable claims so they can be argued with.
 */
export const metadata: Metadata = {
  title: "What verification means",
  description:
    "Exactly what is checked before a company is listed, what each badge covers, and what verification deliberately does not promise.",
  alternates: { canonical: "/verification" },
};

export default function VerificationPage() {
  return (
    <>
      <SectionSlab className="pt-8 sm:pt-10">
        <Breadcrumb items={[{ href: "/", label: "Home" }, { label: "What verification means" }]} />
      </SectionSlab>

      <PageHero
        eyebrow="The standard, published"
        title="A badge nobody explains is decoration."
        lede="Anyone can put a tick on a website. Here is exactly what we check before a company is listed, what each badge covers, and — just as important — what none of them promise."
      />

      <SectionSlab className="pt-12 sm:pt-16">
        <ul className="flex flex-col gap-5">
          {VERIFICATION_LEVELS.map((v) => (
            <li key={v.level}>
              <div className="pub-border-thick rounded-[1.5rem] p-6 sm:rounded-[2rem] sm:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <VerificationBadge level={v.level} />
                  <h2 className="pub-display text-2xl leading-tight tracking-[-0.02em] sm:text-3xl">
                    {v.label}
                  </h2>
                </div>
                <p className="pub-muted mt-3 text-base leading-relaxed">{v.summary}</p>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {v.checks.map((c) => (
                    <li key={c} className="flex items-start gap-2.5 text-sm leading-relaxed">
                      <Check aria-hidden className="pub-deep mt-0.5 h-4 w-4 shrink-0" />
                      <span className="pub-muted">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </SectionSlab>

      <SectionSlab
        ground="ink"
        className="pt-14 sm:pt-20"
        innerClassName="px-6 py-12 sm:px-10 sm:py-16 lg:px-16"
      >
        <h2 className="pub-display max-w-3xl text-4xl leading-[0.98] tracking-[-0.03em] sm:text-5xl">
          What verification is not.
        </h2>
        <ul className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            {
              t: "Not a guarantee of their work",
              b: "We check who a company is, not how good it is. Judge the work yourself — that is what the enquiry is for.",
            },
            {
              t: "Not for sale",
              b: "No plan moves you up this directory. There is no sponsored slot and there is not going to be one.",
            },
            {
              t: "Not permanent",
              b: "Certified is re-checked every year and lapses if the review is not repeated. A badge that never expires stops meaning anything.",
            },
          ].map(({ t, b }) => (
            <li key={t} className="border-t-2 border-[color:var(--public-cream-30)] pt-6">
              <X aria-hidden className="h-6 w-6 text-[color:var(--public-amber)]" />
              <h3 className="mt-4 text-xl font-semibold leading-snug">{t}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-[color:var(--public-cream-70)]">{b}</p>
            </li>
          ))}
        </ul>
      </SectionSlab>

      <SectionSlab className="pt-14 sm:pt-20">
        <div className="max-w-3xl">
          <h2 className="pub-display text-4xl leading-[0.98] tracking-[-0.03em] sm:text-5xl">
            Why a small directory is the point.
          </h2>
          <p className="pub-muted mt-4 text-base leading-relaxed">
            There are directories with hundreds of thousands of listings, and none of them checked
            any of them. We would rather list fewer companies and be able to say what we know about
            each one. If that means the list is short for a while, the list is short for a while.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PublicButton href="/partners" variant="primary" size="md">
              See the partners
            </PublicButton>
            <PublicButton href="/about" variant="secondary" size="md">
              About us
            </PublicButton>
          </div>
        </div>
      </SectionSlab>
    </>
  );
}
