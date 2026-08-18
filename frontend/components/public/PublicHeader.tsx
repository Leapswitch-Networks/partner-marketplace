"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { HEADER_LINKS } from "@/lib/public/homeContent";
import PublicButton from "./PublicButton";

/**
 * The marketing header — a floating pill, not a bar.
 *
 * Measured from the reference (`FRONTEND_PLAN.md` § 15.4): a 64rem-max container
 * with a 2px soft border and the same cream as the page, inset from the top
 * rather than flush against it.
 *
 * ## The 2px detail that is easy to lose
 *
 * Each nav link reserves its border **transparent** and colours it on hover.
 * That is why nothing shifts by two pixels when the pointer arrives. Adding the
 * border only on `:hover` would produce a visible jump on every link, on every
 * hover, forever.
 *
 * ## Why it is a client component when almost nothing else here is
 *
 * The mobile menu. That is the entire reason, and it is why the *page* stays a
 * server component with this as one leaf — § 20.2 rule 1.
 *
 * ## Five links
 *
 * § 15.7: the reference carries five and Justdial's homepage carries about 150.
 * Resist adding a sixth without removing one; the restraint is the design.
 */
export default function PublicHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="pub-bg pub-border-soft mx-auto w-full max-w-[64rem] rounded-2xl">
        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
          {/* Wordmark. `min-w-0` + `truncate` because a long installation name
              otherwise pushes the hamburger off a 360px screen — the defect
              UI_PATTERNS § Responsive Contract closed for the app shell. */}
          <Link
            href="/"
            className="pub-focus pub-ink flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 no-underline"
          >
            <span
              aria-hidden
              className="pub-deep-bg pub-cream flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
            >
              L
            </span>
            <span className="pub-display truncate text-lg tracking-[-0.02em] sm:text-xl">
              Partner Marketplace
            </span>
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {HEADER_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="pub-focus pub-ink rounded-2xl border-2 border-transparent px-3.5 py-2.5 text-[0.9375rem] font-medium leading-none no-underline transition-colors duration-300 hover:border-[color:var(--public-ink)] hover:bg-[#fffdf9]"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <PublicButton href="/sign-in" variant="primary" size="sm" className="hidden sm:inline-flex">
              Partner sign in
            </PublicButton>

            {/* ≥36px touch target below `sm` — the kebab and pager were the two
                worst offenders in the app's responsive audit; not repeating it. */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="public-mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              className="pub-focus pub-ink flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[color:var(--public-ink)] lg:hidden"
            >
              {open ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav
            id="public-mobile-nav"
            aria-label="Main"
            className="border-t-2 border-[color:var(--public-bg-alt)] px-3 pb-3 pt-2 lg:hidden"
          >
            <ul className="flex flex-col gap-1">
              {HEADER_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="pub-focus pub-ink block min-h-11 rounded-xl px-3 py-3 text-base font-medium no-underline hover:bg-[#fffdf9]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="pt-1 sm:hidden">
                <PublicButton href="/sign-in" variant="primary" size="md" fullWidth>
                  Partner sign in
                </PublicButton>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
