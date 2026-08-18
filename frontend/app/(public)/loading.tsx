import SectionSlab from "@/components/public/SectionSlab";

/**
 * Loading skeleton for the public surface.
 *
 * § 20.2 rule 4 and § 20.4: **skeletons match the final dimensions**, or the
 * layout jumps when the real content arrives and CLS blows past the 0.1 budget.
 * The blocks below are sized to the page hero every public route opens with —
 * eyebrow, heading, lede — rather than being generic grey bars.
 *
 * `animate-pulse` is Tailwind's own and costs no JavaScript. The reduced-motion
 * block in `public.css` neutralises it for anyone who has asked for that.
 */
export default function PublicLoading() {
  return (
    <SectionSlab className="pt-10 sm:pt-16 lg:pt-20" aria-hidden>
      <div className="max-w-3xl animate-pulse">
        <div className="pub-bg-alt h-4 w-40 rounded" />
        <div className="pub-bg-alt mt-6 h-14 w-full rounded sm:h-20" />
        <div className="pub-bg-alt mt-3 h-14 w-4/5 rounded sm:h-20" />
        <div className="pub-bg-alt mt-8 h-4 w-full rounded" />
        <div className="pub-bg-alt mt-2.5 h-4 w-11/12 rounded" />
        <div className="pub-bg-alt mt-2.5 h-4 w-2/3 rounded" />
        <div className="pub-bg-alt mt-10 h-14 w-full max-w-2xl rounded-2xl" />
      </div>
      <span className="sr-only" role="status">
        Loading
      </span>
    </SectionSlab>
  );
}
