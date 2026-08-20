import { api } from "@/lib/store/api";
import type {
  ApiCredential,
  ApiProvider,
  CredentialPage,
  CredentialPayload,
  ProviderPage,
  ProviderPayload,
  RevealResponse,
} from "@/lib/api/credentialApi";

const BASE = "/settings/api-credentials";

/**
 * API credentials — providers, credentials and the audited reveal — as RTK Query
 * endpoints. PM-41 § 4.5.
 *
 * One slice for both resources because they are one family: they share a base
 * path, and every write to either changes something the other displays.
 *
 * ## ⚠️ `reveal` is a mutation, and that is a security property
 *
 * It is the only call in this module that returns a plaintext secret. A mutation
 * has **no cache entry**, so the decrypted value exists only in the calling
 * component's state and is gone when that unmounts. Making it a query would park
 * a live credential in the Redux store — and in the devtools — for the rest of
 * the session, for a value the server deliberately requires a fresh password
 * confirmation to hand over, and writes an activity-log entry for every time.
 *
 * Do not "optimise" it into a query. The POST is not an accident of the API.
 *
 * ## The two cross-invalidations that are easy to miss
 *
 * * A credential write moves `credential_count` on its provider's row, so it
 *   invalidates the provider collection as well as its own.
 * * Deleting a provider **cascades to every credential stored against it**, so it
 *   invalidates the credential collection too. Without that, the credentials
 *   screen would keep listing rows whose provider is gone.
 */
export const apiCredentialsEndpoints = api.injectEndpoints({
  endpoints: (build) => ({
    listProviders: build.query<
      ProviderPage,
      {
        search?: string;
        category?: string;
        is_active?: boolean;
        sort_by?: string;
        sort_order?: "asc" | "desc";
        page?: number;
        per_page?: number;
      } | void
    >({
      query: (params) => ({ url: `${BASE}/providers`, params: params ?? {} }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((p) => ({ type: "Provider" as const, id: p.id })),
              { type: "Provider" as const, id: "LIST" },
            ]
          : [{ type: "Provider" as const, id: "LIST" }],
    }),

    getProvider: build.query<ApiProvider, number>({
      query: (id) => `${BASE}/providers/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Provider", id }],
    }),

    createProvider: build.mutation<ApiProvider, ProviderPayload>({
      query: (body) => ({ url: `${BASE}/providers`, method: "POST", body }),
      invalidatesTags: [{ type: "Provider", id: "LIST" }],
    }),

    updateProvider: build.mutation<ApiProvider, { id: number; data: ProviderPayload }>({
      query: ({ id, data }) => ({
        url: `${BASE}/providers/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Provider", id },
        { type: "Provider", id: "LIST" },
        // A provider's name and icon are rendered on every credential row.
        { type: "Credential", id: "LIST" },
      ],
    }),

    /** Cascades to every credential stored against the provider. */
    deleteProvider: build.mutation<{ message: string }, number>({
      query: (id) => ({ url: `${BASE}/providers/${id}`, method: "DELETE" }),
      invalidatesTags: [
        { type: "Provider", id: "LIST" },
        { type: "Credential", id: "LIST" },
      ],
    }),

    listCredentials: build.query<
      CredentialPage,
      {
        search?: string;
        provider_id?: number;
        environment?: string;
        is_active?: boolean;
        sort_by?: string;
        sort_order?: "asc" | "desc";
        page?: number;
        per_page?: number;
      } | void
    >({
      query: (params) => ({ url: `${BASE}/credentials`, params: params ?? {} }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((c) => ({ type: "Credential" as const, id: c.id })),
              { type: "Credential" as const, id: "LIST" },
            ]
          : [{ type: "Credential" as const, id: "LIST" }],
    }),

    /**
     * The editable values for one credential. **Encrypted fields come back
     * empty**, never decrypted — which is why this is safe to cache while
     * `reveal` is not.
     */
    credentialFormValues: build.query<Record<string, string>, number>({
      query: (id) => `${BASE}/credentials/${id}/form-values`,
      providesTags: (_r, _e, id) => [{ type: "Credential", id: `${id}-form` }],
    }),

    createCredential: build.mutation<ApiCredential, CredentialPayload>({
      query: (body) => ({ url: `${BASE}/credentials`, method: "POST", body }),
      invalidatesTags: [
        { type: "Credential", id: "LIST" },
        // `credential_count` is a column on the providers index.
        { type: "Provider", id: "LIST" },
      ],
    }),

    updateCredential: build.mutation<
      ApiCredential,
      { id: number; data: CredentialPayload }
    >({
      query: ({ id, data }) => ({
        url: `${BASE}/credentials/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Credential", id },
        { type: "Credential", id: `${id}-form` },
        { type: "Credential", id: "LIST" },
      ],
    }),

    deleteCredential: build.mutation<{ message: string }, number>({
      query: (id) => ({ url: `${BASE}/credentials/${id}`, method: "DELETE" }),
      invalidatesTags: [
        { type: "Credential", id: "LIST" },
        { type: "Provider", id: "LIST" },
      ],
    }),

    /**
     * Decrypt ONE field. Requires `api-credential-view` **and** a recent password
     * confirmation, and writes an activity-log entry every time.
     *
     * A mutation so the plaintext is never cached — see the note at the top of
     * this file. It invalidates nothing: reading a secret changes no record.
     */
    revealCredentialField: build.mutation<
      RevealResponse,
      { id: number; fieldKey: string }
    >({
      query: ({ id, fieldKey }) => ({
        url: `${BASE}/credentials/${id}/reveal`,
        method: "POST",
        body: { field_key: fieldKey },
      }),
    }),
  }),
});

export const {
  useListProvidersQuery,
  useGetProviderQuery,
  useCreateProviderMutation,
  useUpdateProviderMutation,
  useDeleteProviderMutation,
  useListCredentialsQuery,
  useCredentialFormValuesQuery,
  useCreateCredentialMutation,
  useUpdateCredentialMutation,
  useDeleteCredentialMutation,
  useRevealCredentialFieldMutation,
} = apiCredentialsEndpoints;
