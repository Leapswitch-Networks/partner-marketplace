"use client";

import Link from "next/link";
import useAppSelector from "@/lib/hooks/useAppSelector";

/**
 * The sidebar's user profile block — Viho's, between the logo and the nav.
 *
 * Anatomy from `dashboard-default-light-top.png` and `dashboard-default-dark.png`:
 * a circular avatar inside a tinted ring, a small solid pill overlapping its
 * bottom edge, the name in **brand colour**, a muted secondary line, and a
 * three-up stat row separated by hairline vertical rules — with a gear button
 * floated top-right.
 *
 * **The three stats carry real data.** Viho's are `19.8k Follow`, `2 year
 * Experience`, `95.2k Follower`, which mean nothing here and which we have no
 * source for. Inventing numbers to fill the shape would be worse than empty, so
 * the slots show the user's role, the year they joined, and their status. Same
 * composition, true figures.
 *
 * Likewise the pill: Viho's says "New" decoratively; ours shows account status,
 * which is information the user actually benefits from seeing.
 */
export default function SidebarProfile({ collapsed = false }: { collapsed?: boolean }) {
  const user = useAppSelector((s) => s.auth.user);
  if (!user || collapsed) return null;

  const roleName = user.roles?.[0]?.display_name ?? user.roles?.[0]?.name ?? "—";
  const joinedYear = user.created_at ? new Date(user.created_at).getFullYear().toString() : "—";
  const status = user.status ? user.status.charAt(0) + user.status.slice(1).toLowerCase() : "—";

  const stats: { value: string; label: string }[] = [
    { value: roleName, label: "Role" },
    { value: joinedYear, label: "Joined" },
    { value: status, label: "Status" },
  ];

  return (
    <div className="relative border-b border-surface-border px-4 pb-5 pt-6 text-center dark:border-night-border">
      <Link
        href="/settings/profile"
        title="Profile settings"
        aria-label="Profile settings"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand transition-colors hover:bg-brand hover:text-white focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 dark:bg-brand/20 dark:text-brand-on-dark"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </Link>

      {/* Avatar in a tinted ring, with the status pill overlapping its base */}
      <div className="relative mx-auto mb-3 h-[84px] w-[84px]">
        <span className="absolute inset-0 rounded-full bg-brand/10 dark:bg-brand/20" />
        <span className="absolute inset-[7px] flex items-center justify-center rounded-full bg-brand text-xl font-bold text-white">
          {user.initials || user.first_name?.[0] || "?"}
        </span>
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-[5px] bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {status}
        </span>
      </div>

      <p className="truncate text-base font-bold text-brand dark:text-brand-on-dark">
        {user.full_name || `${user.first_name} ${user.last_name}`.trim()}
      </p>
      <p className="mt-0.5 truncate text-xs text-ink-muted dark:text-night-muted">
        {user.designation || user.company_name || user.email}
      </p>

      <div className="mt-4 flex items-start justify-center">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`min-w-0 flex-1 px-1 ${
              i > 0 ? "border-l border-surface-border dark:border-night-border" : ""
            }`}
          >
            <p className="truncate text-[13px] font-bold text-ink dark:text-white">{s.value}</p>
            <p className="truncate text-[11px] text-ink-muted dark:text-night-muted">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
