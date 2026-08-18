import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2, ExternalLink, MapPin, Users } from "lucide-react";

import Breadcrumb from "@/components/public/Breadcrumb";
import EnquiryForm from "@/components/public/EnquiryForm";
import PublicButton from "@/components/public/PublicButton";
import SectionSlab from "@/components/public/SectionSlab";
import VerificationBadge from "@/components/public/VerificationBadge";
import { fetchAllPartnerSlugs, fetchPartner } from "@/lib/api/public";
import { VERIFICATION_LEVELS } from "@/lib/public/siteContent";

/**
 * `/partners/[slug]` — the credential page, reading the live API.
 *
 * § 20.4: decision-critical information belongs **on** this page, not behind a
 * click. At the size this directory launches at it carries more weight than
 * anywhere else — with a handful of partners the *list* cannot carry the
 * directory, so the depth lives here (§ 12.6).
 *
 * ## Three things it cannot render, by construction
 *
 * `notes`, `gst_number`, `pan_number` and `status` are not hidden here — the API
 * response model has no such fields, so there is nothing to leak. A suspended or
 * unlisted partner does not 403; it 404s, because confirming a hidden company
 * exists is itself a disclosure about them.
 *
 * No rating, review count, or "typically responds in X": none of that data
 * exists, and § 20.4 says omit the block rather than render a zero.
 *
 * ## The canonical is a commitment, not an SEO tactic
 *
 * § 9.1 commitment 2: **we do not compete with a partner for their own name.**
 * Where they have a website, `generateMetadata` canonicalises to it — outranking
 * a company for its own name, using a page we wrote about them, is a commercial
 * injury to somebody who trusted us with their details.
 */

