import Link from "next/link";

import { COMPANY, FOOTER_GROUPS } from "@/lib/public/homeContent";
import { APP_NAME } from "@/lib/utils/constants";

/**
 * The marketing footer.
 *
 * ## It sits on ink, and that decides the hover colour
 *
 * From the reference (`FRONTEND_PLAN.md` § 15.4): on a cream ground a footer
 * link hovers to pine; **on a dark ground it hovers to amber.** This footer is
 * dark, so it is amber — at 9.13:1, which passes. The same amber on cream is
 * 1.88:1 and fails outright, which is why it may only ever appear here (§ 15.10).
 *
 * ## No dead columns
 *
 * `ANTI_SLOP.md` § 1 lists the four-column footer with half its links going
 * nowhere as a tell. Every link below points at a route in § 4's register.
 * ⚠️ Most of them do not exist yet and will 404 — correct for a design review,
 * and it must not survive into anything a stranger can reach.
 */
export default function PublicFooter() {
  return (
    <footer className="px-4 pb-4 pt-16 sm:px-6 sm:pb-6 lg:px-8">
      <div className="pub-ink-bg pub-cream mx-auto w-full max-w-[1400px] rounded-[2rem] px-6 py-12 sm:rounded-[3rem] sm:px-10 sm:py-16 lg:rounded-[5rem] lg:px-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_2fr] lg:gap-16">
          <div>
            <p className="pub-display text-3xl leading-[1.05] tracking-[-0.03em] sm:text-4xl">
              Find the right company. Send one enquiry.
            </p>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-[color:var(--public-cream-70)]">
              Every company listed here is checked before it appears, and your enquiry goes to one of
              them only.
            </p>
            <p className="mt-4 text-xs leading-relaxed text-[color:var(--public-cream-70)]">
              Support {COMPANY.supportHours}
            </p>
          </div>

          {/* Single column base, then two, then five. A bare multi-column grid
              is the defect that left sign-up's name fields 58px wide at 360px. */}
          <nav aria-label="Footer" className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.title}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--public-cream-70)]">
                  {group.title}
                </h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {group.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link
                        href={link.href}
                        {...("external" in link && link.external
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className="pub-focus pub-cream text-sm font-medium no-underline transition-colors duration-300 hover:text-[color:var(--public-amber)]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* 🔴 The bottom bar names the PRODUCT, not the operating company.
            It used to carry the legal entity, the founding year, the office
            cities and the company identification number — and because this
            footer renders on every page, that put the operator's identity in
            front of every visitor on every route.

            The operating entity is still named where a legal document has to
            name it: /terms, /privacy and /contact. That discloses who runs the
            site, which is not the same as disclosing the supply relationship —
            see the confidentiality rule in `lib/public/homeContent.ts`. */}
        <div className="mt-12 flex flex-col gap-3 border-t-2 border-[color:var(--public-cream-15)] pt-6 text-xs text-[color:var(--public-cream-70)] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {APP_NAME}. All rights reserved.</p>
          <p>
            <Link href="/terms" className="pub-focus pub-cream no-underline hover:underline">
              Terms
            </Link>
            {" · "}
            <Link href="/privacy" className="pub-focus pub-cream no-underline hover:underline">
              Privacy
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
