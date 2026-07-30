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

const colorConfig = {
  blue:    { bg: "bg-blue-50 dark:bg-blue-950/30",    border: "border-blue-200 dark:border-blue-800",    text: "text-blue-600 dark:text-blue-400",    hover: "hover:border-blue-300 hover:shadow-blue-100 dark:hover:border-blue-700",    rgb: "59, 130, 246" },
  purple:  { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", text: "text-purple-600 dark:text-purple-400", hover: "hover:border-purple-300 hover:shadow-purple-100 dark:hover:border-purple-700", rgb: "147, 51, 234" },
  amber:   { bg: "bg-amber-50 dark:bg-amber-950/30",   border: "border-amber-200 dark:border-amber-800",   text: "text-amber-600 dark:text-amber-400",   hover: "hover:border-amber-300 hover:shadow-amber-100 dark:hover:border-amber-700",   rgb: "217, 119, 6" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-600 dark:text-emerald-400", hover: "hover:border-emerald-300 hover:shadow-emerald-100 dark:hover:border-emerald-700", rgb: "16, 185, 129" },
  rose:    { bg: "bg-rose-50 dark:bg-rose-950/30",    border: "border-rose-200 dark:border-rose-800",    text: "text-rose-600 dark:text-rose-400",    hover: "hover:border-rose-300 hover:shadow-rose-100 dark:hover:border-rose-700",    rgb: "244, 63, 94" },
  slate:   { bg: "bg-slate-50 dark:bg-slate-800/40",  border: "border-slate-200 dark:border-slate-700",  text: "text-slate-600 dark:text-slate-400",  hover: "hover:border-slate-300 hover:shadow-slate-100 dark:hover:border-slate-600",  rgb: "71, 85, 105" },
};

export default function QuickActionsCard({
  title,
  description,
  icon,
  action,
  color = "blue",
}: QuickActionsCardProps) {
  const config = colorConfig[color];

  return (
    <button
      onClick={action}
      className={`group relative flex h-full w-full flex-col overflow-hidden rounded-xl border p-6 text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer ${config.bg} ${config.border} ${config.hover}`}
    >
      {/* Dot-grid texture — light mode */}
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(${config.rgb}, 0.45) 1px, transparent 1px)`,
          backgroundSize: "18px 18px",
        }}
      />
      {/* Dot-grid texture — dark mode */}
      <div
        className="absolute inset-0 opacity-0 dark:opacity-[0.18] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(${config.rgb}, 0.7) 1px, transparent 1px)`,
          backgroundSize: "18px 18px",
        }}
      />
      <div
        className="absolute inset-0 transition-all duration-300 opacity-0 group-hover:opacity-10"
        style={{ backgroundImage: `linear-gradient(135deg, rgba(${config.rgb}, 0.3), rgba(${config.rgb}, 0.05))` }}
      />
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)", animation: "shimmer 2s infinite" }}
      />

      <div className="relative z-10 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h4 className="font-bold text-gray-900 group-hover:text-gray-800 transition-colors duration-300 dark:text-gray-100 dark:group-hover:text-white">
              {title}
            </h4>
            <p className="mt-1 text-sm text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors duration-300 dark:text-gray-400 dark:group-hover:text-gray-300">
              {description}
            </p>
          </div>
          <div
            className={`flex-shrink-0 rounded-lg p-2.5 transition-all duration-300 group-hover:opacity-90 ${config.text}`}
            style={{ backgroundColor: `rgba(${config.rgb}, 0.1)` }}
          >
            {iconMap[icon]}
          </div>
        </div>

        <div className={`mt-auto pt-4 inline-flex items-center gap-2 text-sm font-medium ${config.text} group-hover:text-gray-900 transition-all duration-300 dark:group-hover:text-gray-100`}>
          <span>Get Started</span>
          <svg className="h-4 w-4 transition-all duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}
