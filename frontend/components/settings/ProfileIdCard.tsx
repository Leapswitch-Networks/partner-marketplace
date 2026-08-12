"use client";

import useAppSelector from "@/lib/hooks/useAppSelector";
import { formatDate } from "@/lib/utils/format";

/**
 * The read-only identity card at the top of the profile page.
 *
 * Ports LeapDesk's `pages/settings/profile.tsx` header: initials avatar with a
 * status badge, name, designation, role badges, status pill, then a responsive
 * info grid. Every grid row is conditional on having a value, so an account with
 * no employee ID shows five fields rather than an empty labelled slot.
 */
export default function ProfileIdCard() {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return null;

  const isPartner = user.roles?.some((r) => r.name === "Partner") ?? false;
  const isActive = user.status === "ACTIVE";

  const infoItems: { label: string; value: string; mono: boolean }[] = [
    ...(user.employee_id
      ? [{ label: "Employee ID", value: user.employee_id, mono: true }]
      : []),
    { label: "Email", value: user.email, mono: false },
    ...(user.personal_email
      ? [{ label: "Personal Email", value: user.personal_email, mono: false }]
      : []),
    ...(user.personal_mobile_number
      ? [{ label: "Mobile", value: user.personal_mobile_number, mono: true }]
      : []),
    { label: "Member Since", value: formatDate(user.created_at), mono: false },
  ];

  return (
    <div className="overflow-hidden rounded-none bg-white ring-1 ring-surface-border dark:bg-night-card dark:ring-night-border">
      <div className="border-b border-surface-border px-6 py-6 dark:border-night-border">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 ring-2 ring-surface-border dark:bg-night-card dark:ring-night-border">
              <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {user.initials}
              </span>
            </div>
            {isActive && (
              <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-tone-success/100 dark:border-gray-900">
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
              {user.full_name}
            </h2>
            <p className="text-sm text-ink-label dark:text-night-muted">
              {user.designation || (isPartner ? "Partner" : "Employee")}
            </p>
            {user.roles?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {user.roles.map((role) => (
                  <span
                    key={role.id}
                    className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-surface-border dark:bg-night-card dark:text-gray-300 dark:ring-night-border"
                  >
                    {role.display_name || role.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                isActive
                  ? "bg-tone-success/10 text-tone-success dark:bg-tone-success/15 dark:text-brand-on-dark"
                  : "bg-tone-danger/10 text-tone-danger dark:bg-tone-danger/15 dark:text-tone-danger"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-tone-success/100" : "bg-tone-danger/100"}`} />
              {user.status}
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {infoItems.map((item) => (
            <div key={item.label} className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-label dark:text-night-muted">
                {item.label}
              </p>
              <p
                className={`break-all text-sm text-gray-900 dark:text-gray-100 ${
                  item.mono ? "font-mono font-medium" : ""
                }`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
