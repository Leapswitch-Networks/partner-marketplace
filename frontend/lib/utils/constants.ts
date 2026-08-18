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
 * The API's contract version. Must match the backend's `settings.API_PREFIX`.
 *
 * Carried in `axiosInstance`'s `baseURL`, so the 60-odd paths in `lib/api/*` are
 * written **relative to the version** — `"/auth/login"`, not `"/api/v1/auth/login"`.
 * One constant to change for a v2 instead of 60 string edits, which is the whole point
 * of PM-40.
 *
 * ⚠️ **This does not apply to the Next app's own route handlers.** `/api/revalidate-branding`
 * is served by this application, not by the backend, and is called with a bare `fetch`
 * on a relative path. Prefixing it would break it.
 */
export const API_PREFIX = "/api/v1";

/** Absolute versioned API root, for server-side `fetch` where axios is not involved. */
export const SERVER_API_URL = `${SERVER_API_BASE_URL}${API_PREFIX}`;

/**
 * The project's name, read at BUILD time.
 *
 * This is deliberately not fetched from the branding endpoint, and the reason is
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

/**
 * Bundled default logo, served from `public/`. Build-time, like the other identity
 * constants.
 *
 * Gives a three-step fallback in `BrandMark`: an uploaded logo, else this file, else
 * the monogram. The monogram stays the last resort rather than the only one, so a
 * fresh install looks like a product instead of a placeholder — but a project reusing
 * this core can set `NEXT_PUBLIC_APP_LOGO=""` and get the letter back.
 *
 * `public/logo.svg` is the master artwork from `logo/logo-master.svg`. It is served as
 * a static file by Next, NOT through the API's asset route, so it needs none of the
 * SVG upload validation — nobody can replace it without a deploy.
 */
export const APP_LOGO = process.env.NEXT_PUBLIC_APP_LOGO ?? "/logo.svg";

/**
 * The public site's absolute origin — used by `app/sitemap.ts` and
 * `app/robots.ts`, both of which must emit absolute URLs.
 *
 * Build-time, like `APP_NAME`, and for the same reason: a sitemap is generated
 * at build and a second installation sets its own value and rebuilds anyway.
 *
 * ⚠️ The fallback is the dev origin on purpose. A wrong absolute URL in a
 * sitemap is worse than an obviously-local one — `http://localhost:3001` is
 * visibly broken the moment anyone looks, whereas a plausible-but-wrong domain
 * gets shipped and silently indexes nothing.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"
).replace(/\/$/, "");
