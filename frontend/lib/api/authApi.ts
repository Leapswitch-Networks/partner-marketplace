import axiosInstance from "./axiosInstance";
import type { AdminUser, User } from "@/types";

export const authApi = {
  register: (data: {
    name: string;
    email: string;
    password: string;
    confirm_password: string;
  }) => axiosInstance.post<{ message: string }>("/api/auth/register", data),

  adminRegister: (data: {
    full_name: string;
    email: string;
    password: string;
    confirm_password: string;
  }) => axiosInstance.post<AdminUser>("/api/auth/admin/register", data),

  adminLogin: (data: { email: string; password: string }) =>
    axiosInstance.post<{ message: string; user: AdminUser }>("/api/auth/admin/login", data),

  login: (data: { email: string; password: string }) =>
    axiosInstance.post<{ message: string; user: User }>("/api/auth/login", data),

  logout: () =>
    axiosInstance.post<{ message: string }>("/api/auth/logout"),

  whoami: () =>
    axiosInstance.get<{ user_type: "admin" | "user"; user: AdminUser | User }>("/api/auth/whoami"),

  me: () => axiosInstance.get<User>("/api/auth/me"),

  adminMe: () => axiosInstance.get<AdminUser>("/api/auth/admin/me"),

  updateProfile: (data: { name: string; email: string }) =>
    axiosInstance.patch<User>("/api/auth/me", data),

  adminUpdateProfile: (data: { full_name: string; email: string }) =>
    axiosInstance.patch<AdminUser>("/api/auth/admin/me", data),
};
