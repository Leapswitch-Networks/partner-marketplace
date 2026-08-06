import { Metadata } from "next";
import AppearanceTabs from "@/components/settings/AppearanceTabs";

export const metadata: Metadata = {
  title: "Appearance settings — Partner Marketplace",
  description: "Choose how Partner Marketplace looks",
};

export default function AppearanceSettingsPage() {
  return (
    <div className="rounded-none bg-white p-6 ring-1 ring-surface-border dark:bg-night-card dark:ring-night-border">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
        Appearance settings
      </h3>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        Update your account&rsquo;s appearance settings.
      </p>
      <div className="mt-5">
        <AppearanceTabs />
      </div>
    </div>
  );
}
