"use client";

import React from "react";

interface ActivityBadgeProps {
  status: "active" | "idle" | "offline";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const statusConfig = {
  active: {
    bg: "bg-emerald-500",
    animation: "animate-pulse-glow",
    label: "Active",
  },
  idle: {
    bg: "bg-amber-500",
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
        boxShadow: `0 0 0 2px rgba(${status === 'active' ? '16, 185, 129' : status === 'idle' ? '217, 119, 6' : '107, 114, 128'}, 0.1)`,
      }} />
    </div>
  );
}
