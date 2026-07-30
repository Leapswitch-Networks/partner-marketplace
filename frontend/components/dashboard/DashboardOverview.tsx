"use client";

import React, { useState, useEffect } from "react";
import StatCard from "./StatCard";
import QuickActionsCard from "./QuickActionsCard";
import type { AdminSection } from "@/components/dashboard/Sidebar";

export default function DashboardOverview({ onNavigate }: { onNavigate: (section: AdminSection) => void }) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className="w-full space-y-6">
      {/* Stats Grid */}
      <div
        className={`transition-all duration-500 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">Overview</h3>
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 auto-rows-max">
          {[
            {
              title: "Total Job Roles",
              value: "0",
              icon: "briefcase" as const,
              trend: "up" as const,
              color: "blue" as const,
              description: "Create your first role",
              delay: "delay-0",
            },
            {
              title: "Test Sections",
              value: "0",
              icon: "layers" as const,
              trend: "up" as const,
              color: "purple" as const,
              description: "Organize your tests",
              delay: "delay-75",
            },
            {
              title: "Questions",
              value: "0",
              icon: "help-circle" as const,
              trend: "up" as const,
              color: "amber" as const,
              description: "Add test questions",
              delay: "delay-150",
            },
            {
              title: "Candidates",
              value: "0",
              icon: "users" as const,
              trend: "stable" as const,
              color: "emerald" as const,
              description: "Browse candidates",
              delay: "delay-200",
            },
          ].map((stat, index) => (
            <div
              key={index}
              className={`transition-all duration-500 ${
                isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{
                transitionDelay: isLoaded ? `${index * 50}ms` : "0ms",
              }}
            >
              <StatCard
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                trend={stat.trend}
                color={stat.color}
                description={stat.description}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div
        className={`transition-all duration-500 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
        style={{
          transitionDelay: isLoaded ? "150ms" : "0ms",
        }}
      >
        <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">Quick Actions</h3>
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 auto-rows-max">
          {[
            {
              title: "Add Job Role",
              description: "Create a new job role for your test platform",
              icon: "briefcase" as const,
              color: "blue" as const,
              section: "add-job-role",
            },
            {
              title: "Add Test Section",
              description: "Organize tests into different sections",
              icon: "layers" as const,
              color: "purple" as const,
              section: "add-test-section",
            },
            {
              title: "Add Question",
              description: "Create MCQ, True/False, or descriptive questions",
              icon: "help-circle" as const,
              color: "amber" as const,
              section: "select-question-type",
            },
            {
              title: "Manage Users",
              description: "Add, edit, or view all system users",
              icon: "users" as const,
              color: "emerald" as const,
              section: "user-info",
            },
            {
              title: "View Candidates",
              description: "Track candidate test submissions and scores",
              icon: "trending-up" as const,
              color: "rose" as const,
              section: "candidate",
            },
            {
              title: "My Profile",
              description: "Update your account information",
              icon: "user" as const,
              color: "slate" as const,
              section: "profile",
            },
          ].map((action, index) => (
            <div
              key={index}
              className={`h-full transition-all duration-500 ${
                isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{
                transitionDelay: isLoaded ? `${200 + index * 50}ms` : "0ms",
              }}
            >
              <QuickActionsCard
                title={action.title}
                description={action.description}
                icon={action.icon}
                action={() => onNavigate(action.section as AdminSection)}
                color={action.color}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Getting Started Section */}
      <div
        className={`transition-all duration-500 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
        style={{
          transitionDelay: isLoaded ? "600ms" : "0ms",
        }}
      >
        <div className="w-full rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 p-6 sm:p-8 hover:shadow-md transition-shadow duration-300 group dark:border-blue-900 dark:from-blue-950/40 dark:to-blue-900/20">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-blue-900 dark:text-blue-300">Getting Started</h3>
              <p className="mt-2 text-sm text-blue-800 dark:text-blue-400">
                Follow these steps to set up your first test:
              </p>
              <ol className="mt-4 space-y-3 text-sm text-blue-800 dark:text-blue-400">
                {[
                  "Create a Job Role to define the position being tested",
                  "Add Test Sections to organize your questions",
                  "Add Questions (MCQ, True/False, or Descriptive)",
                  "Share tests with candidates and review submissions",
                ].map((step, idx) => (
                  <li
                    key={idx}
                    className="flex gap-3 transition-all duration-300 group-hover:translate-x-2"
                    style={{
                      transitionDelay: `${idx * 50}ms`,
                    }}
                  >
                    <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white ring-2 ring-blue-200 dark:ring-blue-800">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="hidden sm:flex items-center justify-center text-6xl opacity-20 flex-shrink-0 group-hover:opacity-30 transition-opacity duration-300">
              📋
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
