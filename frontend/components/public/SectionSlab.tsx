import { cn } from "@/lib/utils/cn";

/**
 * A coloured, heavily-rounded slab floating on the cream page.
 *
 * The reference's page is a stack of these rather than a stack of full-bleed
 * bands — `border-radius: 5rem` on desktop, `2.5rem` on mobile, inset from the
 * viewport edge so the cream shows around every side (`FRONTEND_PLAN.md`
 * § 15.4, § 15.6).
 *
 * **Why this is a component and not a class.** The radius has to shrink on
 * mobile or a 5rem corner eats a 360px card's content, and the ground colour
 * decides the text colour with it — pine and ink slabs both carry cream text at
 * 9.39:1 and 17.20:1. Pairing them by hand at each call site is how one section
 * ends up with ink text on a pine ground.
 *
 * `cream` is the no-op ground: it renders nothing, so a section can opt into the
 * rhythm without a colour change.
 */
type Ground = "cream" | "deep" | "ink" | "alt";

const GROUNDS: Record<Ground, string> = {
  cream: "",
  deep: "pub-deep-bg pub-cream",
  ink: "pub-ink-bg pub-cream",
  alt: "pub-bg-alt pub-ink",
};

export default function SectionSlab({
  ground = "cream",
  className,
  innerClassName,
  children,
  ...rest
}: {
  ground?: Ground;
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const rounded = ground === "cream" ? "" : "rounded-[2rem] sm:rounded-[3rem] lg:rounded-[5rem]";

  return (
    <section className={cn("px-4 sm:px-6 lg:px-8", className)} {...rest}>
      <div className={cn("mx-auto w-full max-w-[1400px]", rounded, GROUNDS[ground], innerClassName)}>
        {children}
      </div>
    </section>
  );
}
