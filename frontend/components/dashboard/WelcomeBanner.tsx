"use client";

import useAppSelector from "@/lib/hooks/useAppSelector";

export default function WelcomeBanner() {
  const user = useAppSelector((s) => s.auth.user);
  const displayName = "full_name" in (user ?? {}) ? (user as { full_name: string }).full_name : (user as { name?: string } | null)?.name ?? "Admin";
  const firstName = displayName.split(" ")[0];
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";

  return (
    // Viho's welcome banner is a FLAT full-bleed brand fill with a faint geometric
    // texture — not a gradient. The blue→cyan gradient this replaced was the single
    // most off-brand thing on the dashboard. Squared to match every other surface.
    <div className="texture-brand relative overflow-hidden rounded-none bg-brand px-6 py-8 text-white sm:px-8 sm:py-10">
      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-white/80">Dashboard</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              {greeting}, {firstName}! 👋
            </h2>
            <p className="mt-2 max-w-md text-sm text-white/80">
              Manage users, roles and permissions, and keep an eye on what is happening across the platform.
            </p>
          </div>

          <div className="flex gap-4 sm:flex-col">
            {memberSince && (
              <div className="flex items-center gap-2 rounded-[5px] bg-white/15 px-3 py-2 backdrop-blur">
                <span className="text-xs font-semibold text-white/80">Member since</span>
                <span className="text-sm font-bold">{memberSince}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur">
            <span>✓</span>
            <span>All systems operational</span>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur">
            <span>⚡</span>
            <span>Partner Marketplace</span>
          </div>
        </div>
      </div>
    </div>
  );
}
