"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/common/Button";
import ResourceIndex from "@/components/common/ResourceIndex";
import CloneRoleModal from "@/components/admin/CloneRoleModal";
import RoleForm from "@/components/admin/RoleForm";
import RoleShow from "@/components/admin/RoleShow";
import { type Column } from "@/components/common/DataTable";
import DeleteDialog from "@/components/common/DeleteDialog";
import {
  actionsColumn,
  badgeColumn,
  dateColumn,
  numberColumn,
  stackedCell,
} from "@/components/common/columns";
import Toast, { useToast } from "@/components/common/Toast";
import { navIcon } from "@/components/dashboard/navIcons";
import { permissionApi, roleApi } from "@/lib/api/rbacApi";
import useModalState from "@/lib/hooks/useModalState";
import usePermissions from "@/lib/hooks/usePermissions";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import type { PermissionGroup, Role } from "@/types";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * Create, edit and view are modals, matching Users — owner's call, 2026-08-11.
 *
 * The routes under `/dashboard/roles/*` still exist and still render the
 * full-page shells. They are the deep-linkable, bookmarkable version and the
 * target of every link elsewhere in the app; the modal is the path from *this*
 * table, where losing your filters and scroll position to edit one field is the
 * whole reason the modals were asked for.
 */
type ModalMode = "create" | "edit" | "view" | "delete" | "clone";

