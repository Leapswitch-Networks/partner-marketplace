import { Metadata } from "next";
import AppearanceTabs from "@/components/settings/AppearanceTabs";

export const metadata: Metadata = {
  title: "Appearance settings — Partner Marketplace",
  description: "Choose how Partner Marketplace looks",
};

export default function AppearanceSettingsPage() {
  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
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
