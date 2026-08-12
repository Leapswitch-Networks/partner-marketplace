import SettingsNav from "@/components/settings/SettingsNav";

/**
 * The settings area, at `/settings/*` to match LeapDesk.
 *
 * Still a **sibling of `/dashboard`, not a child** — LeapDesk's settings routes live
 * outside its dashboard, and the URLs are unchanged. Both now sit inside the `(app)`
 * route group, which contributes nothing to the URL and exists only so the sidebar,
 * top bar and session check are mounted **once** above both areas.
 *
 * **This file no longer renders `AuthInitializer` or `AppShell`.** It used to, and so
 * did `/dashboard`'s layout — two sibling layouts each building their own copy of the
 * chrome. Moving between the two therefore unmounted one and mounted the other, which
 * blanked the sidebar and refetched `/navigation` on every crossing. `(app)/layout.tsx`
 * owns the chrome now; this file owns only what is specific to settings.
 *
 * One deliberate visual change: the outer wrapper previously carried
 * `bg-gray-100 texture-bg`. That element is entirely covered by `AppShell`'s `<main>`,
 * which sets its own `bg-surface-page`, so the texture was never visible — it is not
 * reinstated on the shared wrapper, where it *would* be visible and would apply to
 * `/dashboard` too.
 *
 * Heading and description are LeapDesk's verbatim, since they are what the user
 * asked for by name.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink dark:text-gray-100">Settings</h1>
        {/* `text-gray-500` measured 4.19:1 on the light wash — under the 4.5:1
            floor by a hair, which is exactly the kind of miss that reasoning
            about a palette produces and measuring catches. */}
        <p className="mt-1 text-sm text-ink-label dark:text-night-muted">
          Manage your profile and account settings
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="w-full flex-shrink-0 md:w-56">
          <div className="sticky top-2 rounded-none bg-white ring-1 ring-surface-border dark:bg-night-card dark:ring-night-border">
            <SettingsNav />
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-6">{children}</div>
      </div>
    </div>
  );
}
