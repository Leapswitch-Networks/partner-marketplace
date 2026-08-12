"use client";

import React, { useEffect, useState } from "react";
import useHydrated from "@/lib/hooks/useHydrated";
import StatCard from "./StatCard";
import QuickActionsCard from "./QuickActionsCard";
import usePermissions from "@/lib/hooks/usePermissions";
import { adminApi } from "@/lib/api/adminApi";
import { roleApi, permissionApi, activityApi } from "@/lib/api/rbacApi";
import type { AdminSection } from "@/components/dashboard/Sidebar";

/**
 * The dashboard landing view.
 *
 * Rewritten 2026-08-06 when the inherited test-platform domain was deleted. It
 * used to show Total Job Roles / Test Sections / Questions / Candidates and
 * offer Add Job Role, Add Test Section, Add Question and View Candidates — every
 * one of which pointed at a module that no longer exists.
 *
 * **The old figures were all hardcoded `"0"`.** Nothing was ever fetched, so the
 * dashboard had been reporting four fake zeros. These are real counts.
 */

interface Counts {
  users: number | null;
  roles: number | null;
  permissions: number | null;
  activity: number | null;
}

export default function DashboardOverview({
  onNavigate,
}: {
  onNavigate: (section: AdminSection) => void;
}) {
  const { can } = usePermissions();
  // Drives the entry animation: false on the server and the first render, true
  // once hydrated. Was a `useState` flipped in an effect, which is a whole extra
  // render pass to answer a question `useSyncExternalStore` answers in the first.
  const isLoaded = useHydrated();
  const [counts, setCounts] = useState<Counts>({
    users: null,
    roles: null,
    permissions: null,
    activity: null,
  });



  useEffect(() => {
    let cancelled = false;

    // Each count is fetched independently and failures are swallowed to `null`,
    // which renders as "—". One endpoint the user lacks permission for must not
    // blank the whole panel — a 403 on roles is expected for a Partner.
    const load = async () => {
      const [users, roles, permissions, activity] = await Promise.allSettled([
        adminApi.listUsers({ per_page: 1 }),
        roleApi.list(),
        permissionApi.list(),
        activityApi.list({ per_page: 1 }),
      ]);
      if (cancelled) return;

      setCounts({
        users: users.status === "fulfilled" ? users.value.data.total ?? null : null,
        roles: roles.status === "fulfilled" ? roles.value.data.length : null,
        permissions:
          permissions.status === "fulfilled"
            ? permissions.value.data.reduce((n: number, g) => n + (g.permissions?.length ?? 0), 0)
            : null,
        activity: activity.status === "fulfilled" ? activity.value.data.total ?? null : null,
      });
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const fmt = (n: number | null) => (n === null ? "—" : String(n));

  const stats = [
    {
      title: "Users",
      value: fmt(counts.users),
      icon: "users" as const,
      color: "blue" as const,
      description: "Accounts on the platform",
    },
    {
      title: "Roles",
      value: fmt(counts.roles),
      icon: "briefcase" as const,
      color: "purple" as const,
      description: "Role definitions",
    },
    {
      title: "Permissions",
      value: fmt(counts.permissions),
      icon: "layers" as const,
      color: "emerald" as const,
      description: "Grants in the catalogue",
    },
    {
      title: "Activity",
      value: fmt(counts.activity),
      icon: "trending-up" as const,
      color: "amber" as const,
      description: "Recorded actions",
    },
  ];

  // Each action declares the permission its target needs, and is dropped when the
  // user lacks it — offering a card that 403s on click is worse than not offering
  // it. `null` means everyone (own profile).
  const actions: {
    title: string;
    description: string;
    icon: "users" | "briefcase" | "layers" | "trending-up" | "user";
    section: AdminSection;
    permission: string | null;
    color: "blue" | "purple" | "amber" | "emerald" | "rose" | "slate";
  }[] = [
    {
      title: "Manage Users",
      description: "Add, edit, approve or deactivate accounts",
      icon: "users",
      section: "user-info",
      permission: "user-view",
      color: "blue",
    },
    {
      title: "Add User",
      description: "Create an account or send an invitation",
      icon: "user",
      section: "user-add",
      permission: "user-create",
      color: "purple",
    },
    {
      title: "Roles & Permissions",
      description: "Decide what each role is allowed to do",
      icon: "briefcase",
      section: "roles",
      permission: "role-view",
      color: "emerald",
    },
    {
      title: "Activity Log",
      description: "Review what happened and who did it",
      icon: "trending-up",
      section: "activity",
      permission: "activity-view",
      color: "amber",
    },
    {
      title: "My Profile",
      description: "Update your account information",
      icon: "user",
      section: "profile",
      permission: null,
      color: "slate",
    },
  ];

  const visibleActions = actions.filter((a) => a.permission === null || can(a.permission));

  return (
    <div className="w-full space-y-6">
      <div
        className={`transition-all duration-500 ${
          isLoaded ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <h3 className="mb-4 text-lg font-bold text-ink dark:text-white">Overview</h3>
        <div className="grid w-full auto-rows-max grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={stat.title}
              className={`transition-all duration-500 ${
                isLoaded ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
              style={{ transitionDelay: isLoaded ? `${index * 50}ms` : "0ms" }}
            >
              <StatCard
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                color={stat.color}
                description={stat.description}
              />
            </div>
          ))}
        </div>
      </div>

      {visibleActions.length > 0 && (
        <div
          className={`transition-all duration-500 ${
            isLoaded ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
          style={{ transitionDelay: isLoaded ? "150ms" : "0ms" }}
        >
          <h3 className="mb-4 text-lg font-bold text-ink dark:text-white">Quick Actions</h3>
          <div className="grid w-full auto-rows-max grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleActions.map((action, index) => (
              <div
                key={action.title}
                className={`transition-all duration-500 ${
                  isLoaded ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
                style={{ transitionDelay: isLoaded ? `${200 + index * 50}ms` : "0ms" }}
              >
                <QuickActionsCard
                  title={action.title}
                  description={action.description}
                  icon={action.icon}
                  color={action.color}
                  action={() => onNavigate(action.section)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
