import axiosInstance from "./axiosInstance";
import type { Paginated } from "@/types";

/**
 * The directory — categories, listings, moderation and enquiries.
 *
 * ## One client for two audiences, which mirrors the API
 *
 * `PARTNER_DIRECTORY_PLAN.md` § 20.6.0 ①: there is one route tree and row
 * scoping decides what is in it. A partner calling `listListings` gets their
 * own; a staff member with admin access gets everyone's. **There is deliberately
 * no `partnerId` parameter on the list calls** — passing one would imply the
 * client can choose whose listings to read, and it cannot: the server decides
 * from the session.
 *
 * The moderation calls are separate because their permission is separate:
 * partners hold `listing-update` and never `listing-publish`, so a partner
 * calling `approveListing` gets a 403 from the API rather than a hidden button
 * being the only thing standing between them and publishing their own work.
 */

export type ListingStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED";
export type PricingModel = "FIXED" | "FROM" | "ON_REQUEST";
/**
 * The seven states an enquiry can hold — TECH_DEBT PM-47.
 *
 * `VIEWED` means opened and not yet answered. `SPAM` is the one that mattered:
 * junk arrives through a public form and is never replied to, so before it
 * existed a junk enquiry counted against the partner's response rate for ever —
 * and § 9 ranks partners on that number.
 *
 * Widening this deliberately breaks any exhaustive `Record<EnquiryStatus, …>`
 * until the new entries are added. That is the point: a status the page cannot
 * label renders as an unstyled badge, which is how a half-shipped enum reaches a
 * user.
 */
export type EnquiryStatus =
  | "NEW"
  | "VIEWED"
  | "RESPONDED"
  | "CLOSED"
  | "WON"
  | "LOST"
  | "SPAM";

export interface Category {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  listing_count: number;
}

export interface ListingMedia {
  id: string;
  path: string;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
}

export interface ListingAttribute {
  id: string;
  label: string;
  value: string;
  sort_order: number;
}

export interface Listing {
  id: string;
  partner_id: string;
  category_id: number;
  title: string;
  slug: string;
  summary: string;
  description?: string | null;
  pricing_model: PricingModel;
  price: string | number | null;
  currency: string;
  status: ListingStatus;
  rejection_reason: string | null;
  published_at: string | null;
  submitted_at: string | null;
  created_at: string;
  media?: ListingMedia[];
  attributes?: ListingAttribute[];
}

export interface EnquiryMessage {
  id: string;
  direction: "FROM_BUYER" | "FROM_PARTNER";
  body: string;
  created_at: string;
}

export interface Enquiry {
  id: string;
  reference: string;
  partner_id: string;
  listing_id: string | null;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string | null;
  company: string | null;
  message?: string;
  budget_range?: string | null;
  timeline?: string | null;
  status: EnquiryStatus;
  source: "PROFILE" | "LISTING";
  /**
   * The recipient company's name, denormalised by the list route.
   *
   * The staff-only Partner column rendered `partner_id` until 2026-08-21, so
   * oversight meant reading raw UUIDs. Optional because only the index fills it.
   */
  partner_name?: string;
  /**
   * When the recipient partner first opened it — null until they do.
   *
   * Never set by a staff read: staff hold `enquiry-view` for oversight, and
   * stamping on their reads would make this measure staff browsing rather than
   * partner responsiveness. Paired with `first_responded_at`, these are the two
   * timestamps the trust measures and § 9's ranking are computed from.
   */
  first_viewed_at: string | null;
  first_responded_at: string | null;
  created_at: string;
  messages?: EnquiryMessage[];
  /**
   * Which statuses this enquiry may move to next, from the server.
   *
   * The lifecycle table lives in `enquiry_service`; a second copy here would
   * drift, and a drifted copy offers a move the API refuses with a 409 — which an
   * operator reads as the page being broken rather than as the move being
   * illegal.
   *
   * Present on the detail response only, so it is optional. Absent means "offer
   * nothing", which is the safe default.
   */
  allowed_transitions?: EnquiryStatus[];
}

// --- Categories --------------------------------------------------------------

export const listCategories = async (includeInactive = false): Promise<Category[]> => {
  const { data } = await axiosInstance.get<Category[]>("/categories", {
    params: { include_inactive: includeInactive },
  });
  return data;
};

export const createCategory = async (payload: {
  name: string;
  parent_id?: number | null;
  description?: string | null;
  icon?: string | null;
  sort_order?: number;
}): Promise<Category> => (await axiosInstance.post<Category>("/categories", payload)).data;

