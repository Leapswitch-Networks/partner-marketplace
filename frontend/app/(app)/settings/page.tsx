import { redirect } from "next/navigation";

/**
 * `/settings` has no content of its own — it lands on Profile, matching LeapDesk's
 * `Route::redirect('settings', '/settings/profile')`.
 *
 * A server-side redirect rather than a client one, so the browser never paints a
 * blank settings shell before bouncing.
 */
export default function SettingsIndexPage() {
  redirect("/settings/profile");
}
