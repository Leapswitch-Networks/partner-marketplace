import { Metadata } from "next";
import ProfileIdCard from "@/components/settings/ProfileIdCard";
import EditProfileForm from "@/components/settings/EditProfileForm";
import TwoFactorSettings from "@/components/auth/TwoFactorSettings";
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
export default function ProfileSettingsPage() {
  return (
    <>
      <ProfileIdCard />
      <EditProfileForm />

      <div className="rounded-none bg-white p-6 ring-1 ring-surface-border dark:bg-night-card dark:ring-night-border">
        <TwoFactorSettings />
      </div>

      <div className="rounded-none bg-white p-6 ring-1 ring-surface-border dark:bg-night-card dark:ring-night-border">
        <ActiveSessions />
      </div>
    </>
  );
}
