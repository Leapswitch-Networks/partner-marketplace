"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import { Card, CardContent, CardHeader, FilterRow } from "@/components/common/Card";
import DataTable, { type Column } from "@/components/common/DataTable";
import Input from "@/components/common/Input";
import Modal from "@/components/common/Modal";
import RowActions from "@/components/common/RowActions";
import Toast, { useToast } from "@/components/common/Toast";
import { permissionApi, roleApi } from "@/lib/api/rbacApi";
import usePermissions from "@/lib/hooks/usePermissions";
import type { PermissionGroup, Role } from "@/types";

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

type ModalMode = "create" | "edit" | "delete" | null;

export default function RolesModule() {
  const { can, isSuperAdmin } = usePermissions();
  const { toast, show, dismiss } = useToast();

  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const [modal, setModal] = useState<ModalMode>(null);
  const [target, setTarget] = useState<Role | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await roleApi.list();
      setRoles(res.data);
    } catch (err) {
      setError(apiMessage(err, "Could not load roles."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    if (!can("permission-view")) return;
    permissionApi
      .list()
      .then((res) => setGroups(res.data))
      .catch(() => setGroups([]));
  }, [can]);

  const totalPermissions = useMemo(
    () => groups.reduce((sum, g) => sum + g.permissions.length, 0),
    [groups]
  );

  // Roles are a short list, so filtering and paging happen client-side —
  // there is no server-side search on /api/roles and adding one for six rows
  // would be pointless.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.display_name.toLowerCase().includes(term) ||
        (r.description ?? "").toLowerCase().includes(term)
    );
  }, [roles, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  const columns = useMemo<Column<Role>[]>(
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
        cell: (row) => {
          // A super-admin role's grants may only be edited by a super admin.
          // Editing a role's GRANTS needs role-permissions, which is now separate
          // from role-update (renaming). Gating on role-update alone would offer an
          // editable matrix that the API refuses on save — worse than read-only.
          const editable =
            can("role-update") && can("role-permissions") && (!row.is_protected || isSuperAdmin);
          return (
            <div className="flex justify-center">
              <RowActions
                actions={[
                  {
                    label:
                      can("role-update") && can("role-permissions")
                        ? "Edit permissions"
                        : "View permissions",
                    onSelect: () => {
                      setTarget(row);
                      setModal("edit");
                    },
                  },
                  {
                    label: "Delete",
                    destructive: true,
                    visible: can("role-delete") && !row.is_protected,
                    disabled: row.user_count > 0,
                    hint:
                      row.user_count > 0
                        ? `${row.user_count} user(s) hold this role — reassign them first`
                        : undefined,
                    onSelect: () => {
                      setTarget(row);
                      setModal("delete");
                    },
                  },
                ].filter((a) => a.label !== "Edit permissions" || editable || true)}
              />
            </div>
          );
        },
        className: "text-center !px-0 w-0",
        headerClassName: "text-center !px-0 w-0",
        hideable: false,
      },
      {
        id: "kind",
        header: "Kind",
        cell: (row) => (
          <div className="flex justify-center">
            <Badge
              tone={row.is_protected ? "danger" : "neutral"}
              title={
                row.is_protected
                  ? "Referenced by name in code — cannot be renamed or deleted"
                  : "Created by an administrator"
              }
            >
              {row.is_protected ? "Protected" : "Custom"}
            </Badge>
          </div>
        ),
        className: "text-center",
        headerClassName: "text-center w-[100px]",
      },
      {
        id: "role",
        header: "Role",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-gray-900 dark:text-gray-100">
              {row.display_name}
            </p>
            <p className="truncate font-mono text-[11px] text-gray-400 dark:text-gray-500">
              {row.name}
            </p>
          </div>
        ),
      },
      {
        id: "description",
        header: "Description",
        cell: (row) => (
          <span className="text-gray-500 dark:text-gray-400">{row.description ?? ""}</span>
        ),
      },
      {
        id: "permissions",
        header: "Permissions",
        cell: (row) => {
          const all = totalPermissions > 0 && row.permissions.length === totalPermissions;
          return (
            <Badge tone={all ? "brand" : "neutral"}>
              {all ? "All" : row.permissions.length}
              {!all && totalPermissions > 0 ? ` / ${totalPermissions}` : ""}
            </Badge>
          );
        },
        className: "text-center",
        headerClassName: "text-center w-[120px]",
      },
      {
        id: "users",
        header: "Users",
        cell: (row) => (
          <span className="tabular-nums text-gray-500 dark:text-gray-400">{row.user_count}</span>
        ),
        className: "text-center",
        headerClassName: "text-center w-[80px]",
      },
    ],
    [can, isSuperAdmin, totalPermissions]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Card>
        <CardHeader
          title="Roles & Permissions"
          description={`${roles.length} roles · ${totalPermissions} permissions. A role is a bundle of permissions; users hold roles.`}
          actions={
            can("role-create") ? (
              <Button onClick={() => setModal("create")}>Add role</Button>
            ) : undefined
          }
        />

        <CardContent>
          <FilterRow>
            <div className="min-w-[200px] flex-1">
              <Input
                label=""
                id="role-search"
                placeholder="Search roles…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="!h-9 !py-0 !text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => setSearch("")}
              disabled={!search}
              className="h-9 shrink-0 rounded-[5px] border border-brand/20 px-3 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-night-border dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Reset
            </button>
          </FilterRow>

          <DataTable
            className="min-h-0 flex-1"
            columns={columns}
            rows={pageRows}
            rowKey={(r) => String(r.id)}
            loading={loading}
            error={error}
            onRetry={fetchRoles}
            page={page}
            perPage={perPage}
            total={filtered.length}
            pages={pages}
            onPageChange={setPage}
            onPerPageChange={(n) => {
              setPerPage(n);
              setPage(1);
            }}
            filtersActive={Boolean(search)}
            onResetFilters={() => setSearch("")}
            emptyTitle="No roles"
          />
        </CardContent>
      </Card>

      {(modal === "create" || modal === "edit") && (
        <RoleFormModal
          role={modal === "edit" ? (target ?? undefined) : undefined}
          groups={groups}
          readOnly={
            !can(modal === "edit" ? "role-update" : "role-create") ||
            !can("role-permissions") ||
            (modal === "edit" && Boolean(target?.is_protected) && !isSuperAdmin)
          }
          onClose={() => {
            setModal(null);
            setTarget(null);
          }}
          onSaved={(role, created) => {
            setModal(null);
            setTarget(null);
            show(`${role.display_name} ${created ? "created" : "updated"}.`);
            fetchRoles();
          }}
        />
      )}

      {modal === "delete" && target && (
        <DeleteRoleModal
          role={target}
          onClose={() => {
            setModal(null);
            setTarget(null);
          }}
          onDeleted={(name) => {
            setModal(null);
            setTarget(null);
            show(`${name} deleted.`);
            fetchRoles();
          }}
        />
      )}

      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}

