import type { Metadata } from "next";
import { EB_Garamond } from "next/font/google";

import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";
import BackToTop from "@/components/public/BackToTop";
import PointerGlow from "@/components/public/PointerGlow";
import { APP_NAME } from "@/lib/utils/constants";
import "./public.css";

/**
 * The public shell — Surface A.
 *
 * `FRONTEND_PLAN.md` § 2 settles that this shares **nothing** with the signed-in
 * app: different fetch path, different actor, different chrome, its own
 * components in `components/public/`. That is why this is a route-group layout
 * and not a variant of the app shell, and why a public page must never reach
 * into `components/common/` — that folder belongs to the admin surface.
 *
 * ## The display face
 *
 * EB Garamond, weight 400, headings only. Decided 2026-08-18 (§ 15.8 ②) as a
 * narrow amendment to the otherwise absolute "Montserrat only" rule, because a
 * light serif at large sizes with negative tracking is doing most of the
 * reference's visual work — take the colours without it and the result is a
 * lavender admin panel (§ 15.5).
 *
 * ⚠️ **Loaded here and not in the root layout, deliberately.** The root layout
 * serves the whole app; putting the serif there would make every signed-in route
 * download a font it never renders. Body text stays Montserrat, which the root
 * layout already provides — **Figtree is not adopted.**
 *
 * ## Light-only
 *
 * § 15.8 ①, the owner's decision. Three of the four conditions that keep it
 * reversible are structural and live here or in `public.css`:
 * `color-scheme: light` on `.public-root`, no `dark` class reaching this
 * subtree, and no `dark:` variant on any public component. The fourth — that
 * components reference tokens rather than hexes — is enforced by review.
 *
 * The root layout still paints `bg-white dark:bg-night-body` on `<body>`, so
 * `.public-root` carries `min-h-dvh` and its own ground to cover it. `dvh`, not
 * `vh`: on mobile `100vh` is the URL-bar-hidden height and the page's bottom
 * edge ends up below the visible screen.
 */
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-eb-garamond",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — verified companies for cloud, hosting and infrastructure work`,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "Compare independent companies checked before listing, then send one enquiry to the one you picked.",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`public-root ${ebGaramond.variable} flex min-h-dvh flex-col`}>
      {/* § 20.2 rule 8. First focusable thing on the page, visible only when
          focused — a keyboard user should not tab through five nav links and a
          search box to reach the content on every page. */}
      <a
        href="#main"
        className="pub-focus pub-ink-bg pub-cream sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      {/* Ambient, behind everything, pointer-events off. It renders nothing at
          all on touch devices or under reduced motion — see the component. */}
      <PointerGlow />

      <PublicHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter />

      {/* Mounted in the layout, not per page, so it behaves identically on all
          of them. It is `fixed`, so it costs nothing in flow. */}
      <BackToTop />
    </div>
  );
}
