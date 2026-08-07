"use client";

import React from "react";

interface QuickActionsCardProps {
  title: string;
  description: string;
  icon: "briefcase" | "layers" | "help-circle" | "users" | "trending-up" | "user";
  action: () => void;
  color?: "blue" | "purple" | "amber" | "emerald" | "rose" | "slate";
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  user: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

/**
 * Six legacy colour names collapse onto Viho's two categorical tones. The prop is
 * kept so call sites keep working, but the rainbow scheme it used to drive
 * (blue/purple/amber/emerald/rose/slate tinted cards with matching borders,
 * dot-grid textures and shimmer sweeps) is gone. Viho's action cards are plain
 * white surfaces whose only colour is a tinted icon badge.
 */
const TONE: Record<NonNullable<QuickActionsCardProps["color"]>, "brand" | "accent"> = {
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

const LINK = {
  brand: "text-brand dark:text-brand-on-dark",
  accent: "text-accent-dark dark:text-accent-light",
} as const;

export default function QuickActionsCard({
  title,
  description,
  icon,
  action,
  color = "blue",
}: QuickActionsCardProps) {
  const tone = TONE[color];

  return (
    <button
      onClick={action}
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-none border border-surface-border bg-white p-6 text-left transition-colors hover:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ring-offset-surface-wash dark:ring-offset-night-card dark:border-night-border dark:bg-night-card"
    >
      <div className="relative z-10 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h4 className="font-bold text-ink dark:text-white">{title}</h4>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted dark:text-night-muted">
              {description}
            </p>
          </div>
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${BADGE[tone]}`}>
            {iconMap[icon]}
          </span>
        </div>

        <div className={`mt-auto inline-flex items-center gap-2 pt-4 text-sm font-medium ${LINK[tone]}`}>
          <span>Get Started</span>
          <svg
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}
