import { Check } from "lucide-react";

import { PARTNER_TIERS } from "@/lib/public/siteContent";
import PublicButton from "./PublicButton";

/**
 * What each tier includes.
 *
 * ## Cards, not a comparison matrix
 *
 * A feature matrix is the right shape when the reader is choosing between plans
 * they will pay different amounts for. Here every tier is free and they are
 * **cumulative** — Verified is Certified minus a review — so the honest form is
 * three stacked lists where each says "everything in the one before".
 *
 * ## The thing that is not a design decision
 *
 * ⚠️ Every price reads *"Free"*, and that is `PARTNER_DIRECTORY_PLAN.md` § 10's
 * default rather than a decision: **no revenue model exists for this directory
 * yet.** When one does, this component and the `partner_tiers` rows have to
 * change together — and whatever was promised to partners who signed up during
 * launch has to be honoured. That is a commercial commitment being made by a
 * page, which is why it is called out here rather than left in the data file.
 */
export default function TierTable() {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3">
      {PARTNER_TIERS.map((tier, i) => {
        const featured = i === PARTNER_TIERS.length - 1;
        return (
          <li key={tier.name} className="h-full">
            <div
              className={
                featured
                  ? "pub-deep-bg pub-cream flex h-full flex-col rounded-[1.5rem] p-6 sm:rounded-[2rem] sm:p-8"
                  : "pub-border-thick flex h-full flex-col rounded-[1.5rem] p-6 sm:rounded-[2rem] sm:p-8"
              }
            >
              <h3 className="pub-display text-3xl leading-none tracking-[-0.03em]">{tier.name}</h3>
              <p className="pub-display mt-4 text-4xl leading-none tracking-[-0.03em]">
                {tier.price}
              </p>
              <p
                className={
                  featured
                    ? "mt-2 text-xs text-[color:var(--public-cream-70)]"
                    : "pub-muted mt-2 text-xs"
                }
              >
                {tier.note}
              </p>
              <ul className="mt-6 flex flex-col gap-3">
                {tier.includes.map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-sm leading-relaxed">
                    <Check
                      aria-hidden
                      className={
                        featured
                          ? "mt-0.5 h-4 w-4 shrink-0 text-[color:var(--public-amber)]"
                          : "pub-deep mt-0.5 h-4 w-4 shrink-0"
                      }
                    />
                    <span className={featured ? "" : "pub-muted"}>{line}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <PublicButton
                  href="/become-a-partner#apply"
                  variant={featured ? "onDeep" : "secondary"}
                  size="md"
                  fullWidth
                >
                  Apply
                </PublicButton>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
