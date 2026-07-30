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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 px-6 py-8 text-white sm:px-8 sm:py-10 shadow-lg">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-white blur-3xl" />
        <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-white blur-2xl" />
      </div>

      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium opacity-90">Dashboard</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              {greeting}, <span className="text-blue-100">{firstName}</span>! 👋
            </h2>
            <p className="mt-2 text-sm opacity-80 max-w-md">
              Create and manage your tests, add questions, and track candidate performance all in one place.
            </p>
          </div>

          <div className="flex gap-4 sm:flex-col">
            {memberSince && (
              <div className="flex items-center gap-2 rounded-lg bg-white/20 backdrop-blur px-3 py-2">
                <span className="text-xs font-semibold opacity-90">Member since</span>
                <span className="text-sm font-bold">{memberSince}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur px-3 py-1.5 text-xs font-medium">
            <span>✓</span>
            <span>All systems operational</span>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur px-3 py-1.5 text-xs font-medium">
            <span>⚡</span>
            <span>Ready to create tests</span>
          </div>
        </div>
      </div>
    </div>
  );
}
