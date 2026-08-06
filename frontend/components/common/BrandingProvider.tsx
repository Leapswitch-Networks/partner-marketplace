"use client";

import { createContext, useContext } from "react";
import { FALLBACK_BRANDING, type Branding } from "@/lib/branding";

/**
 * Carries the server-resolved branding to the client components that render chrome.
 *
 * **Context rather than props**, because the consumers are deep: `Sidebar` and
 * `Navbar` sit inside `DashboardClient` inside the dashboard layout, and threading
 * `branding` through every intermediate component would put a prop on components
 * that have no interest in it.
 *
 * **No fetching happens here.** The value is resolved once, server-side, in the root
 * layout and passed in. That is what keeps this off PM-30's ledger: a
 * `useEffect`-fetching provider would add another `set-state-in-effect` error, and
 * more importantly would make branding arrive *after* first paint — a visible flash
 * of the fallback name on every page load.
 *
 * Defaulting to `FALLBACK_BRANDING` rather than `null` means a consumer rendered
 * outside the provider degrades to the build-time identity instead of crashing.
 */
const BrandingContext = createContext<Branding>(FALLBACK_BRANDING);

export default function BrandingProvider({
  branding,
  children,
}: {
  branding: Branding;
  children: React.ReactNode;
}) {
  return (
    <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>
  );
}

/** The project's identity. Safe in any client component under the root layout. */
export function useBranding(): Branding {
  return useContext(BrandingContext);
}
