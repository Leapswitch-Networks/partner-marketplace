"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import Badge, { type BadgeTone } from "@/components/common/Badge";

/**
 * Detail-page primitives — the third page of the Index / Form / Show contract.
 *
 * ```tsx
 * <ShowPageHeader
 *   eyebrow="User"
 *   title={user.full_name}
 *   id={user.id}
 *   badges={[{ label: "Active", tone: "success" }]}
 *   backHref="/dashboard/users"
 *   backLabel="Back to Users"
 *   actions={<Button href={`/dashboard/users/${user.id}/edit`}>Edit</Button>}
 * />
 * <ShowPageGrid>
 *   <ShowPageMain>
 *     <InfoCard title="Account">
 *       <Field label="Email" value={user.email} />
 *     </InfoCard>
 *   </ShowPageMain>
 *   <ShowPageSidebar>
 *     <AuditCard createdAt={user.created_at} updatedAt={user.updated_at} />
 *   </ShowPageSidebar>
 * </ShowPageGrid>
 * ```
 *
 * Ported in **shape** from the reference implementation's `show-page.tsx`, not in
 * code. Its version hardcodes a seven-tone palette of emerald/rose/amber/violet
 * classes, which is precisely the pattern the Viho migration removed from 242
 * call sites across this project. Tones here delegate to `Badge`, so a rebrand
 * touches one file rather than every detail page.
 *
 * Surfaces are `surface-wash` to match the rest of the signed-in chrome, with
 * `border-brand/20` hairlines — on a green background `surface-border` measures
 * 1.02:1 and is invisible. See `UI_PATTERNS.md` § The Signed-In Chrome Is Green.
 */

// ── Header ───────────────────────────────────────────────────────────────────

export interface ShowPageBadge {
  label: ReactNode;
  tone?: BadgeTone;
}

export function ShowPageHeader({
  eyebrow,
  title,
  id,
  description,
  badges,
  backHref,
  backLabel,
  actions,
}: {
  /** Small label above the title — the resource's singular name. */
  eyebrow?: string;
  title: ReactNode;
  /** Rendered beside the eyebrow. A UUID is truncated; it is for support, not reading. */
  id?: string | number;
  description?: ReactNode;
  badges?: ShowPageBadge[];
  backHref?: string;
  backLabel?: string;
  /** Right-aligned, normally the Edit button. Gate it on the permission. */
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 shrink-0">
      {backHref && (
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1 text-[11px] font-medium text-ink-label transition-colors hover:text-brand dark:text-night-muted dark:hover:text-brand-on-dark"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {backLabel ?? "Back"}
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {(eyebrow || id !== undefined) && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand dark:text-brand-on-dark">
              {eyebrow}
              {id !== undefined && (
                <span className="ml-2 font-mono normal-case tracking-normal text-ink-label dark:text-night-muted">
                  #{String(id).length > 12 ? `${String(id).slice(0, 8)}…` : id}
                </span>
              )}
            </p>
          )}

          <h1 className="mt-0.5 truncate text-lg font-bold text-ink dark:text-white">{title}</h1>

          {description && (
            <p className="mt-0.5 text-[11px] text-ink-label dark:text-night-muted">{description}</p>
          )}

          {badges && badges.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {badges.map((badge, i) => (
                <Badge key={i} tone={badge.tone ?? "neutral"}>
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// ── Layout ───────────────────────────────────────────────────────────────────

/**
 * Two columns on large screens, one below.
 *
 * The sidebar is `lg:w-80` rather than a fraction: metadata is short and
 * predictable, so a percentage makes it grow with the viewport for no reason.
 */
export function ShowPageGrid({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">{children}</div>;
}

export function ShowPageMain({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>;
}

export function ShowPageSidebar({ children }: { children: ReactNode }) {
  return <div className="flex w-full shrink-0 flex-col gap-4 lg:w-80">{children}</div>;
}

// ── Cards ────────────────────────────────────────────────────────────────────

export function InfoCard({
  title,
  icon,
  actions,
  children,
}: {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-none border border-brand/20 bg-surface-wash dark:border-night-border dark:bg-night-card">
      <div className="flex items-center justify-between gap-3 border-b border-brand/20 px-4 py-3 dark:border-night-border sm:px-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink dark:text-white">
          {icon}
          {title}
        </h2>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <dl className="divide-y divide-brand/20 px-4 dark:divide-night-border sm:px-5">{children}</dl>
    </section>
  );
}

/** Metadata card — same surface, no heading. For short supporting facts. */
export function MetaCard({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-none border border-brand/20 bg-surface-wash dark:border-night-border dark:bg-night-card">
      <dl className="divide-y divide-brand/20 px-4 dark:divide-night-border sm:px-5">{children}</dl>
    </section>
  );
}

/**
 * One label/value row.
 *
 * An empty value renders an em dash rather than collapsing, so the row count
 * stays stable and a missing value is visibly missing rather than absent.
 */
export function Field({
  label,
  value,
  full,
}: {
  label: string;
  value: ReactNode;
  /** Stack label above value — for long text like a note or an address. */
  full?: boolean;
}) {
  const empty = value === null || value === undefined || value === "";

  return (
    <div
      className={
        full
          ? "py-2.5"
          : "flex flex-wrap items-baseline justify-between gap-2 py-2.5"
      }
    >
      <dt className="text-[11px] font-medium text-ink-label dark:text-night-muted">{label}</dt>
      <dd
        className={`text-xs text-ink dark:text-gray-200 ${full ? "mt-1" : "text-right"} ${
          empty ? "text-ink-label dark:text-night-muted" : ""
        }`}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

/**
 * Created/updated timestamps.
 *
 * Absolute, not relative. "3 months ago" is friendlier and useless when someone
 * is reconciling a detail page against an audit-log entry, which is what this
 * card is usually open for.
 */
export function AuditCard({
  createdAt,
  updatedAt,
  extra,
}: {
  createdAt?: string | null;
  updatedAt?: string | null;
  extra?: ReactNode;
}) {
  const format = (value?: string | null) =>
    value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

  return (
    <MetaCard>
      <Field label="Created" value={format(createdAt)} />
      <Field label="Last updated" value={format(updatedAt)} />
      {extra}
    </MetaCard>
  );
}
