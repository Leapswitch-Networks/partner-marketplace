"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import Badge from "@/components/common/Badge";
import FormModal from "@/components/common/FormModal";
import { navIcon } from "@/components/dashboard/navIcons";
import Button, { buttonClasses } from "@/components/common/Button";
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
import { extractApiError } from "@/lib/utils/apiError";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import type { ManagedUserDetail, UserStatus } from "@/types";

/**
 * The Users detail page — the third page of the Index / Form / Show contract,
 * and the first Show page in the project.
 *
 * It renders `GET /users/{id}`, which returns eleven more fields than the list
 * does. Those were previously unreachable: `adminApi.getUser` was typed as the
 * list item, so TypeScript did not know they existed.
 */

/** `Record<UserStatus, …>` is the point — losing a status here is a type error,
 *  not a blank badge. Two entries since 2026-08-11; see the `UserStatus` type. */
const STATUS_TONE: Record<UserStatus, { tone: "success" | "warning"; label: string }> = {
  ACTIVE: { tone: "success", label: "Active" },
  INACTIVE: { tone: "warning", label: "Inactive" },
};

export default function UserShow({
  userId,
  /** Renders the same content inside `FormModal` instead of the full page. */
  asModal = false,
  onClose,
  onEdit,
}: {
  userId: string;
  asModal?: boolean;
  onClose?: () => void;
  onEdit?: () => void;
}) {
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
      setError(extractApiError(err, "Could not load this user."));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // Handed to a callback rather than called in the body. `load` sets state,
    // and calling it directly here runs those updates inside the effect's own
    // synchronous phase — a second render pass for values React could have had
    // in the first, which is what `react-hooks/set-state-in-effect` is for. One
    // microtask's remove makes them ordinary updates, and nothing else changes:
    // the fetch still starts on mount and the retry path still calls `load`.
    void Promise.resolve().then(load);
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

  /** The cards, shared by the page and the modal. */
  const sections = (
    <>

            <InfoCard title="Account">
              <Field label="Full name" value={`${user.first_name} ${user.last_name}`.trim()} />
              <Field label="Email" value={user.email} />
              <Field
                label="Email verified"
                value={
                  user.email_verified_at ? (
                    formatDate(user.email_verified_at)
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
                  locked ? formatDateTime(user.locked_until) : null
                }
              />
              <Field
                label="Last sign-in"
                value={user.last_login_at ? formatDateTime(user.last_login_at) : null}
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
              </>
  );

  if (asModal) {
    return (
      <FormModal
        open
        onClose={() => onClose?.()}
        icon={navIcon("users")}
        title={user.full_name}
        subtitle={user.email}
        /*
          `xl`, not the default `lg`. This dialog carries four cards and
          nineteen fields against a body capped at 60vh, so at 672px it was
          mostly scrollbar. The wider cap only pays off together with the
          two-column grid below — on its own it would stretch every `Field` row,
          which is label-left/value-right, into a long gap with the two ends
          nowhere near each other.
        */
        size="xl"
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => onClose?.()}>
              Close
            </Button>
            {user.can_edit && onEdit && (
              <Button type="button" onClick={onEdit}>
                Edit User
              </Button>
            )}
          </>
        }
      >
        {/* Badges move into the body: the modal header already carries the name
            and email, and stacking a third row on it crowds the close button. */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge tone="neutral">{user.account_type === "staff" ? "Staff" : "Partner"}</Badge>
          {user.two_factor_enabled && <Badge tone="brand">2FA on</Badge>}
          {locked && <Badge tone="danger">Locked</Badge>}
        </div>
        {/*
          Two columns of cards once there is room for them, one below that.

          This is what turns the extra width into something useful: the cards
          stay about 470px — the width a label/value row reads well at — and the
          dialog gets *shorter* instead of wider, which is the actual complaint
          when a 19-field record is shown in a 60vh box.

          `items-start` is load-bearing. A grid item stretches to its row height
          by default, so the three-field Contact card would grow a tall empty
          tail to match the eight-field Account card beside it.

          The breakpoint is `md`, and it is tied to the width table in
          `FormModal`, not chosen for looks. A `Field` is label-left,
          value-right, so it reads well somewhere around 350-500px and badly
          outside that. Two columns hold the cards inside that band at every
          width from 768px up — 336px, then 412 / 476 / 540 as the dialog steps
          up. One column would put them at 688px and then 1104px, which is the
          stretched-apart look this change exists to avoid. Below 768px the
          screen is too narrow for two of anything and it collapses, which is
          also where a single card is finally the right width again.

          The page version keeps its own single-column `ShowPageMain`, which sits
          in a 2/3 column next to a sticky sidebar and is already the right width.
        */}
        <div className="grid items-start gap-4 md:grid-cols-2">{sections}</div>
      </FormModal>
    );
  }

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
            <Link href={`/dashboard/users/${user.id}/edit`} className={buttonClasses()}>
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
                    formatDate(user.email_verified_at)
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
                  locked ? formatDateTime(user.locked_until) : null
                }
              />
              <Field
                label="Last sign-in"
                value={user.last_login_at ? formatDateTime(user.last_login_at) : null}
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
