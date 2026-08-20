import { Metadata } from "next";
import ProfileIdCard from "@/components/settings/ProfileIdCard";
import EditProfileForm from "@/components/settings/EditProfileForm";
import TwoFactorSettings from "@/components/auth/TwoFactorSettings";
import ThemePreference from "@/components/settings/ThemePreference";
import { getThemePresets } from "@/lib/branding";
import ActiveSessions from "@/components/auth/ActiveSessions";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Profile settings"),
  description: `Manage your profile on ${APP_NAME}`,
};

/**
 * Profile, at LeapDesk's URL.
 *
 * 2FA and active sessions stay on this page rather than becoming a fourth tab:
 * LeapDesk has its Two-Factor nav entry commented out, and PM's controls already
 * work here. Separated by a rule for the same reason the old modal did it — two
 * clicks to find 2FA is two chances to not bother.
 */
export default async function ProfileSettingsPage() {
  const { presets: themes } = await getThemePresets();

  return (
    <>
      <ProfileIdCard />
      <EditProfileForm />

      {/* A personal theme, beside the other personal preferences. NOT on Settings →
          Branding: that screen is installation-wide, super-admin, password-confirmed
          and audited, and its model docstring is explicit that it holds "what the
          application is, not what a user prefers". The catalogue is fetched here so
          the control needs no effect of its own. */}
      <div className="rounded-none bg-white p-6 ring-1 ring-surface-border dark:bg-night-card dark:ring-night-border">
        <ThemePreference themes={themes} />
      </div>

      {/* `id` is the target of the dashboard's two-factor prompt
          (`WelcomeBanner`), which links here rather than to a security page —
          there isn't one. `scroll-mt-6` keeps the panel clear of the sticky
          header when the browser jumps to it. */}
      <div
        id="two-factor"
        className="scroll-mt-6 rounded-none bg-white p-6 ring-1 ring-surface-border dark:bg-night-card dark:ring-night-border"
      >
        <TwoFactorSettings />
      </div>

      <div className="rounded-none bg-white p-6 ring-1 ring-surface-border dark:bg-night-card dark:ring-night-border">
        <ActiveSessions />
      </div>
    </>
  );
}