export const updateCategory = async (
  id: number,
  payload: Partial<Pick<Category, "name" | "description" | "icon" | "sort_order" | "is_active">>,
): Promise<Category> => (await axiosInstance.patch<Category>(`/categories/${id}`, payload)).data;

export const deleteCategory = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/categories/${id}`);
};

/** Whole ordered list, not a swap — see `ReorderCategoriesRequest`. */
export const reorderCategories = async (orderedIds: number[]): Promise<void> => {
  await axiosInstance.post("/categories/reorder", { ordered_ids: orderedIds });
};

// --- Listings ----------------------------------------------------------------

export interface ListListingsParams {
  page?: number;
  per_page?: number;
  status?: ListingStatus;
}

export const listListings = async (params: ListListingsParams = {}): Promise<Paginated<Listing>> =>
  (await axiosInstance.get<Paginated<Listing>>("/listings", { params })).data;

export const getListing = async (id: string): Promise<Listing> =>
  (await axiosInstance.get<Listing>(`/listings/${id}`)).data;

/**
 * Create a listing. **No `partner_id`** — the API takes it from the session.
 * A partner id in this payload would be an invitation to create a listing under
 * somebody else's name.
 */
export const createListing = async (payload: {
  title: string;
  summary: string;
  category_id: number;
  description?: string | null;
  pricing_model?: PricingModel;
  price?: number | null;
  currency?: string;
}): Promise<Listing> => (await axiosInstance.post<Listing>("/listings", payload)).data;

export const updateListing = async (
  id: string,
  payload: Partial<{
    title: string;
    summary: string;
    category_id: number;
    description: string | null;
    pricing_model: PricingModel;
    price: number | null;
    currency: string;
  }>,
): Promise<Listing> => (await axiosInstance.patch<Listing>(`/listings/${id}`, payload)).data;

/** Send a draft to the queue. The partner's own action. */
export const submitListing = async (id: string): Promise<Listing> =>
  (await axiosInstance.post<Listing>(`/listings/${id}/submit`)).data;

export const deleteListing = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/listings/${id}`);
};

// --- Moderation (staff only) -------------------------------------------------

/**
 * A partner's usage against what their tier allows.
 *
 * `max_listings` and `remaining` are both null when the allowance is unlimited,
 * which is why `unlimited` is sent explicitly rather than left to be inferred.
 * `remaining` is never negative: a partner moved to a smaller tier can be over
 * their allowance, and "-2 remaining" is not something to render.
 */
/**
 * The partner landing page's figures, computed on the server.
 *
 * Replaces three list calls and four client-side reductions. Every one of those
 * reductions was wrong in a way that rendered cleanly — the page length was
 * reported as the total, and `unanswered` was recomputed with a rule that no
 * longer matches the server's (spam is excluded there since PM-47).
 *
 * `GET /partners/me/overview`.
 */
export interface OwnOrganisationOverview {
  organisation_name: string;
  status: string;
  is_listed: boolean;
  verification_level: string;
  entitlement: Entitlement;
  listings: { draft: number; pending_review: number; published: number; rejected: number };
  /** `spam` is shown, never divided by — it is excluded from `total` and `unanswered`. */
  enquiries: { total: number; unanswered: number; answered: number; spam: number };
}

export interface Entitlement {
  /** Null when the partner is on no tier at all — which means unlimited. */
  tier: string | null;
  published: number;
  max_listings: number | null;
  unlimited: boolean;
  remaining: number | null;
  at_limit: boolean;
}

/**
 * A moderation queue row — a listing plus whether approving it would work.
 *
 * `blockers` is empty when the listing can be published. When it is not, the
 * strings are ready to render: they name the organisation and, for an allowance
 * refusal, the tier and both numbers. They are the **same** strings the API
 * would raise on a refused approval, so the screen and the error cannot
 * disagree about why.
 *
 * The reviewer needs this *before* opening a listing. Publishing is refused for
 * a suspended or unlisted organisation, or one at its tier allowance
 * (`PARTNER_DIRECTORY_PLAN.md` § 19.9) — and meeting that only after reading the
 * listing and clicking Approve spends the expensive half of the decision to
 * discover the cheap half was impossible.
 */
export interface ModerationQueueEntry extends Listing {
  partner_name: string;
  blockers: string[];
  entitlement: Entitlement;
}

export const reviewQueue = async (): Promise<ModerationQueueEntry[]> =>
  (await axiosInstance.get<ModerationQueueEntry[]>("/moderation/queue")).data;

