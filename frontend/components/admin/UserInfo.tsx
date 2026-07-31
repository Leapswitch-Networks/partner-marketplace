"use client";

import { useEffect, useState, useCallback, useRef, memo } from "react";
import { createPortal } from "react-dom";

// ── Role Select ───────────────────────────────────────────────────────────────
/**
 * Role picker driven by the real roles table.
 *
 * Was a hardcoded admin/super_admin pair; roles are data now, so the options
 * come from GET /api/roles and the value is a role id.
 */
function RoleSelect({
  value,
  onChange,
  roles,
  id,
}: {
  value: number | null;
  onChange: (v: number) => void;
  roles: Role[];
  id?: string;
}) {
  return (
    <div id={id} className="grid grid-cols-2 gap-2" role="radiogroup">
      {roles.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.id)}
            className={`relative flex flex-col items-start gap-1.5 rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40 ${
              selected
                ? "border-[#F97316] bg-orange-50 shadow-sm dark:bg-orange-950/30"
                : "border-gray-200 bg-white hover:border-[#F97316] hover:bg-orange-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-[#F97316] dark:hover:bg-orange-950/20"
            }`}
          >
            <div className="flex items-center gap-2 w-full">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-orange-100 text-[#F97316] dark:bg-orange-950/40">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              <span className={`text-sm font-semibold ${selected ? "text-[#F97316]" : "text-gray-700 dark:text-gray-300"}`}>
                {opt.display_name}
              </span>
              {selected && (
                <span className={`ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-[#F97316]`}>
                  <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 leading-tight pl-9 dark:text-gray-500">{opt.description ?? `${opt.user_count} user(s)`}</p>
          </button>
        );
      })}
    </div>
  );
}

import type { ManagedUser, Role, RoleSummary, UserStatus } from "@/types";
import { adminApi } from "@/lib/api/adminApi";
import type { CreateUserPayload, UpdateUserPayload } from "@/lib/api/adminApi";
import { roleApi } from "@/lib/api/rbacApi";

type ModalMode = "add" | "edit" | "delete" | null;

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-gray-900 dark:ring-1 dark:ring-gray-800 animate-scale-in">
        {children}
      </div>
    </div>
  );
}

