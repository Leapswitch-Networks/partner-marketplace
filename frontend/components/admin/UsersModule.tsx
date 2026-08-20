"use client";

import { useMemo, useState } from "react";
import Avatar from "@/components/common/Avatar";
import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DeleteDialog from "@/components/common/DeleteDialog";
import { type Column } from "@/components/common/DataTable";
import ResourceIndex from "@/components/common/ResourceIndex";
import SendEmailModal from "@/components/admin/SendEmailModal";
import UserForm from "@/components/admin/UserForm";
import UserShow from "@/components/admin/UserShow";
import Toast, { useToast } from "@/components/common/Toast";
import {
  actionsColumn,
  badgeColumn,
  dateColumn,
  numberColumn,
  stackedCell,
} from "@/components/common/columns";
import { navIcon } from "@/components/dashboard/navIcons";
import { extractApiError } from "@/lib/utils/apiError";
import useModalState from "@/lib/hooks/useModalState";
import usePermissions from "@/lib/hooks/usePermissions";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import { useBulkAction } from "@/lib/hooks/useBulkAction";
import { useListPartnersQuery } from "@/lib/api/endpoints/partnersEndpoints";
import { useListRolesQuery } from "@/lib/api/endpoints/rolesEndpoints";
import {
  useApproveUserMutation,
  useBulkDeleteUsersMutation,
  useBulkUserStatusMutation,
  useDeleteUserMutation,
  useListUsersQuery,
  useResetUserTwoFactorMutation,
  useToggleUserStatusMutation,
  useUnlockUserMutation,
} from "@/lib/api/endpoints/usersEndpoints";
import {
  ACCOUNT_TYPE_LABELS,
  type AccountType,
  type ManagedUser,
  type UserStatus,
} from "@/types";

/**
 * The Status column holds two values and no others — owner's call, 2026-08-11.
 * SUSPENDED is gone from the `user_status` column itself (migration
 * `b3d7e02f4c19`), not merely hidden here, so a row can no longer arrive
 * carrying a third value that this map has no entry for.
 *
 * Typed `Record<UserStatus, …>` deliberately: if the domain ever grows again,
 * this fails to compile rather than rendering an empty badge.
 */
const STATUS_TONE: Record<UserStatus, { tone: "success" | "warning"; label: string }> = {
  ACTIVE: { tone: "success", label: "Active" },
  INACTIVE: { tone: "warning", label: "Inactive" },
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: "internal", label: "Staff" },
  { value: "external", label: "Partner" },
];

/** Create, edit and view are modals again — owner's call, 2026-08-10. */
type ModalMode = "delete" | "email" | "create" | "edit" | "view" | "status";

/**
 * The Users index.
 *
 * **This module is the worked example for every module after it.** Everything
 * here that is not specific to users lives in a shared piece, and the list is
 * worth knowing before writing the next one:
 *
 * | Concern | Where it lives |
 * |---|---|
 * | Page shell — header, filter row, table, paging | `ResourceIndex` |
 * | Filter/sort/page/selection state, URL round-trip | `useResourceQuery` |
 * | Fetching, caching, loading, error, invalidation | `lib/api/endpoints/usersEndpoints` |
 * | Bulk write: skipped reasons, clear selection | `useBulkAction` |
 * | Which dialog is open, and on which row | `useModalState` |
 * | `#`, `Actions`, badge and date columns | `columns.tsx` |
 * | Delete confirmation and its wording | `DeleteDialog` |
 * | Toast stack | `Toast` |
 *
 * What is left below is genuinely about users: which API to call, which columns
 * to show, which actions a row offers, and what each one says when it works.
 *
 * **Three bugs were found by extracting these**, each one hiding in code that had
 * been copied and then diverged. They are recorded on the pieces that now own
 * them: the `#` column's paging (`columns.tsx`), the two tables disagreeing about
 * the cell index (`VendorDataTable`), and the bulk actions reading a selection
 * nothing wrote to (below). None was visible without clicking to page 2 or
 * selecting a row — which is the argument for having one copy rather than four
 * careful ones.
 */
