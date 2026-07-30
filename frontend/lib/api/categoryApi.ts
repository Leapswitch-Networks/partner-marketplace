import axiosInstance from "@/lib/api/axiosInstance";
import type { Category } from "@/types";

export interface CreateCategoryPayload {
  id: string;
  name: string;
  description: string;
  status: "active" | "inactive";
}

export const categoryApi = {
  list: () =>
    axiosInstance.get<Category[]>("/api/categories").then((r) => r.data),

  create: (payload: CreateCategoryPayload) =>
    axiosInstance.post<Category>("/api/categories", payload).then((r) => r.data),

  update: (id: string, payload: Partial<CreateCategoryPayload>) =>
    axiosInstance.patch<Category>(`/api/categories/${id}`, payload).then((r) => r.data),

  delete: (id: string) =>
    axiosInstance.delete(`/api/categories/${id}`).then((r) => r.data),
};
