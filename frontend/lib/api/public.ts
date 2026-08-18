import { SERVER_API_URL } from "@/lib/utils/constants";

/**
 * The public surface's data layer — **server-side only**.
 *
 * ## The rule that fails silently if you get it backwards
 *
 * `AGENTS.md` § 5: public data is fetched **server-side** through
 * `INTERNAL_API_URL`; authenticated data stays client-side because the
 * `httpOnly` cookie cannot be forwarded from a server component.
 *
 * Getting these the wrong way round does not throw. Inside the frontend
 * container `localhost:8002` is the frontend itself, so a server-side fetch to
 * the browser-facing URL gets ECONNREFUSED — and `docker-compose.yml` documents
 * at length how that used to surface as branding that saved correctly and never
 * appeared. Everything here uses `SERVER_API_BASE_URL`, which resolves to the
 * Compose service name.
 *
 * ## ⚠️ `SERVER_API_URL`, not `SERVER_API_BASE_URL`
 *
 * They differ by the `/api/v1` prefix and the names do not make that obvious.
 * Using the base one produced `http://backend:8002/public/partners`, which 404s
 * — and because the page has an error boundary, the route still answered 200
 * with an empty directory. **A wrong base URL here looks exactly like an empty
 * database**, which is the most expensive kind of wrong.
 *
 * ## Failures are visible, not papered over
 *
 * Every function throws on a non-OK response. **It deliberately does not fall
 * back to placeholder data.** `DIRECTORY_BUILD_PUNCHLIST.md` 6.2 makes that a
 * test: stop the backend and the page must fail visibly, because a silent
 * fallback is how a page ships looking healthy while reading nothing. The route
 * segment's `error.tsx` renders the failure.
 */

const REVALIDATE_SECONDS = 60;

async function get<T>(path: string, revalidate = REVALIDATE_SECONDS): Promise<T> {
  const res = await fetch(`${SERVER_API_URL}/public${path}`, {
    // Time-based revalidation rather than `no-store`: these pages are public and
    // identical for everyone, so caching them is free. `no-store` would also flip
    // every route to dynamic rendering and lose the static generation the
    // performance budget depends on.
    next: { revalidate },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Public API ${path} responded ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface PublicCategory {
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  listing_count: number;
  children: PublicCategory[];
}

export interface PublicPartnerSummary {
  slug: string;
  name: string;
  tagline: string | null;
  city: string | null;
  verification_level: string;
  founded_year: number | null;
  employee_range: string | null;
  logo_path: string | null;
}

export interface PublicListing {
  title: string;
  slug: string;
  summary: string;
  description: string | null;
  pricing_model: "FIXED" | "FROM" | "ON_REQUEST";
  price: string | number | null;
  currency: string;
  published_at: string | null;
  media: { id: string; path: string; alt_text: string | null; width: number | null; height: number | null }[];
  attributes: { id: string; label: string; value: string }[];
}

export interface PublicPartnerDetail extends PublicPartnerSummary {
  about: string | null;
  website: string | null;
  public_email: string | null;
  public_phone: string | null;
  service_areas: string | null;
  state: string | null;
  country: string | null;
  banner_path: string | null;
  expertise: PublicCategory[];
  listings: PublicListing[];
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export const fetchCategories = () => get<PublicCategory[]>("/categories");

export const fetchPartners = (params: {
  page?: number;
  per_page?: number;
  expertise?: string;
  city?: string;
  q?: string;
} = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  });
  const suffix = qs.toString() ? `?${qs}` : "";
  return get<PagedResponse<PublicPartnerSummary>>(`/partners${suffix}`);
};

export const fetchPartner = (slug: string) =>
  get<PublicPartnerDetail>(`/partners/${encodeURIComponent(slug)}`);

export interface PublicEnquiryStatus {
  reference: string;
  partner_name: string;
  status: string;
  created_at: string;
  first_responded_at: string | null;
  messages: { id: string; direction: "FROM_BUYER" | "FROM_PARTNER"; body: string; created_at: string }[];
}

/**
 * The buyer's own thread, by capability URL.
 *
 * ⚠️ **`no-store`, not the shared revalidate window.** Every other read here is
 * identical for every visitor and caching it is free. This one is personal —
 * caching it would risk one buyer's thread being served from another's request,
 * and it is the one place on this surface where that could happen.
 */
export const fetchEnquiry = (reference: string) =>
  fetch(`${SERVER_API_URL}/public/enquiries/${encodeURIComponent(reference)}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  }).then(async (res) => {
    if (!res.ok) throw new Error(`Enquiry ${reference} responded ${res.status}`);
    return (await res.json()) as PublicEnquiryStatus;
  });

export const fetchListings = (params: { category?: string; page?: number } = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  });
  const suffix = qs.toString() ? `?${qs}` : "";
  return get<PagedResponse<PublicListing & { partner: PublicPartnerSummary }>>(
    `/listings${suffix}`,
  );
};

/**
 * 🔴 **The confidentiality rule, moved here from `lib/public/homeContent.ts`.**
 *
 * `DIRECTORY_BUILD_PUNCHLIST.md` 5.10 requires this note to survive the deletion
 * of the placeholder content files, because this layer is now the only place it
 * can be broken.
 *
 * **No response rendered to an anonymous visitor may state, imply, or let a
 * reader infer that partners source anything from the company operating this
 * platform.** That relationship exists and is why partners are here; it is
 * between us and them only.
 *
 * The backend enforces it by construction — every public response model in
 * `backend/app/schemas/directory.py` simply lacks such a field, and no table has
 * a column for it. **This layer must not reintroduce it**, which in practice
 * means: do not add a client-side join, a hardcoded supplier name, a
 * "powered by" line, or a certifications block belonging to the operator.
 *
 * The one permitted exception is the operating entity named on `/terms`,
 * `/privacy` and `/contact`, where a legal document has to say who stands
 * behind it. Do not extend it beyond those three pages, and never into the
 * footer, which renders everywhere.
 */
export const CONFIDENTIALITY_RULE = true;

/**
 * Every listed partner, across however many pages that takes.
 *
 * ⚠️ **The API caps `per_page` at 60.** An earlier version of `generateStaticParams`
 * asked for 200 and got a 422, which surfaced as a 500 on every partner profile —
 * the page itself was fine, its parameter generation was not. Picking 60 would
 * have "fixed" it until the sixty-first partner signed up and their profile
 * quietly stopped being generated.
 *
 * Walks pages instead, with a hard stop: a paginator bug that never advances
 * would otherwise loop forever during a build.
 */
export async function fetchAllPartnerSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  const MAX_PAGES = 50; // 3,000 partners. Far beyond any plausible directory.
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await fetchPartners({ page, per_page: 60 });
    slugs.push(...res.items.map((p) => p.slug));
    if (page >= res.pages || res.items.length === 0) break;
  }
  return slugs;
}
