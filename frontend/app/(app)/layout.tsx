import AuthInitializer from "@/components/common/AuthInitializer";
import AppShell from "@/components/common/AppShell";

/**
 * The signed-in chrome, mounted **once** for every authenticated area.
 *
 * `(app)` is a route group, so it contributes **nothing to the URL** — the routes
 * beneath it are still `/dashboard/*` and `/settings/*`. Its only job is to be a
 * common ancestor layout, which is what makes the chrome persist.
 *
 * ## Why this exists
 *
 * `/dashboard` and `/settings` each had their own `layout.tsx`, and each rendered its
 * own `AuthInitializer` + `AppShell`. They were **siblings**, so their nearest common
 * ancestor was the root layout — which means moving between the two areas unmounted
 * one entire subtree and mounted the other. Clicking a sidebar item inside `/dashboard`
 * swapped only the panel, but clicking *Branding* tore down and rebuilt the sidebar,
 * the top bar and the session check.
 *
 * It read as a full page reload and it was not one: every navigation goes through
 * `router.push`, and there is no `window.location` call in the sidebar path. The
 * visible flash came from `useNavigation`, which starts at `sections: []` and fetches
 * in an effect — so a remounted sidebar renders **empty**, then refills. Plus a
 * redundant `/navigation` request on every crossing.
 *
 * This is the same defect that was fixed *within* `/dashboard` on 2026-08-06 by
 * deleting `DashboardClient` and hoisting the shell into the layout. That fix stopped
 * at the segment boundary; this one covers both areas, which is where it should have
 * been in the first place.
 *
 * ## Consequences worth knowing
 *
 * `AppShell` takes no `activeSection` here. It cannot: one layout serves both areas
 * and does not know which child is about to render, so the highlight is derived from
 * the pathname inside `AppShell` itself — the same reason `FULL_HEIGHT_ROUTES` is
 * keyed on pathname there.
 *
 * A page that must NOT have this chrome — sign-in, sign-up, the error pages — belongs
 * outside this group. `(auth)` is the existing example.
 */
export default function AppAreaLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthInitializer>
      {/* h-dvh, not h-screen: 100vh on mobile is the LARGE viewport (URL bar
          hidden), so the app's bottom edge — carrying every table's pager —
          sat below the visible screen while the bar showed. dvh tracks the
          real visible height (2026-08-13 responsive audit). */}
      <div className="flex h-dvh bg-surface-wash dark:bg-night-body">
        <AppShell>{children}</AppShell>
      </div>
    </AuthInitializer>
  );
}
