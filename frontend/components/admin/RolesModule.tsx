"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import ResourceIndex from "@/components/common/ResourceIndex";
import { type Column } from "@/components/common/DataTable";
import Modal from "@/components/common/Modal";
import RowActions from "@/components/common/RowActions";
import Toast, { useToast } from "@/components/common/Toast";
import { permissionApi, roleApi } from "@/lib/api/rbacApi";
import usePermissions from "@/lib/hooks/usePermissions";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
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

/** Only `delete` remains — create and edit are pages now. */
type ModalMode = "delete" | null;

export default function RolesModule() {
  const router = useRouter();
  const { can, isSuperAdmin } = usePermissions();
  const { toast, show, dismiss } = useToast();

  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Same hook as Users, even though filtering is client-side here: it owns the
  // filter/page/selection coordination either way, and the module decides
  // whether `applied` goes to the API or to `Array.filter`.
  const q = useResourceQuery({
    filters: { search: "" },
    debounced: ["search"],
    defaultSortBy: "name",
    defaultSortOrder: "asc",
    defaultPerPage: 25,
  });

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
    const term = q.applied.search.trim().toLowerCase();
    if (!term) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.display_name.toLowerCase().includes(term) ||
        (r.description ?? "").toLowerCase().includes(term)
    );
  }, [roles, q.applied.search]);

  // 0 when empty, not 1 — matches every list endpoint and what `DataTable`
  // renders (`pages === 0 ? 0 : page`). This computed the other value.
  const pages = filtered.length === 0 ? 0 : Math.ceil(filtered.length / q.perPage);
  const pageRows = filtered.slice((q.page - 1) * q.perPage, q.page * q.perPage);

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
                    onSelect: () => router.push(`/dashboard/roles/${row.id}/edit`),
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
    [can, isSuperAdmin, totalPermissions, router]
  );

  return (
    <ResourceIndex<Role, typeof q.filters>
      title="Roles & Permissions"
      description={`${roles.length} roles · ${totalPermissions} permissions. A role is a bundle of permissions; users hold roles.`}
      actions={
        can("role-create") ? (
          <Button onClick={() => router.push("/dashboard/roles/new")}>Add role</Button>
        ) : undefined
      }
      query={q}
      filters={[
        { type: "text", key: "search", placeholder: "Search roles…", label: "Search roles" },
      ]}
      columns={columns}
      rows={pageRows}
      rowKey={(r) => String(r.id)}
      loading={loading}
      error={error}
      onRetry={fetchRoles}
      total={filtered.length}
      pages={pages}
      emptyTitle="No roles"
    >

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
    </ResourceIndex>
  );
}

/**
 * Role editor: identity fields plus the permission matrix.
 *
 * The matrix is grouped exactly as the API returns it (`permission_groups`,
 * ordered), with a select-all per group — that is what makes 23 checkboxes
 * manageable, and it will matter more as the catalog grows.
 */
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
