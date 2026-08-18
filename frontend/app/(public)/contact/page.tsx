import type { Metadata } from "next";
import { Mail, Phone } from "lucide-react";

import PageHero from "@/components/public/PageHero";
import SectionSlab from "@/components/public/SectionSlab";
import { COMPANY } from "@/lib/public/homeContent";
import { CONTACT_CHANNELS, OFFICES, PHONE } from "@/lib/public/siteContent";

/**
 * `/contact` — real addresses and a route to a human.
 *
 * § 20.4 asks for the real Pune, Mumbai and Nashik addresses, support-versus-
 * sales routing, and explicitly forbids two things: a map embed that loads a
 * third-party script on first paint (it would blow the JS budget and set a
 * cookie before consent), and a phone number nobody answers.
 *
 * ## Role addresses, not people
 *
 * Every address below is a role, because that is what all three live sites
 * publish — not one of them names an individual. A role survives the person
 * leaving, and it keeps a public repository free of personal data (operating
 * contract rule 7).
 *
 * ⚠️ **These reach the platform team, not a directory team.** Somebody emailing
 * `support@` about a partner listing currently lands with hosting support.
 * Decide before launch whether the directory needs its own aliases.
 *
 * ## No contact form yet
 *
 * Deliberate. A form that collects a name and an email requires the privacy
 * page to be real, and it is still in review — so this page routes to email and
 * phone, both of which are already published and already answered.
 */
export const metadata: Metadata = {
  title: "Contact",
  description: `Reach ${COMPANY.legalName} — offices in Pune, Mumbai and Nashik, and support 24×7×365.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Support 24×7×365"
        title="Talk to somebody who answers."
        lede="Pick the right address and it reaches the team that can actually resolve it. Every one of these is answered by a person."
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href={PHONE.href}
            className="pub-focus pub-lilac-bg pub-ink inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-[color:var(--public-ink)] px-6 py-4 text-base font-semibold no-underline transition-transform duration-200 hover:scale-[.98]"
          >
            <Phone aria-hidden className="h-4 w-4" />
            {PHONE.display}
          </a>
          <p className="pub-muted text-sm">Answered around the clock, every day of the year.</p>
        </div>
      </PageHero>

      <SectionSlab className="pt-14 sm:pt-20">
        <h2 className="pub-display max-w-2xl text-3xl leading-[1.02] tracking-[-0.03em] sm:text-5xl">
          Who to write to.
        </h2>
        <ul className="mt-8 grid gap-4 sm:gap-5 lg:grid-cols-2">
          {CONTACT_CHANNELS.map((c) => (
            <li key={c.key}>
              <div className="pub-border-thick flex h-full flex-col rounded-[1.25rem] p-6 sm:rounded-[1.5rem]">
                <h3 className="pub-display text-2xl leading-tight tracking-[-0.02em]">{c.label}</h3>
                <p className="pub-muted mt-2 text-sm leading-relaxed">{c.body}</p>
                <a
                  href={`mailto:${c.email}`}
                  className="pub-focus pub-deep mt-5 inline-flex min-w-0 items-center gap-2 text-[0.9375rem] font-semibold no-underline hover:underline"
                >
                  <Mail aria-hidden className="h-4 w-4 shrink-0" />
                  <span className="truncate">{c.email}</span>
                </a>
                <p className="pub-muted mt-auto pt-4 text-xs">{c.response}</p>
              </div>
            </li>
          ))}
        </ul>
      </SectionSlab>

      <SectionSlab
        ground="ink"
        className="pt-14 sm:pt-20"
        innerClassName="px-6 py-10 sm:px-10 sm:py-14 lg:px-16"
      >
        <h2 className="pub-display max-w-2xl text-3xl leading-[1.02] tracking-[-0.03em] sm:text-5xl">
          Where we are.
        </h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-6">
          {OFFICES.map((o) => (
            <address key={o.city} className="not-italic">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--public-amber)]">
                {o.role}
              </p>
              <h3 className="pub-display mt-2 text-3xl leading-none tracking-[-0.02em]">{o.city}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--public-cream-70)]">
                {o.lines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </p>
            </address>
          ))}
        </div>
        <p className="mt-10 border-t-2 border-[color:var(--public-cream-15)] pt-6 text-xs text-[color:var(--public-cream-70)]">
          {COMPANY.legalName} · CIN {COMPANY.cin}
        </p>
      </SectionSlab>
    </>
  );
}
