import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";

import type { PublicPartnerSummary } from "@/lib/api/public";
import PartnerLogo from "./PartnerLogo";
import VerificationBadge from "./VerificationBadge";

/**
 * A partner, as a card. **Reads the API's shape directly.**
 *
 * ## Why each row is deep rather than the list being long
 *
 * At the size this directory launches at — a handful of listed partners —
 * the list cannot carry the page. § 12.6 is the conclusion drawn from Shopify's
 * and Clutch's directories, both of which live at our order of magnitude: make
 * each row deep rather than the list long. So this is the smallest complete
 * argument for a company, not a table row with rounded corners.
 *
 * ## The logo falls back to initials
 *
 * Delegated to `PartnerLogo`, which renders the uploaded image when there is one
 * and the company's initials when there is not. The fallback is a deliberate
 * treatment rather than a placeholder — a directory of grey boxes looks broken.
 *
 * ## What it must never show
 *
 * `notes`, `gst_number`, `pan_number`, `status` — § 17.3 marks them internal, and
 * the type this accepts does not carry them, which is the real enforcement. No
 * rating or review count either: § 6.5, unverified ratings read as astroturf and
 * no review exists to average.
 */
export default function PartnerCard({ partner }: { partner: PublicPartnerSummary }) {
  const { slug, name, tagline, city, verification_level, founded_year, employee_range, has_logo } =
    partner;

  return (
    <Link
      href={`/partners/${slug}`}
      className="pub-focus pub-bg pub-border-thick pub-card-hover group flex h-full flex-col rounded-[1.5rem] p-5 no-underline sm:rounded-[2rem] sm:p-7"
    >
      {/* `min-w-0` on the text side and `shrink-0` on the badge — a long partner
          name otherwise pushes the badge off the right edge of a 360px screen. */}
      <div className="flex items-start justify-between gap-3">
        <PartnerLogo name={name} slug={slug} hasLogo={has_logo} size={56} />
        <VerificationBadge level={verification_level} />
      </div>

      <h3 className="pub-display mt-5 text-2xl leading-[1.1] tracking-[-0.02em] sm:text-[1.75rem]">
        {name}
      </h3>

      {tagline && <p className="pub-muted mt-2 text-[0.9375rem] leading-relaxed">{tagline}</p>}

      {/* Pushed to the bottom so every card's footer sits at the same height
          regardless of how long the tagline ran. */}
      <div className="mt-auto flex items-center justify-between gap-3 pt-6">
        <span className="pub-muted flex min-w-0 items-center gap-1.5 text-sm">
          <MapPin aria-hidden className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {[city, founded_year ? `since ${founded_year}` : null, employee_range]
              .filter(Boolean)
              .join(" · ") || "Details on their profile"}
          </span>
        </span>
        <span className="pub-deep flex shrink-0 items-center gap-1 text-sm font-semibold">
          Profile
          <ArrowUpRight aria-hidden className="pub-nudge h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
