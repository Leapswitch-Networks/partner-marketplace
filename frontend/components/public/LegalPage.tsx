import LegalNotice from "./LegalNotice";
import PageHero from "./PageHero";
import SectionSlab from "./SectionSlab";
import { LEGAL_REVIEWED } from "@/lib/public/siteContent";

/**
 * Shared shell for `/terms` and `/privacy`.
 *
 * Both documents are the same shape — a numbered list of sections with a plain
 * heading and a paragraph — so they share a renderer. Writing them twice would
 * guarantee they drift, and a privacy page that looks different from the terms
 * page reads as though one of them was an afterthought.
 *
 * ## Readability, which is a design decision here and not a default
 *
 * The measure is capped at ~68 characters (`max-w-2xl` at this size). Legal text
 * is the one thing on this surface somebody will genuinely read top to bottom,
 * and a full-width paragraph at 1400px is unreadable — the same reason
 * `UI_PATTERNS.md` caps the app's page forms at `max-w-4xl` while letting data
 * tables run full width.
 *
 * Sections are numbered in the markup rather than by CSS counters so the number
 * survives copy-and-paste, which is how legal text is usually quoted back.
 */
export default function LegalPage({
  title,
  lede,
  updated,
  sections,
}: {
  title: string;
  lede: string;
  updated: string;
  sections: ReadonlyArray<{ n: number; title: string; body: string }>;
}) {
  return (
    <>
      <PageHero eyebrow={`Last updated ${updated}`} title={title} lede={lede}>
        {!LEGAL_REVIEWED && (
          <div className="mt-8">
            <LegalNotice />
          </div>
        )}
      </PageHero>

      <SectionSlab className="pt-12 sm:pt-16">
        <ol className="max-w-2xl">
          {sections.map((s) => (
            <li
              key={s.n}
              className="border-t-2 border-[color:var(--public-bg-alt)] py-7 first:border-t-0 first:pt-0"
            >
              <h2 className="pub-display flex gap-3 text-2xl leading-tight tracking-[-0.02em] sm:text-3xl">
                <span className="pub-deep shrink-0 tabular-nums">{s.n}.</span>
                <span>{s.title}</span>
              </h2>
              <p className="pub-muted mt-3 text-base leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </SectionSlab>
    </>
  );
}
