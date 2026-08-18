import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Breadcrumb, and the `BreadcrumbList` JSON-LD that goes with it — § 20.5.
 *
 * The structured data is the reason this is a component rather than three
 * inline links: search results render the trail instead of a bare URL when the
 * markup is present, and hand-writing the JSON at each call site is how one page
 * ends up with a trail that does not match its own links.
 *
 * The last crumb is the current page and is deliberately **not** a link — a link
 * to where you already are is noise for everyone and a trap for screen-reader
 * users. `aria-current="page"` says so explicitly.
 */
export default function Breadcrumb({
  items,
}: {
  items: { href?: string; label: string }[];
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: item.href } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight aria-hidden className="pub-muted h-3.5 w-3.5 shrink-0" />}
            {item.href ? (
              <Link href={item.href} className="pub-focus pub-muted no-underline hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="pub-ink font-medium" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
