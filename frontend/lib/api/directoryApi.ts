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
export type EnquiryStatus = "NEW" | "RESPONDED" | "CLOSED" | "WON" | "LOST";

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
  first_responded_at: string | null;
  created_at: string;
  messages?: EnquiryMessage[];
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

export const reviewQueue = async (): Promise<Listing[]> =>
  (await axiosInstance.get<Listing[]>("/moderation/queue")).data;

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