/**
 * Only listed partners get a page; anything else is a hard 404 from the router
 * rather than a page that renders a 404 and answers 200. A soft 404 is worse
 * than either — a crawler indexes it as real and no monitor flags it.
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await fetchAllPartnerSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const partner = await fetchPartner(params.slug).catch(() => null);
  if (!partner) return { title: "Partner not found" };
  return {
    title: partner.tagline ? `${partner.name} — ${partner.tagline}` : partner.name,
    description: partner.tagline ?? undefined,
    alternates: partner.website ? { canonical: partner.website } : undefined,
  };
}

function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function PartnerProfilePage({ params }: { params: { slug: string } }) {
  const partner = await fetchPartner(params.slug).catch(() => null);
  if (!partner) notFound();

  const level =
    VERIFICATION_LEVELS.find((v) => v.level.toUpperCase() === partner.verification_level) ??
    VERIFICATION_LEVELS[0];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: partner.name,
    description: partner.tagline ?? undefined,
    foundingDate: partner.founded_year ? String(partner.founded_year) : undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: partner.city ?? undefined,
      addressRegion: partner.state ?? undefined,
      addressCountry: partner.country ?? "IN",
    },
    url: partner.website ?? undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <SectionSlab className="pt-8 sm:pt-10">
        <Breadcrumb
          items={[
            { href: "/", label: "Home" },
            { href: "/partners", label: "Partners" },
            { label: partner.name },
          ]}
        />
      </SectionSlab>

      <SectionSlab className="pt-8 sm:pt-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          <span
            aria-hidden
            className="pub-deep-bg pub-cream flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-2xl font-semibold sm:h-28 sm:w-28 sm:text-4xl"
          >
            {monogram(partner.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <VerificationBadge level={partner.verification_level} />
              <span className="pub-muted text-sm">Checked before listing</span>
            </div>
            <h1 className="pub-display mt-4 text-[2.5rem] leading-[0.95] tracking-[-0.035em] sm:text-6xl">
              {partner.name}
            </h1>
            {partner.tagline && (
              <p className="pub-muted mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">
                {partner.tagline}
              </p>
            )}
            <dl className="pub-muted mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {(partner.city || partner.service_areas) && (
                <div className="flex items-center gap-1.5">
                  <MapPin aria-hidden className="h-4 w-4 shrink-0" />
                  <dt className="sr-only">Where they work</dt>
                  <dd>{partner.service_areas || partner.city}</dd>
                </div>
              )}
              {partner.founded_year && (
                <div className="flex items-center gap-1.5">
                  <Building2 aria-hidden className="h-4 w-4 shrink-0" />
                  <dt className="sr-only">Founded</dt>
                  <dd>Since {partner.founded_year}</dd>
                </div>
              )}
              {partner.employee_range && (
                <div className="flex items-center gap-1.5">
                  <Users aria-hidden className="h-4 w-4 shrink-0" />
                  <dt className="sr-only">Team size</dt>
                  <dd>{partner.employee_range}</dd>
                </div>
              )}
            </dl>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PublicButton href="#enquire" variant="primary" size="lg">
                Send enquiry
              </PublicButton>
              {partner.website && (
                // nofollow: § 9.1 — we link out without passing rank we did not earn.
                <a
                  href={partner.website}
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                  className="pub-focus pub-bg pub-ink inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-[color:var(--public-ink)] px-6 py-4 text-base font-semibold no-underline transition-transform duration-200 hover:scale-[.98]"
                >
                  Their website
                  <ExternalLink aria-hidden className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </SectionSlab>

      <SectionSlab className="pt-14 sm:pt-20">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
          <div className="min-w-0">
            {partner.about && (
              <>
                <h2 className="pub-display text-3xl leading-[1.02] tracking-[-0.03em] sm:text-4xl">
                  About {partner.name}
                </h2>
                <p className="pub-muted mt-4 whitespace-pre-wrap text-base leading-relaxed">
                  {partner.about}
                </p>
              </>
            )}

            {partner.expertise.length > 0 && (
              <>
                <h2 className="pub-display mt-12 text-3xl leading-[1.02] tracking-[-0.03em] sm:text-4xl">
                  What they do
                </h2>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {partner.expertise.map((area) => (
                    <li
                      key={area.slug}
                      className="pub-bg-alt pub-ink rounded-full px-3.5 py-2 text-sm font-medium"
                    >
                      {area.name}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h2 className="pub-display mt-12 text-3xl leading-[1.02] tracking-[-0.03em] sm:text-4xl">
              Services
            </h2>
            {partner.listings.length === 0 ? (
              // § 20.4: a partner with no published listings still gets a full
              // profile. They are listed because staff published them, and a
              // broken-looking page reflects on us, not on them.
              <p className="pub-muted mt-4 text-base">
                Listings coming soon. You can still send them an enquiry.
              </p>
            ) : (
              <ul className="mt-6 flex flex-col gap-4">
                {partner.listings.map((listing) => (
                  <li key={listing.slug} className="pub-border-thick rounded-[1.25rem] p-5 sm:p-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="pub-display text-2xl leading-tight tracking-[-0.02em]">
                        {listing.title}
                      </h3>
                      <p className="pub-deep text-lg font-semibold">
                        {listing.pricing_model === "ON_REQUEST"
                          ? "Price on request"
                          : `${listing.pricing_model === "FROM" ? "From " : ""}${listing.currency} ${listing.price}`}
                      </p>
                    </div>
                    <p className="pub-muted mt-2 text-sm leading-relaxed">{listing.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className="min-w-0">
            <div className="pub-deep-bg pub-cream rounded-[1.5rem] p-6 sm:rounded-[2rem] sm:p-8">
              <h2 className="pub-display text-2xl leading-tight tracking-[-0.02em]">
                What we checked
              </h2>
              <p className="mt-2 text-sm text-[color:var(--public-cream-70)]">{level.summary}</p>
              <ul className="mt-6 flex flex-col gap-3">
                {level.checks.map((check) => (
                  <li key={check} className="flex items-start gap-2.5 text-sm leading-relaxed">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--public-amber)]"
                    />
                    <span>{check}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t-2 border-[color:var(--public-cream-15)] pt-4 text-xs leading-relaxed text-[color:var(--public-cream-70)]">
                Verification covers who a company is, not a guarantee of their work. Judge that
                yourself — it is what the enquiry is for.
              </p>
            </div>
          </aside>
        </div>
      </SectionSlab>

      <SectionSlab id="enquire" className="pt-14 sm:pt-20">
        <div className="max-w-3xl">
          <EnquiryForm partnerName={partner.name} partnerSlug={partner.slug} />
        </div>
      </SectionSlab>
    </>
  );
}
