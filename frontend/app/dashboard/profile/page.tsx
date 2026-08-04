import { redirect } from "next/navigation";

/**
 * Profile moved to `/settings/profile`. This redirect keeps old links working.
 *
 * It also fixes a real bug rather than only relocating a page: `SECTION_URLS`
 * mapped this path to the `profile` section, but profile only ever rendered as a
 * modal opened by `onNavigate`. Visiting this URL directly therefore matched no
 * render branch and painted an **empty white panel**. There is nothing left here to
 * render wrongly.
 */
export default function DashboardProfileRedirect() {
  redirect("/settings/profile");
}
