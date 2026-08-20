"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import useAppSelector from "@/lib/hooks/useAppSelector";
import SurfaceCard, { groundText } from "@/components/common/cards/SurfaceCard";

/**
 * The first thing every user sees after signing in.
 *
 * Rebuilt 2026-08-20. It is now a `SurfaceCard` on the `brand` ground, so the
 * greeting, the colour pairing and the hairlines come from the same place as every
 * other card rather than being hand-set here.
 *
 * ## What came out, and why
 *
 * **`✓ All systems operational` — removed.** It was a hard-coded string. It said
 * "operational" with nothing behind it, which means it would have said exactly that
 * with the database unreachable: a false assurance shown to every user on every
 * visit, which is worse than no indicator at all. A real one exists —
 * `healthApi.overview()` — but it returns table sizes and row counts, is an
 * administrator's diagnostic, and is not something to put behind every Partner's
 * dashboard to render a chip. **System Health is the page for that.**
 * `ANTI_SLOP.md` § 3: nothing on the page that is not backed by a live query.
 *
 * **`⚡ Partner Marketplace` — removed.** A chip naming the application, inside the
 * application, beneath a sidebar that names it and a browser tab that names it.
 *
 * **The three emoji — removed.** The public marketing surface uses none, and
 * `ANTI_SLOP.md` § 1 lists emoji-as-marker among the tells of generated design.
 *
 * **`backdrop-blur` ×3 — removed.** It was doing nothing: the parent is an opaque
 * fill, so there is no backdrop to blur. It cost a compositor layer per chip to
 * produce no pixels.
 *
 * **"Member since August 2026" — replaced.** It occupied the most prominent slot on
 * the page to tell people something they already know and can act on in no way.
 *
 * ## What went in
 *
 * Everything here is real, per-user, and already in the Redux store — **no extra
 * request.** The role says what you are; the last sign-in is the one fact that is
 * worth a second look, because if it was not you, that matters. The two-factor
 * prompt appears **only when 2FA is off**, so it is a task that disappears when
 * done rather than a decoration that never changes.
 *
 * The description is split on `has_admin_access`: the old copy promised "manage
 * users, roles and permissions" to every visitor, including Partners who can do
 * none of those things.
 */
export default function WelcomeBanner() {
  const user = useAppSelector((s) => s.auth.user);
  const t = groundText("brand");

  const displayName =
    "full_name" in (user ?? {})
      ? (user as { full_name: string }).full_name
      : (user as { name?: string } | null)?.name ?? "there";
  const firstName = displayName.split(" ")[0];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // `display_name`, falling back to `name`: `name` is the slug the RBAC layer keys
  // on ("super-admin"), and showing a person their own role as a slug is the sort
  // of leak that makes an interface feel like a database viewer.
  const role = user?.roles?.[0];
  const roleName = role ? role.display_name || role.name : null;
  const isAdmin = Boolean(user?.has_admin_access);
  const needsTwoFactor = user ? !user.two_factor_enabled : false;

  const lastLogin = user?.last_login_at
    ? new Date(user.last_login_at).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    // `texture-brand` is Viho's own faint geometric wash — flat fill, never a
    // gradient. The blue-to-cyan gradient this replaced in August was the single
    // most off-brand thing on the dashboard; do not reintroduce one.
    <SurfaceCard ground="brand" padding="lg" className="texture-brand">
      <div className="flex flex-col gap-7 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {/* The uppercase tracked eyebrow in the ground's emphasis colour — amber
              on a dark ground. The public surface opens a section exactly this way,
              and it was `text-sm font-medium text-white/80` here, which is the
              same treatment as body copy. */}
          <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${t.emphasis}`}>
            Dashboard
          </p>

          <h2 className={`app-display mt-2 text-[28px] leading-[1.1] tracking-[-0.02em] sm:text-[36px] ${t.body}`}>
            {greeting}, {firstName}
          </h2>

          <p className={`mt-2.5 max-w-md text-sm leading-relaxed ${t.muted}`}>
            {isAdmin
              ? "Users, roles and permissions, and a record of everything that has happened on the platform."
              : "Your organisation, your listings and the enquiries buyers have sent you."}
          </p>

          {needsTwoFactor && (
            /* A task, not a badge: it disappears the moment it is done. Bordered
               rather than filled — a solid amber panel here would outshout the
               heading, and amber may not carry text on a light ground anyway. */
            /* `/settings/profile`, NOT `/settings/security` — there is no security
               page. `TwoFactorSettings` is rendered on the profile page, and the
               only settings routes that exist are profile, password and appearance.
               Checked, because the obvious guess was wrong. */
            <Link
              href="/settings/profile#two-factor"
              className={`mt-5 inline-flex items-center gap-2 rounded-[5px] border border-white/35 px-3 py-1.5 text-xs font-semibold no-underline transition-colors hover:border-white/70 ${t.emphasis}`}
            >
              <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Two-factor authentication is off
            </Link>
          )}
        </div>

        {/* Facts, not chips. A definition list because that is what this is, and it
            gives each value a real label instead of an icon standing in for one. */}
        {(roleName || lastLogin) && (
          <dl className="flex shrink-0 gap-8 sm:flex-col sm:gap-4 sm:border-l sm:border-white/20 sm:pl-6">
            {roleName && (
              <div>
                <dt className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${t.muted}`}>
                  Signed in as
                </dt>
                <dd className={`mt-0.5 text-sm font-semibold ${t.body}`}>{roleName}</dd>
              </div>
            )}
            {lastLogin && (
              <div>
                <dt className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${t.muted}`}>
                  Previous sign-in
                </dt>
                <dd className={`mt-0.5 text-sm font-semibold tabular-nums ${t.body}`}>{lastLogin}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </SurfaceCard>
  );
}
