import axiosInstance from "./axiosInstance";
import type { Paginated } from "@/types";

/** Error Tracking (LeapDesk parity, Module 17). */

export type ErrorStatus = "open" | "resolved" | "ignored" | "muted";

export interface ErrorGroup {
  id: number;
  fingerprint: string;
  exception_class: string;
  module: string;
  route_name: string | null;
  method: string | null;
  path: string | null;
  file: string;
  line: number;
  latest_message: string;
  status: ErrorStatus;
  occurrence_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  notes: string | null;
}

export interface ErrorOccurrence {
  id: number;
  user_id: string | null;
  ip: string | null;
  url: string | null;
  method: string | null;
  message: string;
  stack_trace: string | null;
  /** User agent and referer only — never request input. */
  context: Record<string, unknown> | null;
  occurred_at: string;
}

export interface ErrorGroupDetail extends ErrorGroup {
  occurrences: ErrorOccurrence[];
  /** The real total. `occurrences` is capped, so its length is not this. */
  occurrence_total: number;
}

export interface ListErrorsParams {
  search?: string;
  status?: ErrorStatus;
  module?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  per_page?: number;
}

export const errorApi = {
  list: (params: ListErrorsParams = {}) =>
    axiosInstance.get<Paginated<ErrorGroup>>("/errors", { params }),

  /** `{status: count}` for the summary cards. Absent statuses are omitted, not 0. */
  counts: () => axiosInstance.get<Record<string, number>>("/errors/counts"),

  get: (id: number) => axiosInstance.get<ErrorGroupDetail>(`/errors/${id}`),

  setStatus: (id: number, status: ErrorStatus, notes?: string | null) =>
    axiosInstance.patch<ErrorGroup>(`/errors/${id}/status`, { status, notes }),

  /** Destroys the evidence of a bug — gated on `error-manage`, and confirms first. */
  remove: (id: number) => axiosInstance.delete(`/errors/${id}`),
};

export default errorApi;
