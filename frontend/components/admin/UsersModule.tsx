"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import { type Column } from "@/components/common/DataTable";
import ResourceIndex from "@/components/common/ResourceIndex";
import Input from "@/components/common/Input";
import Modal from "@/components/common/Modal";
import RowActions from "@/components/common/RowActions";
import Select from "@/components/common/Select";
import Toast, { useToast } from "@/components/common/Toast";
import { adminApi, type CreateUserPayload, type UpdateUserPayload } from "@/lib/api/adminApi";
import { roleApi } from "@/lib/api/rbacApi";
import useAppSelector from "@/lib/hooks/useAppSelector";
import useAutoPerPage from "@/lib/hooks/useAutoPerPage";
import usePermissions from "@/lib/hooks/usePermissions";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import type { ManagedUser, Role, UserStatus } from "@/types";

/** Extract a readable message from a FastAPI error, which may be a 422 detail array. */
function apiMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { detail?: unknown }; status?: number } })?.response;
  const detail = response?.data?.detail;
  if (Array.isArray(detail)) {
    const msg = (detail[0] as { msg?: string })?.msg ?? fallback;
    return msg.replace(/^Value error,\s*/i, "");
  }
  if (typeof detail === "string" && detail) return detail;
  if (!response) return "Network error — check your connection and try again.";
  return `${fallback} (${response.status ?? "unknown"})`;
}

const STATUS_TONE: Record<UserStatus, { tone: "success" | "warning" | "danger"; label: string }> = {
  ACTIVE: { tone: "success", label: "Active" },
  INACTIVE: { tone: "warning", label: "Pending approval" },
  SUSPENDED: { tone: "danger", label: "Suspended" },
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Pending approval" },
  { value: "SUSPENDED", label: "Suspended" },
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: "staff", label: "Staff" },
  { value: "partner", label: "Partner" },
];

type ModalMode = "create" | "edit" | "delete" | null;

