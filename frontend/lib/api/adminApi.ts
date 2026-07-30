import axiosInstance from "./axiosInstance";
import type { AdminRole, AdminUser } from "@/types";

export interface CreateAdminUserPayload {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  role?: AdminRole;
}

export interface UpdateAdminUserPayload {
  full_name?: string;
  email?: string;
  is_active?: boolean;
  role?: AdminRole;
}

export const adminApi = {
  listUsers: () =>
    axiosInstance.get<AdminUser[]>("/api/admin/users"),

  createUser: (data: CreateAdminUserPayload) =>
    axiosInstance.post<AdminUser>("/api/auth/admin/register", data),

  updateUser: (id: string, data: UpdateAdminUserPayload) =>
    axiosInstance.patch<AdminUser>(`/api/admin/users/${id}`, data),

  deleteUser: (id: string) =>
    axiosInstance.delete<{ message: string }>(`/api/admin/users/${id}`),
};
