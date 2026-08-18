import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/public/Breadcrumb";
import PageHero from "@/components/public/PageHero";
import PartnerCard from "@/components/public/PartnerCard";
import PublicButton from "@/components/public/PublicButton";
import SectionSlab from "@/components/public/SectionSlab";
import { fetchCategories, fetchPartners } from "@/lib/api/public";
import { AUDIENCE_PAGES, type AudienceSlug } from "@/lib/public/siteContent";

/**
 * `/for/[audience]` — the same directory, addressed to somebody specific.
 *
 * Taken from the reference site's footer, where eight pages describe one product
 * to eight different readers (`FRONTEND_PLAN.md` § 15.7). **It is the cheapest
 * indexable surface we have**: six real pages that need no `service_categories`
 * table, no `service_listings`, and no threshold — which is exactly why it stands
 * in for the category pages § 14.1 defers.
 *
 * ## The filter is real, and that is the difference from a doorway page
 *
 * Each audience declares the services its readers actually need, and the page
 * shows the partners offering them. A page that changed only its headline would
 * be six copies of `/partners` with different `<h1>`s — which search engines
 * correctly treat as spam and visitors correctly treat as noise.
 *
 * ⚠️ If a filter ever matches nothing, the page shows every partner rather than
 * an empty grid, and says so. At six partners that is honest; past Band 2 it
 * should become a real empty state instead.
 */
/** Six audiences, and no others. See the note in `partners/[slug]` — this is
 *  what turns an unknown slug into a real 404 instead of a soft one. */
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(AUDIENCE_PAGES).map((audience) => ({ audience }));
}

export function generateMetadata({ params }: { params: { audience: string } }): Metadata {
  const a = AUDIENCE_PAGES[params.audience as AudienceSlug];
  if (!a) return { title: "Not found" };
  return {
    title: `For ${a.label.toLowerCase()}`,
    description: a.lede,
    alternates: { canonical: `/for/${params.audience}` },
  };
}

export default async function AudiencePage({ params }: { params: { audience: string } }) {
  const audience = AUDIENCE_PAGES[params.audience as AudienceSlug];
  if (!audience) notFound();

  // A real filter against the API, not a string match on prose — which is what
  // stops these six pages being six copies of /partners with different headings.
  //
  // The audience's `needs` are category slugs. The API filters one at a time, so
  // the first that returns anything wins; falling back to the unfiltered list
  // keeps the page useful while the directory is small.
  const categories = await fetchCategories();
  const wanted = categories.filter((c) =>
    (audience.needs as readonly string[]).includes(c.slug),
  );
  const primary = wanted[0]?.slug;
  const matchedPage = primary ? await fetchPartners({ expertise: primary, per_page: 24 }) : null;
  const allPage = await fetchPartners({ per_page: 24 });
  const matched = matchedPage?.items ?? [];
  const partners = matched.length > 0 ? matched : allPage.items;

  return (
    <>
      <SectionSlab className="pt-8 sm:pt-10">
        <Breadcrumb
          items={[{ href: "/", label: "Home" }, { href: "/partners", label: "Partners" }, { label: audience.label }]}
        />
      </SectionSlab>

      <PageHero eyebrow={`For ${audience.label.toLowerCase()}`} title={audience.headline} lede={audience.lede}>
        <ul className="mt-8 flex flex-wrap gap-2">
          {(wanted.length > 0 ? wanted : []).map((n) => (
            <li key={n.slug} className="pub-bg-alt pub-ink rounded-full px-3 py-1.5 text-xs font-medium">
              {n.name}
            </li>
          ))}
        </ul>
      </PageHero>

      <SectionSlab className="pt-12 sm:pt-16">
        <h2 className="pub-display text-3xl leading-[1.02] tracking-[-0.03em] sm:text-4xl">
          Partners who do this work.
        </h2>
        {matched.length === 0 && (
          <p className="pub-muted mt-3 text-sm">
            None of our partners lists these exactly yet, so here is everyone. The directory is new.
          </p>
        )}
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {partners.map((p) => (
            <li key={p.slug} className="h-full">
              <PartnerCard partner={p} />
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <PublicButton href="/partners" variant="secondary" size="md">
            See every partner
          </PublicButton>
        </div>
      </SectionSlab>
    </>
  );
}
