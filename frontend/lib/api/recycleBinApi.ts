import axiosInstance from "./axiosInstance";

/** Recycle Bin — restore or permanently remove soft-deleted records. */

export interface BinnedItem {
  /** Allowlist key — sent back on restore/purge. Never a class name. */
  type: string;
  type_label: string;
  /** String even for integer keys, so one shape serves every type. */
  id: string;
  label: string;
  subtitle: string | null;
  deleted_at: string;
}

export interface RecycleBinResponse {
  items: BinnedItem[];
  counts: Record<string, number>;
  types: { value: string; label: string }[];
}

export const recycleBinApi = {
  list: (params: { type?: string } = {}) =>
    axiosInstance.get<RecycleBinResponse>("/recycle-bin", { params }),

  restore: (type: string, id: string) =>
    axiosInstance.post<{ message: string }>("/recycle-bin/restore", { type, id }),

  /** The only irreversible delete left in the core. Confirm before calling. */
  purge: (type: string, id: string) =>
    axiosInstance.delete<{ message: string }>("/recycle-bin", { data: { type, id } }),
};

export default recycleBinApi;
