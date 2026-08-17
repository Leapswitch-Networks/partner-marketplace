import axiosInstance from "./axiosInstance";
import type {
  Paginated,
  PartnerDetailResponse,
  PartnerListItem,
  PartnerStatus,
  PartnerTier,
  VerificationLevel,
} from "@/types";

/**
 * Partner organisation administration — staff-facing.
 *
 * Status, verification and publication are separate endpoints on the API, not
 * fields on `PATCH /partners/{id}` — see `backend/app/schemas/partner.py`. Each
 * grants something a general edit should not: login for a whole organisation,
 * Leapswitch's published endorsement, and visibility to the anonymous internet.
 * The client below keeps that split rather than flattening it into one `update`.
 */

export interface ListPartnersParams {
  search?: string;
  status?: PartnerStatus;
  verification_level?: VerificationLevel;
  tier_id?: number;
  is_listed?: boolean;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  per_page?: number;
}

/**
 * Onboard a partner organisation.
 *
 * `status`, `verification_level`, `is_listed` and `slug` are all absent —
 * matching `CreatePartnerRequest`. A new partner is always `PENDING`, derives
 * its own slug from `name`, and every other flag has its own permissioned
 * endpoint below.
 */
export interface CreatePartnerPayload {
  name: string;
  legal_name?: string | null;
  tier_id?: number | null;
  tagline?: string | null;
  about?: string | null;
  website?: string | null;
  public_email?: string | null;
  public_phone?: string | null;
  founded_year?: number | null;
  employee_range?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  billing_address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  agreement_signed_at?: string | null;
  notes?: string | null;
}

/**
 * Partial — only the fields you send are applied (`exclude_unset=True` on the
 * API). `logo_path` / `banner_path` are editable here but not on create, same
 * split as `UpdatePartnerRequest` vs `CreatePartnerRequest`.
 */
export type UpdatePartnerPayload = Partial<CreatePartnerPayload> & {
  logo_path?: string | null;
  banner_path?: string | null;
};

export interface UpdatePartnerTierPayload {
  display_name?: string;
  description?: string | null;
  /** NULL means unlimited. */
  max_listings?: number | null;
  featured_slots?: number;
  is_active?: boolean;
}

export const partnersApi = {
  list: (params: ListPartnersParams = {}) =>
    axiosInstance.get<Paginated<PartnerListItem>>("/partners", { params }),

  // PartnerDetailResponse, not PartnerListItem — the detail record carries
  // eleven more fields than the list does. Same note as `adminApi.getUser`.
  get: (id: string) => axiosInstance.get<PartnerDetailResponse>(`/partners/${id}`),

  create: (data: CreatePartnerPayload) =>
    axiosInstance.post<PartnerDetailResponse>("/partners", data),

  update: (id: string, data: UpdatePartnerPayload) =>
    axiosInstance.patch<PartnerDetailResponse>(`/partners/${id}`, data),

  // 204 No Content — nothing to type on the response.
  remove: (id: string) => axiosInstance.delete<void>(`/partners/${id}`),

  /** Move a partner through PENDING → ACTIVE ↔ SUSPENDED. Revokes sessions on suspend. */
  changeStatus: (id: string, status: PartnerStatus, reason?: string) =>
    axiosInstance.post<PartnerDetailResponse>(`/partners/${id}/status`, { status, reason }),

  /** Set what Leapswitch vouches for. */
  setVerification: (id: string, verification_level: VerificationLevel) =>
    axiosInstance.post<PartnerDetailResponse>(`/partners/${id}/verification`, {
      verification_level,
    }),

  /** Publish or unlist in the directory. The API refuses to publish a non-ACTIVE partner. */
  setListed: (id: string, is_listed: boolean) =>
    axiosInstance.post<PartnerDetailResponse>(`/partners/${id}/listing`, { is_listed }),

  listTiers: (includeInactive = false) =>
    axiosInstance.get<PartnerTier[]>("/partners/tiers", {
      params: { include_inactive: includeInactive },
    }),

  updateTier: (tierId: number, data: UpdatePartnerTierPayload) =>
    axiosInstance.patch<PartnerTier>(`/partners/tiers/${tierId}`, data),
};
