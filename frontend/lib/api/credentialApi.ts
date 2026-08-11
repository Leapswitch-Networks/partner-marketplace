import axiosInstance from "./axiosInstance";

/**
 * API Credentials — providers, credentials, and the audited reveal.
 *
 * **No type in this file carries a plaintext secret except `RevealResponse`.**
 * A credential's values arrive as `masked_value` and leave as `field_values`;
 * that asymmetry is the module, so keep it when adding to this file.
 *
 * Types live here rather than in `@/types` for the same reason as the other new
 * modules: `types/api.d.ts` is generated from `backend/openapi.json` and is not
 * hand-edited. Replace these with the generated schemas next regeneration (PM-42).
 */

/** A declared field. The credential form is generated from these. */
export interface CredentialFieldSchema {
  id: number | null;
  field_key: string;
  field_label: string;
  /** `text` · `password` · `url` · `email` · `number` · `select` · `boolean`. */
  field_type: string;
  field_options: Record<string, string> | string[] | null;
  is_required: boolean;
  /** **Per field.** A region is not a secret; a token is. */
  is_encrypted: boolean;
  validation_rules: Record<string, unknown> | null;
  placeholder: string | null;
  help_text: string | null;
  default_value: string | null;
  display_order: number;
}

export interface ApiProvider {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  documentation_url: string | null;
  setup_steps: string[] | null;
  category: string;
  /** Seeded from code and resolved by slug — not deletable, slug not editable. */
  is_system: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  schemas: CredentialFieldSchema[];
  credential_count: number;
}

export interface ProviderPage {
  items: ApiProvider[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
  can_manage: boolean;
  categories: string[];
}

export interface ProviderPayload {
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  documentation_url: string | null;
  setup_steps: string[] | null;
  category: string;
  is_active: boolean;
  display_order: number;
  /** Omit to leave a provider's field declarations untouched. */
  schemas?: Omit<CredentialFieldSchema, "id" | "display_order">[];
}

/**
 * One field of a credential, as the UI is allowed to see it.
 *
 * `masked_value` is never plaintext for an encrypted or password field.
 * `is_set` is separate because an empty mask is ambiguous on its own — it could
 * mean "not configured" or "configured to an empty string".
 */
export interface MaskedFieldValue {
  field_key: string;
  field_label: string;
  field_type: string;
  is_encrypted: boolean;
  is_required: boolean;
  is_set: boolean;
  masked_value: string;
}

export interface ProviderSummary {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  category: string;
}

export interface ApiCredential {
  id: number;
  provider: ProviderSummary;
  environment: string;
  name: string | null;
  is_active: boolean;
  last_used_at: string | null;
  last_verified_at: string | null;
  verification_status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  values: MaskedFieldValue[];
  configured_fields: number;
  total_fields: number;
}

export interface CredentialPage {
  items: ApiCredential[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
  can_manage: boolean;
  /**
   * Whether to OFFER the Reveal control. It is not whether reveal will succeed —
   * the endpoint additionally requires a recent password confirmation, which the
   * client cannot know about until it tries.
   */
  can_reveal: boolean;
  environments: string[];
}

export interface CredentialPayload {
  provider_id: number;
  environment: string;
  name: string | null;
  is_active: boolean;
  notes: string | null;
  /**
   * `{field_key: value}`. On update, **a blank value for an encrypted field
   * means "leave it as it is"** — the form is never given the secret, so it
   * cannot send it back, so a save that did not touch it must not wipe it.
   */
  field_values: Record<string, string>;
}

/** The only response in this module carrying a plaintext secret. */
export interface RevealResponse {
  field_key: string;
  value: string | null;
}

/**
 * The API answers a missing password confirmation with 403 and this exact
 * detail string. A client must prompt for the password — **not** sign the user
 * out, which is what treating it as a 401 would do.
 */
export const PASSWORD_CONFIRMATION_DETAIL = "Please confirm your password to continue.";

const BASE = "/settings/api-credentials";

export const providerApi = {
  list: (params: {
    search?: string;
    category?: string;
    is_active?: boolean;
    sort_by?: string;
    sort_order?: "asc" | "desc";
    page?: number;
    per_page?: number;
  }) => axiosInstance.get<ProviderPage>(`${BASE}/providers`, { params }),

  get: (id: number) => axiosInstance.get<ApiProvider>(`${BASE}/providers/${id}`),

  create: (data: ProviderPayload) =>
    axiosInstance.post<ApiProvider>(`${BASE}/providers`, data),

  update: (id: number, data: ProviderPayload) =>
    axiosInstance.put<ApiProvider>(`${BASE}/providers/${id}`, data),

  /** Cascades to every credential stored against the provider. */
  remove: (id: number) =>
    axiosInstance.delete<{ message: string }>(`${BASE}/providers/${id}`),
};

export const credentialApi = {
  list: (params: {
    search?: string;
    provider_id?: number;
    environment?: string;
    is_active?: boolean;
    sort_by?: string;
    sort_order?: "asc" | "desc";
    page?: number;
    per_page?: number;
  }) => axiosInstance.get<CredentialPage>(`${BASE}/credentials`, { params }),

  get: (id: number) => axiosInstance.get<ApiCredential>(`${BASE}/credentials/${id}`),

  /** Encrypted fields come back **empty**, never decrypted. */
  formValues: (id: number) =>
    axiosInstance.get<Record<string, string>>(`${BASE}/credentials/${id}/form-values`),

  create: (data: CredentialPayload) =>
    axiosInstance.post<ApiCredential>(`${BASE}/credentials`, data),

  update: (id: number, data: CredentialPayload) =>
    axiosInstance.put<ApiCredential>(`${BASE}/credentials/${id}`, data),

  remove: (id: number) =>
    axiosInstance.delete<{ message: string }>(`${BASE}/credentials/${id}`),

  /**
   * Decrypt ONE field. Requires `api-credential-view` **and** a recent password
   * confirmation, and writes an activity-log entry every time.
   */
  reveal: (id: number, fieldKey: string) =>
    axiosInstance.post<RevealResponse>(`${BASE}/credentials/${id}/reveal`, {
      field_key: fieldKey,
    }),
};

export default credentialApi;