export default function UsersModule({ initialModal }: { initialModal?: ModalMode }) {
  const router = useRouter();
  const { can } = usePermissions();
  const me = useAppSelector((s) => s.auth.user);
  const { toast, show, dismiss } = useToast();

  const autoPerPage = useAutoPerPage();

  // --- query state ---
  //
  // One hook replaces eleven `useState`s and three coordinating `useEffect`s.
  // It also owns the rules those effects encoded — reset to page 1 on a filter
  // change, clear the selection with it, debounce text but not dropdowns — so
  // the next seven modules inherit them instead of reimplementing them.
  const q = useResourceQuery({
    filters: { search: "", status: "", account_type: "", role_id: "" },
    debounced: ["search"],
    defaultSortBy: "created_at",
    defaultSortOrder: "desc",
    autoPerPage,
  });

  // --- data ---
  const [rows, setRows] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalMode>(initialModal ?? null);
  const [target, setTarget] = useState<ManagedUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listUsers({
        search: q.applied.search || undefined,
        status: (q.applied.status as UserStatus) || undefined,
        account_type: (q.applied.account_type as "staff" | "partner") || undefined,
        role_id: q.applied.role_id ? Number(q.applied.role_id) : undefined,
        sort_by: q.sortBy,
        sort_order: q.sortOrder,
        page: q.page,
        per_page: q.perPage,
      });
      setRows(res.data.items);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      setError(apiMessage(err, "Could not load users."));
    } finally {
      setLoading(false);
    }
  }, [q.applied, q.sortBy, q.sortOrder, q.page, q.perPage]);

  useEffect(() => {
    // `ready` is false until the query string has been read. Fetching before
    // then issues a throwaway request with default filters, then immediately
    // repeats it with the real ones.
    if (!q.ready) return;
    fetchUsers();
  }, [fetchUsers, q.ready]);

  // Roles drive both the filter and the pickers; fetched once.
  useEffect(() => {
    if (!can("role-view")) return;
    roleApi
      .list()
      .then((res) => setRoles(res.data))
      .catch(() => setRoles([]));
  }, [can]);


  // --- row actions ---
  const runAction = async (
    id: string,
    action: () => Promise<{ data: ManagedUser }>,
    successMessage: string
  ) => {
    setBusy(id);
    try {
      const res = await action();
      setRows((prev) => prev.map((r) => (r.id === res.data.id ? res.data : r)));
      show(successMessage);
    } catch (err) {
      show(apiMessage(err, "Action failed."), "error");
    } finally {
      setBusy(null);
    }
  };

  const handleToggleStatus = (user: ManagedUser) =>
    runAction(
      user.id,
      () => adminApi.toggleStatus(user.id),
      `${user.full_name} is now ${user.status === "ACTIVE" ? "inactive" : "active"}.`
    );

  const handleApprove = (user: ManagedUser) =>
    runAction(user.id, () => adminApi.approveUser(user.id), `${user.full_name} approved.`);

  const handleUnlock = (user: ManagedUser) =>
    runAction(user.id, () => adminApi.unlockUser(user.id), `${user.full_name} unlocked.`);

  /**
   * Clear a user's 2FA — the support path for a lost phone with no recovery codes
   * left. The message says both consequences out loud, because this removes a
   * control the account holder chose *and* signs out every device they have; a
   * bare "done" would understate it.
   */
  const handleResetTwoFactor = (user: ManagedUser) =>
    runAction(
      user.id,
      () => adminApi.resetTwoFactor(user.id),
      `Two-factor cleared for ${user.full_name}. They have been signed out everywhere and can set it up again.`
    );

  const handleBulk = async (kind: "delete" | UserStatus) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy("bulk");
    try {
      const res =
        kind === "delete"
          ? await adminApi.bulkDelete(ids)
          : await adminApi.bulkStatus(ids, kind);
      const { affected, skipped, skipped_reasons, message } = res.data;
      // Skipped rows are surfaced, never swallowed — a partial success must not
      // read as a total one.
      show(message, skipped > 0 ? "info" : "success", skipped > 0 ? skipped_reasons : undefined);
      if (affected > 0) {
        setSelected(new Set());
        fetchUsers();
      }
    } catch (err) {
      show(apiMessage(err, "Bulk action failed."), "error");
    } finally {
      setBusy(null);
    }
  };

  // --- columns: #, Actions, Status, then data (LeapDesk's fixed order) ---
  const columns = useMemo<Column<ManagedUser>[]>(
    () => [
      {
        id: "number",
        header: "#",
        cell: (_row, index) => <span className="tabular-nums text-gray-400">{index + 1}</span>,
        className: "text-center px-0.5",
        headerClassName: "w-10 text-center px-0.5",
        hideable: false,
      },
      {
        id: "actions",
        header: "Actions",
        cell: (row) => (
          <div className="flex justify-center">
            <RowActions
              actions={[
                {
                  // First, because reading is the commonest reason to open this
                  // menu and it is the only entry with no permission of its own —
                  // if you can see the row you can open it.
                  label: "View",
                  onSelect: () => router.push(`/dashboard/users/${row.id}`),
                },
                {
                  label: "Edit",
                  visible: row.can_edit,
                  onSelect: () => {
                    setTarget(row);
                    setModal("edit");
                  },
                },
                {
                  label: "Approve",
                  visible: row.can_approve,
                  disabled: busy === row.id,
                  onSelect: () => handleApprove(row),
                },
                {
                  label: row.status === "ACTIVE" ? "Deactivate" : "Activate",
                  visible: row.can_toggle_status && row.status !== "SUSPENDED",
                  disabled: busy === row.id,
                  onSelect: () => handleToggleStatus(row),
                },
                {
                  label: "Clear lockout",
                  visible: row.can_edit,
                  disabled: busy === row.id,
                  hint: "Clears failed sign-in attempts",
                  onSelect: () => handleUnlock(row),
                },
                {
                  label: "Reset 2FA",
                  // Only offered when the account actually has it — otherwise
                  // every row grows an action that can only ever return an error.
                  visible: row.can_edit && Boolean(row.two_factor_enabled),
                  disabled: busy === row.id,
                  destructive: true,
                  hint: "Clears their authenticator and signs out every device",
                  onSelect: () => handleResetTwoFactor(row),
                },
                {
                  label: "Delete",
                  destructive: true,
                  visible: row.can_delete,
                  onSelect: () => {
                    setTarget(row);
                    setModal("delete");
                  },
                },
              ]}
            />
          </div>
        ),
        className: "text-center !px-0 w-0",
        headerClassName: "text-center !px-0 w-0",
        hideable: false,
      },
      {
        id: "status",
        header: "Status",
        sortKey: "status",
        cell: (row) => {
          const meta = STATUS_TONE[row.status];
          const clickable = row.can_toggle_status && row.status !== "SUSPENDED";
          return (
            <div className="flex justify-center">
              <Badge
                tone={meta.tone}
                disabled={busy === row.id}
                onClick={clickable ? () => handleToggleStatus(row) : undefined}
                title={
                  clickable
                    ? "Click to toggle"
                    : row.status === "SUSPENDED"
                      ? "Suspended accounts must be changed from Edit"
                      : undefined
                }
              >
                {meta.label}
              </Badge>
            </div>
          );
        },
        className: "text-center",
        headerClassName: "text-center w-[130px]",
      },
      {
        id: "user",
        header: "User",
        sortKey: "first_name",
        cell: (row) => (
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
              {row.initials}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                {row.full_name}
              </p>
              {row.designation && (
                <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                  {row.designation}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "email",
        header: "Email",
        sortKey: "email",
        cell: (row) => <span className="truncate text-gray-500 dark:text-gray-400">{row.email}</span>,
      },
      {
        id: "roles",
        header: "Roles",
        cell: (row) =>
          row.roles.length === 0 ? (
            <span className="text-[11px] text-gray-400 dark:text-gray-500">No role</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {row.roles.map((r) => (
                <Badge key={r.id} tone="brand">
                  {r.display_name}
                </Badge>
              ))}
            </span>
          ),
      },
      {
        id: "account_type",
        header: "Type",
        sortKey: "account_type",
        cell: (row) => (
          <Badge tone={row.account_type === "staff" ? "info" : "neutral"}>
            {row.account_type === "staff" ? "Staff" : "Partner"}
          </Badge>
        ),
        className: "text-center",
        headerClassName: "text-center w-[90px]",
      },
      {
        id: "company",
        header: "Company",
        cell: (row) => (
          <span className="truncate text-gray-500 dark:text-gray-400">
            {row.company_name ?? ""}
          </span>
        ),
      },
      {
        id: "sign_in",
        header: "Sign-in",
        cell: (row) => (
          <Badge tone={row.auth_provider === "google" ? "info" : "neutral"}>
            {row.auth_provider === "google" ? "Google" : "Password"}
          </Badge>
        ),
        className: "text-center",
        headerClassName: "text-center w-[100px]",
      },
      {
        id: "last_login",
        header: "Last login",
        sortKey: "last_login_at",
        cell: (row) => (
          <span className="whitespace-nowrap tabular-nums text-gray-400 dark:text-gray-500">
            {row.last_login_at
              ? new Date(row.last_login_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Never"}
          </span>
        ),
      },
      {
        id: "created",
        header: "Created",
        sortKey: "created_at",
        cell: (row) => (
          <span className="whitespace-nowrap tabular-nums text-gray-400 dark:text-gray-500">
            {new Date(row.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy]
  );

  const roleFilterOptions = roles.map((r) => ({ value: String(r.id), label: r.display_name }));

  return (
    <ResourceIndex<ManagedUser, typeof q.filters>
      title="Users"
      description={`${total} account${total === 1 ? "" : "s"} · roles decide what each one can do`}
      actions={can("user-create") ? <Button onClick={() => setModal("create")}>Add user</Button> : undefined}
      query={q}
      filters={[
        { type: "text", key: "search", placeholder: "Search name, email or company…", label: "Search users" },
        { type: "select", key: "status", placeholder: "All statuses", label: "Filter by status", options: STATUS_OPTIONS },
        { type: "select", key: "account_type", placeholder: "All types", label: "Filter by account type", options: ACCOUNT_TYPE_OPTIONS },
        {
          type: "select",
          key: "role_id",
          placeholder: "All roles",
          label: "Filter by role",
          options: roleFilterOptions,
          // Hidden rather than empty: roles need `role-view`, and a dropdown
          // with no options reads as broken rather than as unavailable.
          hidden: roleFilterOptions.length === 0,
        },
      ]}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      loading={loading}
      error={error}
      onRetry={fetchUsers}
      total={total}
      pages={pages}
      selectable={can("user-update") || can("user-delete")}
      bulkActions={
        <>
          {can("user-update") && (
            <>
              <BulkButton onClick={() => handleBulk("ACTIVE")} disabled={busy === "bulk"}>
                Activate
              </BulkButton>
              <BulkButton onClick={() => handleBulk("INACTIVE")} disabled={busy === "bulk"}>
                Deactivate
              </BulkButton>
            </>
          )}
          {can("user-delete") && (
            <BulkButton
              onClick={() => handleBulk("delete")}
              disabled={busy === "bulk"}
              destructive
            >
              Delete
            </BulkButton>
          )}
        </>
      }
      emptyTitle="No users yet"
      emptyHint={can("user-create") ? "Use “Add user” to create the first one." : undefined}
    >

      {modal === "create" && (
        <UserFormModal
          roles={roles}
          onClose={() => setModal(null)}
          onSaved={(user) => {
            setModal(null);
            show(`${user.full_name} created.`);
            fetchUsers();
          }}
        />
      )}

      {modal === "edit" && target && (
        <UserFormModal
          user={target}
          roles={roles}
          currentUserId={me?.id}
          onClose={() => {
            setModal(null);
            setTarget(null);
          }}
          onSaved={(user) => {
            setModal(null);
            setTarget(null);
            setRows((prev) => prev.map((r) => (r.id === user.id ? user : r)));
            show(`${user.full_name} updated.`);
          }}
        />
      )}

      {modal === "delete" && target && (
        <DeleteUserModal
          user={target}
          onClose={() => {
            setModal(null);
            setTarget(null);
          }}
          onDeleted={(name) => {
            setModal(null);
            setTarget(null);
            show(`${name} deleted.`);
            fetchUsers();
          }}
        />
      )}

      <Toast toast={toast} onDismiss={dismiss} />
    </ResourceIndex>
  );
}

function BulkButton({
  children,
  onClick,
  disabled,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-7 rounded-[5px] border px-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        destructive
          ? "border-tone-danger/40 text-tone-danger hover:bg-tone-danger/10 dark:border-tone-danger/50 dark:text-tone-danger dark:hover:bg-tone-danger/15"
          : "border-brand/20 text-gray-600 hover:bg-gray-50 dark:border-night-border dark:text-gray-400 dark:hover:bg-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

/** Create/edit form. One component, because the fields are the same. */
function UserFormModal({
  user,
  roles,
  currentUserId,
  onClose,
  onSaved,
}: {
  user?: ManagedUser;
  roles: Role[];
  currentUserId?: string;
  onClose: () => void;
  onSaved: (user: ManagedUser) => void;
}) {
  const editing = Boolean(user);
  const isSelf = Boolean(user && currentUserId && user.id === currentUserId);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: user?.email ?? "",
    password: "",
    account_type: (user?.account_type ?? "partner") as "staff" | "partner",
    status: (user?.status ?? "INACTIVE") as UserStatus,
    designation: user?.designation ?? "",
    company_name: user?.company_name ?? "",
    role_id: user?.roles[0]?.id ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Split the server's `full_name` back into two fields for editing.
  useEffect(() => {
    if (!user) return;
    const parts = user.full_name.trim().split(" ");
    setForm((f) => ({
      ...f,
      first_name: parts[0] ?? "",
      last_name: parts.slice(1).join(" "),
    }));
  }, [user]);

  const set = (key: keyof typeof form) => (value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing && user) {
        const payload: UpdateUserPayload = {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          account_type: form.account_type,
          designation: form.designation.trim() || null,
          company_name: form.company_name.trim() || null,
        };
        if (form.password) payload.password = form.password;
        // The API refuses these on your own account; don't even send them.
        if (!isSelf) {
          payload.status = form.status;
          payload.role_ids = form.role_id ? [form.role_id] : [];
        }
        const res = await adminApi.updateUser(user.id, payload);
        onSaved(res.data);
      } else {
        const payload: CreateUserPayload = {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          account_type: form.account_type,
          status: form.status,
          role_ids: form.role_id ? [form.role_id] : [],
          designation: form.designation.trim() || null,
          company_name: form.company_name.trim() || null,
        };
        if (form.password) payload.password = form.password;
        const res = await adminApi.createUser(payload);
        onSaved(res.data);
      }
    } catch (err) {
      setError(apiMessage(err, editing ? "Could not update user." : "Could not create user."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={editing ? "Edit user" : "Add user"}
      subtitle={editing ? user?.email : "Created accounts are vouched for, so they can be active immediately"}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="user-form" loading={saving}>
            {editing ? "Save changes" : "Create user"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            id="u-first"
            value={form.first_name}
            onChange={(e) => set("first_name")(e.target.value)}
            required
          />
          <Input
            label="Last name"
            id="u-last"
            value={form.last_name}
            onChange={(e) => set("last_name")(e.target.value)}
          />
        </div>

        <Input
          label="Email address"
          id="u-email"
          type="email"
          value={form.email}
          onChange={(e) => set("email")(e.target.value)}
          required
        />

        <Input
          label={editing ? "New password (leave blank to keep)" : "Password"}
          id="u-password"
          type="password"
          value={form.password}
          onChange={(e) => set("password")(e.target.value)}
          placeholder={editing ? "Unchanged" : "Min 8 chars, one uppercase, one number"}
        />
        {!editing && (
          <p className="-mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            Leave blank for a Google-only staff account — it will have no password and must sign in
            with Google.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Account type"
            id="u-type"
            options={ACCOUNT_TYPE_OPTIONS}
            value={form.account_type}
            onChange={(e) => set("account_type")(e.target.value)}
          />
          <Select
            label="Status"
            id="u-status"
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(e) => set("status")(e.target.value)}
            disabled={isSelf}
          />
        </div>

        <Select
          label="Role"
          id="u-role"
          placeholder="No role"
          options={roles.map((r) => ({ value: String(r.id), label: r.display_name }))}
          value={form.role_id ? String(form.role_id) : ""}
          onChange={(e) => set("role_id")(Number(e.target.value))}
          disabled={isSelf}
        />

        {isSelf && (
          <p className="-mt-2 text-[11px] text-ink dark:text-tone-warning">
            Status and role are locked on your own account — you cannot change your own access.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Designation"
            id="u-designation"
            value={form.designation}
            onChange={(e) => set("designation")(e.target.value)}
          />
          <Input
            label="Company"
            id="u-company"
            value={form.company_name}
            onChange={(e) => set("company_name")(e.target.value)}
            placeholder="Partner organisation"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-sm text-tone-danger dark:border-tone-danger/50 dark:bg-tone-danger/15 dark:text-tone-danger"
          >
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function DeleteUserModal({
  user,
  onClose,
  onDeleted,
}: {
  user: ManagedUser;
  onClose: () => void;
  onDeleted: (name: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await adminApi.deleteUser(user.id);
      onDeleted(user.full_name);
    } catch (err) {
      setError(apiMessage(err, "Could not delete user."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Delete user"
      subtitle={user.email}
      footer={
        <>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <button
            type="button"
            onClick={confirm}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-[5px] bg-tone-danger px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-tone-danger disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete user"}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Permanently delete{" "}
        <span className="font-semibold text-gray-900 dark:text-gray-100">{user.full_name}</span>?
        This cannot be undone.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-sm text-tone-danger dark:border-tone-danger/50 dark:bg-tone-danger/15 dark:text-tone-danger"
        >
          {error}
        </p>
      )}
    </Modal>
  );
}
