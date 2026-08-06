"use client";

import React from "react";

interface StatCardProps {
  title: string;
  value: string;
  icon: "briefcase" | "layers" | "help-circle" | "users" | "trending-up";
  trend?: "up" | "down" | "stable";
  /**
   * Retained for call-site compatibility, but this is now a **two-tone** selector,
   * not a six-colour palette. Viho's stat cards alternate teal and tan; the
   * rainbow scheme this replaced (blue/purple/amber/emerald/rose/slate gradients
   * with matching borders) was the loudest thing on the dashboard and is exactly
   * the "two visual languages in one app" the design docs warn about.
   */
  color?: "blue" | "purple" | "amber" | "emerald" | "rose" | "slate";
  description?: string;
}

const iconMap = {
  briefcase: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  layers: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  "help-circle": (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  users: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  "trending-up": (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
};

/** Six legacy colour names collapse onto Viho's two categorical tones. */
const TONE: Record<NonNullable<StatCardProps["color"]>, "brand" | "accent"> = {
  blue: "brand",
  emerald: "brand",
  slate: "brand",
  purple: "accent",
  amber: "accent",
  rose: "accent",
};

const BADGE = {
  brand: "bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-on-dark",
  accent: "bg-accent/20 text-accent-dark dark:bg-accent/25 dark:text-accent-light",
} as const;

/** The oversized faint glyph Viho sits behind each stat card. */
const WATERMARK = {
  brand: "text-brand/[.04] dark:text-brand/[.07]",
  accent: "text-accent/[.06] dark:text-accent/[.09]",
} as const;

export default function StatCard({
  title,
  value,
  icon,
  trend = "stable",
  color = "blue",
  description,
}: StatCardProps) {
  const tone = TONE[color];

  return (
    <div className="group relative h-full overflow-hidden rounded-none border border-surface-border bg-white p-6 text-center transition-colors hover:border-brand/40 dark:border-night-border dark:bg-night-card">
      {/* Oversized watermark glyph, behind everything */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-8 -top-8 [&>svg]:h-28 [&>svg]:w-28 ${WATERMARK[tone]}`}
      >
        {iconMap[icon]}
      </span>

      <div className="relative z-10 flex h-full flex-col items-center">
        {/* Icon in a tinted circle — teal or tan, alternating */}
        <span className={`flex h-14 w-14 items-center justify-center rounded-full ${BADGE[tone]}`}>
          {iconMap[icon]}
        </span>

        <p className="mt-4 text-3xl font-bold text-ink dark:text-white sm:text-4xl">{value}</p>
        <p className="mt-1 text-sm font-medium text-ink-muted dark:text-night-muted">{title}</p>

        {description && (
          <p className="mt-2 text-xs leading-relaxed text-ink-muted dark:text-night-muted">
            {description}
          </p>
        )}

        {trend && trend !== "stable" && (
          <div className="mt-auto flex items-center gap-1.5 pt-4">
            <svg
              className={`h-4 w-4 ${trend === "up" ? "text-brand dark:text-brand-on-dark" : "text-tone-danger"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={trend === "up" ? "M7 16V4m0 0L3 8m0 0l4 4m10-4v12m0 0l4 4m0 0l-4-4" : "M7 8V4m0 0L3 8m0 0l4-4m10 4v12m0 0l4 4m0 0l-4-4"}
              />
            </svg>
            <span
              className={`text-xs font-semibold ${trend === "up" ? "text-brand dark:text-brand-on-dark" : "text-tone-danger"}`}
            >
              {trend === "up" ? "Ready to add" : "Needs attention"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
