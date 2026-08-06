// 8002, not 8000. The framework defaults (:3000 / :8000) are too often already
// taken, so this project runs the API on 8002 and the frontend on 3001 — see
// README § Quick Start. The fallback said 8000, which meant a developer with no
// NEXT_PUBLIC_API_URL set got connection-refused against a port nothing serves,
// and the symptom ("the app is broken") points nowhere near the cause.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

/**
 * Where **server-side** code reaches the API. Not the same address as the browser's.
 *
 * `API_BASE_URL` is a *browser* address: `NEXT_PUBLIC_*` values are inlined into the
 * client bundle, so it has to be resolvable from the user's machine. Inside the
 * frontend container `localhost:8002` is the frontend itself, and a server-side
 * fetch to it gets `ECONNREFUSED` — measured, and it failed **silently**, because
 * `getBranding` catches everything and falls back to the build-time defaults. The
 * symptom was branding that saved correctly and never appeared.
 *
 * Docker Compose resolves service names on its network, so the server address is
 * `http://backend:8002` — the backend listens on 8002 *inside* the container too
 * (`--port ${BACKEND_PORT:-8002}`), not on 8000.
 *
 * Falls back to `API_BASE_URL`, which is correct whenever the two are the same
 * address: running both on the host, or a same-origin deployment behind one proxy.
 * There is no `NEXT_PUBLIC_` prefix on purpose — this must never reach the browser.
 */
export const SERVER_API_BASE_URL = process.env.INTERNAL_API_URL ?? API_BASE_URL;

/**
 * The project's name, read at BUILD time.
 *
 * This is deliberately not fetched from `/api/settings/branding`, and the reason is
 * measured rather than stylistic. Page titles come from `export const metadata`,
 * which is a static export and cannot read an API. Converting the 16 metadata
 * blocks to `generateMetadata()` so they could would turn **15 prerendered routes
 * into server-rendered-on-demand ones** — a round trip per page view to render a
 * `<title>`. See `documentation/planning/DYNAMIC_BRANDING_PLAN.md` § 3.2.
 *
 * So document metadata is build-time, and the in-app chrome (sidebar, navbar, auth
 * screen) is runtime via the API. For a core reused across projects that is the
 * right split: a new project sets `NEXT_PUBLIC_APP_NAME` and rebuilds anyway.
 *
 * Keep this in sync with the backend's `APP_NAME`. They are separate variables
 * because they are read by separate processes at different times, not by accident.
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Partner Marketplace";

/** `"<page> — <app>"`, the established title shape. Used by every route's metadata. */
export const pageTitle = (page: string): string => `${page} — ${APP_NAME}`;

/**
 * One-line product description. Build-time, for the same reason as `APP_NAME`.
 *
 * Also the initial value the sign-in screen renders before the runtime branding
 * arrives, so it must be a sentence about *this* deployment — the previous literal
 * ("Partner marketplace platform") would describe the wrong product on any project
 * reusing this core, and it appears in search results and link previews.
 */
export const APP_TAGLINE =
  process.env.NEXT_PUBLIC_APP_TAGLINE ??
  "One place to manage partners, catalogue and quotes.";

/** Two-character badge beside the name. Build-time initial value; overridden at runtime. */
export const APP_MONOGRAM = process.env.NEXT_PUBLIC_APP_MONOGRAM ?? "P";

/** The small uppercase line under the name in the sidebar. */
export const APP_CHROME_SUBTITLE =
  process.env.NEXT_PUBLIC_APP_CHROME_SUBTITLE ?? "Admin Panel";

/** Shown where space is tight — the collapsed sidebar. */
export const APP_SHORT_NAME = process.env.NEXT_PUBLIC_APP_SHORT_NAME ?? "Partner MP";
