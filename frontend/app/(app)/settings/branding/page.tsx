import { Metadata } from "next";
import BrandingForm from "@/components/settings/BrandingForm";
import { getBranding, getThemePresets } from "@/lib/branding";
import { APP_NAME, pageTitle } from "@/lib/utils/constants";

export const metadata: Metadata = {
  title: pageTitle("Branding"),
  description: `Change the name and identity of this ${APP_NAME} installation`,
};

/**
 * Installation branding.
 *
 * A server shell that resolves the current values and hands them to the client form
 * as a prop — the established server-shell/client-body pattern, and it means the
 * form renders populated on first paint with no fetch-on-mount.
 *
 * **This page is not a personal preference**, unlike its neighbours under
 * `/settings`. `profile`, `password` and `appearance` change a row about you; this
 * changes what every user of the installation sees. The heading says so, because the
 * URL does not.
 */
export default async function BrandingSettingsPage() {
  // Both resolved server-side and passed as props, so the form needs no
  // fetch-on-mount and renders populated on first paint.
  const [branding, themes] = await Promise.all([getBranding(), getThemePresets()]);

  return (
    <div className="rounded-none bg-white p-6 ring-1 ring-surface-border dark:bg-night-card dark:ring-night-border">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
        Branding
      </h3>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        The name and identity of this installation. These change what{" "}
        <strong className="font-semibold">every user</strong> sees, not just you.
      </p>
      <div className="mt-5">
        <BrandingForm initial={branding} themes={themes} />
      </div>
    </div>
  );
}