export default function RolesModule() {
  const router = useRouter();
  const { can, isSuperAdmin } = usePermissions();
  const { toasts, show, dismiss } = useToast();

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
    // 30, matching Users' owner-set default so switching modules keeps the
    // same density (2026-08-13).
    defaultPerPage: 30,
  });

  const modal = useModalState<ModalMode, Role>();

  /*
    **Not a paged server query, and that is a decision rather than an oversight.**

    `/api/roles` returns the whole list — it is not paged and has no server-side
    search, because there are six roles and adding an endpoint to satisfy a hook
    would be the tail wagging the dog. So this loads once and the filtering and
    paging below happen in the browser.

    A paged query refetches whenever its arguments change, which for a
    client-filtered list would mean a network round trip on every keystroke.
    Recorded in `MODULE_PARITY_PLAN.md` § 4 as the one module that stays
    open-coded; revisit if roles ever become a list you scroll.
  */
  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await roleApi.list();
      setRoles(res.data);
    } catch (err) {
      setError(extractApiError(err, "Could not load roles."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Handed to a callback rather than called in the body. `load` sets state,
    // and calling it directly here runs those updates inside the effect's own
    // synchronous phase — a second render pass for values React could have had
    // in the first, which is what `react-hooks/set-state-in-effect` is for. One
    // microtask's remove makes them ordinary updates, and nothing else changes:
    // the fetch still starts on mount and the retry path still calls `load`.
    void Promise.resolve().then(fetchRoles);
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
      numberColumn<Role>(),
      actionsColumn<Role>((row) => [
        {
          // First, and with no permission of its own — if you can see the row you
          // can open it. Same rule as Users.
          label: "View",
          onSelect: () => modal.open("view", row),
        },
        {
          /*
            Editing a role's GRANTS needs `role-permissions`, which is separate
            from `role-update` (renaming). Without both, the same screen is
            read-only — and the label says so, rather than offering an editable
            matrix the API refuses on save.

            **The protected-role clause was written and never took effect.** The
            old code computed exactly this condition into a local called
            `editable`, then applied it as
            `.filter((a) => a.label !== "Edit permissions" || editable || true)` —
            and `|| true` makes the whole predicate constant, so the variable was
            dead and every caller saw "Edit permissions" regardless. Restored as
            the label rule it was evidently meant to be: a protected role's grants
            are a super-admin matter, because those role names are referenced
            from code.
          */
          label:
            can("role-update") && can("role-permissions") && (!row.is_protected || isSuperAdmin)
              ? "Edit permissions"
              : "View permissions",
          onSelect: () =>
            can("role-update") && can("role-permissions") && (!row.is_protected || isSuperAdmin)
              ? modal.open("edit", row)
              : modal.open("view", row),
        },
        {
          label: "Clone",
          visible: can("role-create"),
          hint: "Copy this role's permissions into a new one",
          onSelect: () => modal.open("clone", row),
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
          onSelect: () => modal.open("delete", row),
        },
      ]),
      badgeColumn<Role>({
        id: "kind",
        header: "Kind",
        tone: (row) => (row.is_protected ? "danger" : "neutral"),
        label: (row) => (row.is_protected ? "Protected" : "Custom"),
        title: (row) =>
          row.is_protected
            ? "Referenced by name in code — cannot be renamed or deleted"
            : "Created by an administrator",
        width: "w-[100px]",
      }),
      {
        id: "role",
        header: "Role",
        cell: (row) => stackedCell(row.display_name, <span className="font-mono">{row.name}</span>),
      },
      {
        id: "description",
        header: "Description",
        cell: (row) => (
          <span className="text-ink-label dark:text-night-muted">{row.description ?? ""}</span>
        ),
      },
      badgeColumn<Role>({
        id: "permissions",
        header: "Permissions",
        tone: (row) =>
          totalPermissions > 0 && row.permissions.length === totalPermissions ? "brand" : "neutral",
        label: (row) => {
          const all = totalPermissions > 0 && row.permissions.length === totalPermissions;
          return all
            ? "All"
            : `${row.permissions.length}${totalPermissions > 0 ? ` / ${totalPermissions}` : ""}`;
        },
        width: "w-[120px]",
      }),
      {
        id: "users",
        header: "Users",
        cell: (row) => (
          <span className="tabular-nums text-ink-label dark:text-night-muted">
            {row.user_count}
          </span>
        ),
        className: "text-center",
        headerClassName: "text-center w-[80px]",
      },
      // `Role.created_at` has always been on the wire and the table never showed
      // it. Every other index ends with a Created column; this one now does too.
      // No `sortKey` — this list is sorted in the browser, not by the API.
      dateColumn<Role>({ id: "created", header: "Created", value: (row) => row.created_at }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can, isSuperAdmin, totalPermissions, router, modal.open]
  );

  return (
    <ResourceIndex<Role, typeof q.filters>
      icon={navIcon("roles")}
      title="Roles & Permissions"
      // The role count moved to the pager; the permission count stays, because
      // it is the denominator the Permissions column is read against and it
      // appears nowhere else on the page.
      description={`A role is a bundle of permissions; users hold roles. ${totalPermissions} permissions exist.`}
      actions={
        <>
          <Button variant="outline" onClick={() => router.push("/dashboard/roles/matrix")}>
            Matrix
          </Button>
          {can("role-create") && (
            <Button onClick={() => modal.open("create")}>
              {navIcon("roles")}
              Add Role
            </Button>
          )}
        </>
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
      table="vendor"
      rowNoun="role"
      emptyTitle="No roles"
      emptyHint={
        can("role-create") ? (
          <Button size="sm" onClick={() => modal.open("create")}>
            Create First Role
          </Button>
        ) : undefined
      }
    >
      {/*
        Create / edit / view as modals, each refreshing the table on a save so the
        row reflects the change without a reload — the point of moving off the
        pages in the first place.
      */}
      {(modal.is("create") || modal.is("edit")) && (
        <RoleForm
          asModal
          roleId={modal.is("edit") ? modal.target?.id : undefined}
          onDone={(action) => {
            const wasEdit = modal.is("edit");
            modal.close();
            if (action === "saved") {
              show(wasEdit ? "Role updated." : "Role created.");
              fetchRoles();
            }
          }}
        />
      )}

      {modal.is("view") && modal.target && (
        <RoleShow
          asModal
          roleId={modal.target.id}
          onClose={modal.close}
          // `switchTo`, not `open` — it keeps the row.
          onEdit={() => modal.switchTo("edit")}
        />
      )}

      {modal.is("clone") && modal.target && (
        <CloneRoleModal
          role={modal.target}
          onClose={modal.close}
          onCloned={(role) => {
            const from = modal.target!.display_name;
            modal.close();
            show(`${role.display_name} created from ${from}.`);
            fetchRoles();
          }}
        />
      )}

      {modal.is("delete") && modal.target && (
        <DeleteDialog
          noun="role"
          name={modal.target.display_name}
          subtitle={modal.target.name}
          // The API refuses while anyone still holds the role, so the button is
          // blocked here too — and the reason is stated below rather than left as
          // a disabled control with no explanation.
          confirmDisabled={modal.target.user_count > 0}
          onConfirm={() => roleApi.remove(modal.target!.id)}
          onDeleted={() => {
            const name = modal.target!.display_name;
            modal.close();
            show(`${name} deleted.`);
            fetchRoles();
          }}
          onClose={modal.close}
        >
          {modal.target.user_count > 0 && (
            <p className="rounded-[5px] border border-tone-warning/40 bg-tone-warning/15 px-3 py-2 text-xs text-ink dark:border-tone-warning/40 dark:text-tone-warning">
              {modal.target.user_count} user(s) still hold this role. Reassign them first — the API
              will refuse otherwise.
            </p>
          )}
        </DeleteDialog>
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </ResourceIndex>
  );
}

/*
  `DeleteRoleModal` lived here until 2026-08-11 and is now `DeleteDialog`.

  It was the **last** of the hand-rolled destructive controls the 2026-08-10 pass
  set out to remove, and it had every defect that entry described: `px-5 py-2.5`
  where the primitive uses `px-7 py-1.5`, its own busy flag, its own error banner,
  its own disabled opacity — and `hover:bg-tone-danger` on a `bg-tone-danger`
  button, which is the same colour, so **the most destructive control on this page
  was the one with no hover state at all.** Nobody wrote that on purpose; it is
  what copy-paste does, and it survived a pass that was explicitly looking for it
  because it was a bare `<button>` rather than a `Button`.
*/
