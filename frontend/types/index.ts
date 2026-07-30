export type AdminRole = "admin" | "super_admin";

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  role: AdminRole;
  is_super_admin: boolean;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  created_at: string;
}

export interface Test {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  total_questions: number;
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  test_id: string;
  text: string;
  type: "mcq" | "true_false" | "descriptive";
  category: string;
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  order: number;
  options?: Option[];
}

export interface Option {
  id: string;
  question_id: string;
  label: string;
  text: string;
}

export interface TestSession {
  id: string;
  user_id: string;
  test_id: string;
  started_at: string;
  submitted_at: string | null;
  status: "in_progress" | "submitted" | "timed_out";
  score: number | null;
  total_marks: number;
}

export interface ApiError {
  detail: string;
}

export type CategoryStatus = "active" | "inactive";

export interface Category {
  id: string;
  name: string;
  description: string;
  status: CategoryStatus;
  created_at: string;
}
