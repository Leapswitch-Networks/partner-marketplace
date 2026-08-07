"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import Badge from "@/components/common/Badge";
import ErrorState from "@/components/common/ErrorState";
import Skeleton from "@/components/common/Skeleton";
import {
  AuditCard,
  Field,
  InfoCard,
  ShowPageGrid,
  ShowPageHeader,
  ShowPageMain,
  ShowPageSidebar,
} from "@/components/common/ShowPage";
import { adminApi } from "@/lib/api/adminApi";
import usePermissions from "@/lib/hooks/usePermissions";
import type { ManagedUserDetail, UserStatus } from "@/types";

/**
 * The Users detail page — the third page of the Index / Form / Show contract,
 * and the first Show page in the project.
 *
 * It renders `GET /users/{id}`, which returns eleven more fields than the list
 * does. Those were previously unreachable: `adminApi.getUser` was typed as the
 * list item, so TypeScript did not know they existed.
 */

const STATUS_TONE: Record<UserStatus, { tone: "success" | "warning" | "danger"; label: string }> = {
  ACTIVE: { tone: "success", label: "Active" },
  INACTIVE: { tone: "warning", label: "Pending approval" },
  SUSPENDED: { tone: "danger", label: "Suspended" },
};

function apiMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  const detail = response?.data?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (!response) return "Network error — check your connection and try again.";
  return `${fallback} (${response.status ?? "unknown"})`;
}

export default function UserShow({ userId }: { userId: string }) {
  const { can } = usePermissions();
  const [user, setUser] = useState<ManagedUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getUser(userId);
      setUser(res.data);
    } catch (err) {
      setError(apiMessage(err, "Could not load this user."));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <ErrorState
        // `ErrorState` takes an Error because it also serves as the route-level
        // `error.tsx` boundary, which React hands one. Wrapping the message keeps
        // one error surface rather than inventing a second.
        error={new Error(error ?? "The user could not be found.")}
        reset={load}
        title="Could not load this user"
        description="The record may have been deleted, or you may not have permission to view it."
        compact
      />
    );
  }

  const status = STATUS_TONE[user.status];
  const locked = user.locked_until && new Date(user.locked_until) > new Date();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ShowPageHeader
        eyebrow="User"
        title={user.full_name}
        id={user.id}
        description={user.designation ?? undefined}
        badges={[
          { label: status.label, tone: status.tone },
          { label: user.account_type === "staff" ? "Staff" : "Partner", tone: "neutral" },
          ...(user.two_factor_enabled ? [{ label: "2FA on", tone: "brand" as const }] : []),
          // Only shown while the lockout is live. A stale "locked" badge on an
          // account that has since unlocked itself would send support down the
          // wrong path.
          ...(locked ? [{ label: "Locked", tone: "danger" as const }] : []),
        ]}
        backHref="/dashboard/users"
        backLabel="Back to Users"
        actions={
          user.can_edit ? (
            <Link
              href={`/dashboard/users/${user.id}/edit`}
              className="inline-flex h-9 items-center rounded-[5px] bg-brand px-7 text-xs font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Edit
            </Link>
          ) : undefined
        }
      />

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
        <ShowPageGrid>
          <ShowPageMain>
            <InfoCard title="Account">
              <Field label="Full name" value={`${user.first_name} ${user.last_name}`.trim()} />
              <Field label="Email" value={user.email} />
              <Field
                label="Email verified"
                value={
                  user.email_verified_at ? (
                    new Date(user.email_verified_at).toLocaleDateString(undefined, { dateStyle: "medium" })
                  ) : (
                    <Badge tone="warning">Not verified</Badge>
                  )
                }
              />
              <Field label="Account type" value={user.account_type === "staff" ? "Staff" : "Partner"} />
              <Field
                label="Sign-in method"
                value={user.auth_provider === "google" ? "Google" : "Password"}
              />
              <Field label="Company" value={user.company_name} />
              <Field label="Designation" value={user.designation} />
              <Field label="Employee ID" value={user.employee_id} />
            </InfoCard>

            <InfoCard title="Contact">
              <Field label="Personal email" value={user.personal_email} />
              <Field label="Mobile" value={user.personal_mobile_number} />
              <Field label="Timezone" value={user.timezone_preference} />
            </InfoCard>

            <InfoCard title="Roles">
              {user.roles.length === 0 ? (
                <Field label="Roles" value={null} />
              ) : (
                <div className="flex flex-wrap gap-1.5 py-2.5">
                  {user.roles.map((role) => (
                    <Badge key={role.id} tone="brand">
                      {role.display_name}
                    </Badge>
                  ))}
                </div>
              )}
            </InfoCard>
          </ShowPageMain>

          <ShowPageSidebar>
            <InfoCard title="Security">
              <Field
                label="Two-factor"
                value={
                  user.two_factor_enabled ? (
                    <Badge tone="success">Enabled</Badge>
                  ) : (
                    <Badge tone="neutral">Off</Badge>
                  )
                }
              />
              <Field label="Failed sign-ins" value={String(user.failed_login_attempts)} />
              <Field
                label="Locked until"
                value={
                  locked ? new Date(user.locked_until as string).toLocaleString() : null
                }
              />
              <Field
                label="Last sign-in"
                value={user.last_login_at ? new Date(user.last_login_at).toLocaleString() : null}
              />
              {/* Shown to anyone who can read the record, matching the API — it
                  is on UserDetailResponse, which is gated on `user-view`. */}
              <Field label="Last sign-in IP" value={user.last_login_ip} />
            </InfoCard>

            <AuditCard createdAt={user.created_at} updatedAt={user.updated_at} />

            {can("activity-view") && (
              <Link
                href={`/dashboard/activity?causer_id=${user.id}`}
                className="inline-flex items-center justify-center rounded-[5px] border border-brand/20 px-3 py-2 text-xs font-medium text-ink-label transition-colors hover:bg-brand/10 hover:text-brand dark:border-night-border dark:text-gray-400 dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
              >
                View this user&rsquo;s activity
              </Link>
            )}
          </ShowPageSidebar>
        </ShowPageGrid>
      </div>
    </div>
  );
}
