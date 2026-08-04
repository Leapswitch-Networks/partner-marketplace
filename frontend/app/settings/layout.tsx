import AuthInitializer from "@/components/common/AuthInitializer";
import AppShell from "@/components/common/AppShell";
import SettingsNav from "@/components/settings/SettingsNav";

/**
 * The settings area, at `/settings/*` to match LeapDesk.
 *
 * Deliberately a sibling of `/dashboard` rather than a child. LeapDesk's settings
 * routes live outside its dashboard, and in PM the practical reason is stronger:
 * `/dashboard/*` all render `DashboardClient`, which owns a section switch and the
 * inherited authoring state. Nesting settings inside it would mean adding settings
 * branches to that switch — the opposite of untangling it.
 *
 * Heading and description are LeapDesk's verbatim, since they are what the user
 * asked for by name.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthInitializer>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-950 texture-bg">
        <AppShell>
          <div className="mx-auto w-full max-w-5xl">
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Settings
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Manage your profile and account settings
              </p>
            </div>

            <div className="flex flex-col gap-4 md:flex-row">
              <div className="w-full flex-shrink-0 md:w-56">
                <div className="sticky top-2 rounded-2xl bg-white ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
                  <SettingsNav />
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-6">{children}</div>
            </div>
          </div>
        </AppShell>
      </div>
    </AuthInitializer>
  );
}