/**
 * Role editor: identity fields plus the permission matrix.
 *
 * The matrix is grouped exactly as the API returns it (`permission_groups`,
 * ordered), with a select-all per group — that is what makes 23 checkboxes
 * manageable, and it will matter more as the catalog grows.
 */
function RoleFormModal({
  role,
  groups,
  readOnly,
  onClose,
  onSaved,
}: {
  role?: Role;
  groups: PermissionGroup[];
  readOnly: boolean;
  onClose: () => void;
  onSaved: (role: Role, created: boolean) => void;
}) {
  const editing = Boolean(role);

  const [name, setName] = useState(role?.name ?? "");
  const [displayName, setDisplayName] = useState(role?.display_name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [checked, setChecked] = useState<Set<number>>(
    new Set(role?.permissions.map((p) => p.id) ?? [])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleGroup = (group: PermissionGroup) => {
    const ids = group.permissions.map((p) => p.id);
    const allOn = ids.every((id) => checked.has(id));
    setChecked((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const submit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing && role) {
        const res = await roleApi.update(role.id, {
          display_name: displayName.trim(),
          description: description.trim() || null,
          permission_ids: Array.from(checked),
        });
        onSaved(res.data, false);
      } else {
        const res = await roleApi.create({
          name: name.trim(),
          display_name: displayName.trim() || name.trim(),
          description: description.trim() || null,
          permission_ids: Array.from(checked),
        });
        onSaved(res.data, true);
      }
    } catch (err) {
      setError(apiMessage(err, editing ? "Could not update role." : "Could not create role."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={editing ? (readOnly ? "Role permissions" : "Edit role") : "Add role"}
      subtitle={
        editing
          ? readOnly
            ? "Read-only — this role is protected"
            : role?.name
          : "Name is referenced by code, so pick it carefully"
      }
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} type="button">
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button type="submit" form="role-form" loading={saving}>
              {editing ? "Save changes" : "Create role"}
            </Button>
          )}
        </>
      }
    >
      <form id="role-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Name (code identifier)"
            id="r-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={readOnly || editing}
            placeholder="e.g. RegionalManager"
            hint={editing ? "Cannot be changed — code references it" : "Letters, digits, - and _"}
            required
          />
          <Input
            label="Display name"
            id="r-display"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={readOnly}
            placeholder="e.g. Regional Manager"
          />
        </div>

        <Input
          label="Description"
          id="r-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={readOnly}
          placeholder="What is this role for?"
        />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Permissions</p>
            <Badge tone="brand">{checked.size} selected</Badge>
          </div>

          {groups.length === 0 && (
            <p className="rounded-[5px] border border-brand/20 px-3 py-4 text-center text-xs text-gray-400 dark:border-night-border dark:text-gray-500">
              You do not have permission to view the permission catalog.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {groups.map((group) => {
              const ids = group.permissions.map((p) => p.id);
              const allOn = ids.every((id) => checked.has(id));
              const someOn = !allOn && ids.some((id) => checked.has(id));
              return (
                <fieldset
                  key={group.id}
                  className="rounded-[5px] border border-brand/20 px-3 py-2.5 dark:border-night-border"
                >
                  <legend className="flex items-center gap-2 px-1">
                    <button
                      type="button"
                      onClick={() => !readOnly && toggleGroup(group)}
                      disabled={readOnly}
                      className="text-xs font-semibold text-gray-800 hover:text-brand disabled:cursor-not-allowed dark:text-gray-200"
                    >
                      {group.display_name}
                    </button>
                    {someOn && <Badge tone="warning">partial</Badge>}
                    {allOn && <Badge tone="success">all</Badge>}
                  </legend>
                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {group.permissions.map((permission) => (
                      <label
                        key={permission.id}
                        className={`flex items-start gap-2 rounded-[5px] px-1.5 py-1 text-xs ${
                          readOnly ? "" : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked.has(permission.id)}
                          onChange={() => toggle(permission.id)}
                          disabled={readOnly}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-gray-700 dark:text-gray-300">
                            {permission.display_name}
                          </span>
                          <span className="block truncate font-mono text-[10px] text-gray-400 dark:text-gray-500">
                            {permission.name}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>
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

function DeleteRoleModal({
  role,
  onClose,
  onDeleted,
}: {
  role: Role;
  onClose: () => void;
  onDeleted: (name: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await roleApi.remove(role.id);
      onDeleted(role.display_name);
    } catch (err) {
      setError(apiMessage(err, "Could not delete role."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Delete role"
      subtitle={role.name}
      footer={
        <>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <button
            type="button"
            onClick={confirm}
            disabled={deleting || role.user_count > 0}
            className="inline-flex items-center gap-2 rounded-[5px] bg-tone-danger px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-tone-danger disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete role"}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Delete{" "}
        <span className="font-semibold text-gray-900 dark:text-gray-100">{role.display_name}</span>?
      </p>
      {role.user_count > 0 && (
        <p className="mt-3 rounded-[5px] border border-tone-warning/40 bg-tone-warning/15 px-3 py-2 text-xs text-ink dark:border-tone-warning/40 dark:bg-tone-warning/15 dark:text-tone-warning">
          {role.user_count} user(s) still hold this role. Reassign them first — the API will refuse
          otherwise.
        </p>
      )}
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
