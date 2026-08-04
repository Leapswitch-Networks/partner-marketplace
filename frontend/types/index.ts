export type UserStatus = "INACTIVE" | "ACTIVE" | "SUSPENDED";
export type AccountType = "staff" | "partner";
export type AuthProvider = "password" | "google";

export interface RoleSummary {
  id: number;
  name: string;
  display_name: string;
}

/**
 * The authenticated identity, from GET /api/auth/me.
 *
 * `permissions` is already resolved server-side, and for a super admin it is the
 * FULL catalog — so the UI checks membership and never needs to know that super
 * admins bypass checks. Use the `usePermissions` hook rather than reading it.
 */
export interface CurrentUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  initials: string;
  avatar_url: string | null;
  designation: string | null;
  employee_id: string | null;
  personal_mobile_number: string | null;
  personal_email: string | null;
  company_name: string | null;
  account_type: AccountType;
  status: UserStatus;
  auth_provider: AuthProvider;
  timezone_preference: string;
  email_verified_at: string | null;
  /** 2FA enrolled AND confirmed. A boolean only — never the secret. */
  two_factor_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: RoleSummary[];
  permissions: string[];
  is_super_admin: boolean;
  has_admin_access: boolean;
  /**
   * Email ownership recently proved by OTP, so the password form may omit the
   * current-password field. Advisory for the UI only — the server enforces it
   * independently of what the client sends.
   */
  password_otp_grace: boolean;
}

/** One row of the admin users table, from GET /api/users. */
export interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  initials: string;
  avatar_url: string | null;
  designation: string | null;
  company_name: string | null;
  account_type: AccountType;
  status: UserStatus;
  auth_provider: AuthProvider;
  /** 2FA enrolled AND confirmed. Drives the per-row "Reset 2FA" action. */
  two_factor_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: RoleSummary[];
  /** Computed per row against the requesting actor — for rendering only. */
  can_edit: boolean;
  can_delete: boolean;
  can_toggle_status: boolean;
  can_approve: boolean;
}

export interface Permission {
  id: number;
  name: string;
  display_name: string;
}

export interface PermissionGroup {
  id: number;
  name: string;
  display_name: string;
  display_order: number;
  module: string | null;
  permissions: Permission[];
}

export interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  is_protected: boolean;
  created_at: string;
  permissions: Permission[];
  user_count: number;
}

export interface Invitation {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  account_type: AccountType;
  expires_at: string;
  accepted_at: string | null;
  resent_count: number;
  last_sent_at: string | null;
  note: string | null;
  created_at: string;
  is_expired: boolean;
  role: RoleSummary | null;
  invited_by_name: string | null;
  /** Only present on create/resend responses. */
  accept_url?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
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

/**
 * One sidebar entry, from GET /api/navigation.
 *
 * The tree is built and permission-filtered server-side, so anything present here
 * is something the user may use. `permission` is echoed back for debuggability
 * only — the client never evaluates it. See `services/navigation_service.py`.
 */
export interface NavigationItem {
  title: string;
  /** `"#"` for a group heading that only contains children. */
  href: string;
  /** An icon *name*, not markup — the client owns the SVG. */
  icon: string;
  permission: string | string[] | null;
  /** Match the pathname exactly. Needed for `/dashboard`, a prefix of everything. */
  exact: boolean;
  /** Pathname prefixes that should highlight this item. */
  active_prefixes: string[];
  items?: NavigationItem[] | null;
}

export interface NavigationSection {
  /** `null` for the unlabelled first section. */
  label: string | null;
  /** Catalog slug that `roles.nav_preferences` keys on; `null` when unlabelled. */
  key: string | null;
  collapsible: boolean;
  items: NavigationItem[];
}
