import type { Metadata } from "next";
import Link from "next/link";

import Breadcrumb from "@/components/public/Breadcrumb";
import EmptyState from "@/components/public/EmptyState";
import PageHero from "@/components/public/PageHero";
import PartnerCard from "@/components/public/PartnerCard";
import PublicButton from "@/components/public/PublicButton";
import SearchBar from "@/components/public/SearchBar";
import SectionSlab from "@/components/public/SectionSlab";
import { fetchCategories, fetchPartners } from "@/lib/api/public";
import { VERIFICATION_LEVELS } from "@/lib/public/siteContent";

/**
 * `/partners` — the directory index, and at our size **it is the whole
 * directory**. There is no separate category map (§ 14.1: `/services` is folded
 * into this page until a category clears the threshold).
 *
 * ## What § 20.4 asks for that is deliberately absent
 *
 * `FRONTEND_PLAN.md` § 13.3 turns each of these off until a measured trigger:
 *
 * | Absent | Switches on at |
 * |---|---|
 * | Facets / filters | Band 2, or ≥3 values with ≥2 partners each |
 * | Pagination | more than 24 rows |
 * | *"Showing 12 of 87"* | Band 2 |
 * | Sort control | when there is enough to sort |
 *
 * A facet over six rows produces mostly-empty combinations, and § 20.4 wants
 * each combination to be a crawlable URL — so filtering early **manufactures**
 * the thin pages the plan elsewhere warns about. A verified count of six is
 * worse than no count.
 *
 * So this page is: a search box, an explanation of what verification means, and
 * every partner. That is the honest shape of a directory this size, and it is
 * also the one that makes six partners read as *selective* rather than *empty*.
 *
 * ## `searchParams` drives a real server-side filter
 *
 * ⚠️ **Corrected 2026-08-21.** This section used to say the query was echoed but
 * nothing was filtered, "because there is no search backend". That stopped being
 * true when `/public/partners` landed, and the page had *already* been passing all
 * three parameters through — so the comment was describing an earlier version of
 * the file it sits in. Re-measured against the running stack:
 *
 * | Request | Partners rendered |
 * |---|---:|
 * | `/partners` | 6 |
 * | `/partners?q=north` | 1 |
 * | `/partners?expertise=cloud-infrastructure` | 3 |
 * | `/partners?city=nowhere` | 0 |
 *
 * `expertise` is a join on the expertise pivot, not a text match, and filtering on
 * a parent category includes its children — a partner attaches expertise to leaves,
 * so matching a parent id exactly returned nothing while the chips rendered
 * perfectly. `q` is a LIKE over name and tagline; `city` is an exact lowercase
 * match.
 *
 * The § 13.3 table above still holds: what is absent is *facet UI* — visible
 * chips and counts that manufacture crawlable thin pages at this size. Answering a
 * URL somebody already has is a different thing from advertising the combinations.
 */
export const metadata: Metadata = {
  title: "Partner directory",
  description:
    "Every company in the directory, what each one does, where they are, and what our verification covered.",
  alternates: { canonical: "/partners" },
};

