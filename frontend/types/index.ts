/**
 * Two values, and only two — owner's call, 2026-08-11. The database enforces it
 * (`user_status`, migration `b3d7e02f4c19`), so this is a mirror of a constraint
 * rather than a frontend convention. A third value, SUSPENDED, was removed:
 * nothing behaved differently for it.
 */
export type UserStatus = "INACTIVE" | "ACTIVE";
/**
 * The account CLASS, not this project's word for it. Renamed from
 * `staff | partner` on 2026-08-17 with the backend enum (migration
 * `c9a71f4e2b60`, `CORE_EXTRACTION_PLAN.md` phase 2) so the contract survives
 * into a project whose external accounts are clinics or suppliers.
 *
 * **The UI still says "Staff" and "Partner"** — see `ACCOUNT_TYPE_LABELS`. The
 * wire value is neutral; the label is this project's.
 */
export type AccountType = "internal" | "external";

/**
 * What each account class is CALLED here. One map, so relabelling for a second
 * project is a single edit rather than a hunt through six components — which is
 * what it was before this existed.
 */
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  internal: "Staff",
  external: "Partner",
};
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
  /** Organisation membership. NULL means an internal, first-party account. */
  organisation_id: string | null;
  status: UserStatus;
  auth_provider: AuthProvider;
  timezone_preference: string;
  /**
   * The user's OWN theme choice, or null when they inherit the installation's.
   * The picker needs the raw value: a resolved one cannot tell "chose pine" apart
   * from "inherits, and the installation happens to be pine".
   */
  theme_preference: string | null;
  /**
   * What should actually render — the personal choice, else the installation's.
   * Null when the installation runs a custom brand colour, which no preset key can
   * name; the server-rendered style is already correct in that case.
   */
  resolved_theme: string | null;
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
  /** Organisation membership. NULL means an internal, first-party account. */
  organisation_id: string | null;
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

/**
 * What `GET /users/{id}` actually returns — `UserListItem` plus eleven fields.
 *
 * `adminApi.getUser` was typed as `ManagedUser` (i.e. `UserListItem`), so every
 * one of those extra fields was invisible to TypeScript and the detail page had
 * nothing to render. Exactly the failure `api-contract.ts` describes: types that
 * agree by convention look like an enforced contract while under-describing the
 * API. The contract assertion below now covers it.
 */
export interface ManagedUserDetail extends ManagedUser {
  first_name: string;
  last_name: string;
  employee_id: string | null;
  personal_mobile_number: string | null;
  personal_email: string | null;
  timezone_preference: string;
  email_verified_at: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_ip: string | null;
  updated_at: string;
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
  // No `accept_url` here. The list endpoint does not send it — it exists only on
  // InvitationCreatedResponse, which is what `InvitationCreated` below models.
  // Declaring it on the base type made every listed invitation look as though it
  // might carry a live accept link, and the contract assertion caught it.
}

/**
 * What create, bulk-create and resend actually return.
 *
 * `email_sent` is the field that lets the UI say "we emailed them" rather than
 * "copy this link and send it yourself". It exists on the API
 * (`InvitationCreatedResponse`) and was missing here, so the distinction was
 * unreachable from the client — which would have made the create flow guess.
 *
 * `accept_url` is populated ONLY when no email was delivered. When one was, the
 * link is withheld deliberately: it is a live credential and does not belong in
 * a response body, a devtools tab and a log for something already sent privately.
 */
export interface InvitationCreated extends Invitation {
  accept_url: string | null;
  email_sent: boolean;
}

/**
 * The organisation's lifecycle, one level above the account gate on `users` —
 * mirrors `Partner.status` on the backend. `status` gates LOGIN for every user
 * in the organisation; it is independent of `is_listed`, which gates public
 * visibility. See `PartnerListItem.publicly_visible`, which needs both.
 */
export type PartnerStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

/**
 * What Leapswitch vouches for — the directory's trust signal, ranked ahead of
 * any paid placement. Mirrors `Partner.verification_level`.
 */
export type VerificationLevel = "UNVERIFIED" | "VERIFIED" | "PREMIER";

/** A partner tier, as `GET /partners/tiers` and the tier picker render it. */
export interface PartnerTier {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  /** NULL means unlimited. Do not coerce this to 0. */
  max_listings: number | null;
  featured_slots: number;
  sort_order: number;
  is_active: boolean;
  is_unlimited: boolean;
  can_feature: boolean;
}

/**
 * One row of the staff partners table, from GET /partners.
 *
 * `can_*` flags are computed per row against the requesting actor — for
 * rendering only, same contract as `ManagedUser`. The API re-checks every write
 * regardless.
 */
export interface PartnerListItem {
  id: string;
  name: string;
  slug: string;
  status: PartnerStatus;
  verification_level: VerificationLevel;
  is_listed: boolean;
  tier: PartnerTier | null;
  city: string | null;
  country: string | null;
  user_count: number;
  created_at: string;

  is_active: boolean;
  is_verified: boolean;
  publicly_visible: boolean;

  can_edit: boolean;
  can_delete: boolean;
  can_change_status: boolean;
  can_verify: boolean;
  can_publish: boolean;
}

/**
 * What `GET /partners/{id}` actually returns — `PartnerListItem` plus the
 * compliance and audit columns the directory profile needs. Declared in full
 * rather than inherited-and-hoped, same reasoning as `ManagedUserDetail`: the
 * list item under-describes the record.
 */
export interface PartnerDetailResponse extends PartnerListItem {
  legal_name: string | null;
  tagline: string | null;
  about: string | null;
  logo_path: string | null;
  banner_path: string | null;
  website: string | null;
  public_email: string | null;
  public_phone: string | null;
  founded_year: number | null;
  employee_range: string | null;

  gst_number: string | null;
  pan_number: string | null;
  billing_address: string | null;
  state: string | null;
  postal_code: string | null;

  agreement_signed_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  onboarded_by: string | null;
  notes: string | null;

  created_by: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ApiError {
  detail: string;
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
