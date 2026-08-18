import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import Breadcrumb from "@/components/public/Breadcrumb";
import PageHero from "@/components/public/PageHero";
import SectionSlab from "@/components/public/SectionSlab";
import { fetchCategories } from "@/lib/api/public";

/**
 * `/services` — the taxonomy as a browsable map.
 *
 * ## It only shows categories with something behind them
 *
 * The API returns categories whose roll-up count is above zero, so § 8's
 * threshold is applied at the source rather than re-implemented here. § 20.4:
 * *"categories with zero listings"* is on the must-NOT-have list, because an
 * empty category is a promise the directory cannot keep.
 *
 * ## Two levels, never three
 *
 * The schema enforces it (a third level is a 409) and this page assumes it. A
 * recursive renderer here would be code written for a shape the database
 * refuses to store.
 */
export const metadata: Metadata = {
  title: "Services",
  description: "Every kind of work the companies in this directory do.",
  alternates: { canonical: "/services" },
};

export default async function ServicesPage() {
  const categories = await fetchCategories();

  return (
    <>
      <SectionSlab className="pt-8 sm:pt-10">
        <Breadcrumb items={[{ href: "/", label: "Home" }, { label: "Services" }]} />
      </SectionSlab>

      <PageHero
        eyebrow="Browse by what you need"
        title="Services."
        lede="Everything here is offered by a company we checked before listing. Pick the closest match — you can narrow further on the next page."
      />

      <SectionSlab className="pt-12 sm:pt-16">
        {categories.length === 0 ? (
          <p className="pub-muted max-w-2xl text-base">
            No categories have listings yet. The directory is just opening.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
            {categories.map((category) => (
              <li key={category.slug} className="h-full">
                <div className="pub-border-thick flex h-full flex-col rounded-[1.5rem] p-6 sm:rounded-[2rem] sm:p-8">
                  <Link
                    href={`/services/${category.slug}`}
                    className="pub-focus group flex items-start justify-between gap-3 no-underline"
                  >
                    <h2 className="pub-display text-3xl leading-none tracking-[-0.03em] sm:text-4xl">
                      {category.name}
                    </h2>
                    <ArrowUpRight aria-hidden className="pub-deep mt-1 h-5 w-5 shrink-0" />
                  </Link>
                  {category.description && (
                    <p className="pub-muted mt-3 text-sm leading-relaxed">{category.description}</p>
                  )}
                  {category.children.length > 0 && (
                    <ul className="mt-5 flex flex-wrap gap-2">
                      {category.children.map((child) => (
                        <li key={child.slug}>
                          <Link
                            href={`/partners?expertise=${encodeURIComponent(child.slug)}`}
                            className="pub-focus pub-bg-alt pub-ink inline-block rounded-full px-3 py-1.5 text-xs font-medium no-underline transition-transform duration-200 hover:scale-[.97]"
                          >
                            {child.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionSlab>
    </>
  );
}
