"use client";

import React, { useState } from "react";

interface StatCardProps {
  title: string;
  value: string;
  icon: "briefcase" | "layers" | "help-circle" | "users" | "trending-up";
  trend?: "up" | "down" | "stable";
  color?: "blue" | "purple" | "amber" | "emerald" | "rose" | "slate";
  description?: string;
}

const iconMap = {
  briefcase: (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  layers: (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  "help-circle": (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  users: (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  "trending-up": (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
};

const colorRgb = {
  blue:    "59, 130, 246",
  purple:  "147, 51, 234",
  amber:   "217, 119, 6",
  emerald: "16, 185, 129",
  rose:    "244, 63, 94",
  slate:   "71, 85, 105",
};

const colorClasses = {
  blue:    "from-blue-500/10 to-blue-600/5 text-blue-600 border-blue-200 dark:from-blue-500/20 dark:to-blue-600/10 dark:text-blue-400 dark:border-blue-800",
  purple:  "from-purple-500/10 to-purple-600/5 text-purple-600 border-purple-200 dark:from-purple-500/20 dark:to-purple-600/10 dark:text-purple-400 dark:border-purple-800",
  amber:   "from-amber-500/10 to-amber-600/5 text-amber-600 border-amber-200 dark:from-amber-500/20 dark:to-amber-600/10 dark:text-amber-400 dark:border-amber-800",
  emerald: "from-emerald-500/10 to-emerald-600/5 text-emerald-600 border-emerald-200 dark:from-emerald-500/20 dark:to-emerald-600/10 dark:text-emerald-400 dark:border-emerald-800",
  rose:    "from-rose-500/10 to-rose-600/5 text-rose-600 border-rose-200 dark:from-rose-500/20 dark:to-rose-600/10 dark:text-rose-400 dark:border-rose-800",
  slate:   "from-slate-500/10 to-slate-600/5 text-slate-600 border-slate-200 dark:from-slate-500/20 dark:to-slate-600/10 dark:text-slate-400 dark:border-slate-700",
};

export default function StatCard({
  title,
  value,
  icon,
  trend = "stable",
  color = "blue",
  description,
}: StatCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const colorClass = colorClasses[color];
  const rgb = colorRgb[color];

  return (
    <div
      className={`group rounded-xl border bg-gradient-to-br p-6 transition-all duration-300 cursor-default overflow-hidden relative h-full ${colorClass} ${
        isHovered ? "shadow-lg" : "shadow-sm hover:shadow-md"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Dot-grid texture — light mode */}
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(${rgb}, 0.45) 1px, transparent 1px)`,
          backgroundSize: "18px 18px",
        }}
      />
      {/* Dot-grid texture — dark mode */}
      <div
        className="absolute inset-0 opacity-0 dark:opacity-[0.18] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(${rgb}, 0.7) 1px, transparent 1px)`,
          backgroundSize: "18px 18px",
        }}
      />
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%)" }}
      />

      <div className="relative z-10 flex flex-col h-full items-start justify-between">
        <div className="flex-1 w-full">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className={`mt-3 text-3xl sm:text-4xl font-bold transition-colors duration-300 ${
            isHovered ? "text-gray-950 dark:text-white" : "text-gray-900 dark:text-gray-100"
          }`}>
            {value}
          </p>
          {description && (
            <p className={`mt-3 text-xs leading-relaxed transition-colors duration-300 ${
              isHovered ? "text-gray-600 dark:text-gray-300" : "text-gray-500 dark:text-gray-400"
            }`}>
              {description}
            </p>
          )}
        </div>
        <div className={`flex-shrink-0 transition-all duration-300 mt-4 ${isHovered ? "opacity-100" : "opacity-70"}`}>
          {iconMap[icon]}
        </div>
      </div>

      {trend && trend !== "stable" && (
        <div className="mt-3 flex items-center gap-1.5 transition-colors duration-300 pt-4 border-t border-current border-opacity-10">
          <svg
            className={`h-4 w-4 transition-colors duration-300 ${trend === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path
              strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={trend === "up" ? "M7 16V4m0 0L3 8m0 0l4 4m10-4v12m0 0l4 4m0 0l-4-4" : "M7 8V4m0 0L3 8m0 0l4-4m10 4v12m0 0l4 4m0 0l-4-4"}
            />
          </svg>
          <span className={`text-xs font-semibold transition-colors duration-300 ${trend === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {trend === "up" ? "Ready to add" : "Needs attention"}
          </span>
        </div>
      )}
    </div>
  );
}