export const approveListing = async (id: string): Promise<Listing> =>
  (await axiosInstance.post<Listing>(`/moderation/listings/${id}/approve`)).data;

/** The reason is required by the API, not merely encouraged. */
export const rejectListing = async (id: string, reason: string): Promise<Listing> =>
  (await axiosInstance.post<Listing>(`/moderation/listings/${id}/reject`, { reason })).data;

export const unpublishListing = async (id: string): Promise<Listing> =>
  (await axiosInstance.post<Listing>(`/moderation/listings/${id}/unpublish`)).data;

// --- Enquiries ---------------------------------------------------------------

export interface ListEnquiriesParams {
  page?: number;
  per_page?: number;
  status?: EnquiryStatus;
  unanswered?: boolean;
}

export const listEnquiries = async (
  params: ListEnquiriesParams = {},
): Promise<Paginated<Enquiry>> =>
  (await axiosInstance.get<Paginated<Enquiry>>("/enquiries", { params })).data;

export const getEnquiry = async (id: string): Promise<Enquiry> =>
  (await axiosInstance.get<Enquiry>(`/enquiries/${id}`)).data;

/**
 * Reply on-platform.
 *
 * ⚠️ **Staff cannot call this** — they do not hold `enquiry-respond`, and the
 * API will refuse. That is deliberate: a buyer would have no way to know they
 * were talking to us rather than to the partner they wrote to.
 */
export const replyToEnquiry = async (id: string, body: string): Promise<EnquiryMessage> =>
  (await axiosInstance.post<EnquiryMessage>(`/enquiries/${id}/reply`, { body })).data;

export const updateEnquiryStatus = async (id: string, status: EnquiryStatus): Promise<Enquiry> =>
  (await axiosInstance.patch<Enquiry>(`/enquiries/${id}/status`, { status })).data;

// --- The caller's own organisation -------------------------------------------

/**
 * ⚠️ **No id parameter, deliberately.** The API resolves the organisation from
 * the session, so there is nothing here to tamper with and no ownership check
 * for either side to forget. A `getOrganisation(id)` would be one missing
 * comparison away from letting anyone edit anyone.
 */
export interface OwnOrganisation {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  about: string | null;
  website: string | null;
  public_email: string | null;
  public_phone: string | null;
  founded_year: number | null;
  employee_range: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  service_areas: string | null;
  /** Presence, not content — the bytes are served by their own route. */
  logo_mime?: string | null;
  banner_mime?: string | null;
  status: string;
  verification_level: string;
  is_listed: boolean;
  expertise?: Category[];
}

export const getMyOrganisation = async (): Promise<OwnOrganisation> =>
  (await axiosInstance.get<OwnOrganisation>("/partners/me")).data;

export const updateMyOrganisation = async (
  payload: Partial<
    Pick<
      OwnOrganisation,
      | "name" | "tagline" | "about" | "website" | "public_email" | "public_phone"
      | "founded_year" | "employee_range" | "city" | "state" | "country"
      | "postal_code" | "service_areas"
    >
  >,
): Promise<OwnOrganisation> =>
  (await axiosInstance.patch<OwnOrganisation>("/partners/me", payload)).data;

/** Replaces the whole selection. Ids, because these become the filter's join. */
export const setMyExpertise = async (categoryIds: number[]): Promise<OwnOrganisation> =>
  (await axiosInstance.put<OwnOrganisation>("/partners/me/expertise", {
    category_ids: categoryIds,
  })).data;

/**
 * Upload a logo or banner for the caller's own organisation.
 *
 * `FormData`, so the browser sets the multipart boundary — setting
 * `Content-Type` by hand here is the classic way to break a multipart upload,
 * because the boundary token is generated per request and cannot be guessed.
 *
 * Validation is entirely server-side: size, magic bytes rather than the declared
 * type or the filename, dimensions, and an SVG content scan. The client checks
 * nothing, on purpose — a client-side check is a courtesy that becomes a lie the
 * moment somebody posts directly.
 */
export const uploadBrandAsset = async (
  asset: "logo" | "banner",
  file: File,
): Promise<OwnOrganisation> => {
  const body = new FormData();
  body.append("file", file);
  const { data } = await axiosInstance.put<OwnOrganisation>(`/partners/me/brand/${asset}`, body);
  return data;
};

export const clearBrandAsset = async (asset: "logo" | "banner"): Promise<OwnOrganisation> =>
  (await axiosInstance.delete<OwnOrganisation>(`/partners/me/brand/${asset}`)).data;