export default async function PartnersPage({
  searchParams,
}: {
  searchParams?: { q?: string; expertise?: string; city?: string };
}) {
  const q = searchParams?.q?.trim();
  const expertise = searchParams?.expertise;
  const city = searchParams?.city;

  // Server-side, through INTERNAL_API_URL — `lib/api/public.ts` explains why
  // getting that backwards fails silently. Both requests run in parallel; the
  // categories drive the filter and the partners are the page.
  const [page, categories] = await Promise.all([
    fetchPartners({ q, expertise, city, per_page: 60 }),
    fetchCategories(),
  ]);
  const partners = page.items;

  return (
    <>
      <SectionSlab className="pt-8 sm:pt-10">
        <Breadcrumb items={[{ href: "/", label: "Home" }, { label: "Partners" }]} />
      </SectionSlab>

      <PageHero
        eyebrow="Every partner, unfiltered"
        title="The directory."
        lede="Small on purpose. Every company here was checked against public records before it appeared, and each badge says exactly what that check covered."
      >
        <div className="mt-8 max-w-2xl">
          <SearchBar />
        </div>
      </PageHero>

      {/* What the badges mean, before the cards that carry them — otherwise the
          first thing a stranger sees is a label they cannot interpret. */}
      <SectionSlab className="pt-12 sm:pt-16">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          {VERIFICATION_LEVELS.map((v) => (
            <li key={v.level} className="pub-bg-alt rounded-[1.25rem] p-5 sm:rounded-[1.5rem] sm:p-6">
              <h2 className="pub-display text-xl leading-tight tracking-[-0.02em]">{v.label}</h2>
              <p className="pub-muted mt-2 text-sm leading-relaxed">{v.summary}</p>
            </li>
          ))}
        </ul>
        <p className="pub-muted mt-4 text-sm">
          <a href="/verification" className="pub-deep font-semibold underline underline-offset-4">
            The full criteria for each
          </a>
        </p>
      </SectionSlab>

      {/* ── The filter — step 6 of the cycle ───────────────────────────────
          Links, not a form: it works with JavaScript disabled, the back button
          behaves, a filtered view is shareable, and the page stays a server
          component. § 20.5 asks for exactly this.

          **No counts on the options.** A count next to a filter is a count of
          the inventory, and § 20.2 rule 10 plus § 13.3 both say not yet. An
          option that would match nothing is simply not rendered — the API only
          returns categories that have something in them. */}
      {categories.length > 0 && (
        <SectionSlab className="pt-12 sm:pt-16">
          <div className="pub-border-thick rounded-[1.5rem] p-5 sm:rounded-[2rem] sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="pub-display text-2xl leading-tight tracking-[-0.02em]">
                What do you need?
              </h2>
              {(expertise || city) && (
                <Link
                  href="/partners"
                  className="pub-focus pub-deep text-sm font-semibold no-underline hover:underline"
                >
                  Clear filters
                </Link>
              )}
            </div>
            <ul className="mt-5 flex flex-wrap gap-2">
              {categories.map((c) => {
                const active = expertise === c.slug;
                return (
                  <li key={c.slug}>
                    <Link
                      href={active ? "/partners" : `/partners?expertise=${encodeURIComponent(c.slug)}`}
                      // `aria-current` rather than `aria-pressed`: this is a
                      // link, not a toggle button, and `aria-pressed` is not
                      // supported on the link role.
                      aria-current={active ? "true" : undefined}
                      className={
                        active
                          ? "pub-focus pub-ink-bg pub-cream inline-block rounded-full border-2 border-[color:var(--public-ink)] px-3.5 py-2 text-sm font-medium no-underline transition-transform duration-200 hover:scale-[.97]"
                          : "pub-focus pub-bg pub-ink pub-card-hover inline-block rounded-full border-2 border-[color:var(--public-bg-alt)] px-3.5 py-2 text-sm font-medium no-underline hover:scale-[.97]"
                      }
                    >
                      {c.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </SectionSlab>
      )}

      <SectionSlab className="pt-12 sm:pt-16">
        {q && (
          <p className="pub-muted mb-6 text-sm">
            Showing every partner. Search is not wired up yet, so{" "}
            <strong className="pub-ink">&ldquo;{q}&rdquo;</strong> has not narrowed this list —
            it will when the directory is large enough to need it.
          </p>
        )}

        {partners.length === 0 ? (
          <EmptyState
            title={
              expertise || city || q
                ? "Nothing matches that yet."
                : "No partners listed yet."
            }
            body={
              expertise || city || q
                ? "The directory is small and growing. Clear the filters to see everyone, or tell us what you were looking for — it is how we know who to verify next."
                : "The directory is new. If you deliver infrastructure services, this is a good moment to be the first company in it."
            }
            action={
              expertise || city || q
                ? { href: "/partners", label: "Clear filters" }
                : { href: "/become-a-partner", label: "Become a partner" }
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {partners.map((p) => (
              <li key={p.slug} className="h-full">
                <PartnerCard partner={p} />
              </li>
            ))}
          </ul>
        )}
      </SectionSlab>

      <SectionSlab
        ground="deep"
        className="pt-14 sm:pt-20"
        innerClassName="px-6 py-12 text-center sm:px-10 sm:py-16"
      >
        <h2 className="pub-display mx-auto max-w-2xl text-3xl leading-[1.02] tracking-[-0.03em] sm:text-5xl">
          Not finding the work you need?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[color:var(--public-cream-70)]">
          Tell us what you were looking for. It is the fastest way for us to know which partners to
          go and verify next.
        </p>
        <div className="mt-8 flex justify-center">
          <PublicButton href="/contact" variant="primary" size="lg">
            Tell us what is missing
          </PublicButton>
        </div>
      </SectionSlab>
    </>
  );
}
