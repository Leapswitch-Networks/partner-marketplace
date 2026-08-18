import { BadgeCheck, ShieldCheck, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * The trust signal — one component, one meaning.
 *
 * ## It takes the API's vocabulary, not a friendlier one
 *
 * `verification_level` on `partners` is `UNVERIFIED | VERIFIED | PREMIER`, and
 * this component accepts exactly that. An intermediate mapping — "certified",
 * "listed" — existed while the page ran on placeholder content and was removed
 * when the API landed: two vocabularies for one column is how a badge ends up
 * meaning something different on two pages.
 *
 * ## The tooltip states the criteria, not the level's name
 *
 * `FRONTEND_PLAN.md` § 14.6, taken from the one useful lesson in Justdial's
 * monetisation page (§ 12.4): it publishes exactly what earns its badge. A badge
 * whose meaning is unpublished is decoration, and this directory's entire
 * argument is that ours means something.
 *
 * ⚠️ The criteria below are **proposed pending the real verification policy**
 * (§ 9 decision 1). They are written as concrete claims so they can be argued
 * with, and must be replaced rather than paraphrased before launch.
 */
export type VerificationLevel = "PREMIER" | "VERIFIED" | "UNVERIFIED";

const LEVELS: Record<
  VerificationLevel,
  { label: string; criteria: string; icon: typeof BadgeCheck; className: string }
> = {
  PREMIER: {
    label: "Certified partner",
    criteria:
      "Identity and GST verified, a signed agreement, and at least one completed engagement reviewed by our team. Re-checked annually.",
    icon: Sparkles,
    className: "pub-deep-bg pub-cream border-[color:var(--public-deep)]",
  },
  VERIFIED: {
    label: "Verified partner",
    criteria:
      "Company identity and GST registration verified against public records, with a signed agreement on file.",
    icon: BadgeCheck,
    className: "pub-lilac-bg pub-ink border-[color:var(--public-ink)]",
  },
  UNVERIFIED: {
    label: "Listed",
    criteria:
      "Company details confirmed. Verification is in progress and this partner has not completed it yet.",
    icon: ShieldCheck,
    className: "pub-bg pub-ink border-[color:var(--public-bg-alt)]",
  },
};

export default function VerificationBadge({
  level,
  className,
}: {
  level: string;
  className?: string;
}) {
  // Unknown values degrade to the weakest claim rather than throwing. A new
  // enum value shipping before this file is updated must not take the directory
  // down, and must never silently read as the strongest badge.
  const entry = LEVELS[(level as VerificationLevel) in LEVELS ? (level as VerificationLevel) : "UNVERIFIED"];
  const { label, criteria, icon: Icon } = entry;

  return (
    <span
      title={`${label} — ${criteria}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-semibold leading-none",
        entry.className,
        className,
      )}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" />
      <span>{label}</span>
    </span>
  );
}
