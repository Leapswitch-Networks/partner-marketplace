import HeadingReveal from "./HeadingReveal";
import SectionSlab from "./SectionSlab";

/**
 * The opening block for every public page that is not the home page.
 *
 * One component rather than a hand-rolled header per page, for the reason
 * `UI_PATTERNS.md` gives about the app's three-page contract: the moment each
 * page sets its own top spacing and heading size, they drift, and the drift is
 * visible the second somebody clicks between two of them.
 *
 * The `<h1>` lives here, which is what guarantees the "exactly one per page"
 * rule in § 20.2 rather than leaving it to each page to remember.
 */
export default function PageHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  /**
   * A string animates as one line. An array animates line by line — pass one
   * when the headline has a natural break, since the author knows where it
   * belongs and measuring it would need JavaScript (see `HeadingReveal`).
   */
  title: string | readonly string[];
  lede?: string;
  children?: React.ReactNode;
}) {
  return (
    <SectionSlab className="pt-10 sm:pt-16 lg:pt-20">
      <div className="max-w-3xl">
        {eyebrow && (
          <p className="pub-deep text-xs font-semibold uppercase tracking-[0.16em] sm:text-sm">
            {eyebrow}
          </p>
        )}
        <h1 className="pub-display mt-4 text-[2.5rem] leading-[0.95] tracking-[-0.035em] sm:text-6xl lg:text-7xl lg:leading-[0.9]">
          <HeadingReveal text={title} />
        </h1>
        {lede && <p className="pub-muted mt-6 text-base leading-relaxed sm:text-lg">{lede}</p>}
        {children}
      </div>
    </SectionSlab>
  );
}
