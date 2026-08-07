import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/admin", "/dashboard", "/settings"];

/**
 * Edge route protection — decides whether to render the app or the sign-in screen.
 *
 * ## What this is NOT
 *
 * **It is not an authorization control.** It never reads a token's contents and never
 * asks the API anything. Every protected route is independently enforced by the
 * backend's guards, which resolve the access token and re-check the session row on
 * every request. This only avoids serving an app shell to somebody who is plainly not
 * signed in.
 *
 * ## The bug this used to have, which cost real users their sessions
 *
 * It checked `access_token` alone:
 *
 * ```ts
 * if (isProtected && !accessToken) redirect("/sign-in");   // ← wrong
 * ```
 *
 * `access_token` carries `Max-Age=3600`, so **the browser deletes it after an hour.**
 * The refresh token lives for seven days — but it is deliberately path-scoped to
 * `/api/v1/auth/refresh`, so a page request never carries it and this middleware could
 * not see it.
 *
 * So an hour after signing in, opening any page redirected to /sign-in **before any
 * JavaScript ran**, and the axios interceptor that would have refreshed the session
 * transparently never got the chance. The session was still perfectly valid server-side.
 *
 * Measured on 2026-08-06, which is how it was found: **77 un-revoked sessions in the
 * database, every one still within its seven days, and only 4 ever refreshed.** Users
 * were signing in repeatedly, each time creating another session that would be
 * abandoned an hour later. "Remember me" could not have helped — it was a decorative
 * checkbox the backend had never heard of.
 *
 * ## The fix
 *
 * The backend also sets `session_active` — same lifetime as the refresh token, scoped
 * to `/`, so this middleware can see it. It is **a marker, not a credential**: no user
 * id, no signature, nothing to forge that gains anything. Forging it yields a page
 * shell that the client immediately bounces, which is what a signed-out visitor sees
 * regardless.
 *
 * A missing access token now means *"probably needs a refresh"*, not *"logged out"* —
 * so the page loads, `AuthInitializer` calls `/auth/me`, the interceptor refreshes on
 * the 401, and the user never notices. Only when **both** cookies are absent is the
 * visitor actually signed out.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("access_token")?.value;
  // Outlives the access token by seven days. Its presence means a refresh is worth
  // attempting; the client does the attempting.
  const sessionHint = request.cookies.get("session_active")?.value;

  // Root path: send to sign-in always (the sign-in page redirects on if already authed)
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));

  // Redirect only when there is nothing at all to work with. An expired access token
  // plus a live session hint is the ordinary "came back the next morning" case, and
  // bouncing it is what caused users to re-authenticate every hour.
  if (isProtected && !accessToken && !sessionHint) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/dashboard/:path*",
    "/dashboard",
    "/settings/:path*",
    "/settings",
  ],
};
