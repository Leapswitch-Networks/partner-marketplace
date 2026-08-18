/**
 * Frequently-asked questions, as native `<details>`.
 *
 * ## Why not an accordion component
 *
 * `<details>`/`<summary>` is open/close, keyboard operable, and findable by the
 * browser's own in-page search — with **zero JavaScript**. A hand-built
 * accordion costs a client component, an ARIA pattern that is easy to get
 * wrong, and it hides its content from Ctrl-F. The public surface is L1, CSS
 * only (§ 15.5), and this is the clearest case for it on the whole site.
 *
 * The FAQ block is lifted from the reference's own supply-side page
 * (`FRONTEND_PLAN.md` § 14.3 ④): it answers the objections a partner actually
 * has, which is a different list from the ones a marketing page wants to make.
 *
 * `FAQPage` JSON-LD is emitted with it — an FAQ is one of the few blocks
 * search engines still render richly, and it costs nothing here.
 */
export default function FaqList({
  items,
}: {
  items: ReadonlyArray<{ q: string; a: string }>;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };

  return (
    <div className="max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ul>
        {items.map(({ q, a }) => (
          <li key={q} className="border-t-2 border-[color:var(--public-bg-alt)] last:border-b-2">
            <details className="group">
              <summary className="pub-focus flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-lg font-semibold leading-snug marker:content-none">
                {q}
                <span
                  aria-hidden
                  className="pub-deep shrink-0 text-2xl leading-none transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pub-muted pb-6 pr-10 text-[0.9375rem] leading-relaxed">{a}</p>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