export default function UsersModule({ initialModal }: { initialModal?: ModalMode }) {
  const { can } = usePermissions();
  const { toasts, show, dismiss } = useToast();

  // --- query state ---
  //
  // One hook replaces eleven `useState`s and three coordinating `useEffect`s.
  // It also owns the rules those effects encoded — reset to page 1 on a filter
  // change, clear the selection with it, debounce text but not dropdowns — so
  // the next seven modules inherit them instead of reimplementing them.
  const q = useResourceQuery({
    filters: { search: "", status: "", account_type: "", role_id: "", organisation_id: "" },
    debounced: ["search"],
    defaultSortBy: "created_at",
    defaultSortOrder: "desc",
    // 30 by owner's instruction, 2026-08-10 — a fixed default rather than
    // `autoPerPage`'s viewport measurement. The two cannot both own this number:
    // `autoPerPage` recomputes on every resize until the user picks a size, so
    // seeding 30 alongside it would have the page silently resize back to
    // whatever fits. The dropdown still overrides, and that choice sticks.
    defaultPerPage: 30,
  });

  // --- data ---
  // PM-41 § 4.5. `status`, `account_type`, `role_id` and `organisation_id` are
  // all filters *and* things the writes here change, so a patched row could sit
  // in a view it no longer belongs to. Invalidation re-runs the filtered query.
  const listQuery = useListUsersQuery(
    {
      search: q.applied.search || undefined,
      status: (q.applied.status as UserStatus) || undefined,
      account_type: (q.applied.account_type as AccountType) || undefined,
      role_id: q.applied.role_id ? Number(q.applied.role_id) : undefined,
      organisation_id: q.applied.organisation_id || undefined,
      sort_by: q.sortBy,
      sort_order: q.sortOrder,
      page: q.page,
      per_page: q.perPage,
    },
    { skip: !q.ready },
  );

  const modal = useModalState<ModalMode, ManagedUser>(initialModal);

  // Roles drive both the filter and the pickers. Now a shared cache entry rather
  // than a fetch-on-mount, so arriving here from the invite form — which needs
  // the same unchanging list — costs nothing. `?? []` keeps the old rule that a
  // failure leaves the picker empty instead of blocking the table.
  const { data: roles = [] } = useListRolesQuery(undefined, { skip: !can("role-view") });

  // --- row actions ---
  const [approveUser] = useApproveUserMutation();
  const [unlockUser] = useUnlockUserMutation();
  const [resetTwoFactor] = useResetUserTwoFactorMutation();
  const [toggleUserStatus] = useToggleUserStatusMutation();
  const [removeUser] = useDeleteUserMutation();

  /*
    An id, not a boolean. It disables the one row being written rather than the
    whole table: a boolean would either freeze every row while one writes, or
    freeze none and let the same row be clicked twice — and a second click on a
    toggle sends it straight back, which reads as the action having silently
    failed.
  */
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<unknown>, successMessage: string) => {
    setBusy(id);
    try {
      await action();
      show(successMessage);
    } catch (err) {
      show(extractApiError(err, "Action failed."), "error");
    } finally {
      setBusy(null);
    }
  };

  /*
    **`q.selected`, not a local one.** This module used to keep its own
    `useState<Set<string>>` here and read it in the bulk handler — but the table
    is wired to `useResourceQuery`'s selection by `ResourceIndex`, so nothing
    ever wrote to the local copy. Every bulk action saw an empty set and returned
    at the `ids.length === 0` guard: **the Set Active, Set Inactive and Delete
    Selected buttons did nothing at all**, silently, for as long as they have
    existed. Two states meaning one thing is how that happens; there is one now.
  */
  const [bulkDeleteUsers] = useBulkDeleteUsersMutation();
  const [bulkUserStatus] = useBulkUserStatusMutation();

  /*
    `onChanged` is now a no-op, and that is the point: the bulk mutations
    invalidate the collection themselves. It stays a required prop because
    `useBulkAction`'s other two jobs — surfacing `skipped_reasons` so a partial
    success cannot read as a total one, and only clearing the selection when
    something actually changed — are still worth having, and are the reason this
    hook survived the conversion while the per-row one did not.
  */
  const bulk = useBulkAction({
    show,
    onChanged: () => {},
    clearSelection: () => q.setSelected(new Set()),
  });

  const runBulk = (kind: "delete" | UserStatus) => {
    const ids = Array.from(q.selected);
    if (ids.length === 0) return;
    return bulk.run(() =>
      kind === "delete"
        ? bulkDeleteUsers(ids)
            .unwrap()
            .then((data) => ({ data }))
        : bulkUserStatus({ user_ids: ids, status: kind })
            .unwrap()
            .then((data) => ({ data }))
    );
  };

  const toggleStatus = (user: ManagedUser) =>
    run(
      user.id,
      () => toggleUserStatus(user.id).unwrap(),
      `${user.full_name} is now ${user.status === "ACTIVE" ? "inactive" : "active"}.`
    );

  // --- columns: #, Actions, Status, then data (LeapDesk's fixed order) ---
  // Organisations for the filter and the "belongs to" column. A shared cache
  // entry — `PartnersModule` reads the same query — replacing a fetch-on-mount.
  // A failure still leaves the users table readable rather than blocking it,
  // because an absent list only empties the picker.
  const { data: organisationPage } = useListPartnersQuery({ per_page: 100 });
  const organisations = useMemo(
    () => (organisationPage?.items ?? []).map((p) => ({ id: p.id, name: p.name })),
    [organisationPage]
  );
  const organisationName = (id: string | null | undefined) =>
    id ? organisations.find((o) => o.id === id)?.name ?? "—" : "Internal";

  const columns = useMemo<Column<ManagedUser>[]>(
    () => [
      numberColumn(),
      actionsColumn((row) => [
        {
          // First, because reading is the commonest reason to open this menu and
          // it is the only entry with no permission of its own — if you can see
          // the row you can open it.
          label: "View",
          onSelect: () => modal.open("view", row),
        },
        {
          label: "Edit",
          visible: row.can_edit,
          onSelect: () => modal.open("edit", row),
        },
        {
          // Reference order: View → Edit → Approve User → Send Email → Delete.
          // Its own label is "Approve User", not "Approve".
          label: "Approve User",
          visible: row.can_approve,
          disabled: busy === row.id,
          onSelect: () =>
            run(row.id, () => approveUser(row.id).unwrap(), `${row.full_name} approved.`),
        },
        {
          label: "Send Email",
          // `user-email` is separate from `user-update`: sending mail as the
          // platform is a different capability from editing a record.
          visible: can("user-email"),
          onSelect: () => modal.open("email", row),
        },
        {
          label: row.status === "ACTIVE" ? "Deactivate" : "Activate",
          // No status exclusion left: with two values the toggle is always
          // meaningful, and `can_toggle_status` — which the API computes — is the
          // only thing that decides.
          visible: row.can_toggle_status,
          disabled: busy === row.id,
          onSelect: () => toggleStatus(row),
        },
        {
          label: "Clear lockout",
          visible: row.can_edit,
          disabled: busy === row.id,
          hint: "Clears failed sign-in attempts",
          onSelect: () =>
            run(row.id, () => unlockUser(row.id).unwrap(), `${row.full_name} unlocked.`),
        },
        {
          label: "Reset 2FA",
          // Only offered when the account actually has it — otherwise every row
          // grows an action that can only ever return an error.
          visible: row.can_edit && Boolean(row.two_factor_enabled),
          disabled: busy === row.id,
          destructive: true,
          hint: "Clears their authenticator and signs out every device",
          // Both consequences said out loud: this removes a control the account
          // holder chose *and* signs out every device they have. A bare "done"
          // would understate it.
          onSelect: () =>
            run(
              row.id,
              () => resetTwoFactor(row.id).unwrap(),
              `Two-factor cleared for ${row.full_name}. They have been signed out everywhere and can set it up again.`
            ),
        },
        {
          label: "Delete",
          destructive: true,
          visible: row.can_delete,
          onSelect: () => modal.open("delete", row),
        },
      ]),
      badgeColumn<ManagedUser>({
        id: "status",
        header: "Status",
        sortKey: "status",
        tone: (row) => STATUS_TONE[row.status].tone,
        label: (row) => STATUS_TONE[row.status].label,
        disabled: (row) => busy === row.id,
        // `undefined` for a row that may not be toggled leaves the badge inert
        // rather than offering a control the API would refuse.
        onClick: (row) =>
          row.can_toggle_status ? () => modal.open("status", row) : undefined,
        title: (row) => (row.can_toggle_status ? "Click to change status" : undefined),
      }),
      {
        id: "user",
        header: "User",
        sortKey: "first_name",
        cell: (row) => (
          <div className="flex items-center gap-2">
            <Avatar user={row} size="sm" />
            {stackedCell(row.full_name, row.designation)}
          </div>
        ),
      },
      {
        id: "email",
        header: "Email",
        sortKey: "email",
        cell: (row) => (
          <span className="truncate text-ink-label dark:text-night-muted">{row.email}</span>
        ),
      },
      {
        id: "roles",
        header: "Role",
        cell: (row) =>
          row.roles.length === 0 ? (
            <span className="text-ink-label dark:text-night-muted">No role</span>
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
        // Organisation membership. The write path landed in CORE_EXTRACTION_PLAN
        // phase 2 and nothing displayed it, so an admin could set it and never
        // confirm it. "Internal" rather than a dash for NULL: the absence is a
        // meaningful value here — a first-party account — not missing data.
        id: "organisation",
        header: "Organisation",
        cell: (row) => organisationName(row.organisation_id),
      },
      badgeColumn<ManagedUser>({
        id: "account_type",
        header: "Type",
        sortKey: "account_type",
        tone: (row) => (row.account_type === "internal" ? "info" : "neutral"),
        label: (row) => ACCOUNT_TYPE_LABELS[row.account_type],
        width: "w-[90px]",
      }),
      badgeColumn<ManagedUser>({
        id: "sign_in",
        header: "Sign-in",
        tone: (row) => (row.auth_provider === "google" ? "info" : "neutral"),
        label: (row) => (row.auth_provider === "google" ? "Google" : "Password"),
        width: "w-[100px]",
      }),
      dateColumn<ManagedUser>({
        id: "last_login",
        header: "Last login",
        sortKey: "last_login_at",
        value: (row) => row.last_login_at,
        // "Never" rather than the default em dash: an account that has never
        // signed in is a fact worth stating, not a missing value.
        fallback: "Never",
      }),
      dateColumn<ManagedUser>({
        id: "created",
        header: "Created",
        sortKey: "created_at",
        value: (row) => row.created_at,
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, can, modal.open]
  );

  const roleFilterOptions = roles.map((r) => ({ value: String(r.id), label: r.display_name }));

  return (
    <ResourceIndex<ManagedUser, typeof q.filters>
      // Heading, description and button label are the reference's, verbatim —
      // `CORE_COMPLETION_PLAN.md` § 1.1 puts every label under 🔒 exact parity.
      // The count that used to live in the description moved to the pager, which
      // already says "1–25 of 137" and does not go stale between fetches.
      icon={navIcon("users")}
      title="Users Management"
      description="Manage users and their permissions"
      actions={
        can("user-create") ? (
          <Button onClick={() => modal.open("create")}>
            {navIcon("userAdd")}
            Add User
          </Button>
        ) : undefined
      }
      query={q}
      filters={[
        // No `icon`: a text filter gets the magnifier by default now. It was a
        // four-line SVG declared in this file, which every next module would
        // have copied to get the same field.
        { type: "text", key: "search", placeholder: "Search users...", label: "Search users" },
        { type: "select", key: "status", placeholder: "All Status", searchPlaceholder: "Search status...", label: "Filter by status", options: STATUS_OPTIONS },
        { type: "select", key: "account_type", placeholder: "All Types", searchPlaceholder: "Search types...", label: "Filter by account type", options: ACCOUNT_TYPE_OPTIONS },
        {
          type: "select",
          key: "organisation_id",
          placeholder: "All Organisations",
          searchPlaceholder: "Search organisations...",
          label: "Filter by organisation",
          options: organisations.map((o) => ({ value: o.id, label: o.name })),
        },
        {
          type: "select",
          key: "role_id",
          placeholder: "All Roles",
          searchPlaceholder: "Search roles...",
          label: "Filter by role",
          options: roleFilterOptions,
          // Hidden rather than empty: roles need `role-view`, and a dropdown
          // with no options reads as broken rather than as unavailable.
          hidden: roleFilterOptions.length === 0,
        },
      ]}
      columns={columns}
      result={listQuery}
      rowKey={(r) => r.id}
      errorMessage="Could not load users."
      selectable={can("user-update") || can("user-delete")}
      bulkActions={
        <>
          {can("user-update") && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runBulk("ACTIVE")}
                disabled={bulk.busy}
              >
                Set Active
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runBulk("INACTIVE")}
                disabled={bulk.busy}
              >
                Set Inactive
              </Button>
            </>
          )}
          {can("user-delete") && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => runBulk("delete")}
              disabled={bulk.busy}
            >
              Delete Selected
            </Button>
          )}
        </>
      }
      // The reference's DataTable, opt-in. Users only until it is signed off.
      table="vendor"
      rowNoun="user"
      emptyTitle="No users found"
      emptyHint={
        can("user-create") ? (
          <Button size="sm" onClick={() => modal.open("create")}>
            Create First User
          </Button>
        ) : undefined
      }
    >
      {modal.is("email") && modal.target && (
        <SendEmailModal
          user={modal.target}
          onClose={modal.close}
          onSent={(message) => {
            modal.close();
            show(message);
          }}
        />
      )}

      {/*
        Create / edit / view as modals. Each one refreshes the table on a save
        so the row reflects the change without a reload — the point of moving
        off the pages in the first place.
      */}
      {(modal.is("create") || modal.is("edit")) && (
        <UserForm
          asModal
          userId={modal.is("edit") ? modal.target?.id : undefined}
          onDone={(action) => {
            const wasEdit = modal.is("edit");
            modal.close();
            if (action === "saved") {
              // `UserForm`'s own save invalidates the collection.
              show(wasEdit ? "User updated." : "User created.");
            }
          }}
        />
      )}

      {modal.is("view") && modal.target && (
        <UserShow
          asModal
          userId={modal.target.id}
          onClose={modal.close}
          // `switchTo`, not `open` — it keeps the row. `open("edit")` would need
          // it passing again, and that is the spelling that loses it.
          onEdit={() => modal.switchTo("edit")}
        />
      )}

      {/*
        Status is a click on a badge — the easiest control in the table to hit by
        accident, and it silently changes whether someone can sign in at all. It
        confirms first, like delete does.
      */}
      {modal.is("status") && modal.target && (
        <ConfirmDialog
          title={modal.target.status === "ACTIVE" ? "Deactivate user" : "Activate user"}
          subtitle={modal.target.email}
          confirmLabel={modal.target.status === "ACTIVE" ? "Deactivate" : "Activate"}
          busyLabel={modal.target.status === "ACTIVE" ? "Deactivating…" : "Activating…"}
          tone={modal.target.status === "ACTIVE" ? "danger" : "primary"}
          errorFallback="Could not change status."
          onConfirm={async () => {
            // No `patchRow`: `status` is a filter on this table, so the toggled
            // row may no longer belong in the current view — which only the
            // server can decide. The mutation invalidates the collection and the
            // filtered query re-runs.
            await toggleUserStatus(modal.target!.id).unwrap();
          }}
          onConfirmed={() => {
            const name = modal.target!.full_name;
            const nowActive = modal.target!.status !== "ACTIVE";
            modal.close();
            show(`${name} is now ${nowActive ? "active" : "inactive"}.`);
          }}
          onClose={modal.close}
        >
          {modal.target.status === "ACTIVE" ? (
            <>
              Deactivate{" "}
              <span className="font-semibold text-ink dark:text-gray-100">
                {modal.target.full_name}
              </span>
              ? They will not be able to sign in until reactivated.
            </>
          ) : (
            <>
              Activate{" "}
              <span className="font-semibold text-ink dark:text-gray-100">
                {modal.target.full_name}
              </span>
              ? They will be able to sign in immediately.
            </>
          )}
        </ConfirmDialog>
      )}

      {modal.is("delete") && modal.target && (
        <DeleteDialog
          noun="user"
          name={modal.target.full_name}
          subtitle={modal.target.email}
          onConfirm={() => removeUser(modal.target!.id).unwrap()}
          onDeleted={() => {
            const name = modal.target!.full_name;
            modal.close();
            show(`${name} deleted.`);
          }}
          onClose={modal.close}
        />
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </ResourceIndex>
  );
}
