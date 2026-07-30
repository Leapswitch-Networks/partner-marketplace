import axiosInstance from "./axiosInstance";

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCandidatePayload {
  name: string;
  email: string;
  phone?: string;
  position?: string;
  notes?: string;
}

export interface UpdateCandidatePayload {
  name?: string;
  email?: string;
  phone?: string;
  position?: string;
  notes?: string;
}

export const candidateApi = {
  list: () =>
    axiosInstance.get<Candidate[]>("/api/candidates"),

  get: (id: string) =>
    axiosInstance.get<Candidate>(`/api/candidates/${id}`),

  create: (data: CreateCandidatePayload) =>
    axiosInstance.post<Candidate>("/api/candidates", data),

  update: (id: string, data: UpdateCandidatePayload) =>
    axiosInstance.patch<Candidate>(`/api/candidates/${id}`, data),

  delete: (id: string) =>
    axiosInstance.delete<{ message: string }>(`/api/candidates/${id}`),
};
