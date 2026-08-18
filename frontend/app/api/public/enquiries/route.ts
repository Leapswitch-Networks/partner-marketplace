import { NextResponse } from "next/server";

import { SERVER_API_URL } from "@/lib/utils/constants";

/**
 * The enquiry form's submit target — a thin proxy to the public API.
 *
 * ## Why a route handler rather than posting to the backend directly
 *
 * Three reasons, and the third is the one that matters:
 *
 * 1. **No CORS.** The browser talks to its own origin. The backend's allowlist
 *    stays for the signed-in app and does not need to grow a second case.
 * 2. **No internal ids anywhere on the public surface.** The page knows a
 *    partner by the slug in its URL and the API accepts exactly that — no
 *    database identifier is sent, resolved, or returned.
 * 3. **The client IP reaching the rate limiter is the real one.** The backend
 *    limits `/public/enquiries` to six per minute per address — if the browser
 *    posted through this proxy without forwarding the caller's address, every
 *    enquiry on the internet would share the frontend container's IP and one
 *    spammer would lock out every genuine buyer.
 *
 * ⚠️ **That third point is a live caveat, not a solved problem.** The forwarded
 * headers below are only trustworthy behind a proxy that sets them; a client can
 * send whatever it likes. Until there is a real reverse proxy in front of this
 * (there is no Nginx yet — see `documentation/AGENTS.md`), treat the rate limit
 * as approximate and do not add anything that trusts these headers for
 * authorisation.
 */
export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Malformed request." }, { status: 400 });
  }

  const slug = typeof payload.partner_slug === "string" ? payload.partner_slug : null;
  if (!slug) {
    return NextResponse.json({ detail: "No partner named." }, { status: 400 });
  }

  // No slug -> id resolution here: the public API takes the slug directly, and
  // resolves it against the same visibility rules the profile page used. An
  // earlier version of this file looked the id up first, which meant two extra
  // round trips and an internal identifier passing through the frontend for no
  // reason.
  const forwarded =
    request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";

  const res = await fetch(`${SERVER_API_URL}/public/enquiries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(forwarded ? { "X-Forwarded-For": forwarded } : {}),
    },
    body: JSON.stringify({
      partner_slug: slug,
      buyer_name: payload.buyer_name,
      buyer_email: payload.buyer_email,
      buyer_phone: payload.buyer_phone ?? null,
      company: payload.company ?? null,
      message: payload.message,
      budget_range: payload.budget_range ?? null,
      timeline: payload.timeline ?? null,
      website: payload.website ?? null,
    }),
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));
  // Pass the status through rather than flattening it. A 429 has to reach the
  // form as a 429 so the buyer is told to wait rather than told it failed.
  return NextResponse.json(body, { status: res.status });
}
