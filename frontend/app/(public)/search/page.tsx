import type { Metadata } from "next";

import Breadcrumb from "@/components/public/Breadcrumb";
import EmptyState from "@/components/public/EmptyState";
import PageHero from "@/components/public/PageHero";
import PartnerCard from "@/components/public/PartnerCard";
import SearchBar from "@/components/public/SearchBar";
import SectionSlab from "@/components/public/SectionSlab";
import { fetchCategories, fetchPartners } from "@/lib/api/public";

/**
 * `/search` — results.
 *
 * ## Always `noindex, follow`, without exception
 *
 * § 20.4 states it flatly and it is not a preference: search result pages are
 * near-duplicate content, search engines penalise them, and a crawler that finds
 * one finds an unbounded number. `follow` is kept so the partner pages linked
 * from here still get discovered.
 *
 * ## Why this exists despite being deferred
 *
 * `FRONTEND_PLAN.md` § 13.3 puts search at Band 2, and the argument still holds:
 * at this size the filter on `/partners` is strictly better, because it offers a
 * closed set of real categories instead of asking a stranger to guess our
 * vocabulary. So this page **is deliberately thin** — it runs the same query the
 * directory does and, when the text matches nothing, sends the visitor to the
 * filter rather than to a dead end.
 *
 * It is here because the header's search box has to go somewhere, and a form
 * that posts to a 404 is worse than a page that admits its limits.
 */
export const metadata: Metadata = {
  title: "Search",
  // Non-negotiable — see the note above.
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const q = searchParams?.q?.trim() ?? "";
  const [page, categories] = await Promise.all([
    q ? fetchPartners({ q, per_page: 60 }) : Promise.resolve(null),
    fetchCategories(),
  ]);
  const results = page?.items ?? [];

  return (
    <>
      <SectionSlab className="pt-8 sm:pt-10">
        <Breadcrumb items={[{ href: "/", label: "Home" }, { label: "Search" }]} />
      </SectionSlab>

      <PageHero
        eyebrow={q ? "Search results" : "Search"}
        title={q ? `“${q}”` : "What are you looking for?"}
        lede={
          q
            ? "Matching companies from the directory. Everything here was checked before listing."
            : "Search by company name or what they do — or browse by category below, which is usually faster."
        }
      >
        <div className="mt-8 max-w-2xl">
          <SearchBar />
        </div>
      </PageHero>

      <SectionSlab className="pt-12 sm:pt-16">
        {!q ? (
          // No query: send them to the closed set rather than a blank page.
          <>
            <h2 className="pub-display text-2xl leading-tight tracking-[-0.02em] sm:text-3xl">
              Browse instead
            </h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {categories.map((category) => (
                <li key={category.slug}>
                  <a
                    href={`/partners?expertise=${encodeURIComponent(category.slug)}`}
                    className="pub-focus pub-bg-alt pub-ink inline-block rounded-full px-3.5 py-2 text-sm font-medium no-underline transition-transform duration-200 hover:scale-[.97]"
                  >
                    {category.name}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : results.length === 0 ? (
          <EmptyState
            title={`Nothing matched “${q}”.`}
            body="The directory is small, so a spelling that works elsewhere may find nothing here. Browsing by category is usually faster — it offers the exact words partners chose."
            action={{ href: "/partners", label: "Browse the directory" }}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {results.map((partner) => (
              <li key={partner.slug} className="h-full">
                <PartnerCard partner={partner} />
              </li>
            ))}
          </ul>
        )}
      </SectionSlab>
    </>
  );
}
