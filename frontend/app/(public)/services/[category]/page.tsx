import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/public/Breadcrumb";
import PageHero from "@/components/public/PageHero";
import PartnerCard from "@/components/public/PartnerCard";
import PublicButton from "@/components/public/PublicButton";
import SectionSlab from "@/components/public/SectionSlab";
import { fetchCategories, fetchPartners } from "@/lib/api/public";
import { staticParamsOrEmpty } from "@/lib/public/buildParams";

/**
 * `/services/[category]` — the page § 20.4 calls "the page that ranks".
 *
 * ## Only categories above the threshold get one
 *
 * `generateStaticParams` reads the same endpoint the map does, and that endpoint
 * only returns categories with listings behind them. So a thin category has no
 * page at all rather than a page marked `noindex` — § 8's threshold applied to
 * *existence*, which `FRONTEND_PLAN.md` § 14.1 argues for at our size.
 *
 * `dynamicParams = false` makes anything else a hard 404 from the router rather
 * than a rendered not-found answering 200.
 *
 * ## It lists partners, not listings
 *
 * A buyer choosing a category is choosing who to talk to. The listing detail
 * page is a separate surface and waits on media and attributes being authored;
 * pointing this at partners means the page is useful the day a category has
 * anyone in it.
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  // Build-time, against the live API — see `lib/public/buildParams.ts` and the
  // note on the same call in `/partners/[slug]`.
  return staticParamsOrEmpty("/services/[category]", async () => {
    const categories = await fetchCategories();
    return categories.flatMap((c) => [
      { category: c.slug },
      ...c.children.map((child) => ({ category: child.slug })),
    ]);
  });
}

export async function generateMetadata({
  params,
}: {
  params: { category: string };
}): Promise<Metadata> {
  const categories = await fetchCategories();
  const all = categories.flatMap((c) => [c, ...c.children]);
  const category = all.find((c) => c.slug === params.category);
  if (!category) return { title: "Not found" };
  return {
    title: `${category.name} partners`,
    description:
      category.description ??
      `Companies offering ${category.name.toLowerCase()}, checked before listing.`,
    alternates: { canonical: `/services/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: { params: { category: string } }) {
  const categories = await fetchCategories();
  const all = categories.flatMap((c) => [c, ...c.children]);
  const category = all.find((c) => c.slug === params.category);
  if (!category) notFound();

  const page = await fetchPartners({ expertise: category.slug, per_page: 60 });
  const parent = categories.find((c) => c.children.some((x) => x.slug === category.slug));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${category.name} partners`,
    numberOfItems: page.items.length,
    itemListElement: page.items.map((partner, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: partner.name,
      url: `/partners/${partner.slug}`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <SectionSlab className="pt-8 sm:pt-10">
        <Breadcrumb
          items={[
            { href: "/", label: "Home" },
            { href: "/services", label: "Services" },
            ...(parent ? [{ href: `/services/${parent.slug}`, label: parent.name }] : []),
            { label: category.name },
          ]}
        />
      </SectionSlab>

      <PageHero
        eyebrow="Checked before listed"
        title={category.name}
        lede={
          category.description ??
          `Companies that do ${category.name.toLowerCase()}. Every one was verified against public records before it appeared here.`
        }
      />

      <SectionSlab className="pt-12 sm:pt-16">
        {page.items.length === 0 ? (
          // Not expected — the category only has a page because it has listings —
          // but a partner can be unlisted between the build and the request.
          <p className="pub-muted max-w-2xl text-base">
            Nobody is listed under this yet. Try the{" "}
            <Link href="/partners" className="pub-deep underline underline-offset-4">
              full directory
            </Link>
            .
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {page.items.map((partner) => (
              <li key={partner.slug} className="h-full">
                <PartnerCard partner={partner} />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <PublicButton href="/partners" variant="secondary" size="md">
            See every partner
          </PublicButton>
          <PublicButton href="/services" variant="text" size="md">
            All services
          </PublicButton>
        </div>
      </SectionSlab>
    </>
  );
}
