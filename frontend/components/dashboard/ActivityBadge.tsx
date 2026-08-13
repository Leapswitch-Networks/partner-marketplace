"use client";

import React from "react";

interface ActivityBadgeProps {
  status: "active" | "idle" | "offline";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const statusConfig = {
  active: {
    bg: "bg-tone-success/100",
    animation: "animate-pulse-glow",
    label: "Active",
  },
  idle: {
    bg: "bg-tone-warning/150",
    animation: "animate-pulse",
    label: "Idle",
  },
  offline: {
    bg: "bg-gray-400",
    animation: "",
    label: "Offline",
  },
};

const sizeConfig = {
  sm: "h-2 w-2",
  md: "h-3 w-3",
  lg: "h-4 w-4",
};

export default function ActivityBadge({
  status,
  size = "md",
  className = "",
}: ActivityBadgeProps) {
  const config = statusConfig[status];
  const sizeClass = sizeConfig[size];

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className={`${sizeClass} ${config.bg} rounded-full ${config.animation}`}
      />
      <div className="absolute inset-0 rounded-full animate-pulse-ring" style={{
        // "Active" reads the live theme (it was frozen emerald — green under
        // every brand, caught by the 2026-08-13 leak sweep); idle/offline stay
        // semantic amber/grey like tone.warning and tone.danger do.
        boxShadow: `0 0 0 2px ${status === 'active' ? 'rgb(var(--tone-success) / 0.15)' : `rgba(${status === 'idle' ? '217, 119, 6' : '107, 114, 128'}, 0.1)`}`,
      }} />
    </div>
  );
}