function Field({
  label, id, type = "text", value, onChange, required, placeholder, disabled, hint,
}: {
  label: string; id: string; type?: string; value: string; onChange: (v: string) => void;
  required?: boolean; placeholder?: string; disabled?: boolean; hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-700 mb-1.5 dark:text-gray-300">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <input
        id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)}
        required={required} placeholder={placeholder} disabled={disabled}
        className="block w-full rounded-xl border-2 border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 disabled:bg-gray-50 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
      />
      {hint && <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function AddUserModal({ onClose, onSuccess, roles }: { onClose: () => void; onSuccess: (user: ManagedUser) => void; roles: Role[] }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm_password: "" });
  const [roleId, setRoleId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!roleId) { setError("Select a role."); return; }
    if (form.password !== form.confirm_password) { setError("Passwords do not match."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!/[A-Z]/.test(form.password)) { setError("Password must contain at least one uppercase letter."); return; }
    if (!/[0-9]/.test(form.password)) { setError("Password must contain at least one number."); return; }
    setSaving(true); setError(null);
    try {
      // The API takes first/last name and a list of role ids.
      const trimmed = form.full_name.trim();
      const spaceAt = trimmed.indexOf(" ");
      const payload: CreateUserPayload = {
        first_name: spaceAt > 0 ? trimmed.slice(0, spaceAt) : trimmed,
        last_name: spaceAt > 0 ? trimmed.slice(spaceAt + 1).trim() : "",
        email: form.email.trim(),
        password: form.password,
        account_type: "staff",
        // Admin-created accounts are vouched for, so skip the approval queue.
        status: "ACTIVE",
        role_ids: roleId ? [roleId] : [],
      };
      const res = await adminApi.createUser(payload);
      onSuccess(res.data);
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { detail?: unknown }; status?: number } })?.response;
      const detail = response?.data?.detail;
      let msg: string;
      if (Array.isArray(detail)) { const raw = (detail[0] as { msg?: string })?.msg ?? "Failed to create user."; msg = raw.replace(/^Value error,\s*/i, ""); }
      else if (typeof detail === "string" && detail) { msg = detail; }
      else if (!response) { msg = "Network error — please check your connection and try again."; }
      else { msg = `Failed to create user. (${response.status ?? "unknown"})`; }
      setError(msg);
    } finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Add User</h3>
          <p className="text-[11px] text-gray-400 mt-0.5 dark:text-gray-500">Create a new admin account</p>
        </div>
        <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        <Field label="Full name" id="add-name" value={form.full_name} onChange={set("full_name")} required placeholder="Your Full Name" />
        <Field label="Email address" id="add-email" type="email" value={form.email} onChange={set("email")} required placeholder="you@leapswitch.com" />
        <Field label="Password" id="add-password" type="password" value={form.password} onChange={set("password")} required placeholder="Min 8 characters" />
        <p className="text-[11px] text-gray-400 -mt-2.5 dark:text-gray-500">Must include an uppercase letter and a number</p>
        <Field label="Confirm password" id="add-confirm" type="password" value={form.confirm_password} onChange={set("confirm_password")} required placeholder="Repeat password" />
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 dark:text-gray-300">Role<span className="ml-0.5 text-red-400">*</span></label>
          <RoleSelect id="add-role" value={roleId} onChange={setRoleId} roles={roles} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1 border-t border-gray-100 mt-2 dark:border-gray-800">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
            {saving && <Spinner />}{saving ? "Creating…" : "Create user"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onSuccess, roles }: { user: ManagedUser; onClose: () => void; onSuccess: (updated: ManagedUser) => void; roles: Role[] }) {
  const [form, setForm] = useState({
    full_name: user.full_name,
    email: user.email,
    // Three states now, so a boolean toggle would lose SUSPENDED.
    status: user.status as UserStatus,
    role_id: user.roles[0]?.id ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));
  const isDirty =
    form.full_name !== user.full_name ||
    form.email !== user.email ||
    form.status !== user.status ||
    form.role_id !== (user.roles[0]?.id ?? null);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!isDirty) return;
    setSaving(true); setError(null);
    try {
      const payload: UpdateUserPayload = {};
      const trimmed = form.full_name.trim();
      if (trimmed !== user.full_name) {
        const spaceAt = trimmed.indexOf(" ");
        payload.first_name = spaceAt > 0 ? trimmed.slice(0, spaceAt) : trimmed;
        payload.last_name = spaceAt > 0 ? trimmed.slice(spaceAt + 1).trim() : "";
      }
      if (form.email.trim() !== user.email) payload.email = form.email.trim();
      if (form.status !== user.status) payload.status = form.status;
      if (form.role_id !== (user.roles[0]?.id ?? null)) payload.role_ids = form.role_id ? [form.role_id] : [];
      const res = await adminApi.updateUser(user.id, payload);
      onSuccess(res.data);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      const msg = Array.isArray(detail) ? (detail[0] as { msg?: string })?.msg ?? "Failed to update user." : (detail as string | undefined) ?? "Failed to update user.";
      setError(msg);
    } finally { setSaving(false); }
  };

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div
        role="checkbox" aria-checked={checked} tabIndex={0}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") onChange(!checked); }}
        onClick={() => onChange(!checked)}
        className={`h-4 w-4 rounded border-2 transition-colors flex items-center justify-center ${checked ? "bg-[#F97316] border-[#F97316]" : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"}`}
      >
        {checked && (<svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>)}
      </div>
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </label>
  );

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Edit User</h3>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[260px] dark:text-gray-500">{user.email}</p>
        </div>
        <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        <Field label="Full name" id="edit-name" value={form.full_name} onChange={set("full_name")} required />
        <Field label="Email address" id="edit-email" type="email" value={form.email} onChange={set("email")} required />
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 dark:text-gray-300">Role<span className="ml-0.5 text-red-400">*</span></label>
          <RoleSelect id="edit-role" value={form.role_id} onChange={(v) => setForm((f) => ({ ...f, role_id: v }))} roles={roles} />
        </div>
        <div>
          <label htmlFor="edit-status" className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">Status</label>
          <select
            id="edit-status"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as UserStatus }))}
            className="block w-full rounded-xl border-2 border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="ACTIVE">Active — can sign in</option>
            <option value="INACTIVE">Inactive — awaiting approval</option>
            <option value="SUSPENDED">Suspended — blocked</option>
          </select>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1 border-t border-gray-100 mt-2 dark:border-gray-800">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">Cancel</button>
          <button type="submit" disabled={saving || !isDirty} className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
            {saving && <Spinner />}{saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteUserModal({ user, onClose, onSuccess }: { user: ManagedUser; onClose: () => void; onSuccess: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true); setError(null);
    try {
      await adminApi.deleteUser(user.id);
      onSuccess(user.id);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      const msg = Array.isArray(detail) ? (detail[0] as { msg?: string })?.msg ?? "Failed to delete user." : (detail as string | undefined) ?? "Failed to delete user.";
      setError(msg); setDeleting(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="px-5 py-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
            <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Delete User</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">{user.full_name}</span>?
              This action cannot be undone.
            </p>
          </div>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={deleting} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">Cancel</button>
          <button type="button" onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {deleting && <Spinner />}{deleting ? "Deleting…" : "Delete user"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const UserTableRow = memo(function UserTableRow({
  u,
  idx,
  onEdit,
  onDelete,
}: {
  u: ManagedUser;
  idx: number;
  onEdit: (u: ManagedUser) => void;
  onDelete: (u: ManagedUser) => void;
}) {
  return (
    <tr className={`border-b border-gray-50 transition-colors hover:bg-orange-50/40 dark:border-gray-800 dark:hover:bg-orange-950/10 ${idx % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-gray-50/50 dark:bg-gray-800/20"}`}>
      <td className="w-12 px-4 py-3 text-gray-400 text-sm text-center tabular-nums 2xl:px-5 2xl:py-4 dark:text-gray-500">{idx + 1}</td>
      <td className="px-4 py-3 font-medium text-gray-900 2xl:px-5 2xl:py-4 dark:text-gray-100">{u.full_name}</td>
      <td className="px-4 py-3 text-gray-500 2xl:px-5 2xl:py-4 dark:text-gray-400">{u.email}</td>
      <td className="px-4 py-3 2xl:px-5 2xl:py-4"><RoleBadge roles={u.roles} /></td>
      <td className="px-4 py-3 2xl:px-5 2xl:py-4"><StatusBadge status={u.status} /></td>
      <td className="px-4 py-3 text-gray-400 2xl:px-5 2xl:py-4 dark:text-gray-500">{new Date(u.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</td>
      <td className="w-24 px-4 py-3 2xl:px-5 2xl:py-4"><div className="flex items-center justify-center"><RowActions user={u} onEdit={onEdit} onDelete={onDelete} /></div></td>
    </tr>
  );
});

function RoleBadge({ roles }: { roles: RoleSummary[] }) {
  if (roles.length === 0) {
    return <span className="text-[11px] text-gray-400 dark:text-gray-500">No role</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <span
          key={role.id}
          className="inline-flex items-center rounded-md bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-[#F97316] dark:bg-orange-950/40 dark:text-orange-400"
        >
          {role.display_name}
        </span>
      ))}
    </span>
  );
}

/** Three states, not a boolean — SUSPENDED is distinct from awaiting approval. */
function StatusBadge({ status }: { status: UserStatus }) {
  const styles: Record<UserStatus, { dot: string; text: string; label: string }> = {
    ACTIVE: { dot: "bg-emerald-500 dark:bg-emerald-400", text: "text-emerald-600 dark:text-emerald-400", label: "Active" },
    INACTIVE: { dot: "bg-amber-400 dark:bg-amber-500", text: "text-amber-600 dark:text-amber-400", label: "Pending approval" },
    SUSPENDED: { dot: "bg-red-500 dark:bg-red-400", text: "text-red-600 dark:text-red-400", label: "Suspended" },
  };
  const s = styles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function RowActions({ user, onEdit, onDelete }: { user: ManagedUser; onEdit: (u: ManagedUser) => void; onDelete: (u: ManagedUser) => void }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const updateCoords = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + window.scrollY + 4, left: rect.right + window.scrollX });
  };

  const toggle = () => { updateCoords(); setOpen((o) => !o); };

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    return () => { document.removeEventListener("mousedown", onPointer); window.removeEventListener("scroll", onScroll, true); };
  }, [open]);

  return (
    <>
      <button ref={btnRef} type="button" onClick={toggle} className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300" aria-label="Row actions">
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" /></svg>
      </button>
      {open && mounted && createPortal(
        <div ref={dropRef} style={{ position: "absolute", top: coords.top, left: coords.left, transform: "translateX(-100%)" }} className="z-[9999] w-40 rounded-xl border border-gray-100 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <button type="button" onClick={() => { setOpen(false); onEdit(user); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-[#F97316] dark:text-gray-300 dark:hover:bg-orange-950/30 dark:hover:text-orange-400">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Edit details
          </button>
          <button type="button" onClick={() => { setOpen(false); onDelete(user); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Delete user
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

export default function UserInfo({ initialModal }: { initialModal?: "add" }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(initialModal ?? null);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try { const res = await adminApi.listUsers({ per_page: 100 }); setUsers(res.data.items); }
    catch { setFetchError("Failed to load users. Please try again."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Roles drive the pickers; fetched once.
  useEffect(() => {
    roleApi.list().then((res) => setRoles(res.data)).catch(() => setRoles([]));
  }, []);

  const initialModalRef = useRef(initialModal);
  useEffect(() => { if (initialModalRef.current) setModal(initialModalRef.current); }, []);

  const closeModal = useCallback(() => { setModal(null); setSelectedUser(null); }, []);
  const onUserAdded = useCallback((user: ManagedUser) => { setUsers((prev) => [user, ...prev]); setModal(null); setSelectedUser(null); showToast(`${user.full_name} was added successfully.`); }, [showToast]);
  const onUserUpdated = useCallback((updated: ManagedUser) => { setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u))); setModal(null); setSelectedUser(null); showToast(`${updated.full_name} was updated successfully.`); }, [showToast]);
  const onUserDeleted = useCallback((id: string) => { setUsers((prev) => prev.filter((u) => u.id !== id)); setModal(null); setSelectedUser(null); showToast("User deleted successfully."); }, [showToast]);
  const openEdit = useCallback((user: ManagedUser) => { setSelectedUser(user); setModal("edit"); }, []);
  const openDelete = useCallback((user: ManagedUser) => { setSelectedUser(user); setModal("delete"); }, []);

  return (
    <div className="relative">
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.type === "success"
            ? <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            : <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
          {toast.msg}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 2xl:text-xl dark:text-gray-100">User Info</h2>
          {!loading && !fetchError && (
            <p className="text-xs text-gray-400 mt-0.5 dark:text-gray-500">{users.length} {users.length === 1 ? "user" : "users"} total</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={fetchUsers} disabled={loading} className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800" title="Refresh">
            <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button type="button" onClick={() => setModal("add")} className="inline-flex items-center gap-1.5 rounded-xl bg-[#F97316] px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors shadow-sm">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add User
          </button>
        </div>
      </div>

      {loading && <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-[#F97316]" /></div>}

      {!loading && fetchError && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-red-500 dark:text-red-400">{fetchError}</p>
          <button type="button" onClick={fetchUsers} className="rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">Try again</button>
        </div>
      )}

      {!loading && !fetchError && users.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <svg className="h-7 w-7 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </span>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No users yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Click &ldquo;Add User&rdquo; to create the first account.</p>
        </div>
      )}

      {!loading && !fetchError && users.length > 0 && (
        <>
          {/* Mobile cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {users.map((u) => (
              <div key={u.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate dark:text-gray-100">{u.full_name}</p>
                    <p className="mt-0.5 text-xs text-gray-500 truncate dark:text-gray-400">{u.email}</p>
                  </div>
                  <RowActions user={u} onEdit={openEdit} onDelete={openDelete} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5 dark:border-gray-700">
                  <div className="flex items-center gap-2"><RoleBadge roles={u.roles} /><StatusBadge status={u.status} /></div>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">{new Date(u.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop/tablet table */}
          <div className="hidden sm:block rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-sm 2xl:text-base">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-gray-100 bg-gray-50 text-left dark:border-gray-800 dark:bg-gray-800/60">
                    <th className="w-12 px-4 py-3 font-semibold text-gray-600 text-center 2xl:px-5 2xl:py-4 dark:text-gray-400">#</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 2xl:px-5 2xl:py-4 dark:text-gray-400">Name</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 2xl:px-5 2xl:py-4 dark:text-gray-400">Email</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 2xl:px-5 2xl:py-4 dark:text-gray-400">Role</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 2xl:px-5 2xl:py-4 dark:text-gray-400">Status</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 2xl:px-5 2xl:py-4 dark:text-gray-400">Member Since</th>
                    <th className="w-24 px-4 py-3 font-semibold text-gray-600 text-center 2xl:px-5 2xl:py-4 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, idx) => (
                    <UserTableRow key={u.id} u={u} idx={idx} onEdit={openEdit} onDelete={openDelete} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {modal === "add" && <AddUserModal onClose={closeModal} onSuccess={onUserAdded} roles={roles} />}
      {modal === "edit" && selectedUser && <EditUserModal user={selectedUser} onClose={closeModal} onSuccess={onUserUpdated} roles={roles} />}
      {modal === "delete" && selectedUser && <DeleteUserModal user={selectedUser} onClose={closeModal} onSuccess={onUserDeleted} />}
    </div>
  );
}
