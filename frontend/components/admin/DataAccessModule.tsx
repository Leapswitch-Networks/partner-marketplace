"use client";

import { useEffect, useMemo, useState } from "react";

import Button from "@/components/common/Button";
import DeleteDialog from "@/components/common/DeleteDialog";
import FormModal from "@/components/common/FormModal";
import Input from "@/components/common/Input";
import ResourceIndex from "@/components/common/ResourceIndex";
import Select from "@/components/common/Select";
import Toast, { useToast } from "@/components/common/Toast";
import { type Column } from "@/components/common/DataTable";
import {
  actionsColumn,
  badgeColumn,
  dateColumn,
  numberColumn,
  stackedCell,
} from "@/components/common/columns";
import { navIcon } from "@/components/dashboard/navIcons";
import {
  dataAccessApi,
  type AccessLevel,
  type DataAccessGrant,
  type GrantParty,
  type ScopeOption,
} from "@/lib/api/dataAccessApi";
import useModalState from "@/lib/hooks/useModalState";
import useResourceList from "@/lib/hooks/useResourceList";
import useResourceQuery from "@/lib/hooks/useResourceQuery";

const ACCESS_LEVEL_OPTIONS = [
  { value: "view", label: "View" },
  { value: "manage", label: "Manage" },
];

/**
 * `view` is the ordinary case and `manage` is the one worth noticing, so the
 * tones are not symmetric: `manage` confers write access over another person's
 * records and reads as a warning, not as a neutral fact.
 */
const LEVEL_TONE: Record<AccessLevel, { tone: "info" | "warning"; label: string }> = {
  view: { tone: "info", label: "View" },
  manage: { tone: "warning", label: "Manage" },
};

type ModalMode = "create" | "delete";

/**
 * The Data Access index — who may see or manage whose records.
 *
 * Grants are **user to user**, not role to role. The screen sits with Roles in
 * the sidebar because the reference puts it there, but nothing here attaches to
 * a role: `grantee` and `subject` are both users. `DataAccessGrant`'s model
 * docstring makes the same point, because the reference's own `roles/data-access`
 * URL is the misleading part.
 *
 * ## Two deviations from `UsersModule`, both required by the domain
 *
 * **1. No selection and no bulk bar.** `UI_PATTERNS.md` § "Parity means the same
 * vocabulary, not the same feature list" — the action set is decided by the
 * domain and the API, not by symmetry with Users. There is no bulk endpoint for
 * grants, and a checkbox column wired to nothing is the exact failure that
 * contract was written to stop.
 *
 * **2. No `useRowAction`.** It runs a per-row write and applies the record the
 * write returned. The only per-row write here is delete, which `DeleteDialog`
 * owns end to end — including its own busy state — and which returns no record
 * to patch. Adding a row action purely to give the hook a job would mean
 * inventing an affordance the reference does not have, and parity forbids that.
 * The multi-subject create form is where a level is changed: re-granting an
 * existing pair upserts it.
 */
export default function DataAccessModule() {
  const { toasts, show, dismiss } = useToast();

  const q = useResourceQuery({
    filters: { search: "", scope: "", access_level: "" },
    debounced: ["search"],
    defaultSortBy: "created_at",
    defaultSortOrder: "desc",
    // 25, matching the reference's `per_page` default for this controller.
    defaultPerPage: 25,
  });

  const list = useResourceList<DataAccessGrant>({
    ready: q.ready,
    deps: [q.applied, q.sortBy, q.sortOrder, q.page, q.perPage],
    errorMessage: "Could not load data access grants.",
    fetch: () =>
      dataAccessApi
        .list({
          search: q.applied.search || undefined,
          scope: q.applied.scope || undefined,
          access_level: (q.applied.access_level as AccessLevel) || undefined,
          sort_by: q.sortBy,
          sort_order: q.sortOrder,
          page: q.page,
          per_page: q.perPage,
        })
        .then((res) => {
          // `can_manage` rides on the list envelope, so it refreshes with the
          // data rather than being read once from a client-side permission set.
          setCanManage(res.data.can_manage);
          return res.data;
        }),
  });

  const modal = useModalState<ModalMode, DataAccessGrant>();

  const [canManage, setCanManage] = useState(false);
  const [users, setUsers] = useState<GrantParty[]>([]);
  const [scopes, setScopes] = useState<ScopeOption[]>([]);

  // The pickers, fetched once. Not a `useResourceList` — it is neither paged nor
  // filtered, and a failure must leave the table readable rather than blocking
  // it, so that hook's rules do not apply. Same call the Users module makes for
  // roles, and for the same reasons.
  useEffect(() => {
    dataAccessApi
      .options()
      .then((res) => {
        setUsers(res.data.users);
        setScopes(res.data.scopes);
      })
      .catch(() => {
        setUsers([]);
        setScopes([]);
      });
  }, []);

  // --- columns: #, Actions, Status, then data (the fixed order) -------------
  const columns = useMemo<Column<DataAccessGrant>[]>(
    () => [
      numberColumn(),
      actionsColumn((row) => [
        {
          label: "Revoke",
          destructive: true,
          // Gated on the server's flag, not on a client permission string.
          visible: canManage,
          onSelect: () => modal.open("delete", row),
        },
      ]),
      badgeColumn<DataAccessGrant>({
        id: "access_level",
        header: "Access",
        sortKey: "access_level",
        tone: (row) => LEVEL_TONE[row.access_level].tone,
        label: (row) => LEVEL_TONE[row.access_level].label,
        width: "w-[110px]",
      }),
      {
        id: "grantee",
        header: "Grantee",
        // No `sortKey`: the API's allowlist is scope / access_level / created_at
        // only. A sortKey it does not accept renders an arrow that takes a click
        // and does nothing — `UI_PATTERNS.md` § The index, feature by feature, 5.
        cell: (row) => stackedCell(row.grantee.name, row.grantee.email),
      },
      {
        id: "subject",
        header: "Can access records of",
        cell: (row) => stackedCell(row.subject.name, row.subject.email),
      },
      {
        id: "scope",
        header: "Scope",
        sortKey: "scope",
        cell: (row) => (
          <span className="text-ink-label dark:text-night-muted">{row.scope_label}</span>
        ),
      },
      {
        id: "granted_by",
        header: "Granted by",
        cell: (row) => (
          <span className="text-ink-label dark:text-night-muted">
            {/* An em dash, not "System": the granter is null because the account
                was deleted, which is a lost fact rather than a system action. */}
            {row.granted_by ?? "—"}
          </span>
        ),
      },
      dateColumn<DataAccessGrant>({
        id: "created",
        header: "Granted",
        sortKey: "created_at",
        value: (row) => row.created_at,
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, modal.open]
  );

  return (
    <ResourceIndex<DataAccessGrant, typeof q.filters>
      icon={navIcon("roles")}
      title="Data Access"
      description="Delegate who can see and manage another user's records"
      actions={
        canManage ? (
          <Button onClick={() => modal.open("create")}>Grant Data Access</Button>
        ) : undefined
      }
      query={q}
      filters={[
        {
          type: "text",
          key: "search",
          placeholder: "Search users...",
          label: "Search grantee or subject",
        },
        {
          type: "select",
          key: "scope",
          placeholder: "All Scopes",
          searchPlaceholder: "Search scopes...",
          label: "Filter by scope",
          options: scopes,
          // A single-option dropdown is noise while `*` is the only scope. It
          // appears on its own once a module registers a second one.
          hidden: scopes.length < 2,
        },
        {
          type: "select",
          key: "access_level",
          placeholder: "All Levels",
          searchPlaceholder: "Search levels...",
          label: "Filter by access level",
          options: ACCESS_LEVEL_OPTIONS,
        },
      ]}
      columns={columns}
      rows={list.rows}
      rowKey={(r) => r.id}
      loading={list.loading}
      error={list.error}
      onRetry={list.refetch}
      total={list.total}
      pages={list.pages}
      // No selection: there is no bulk endpoint. See the deviation note above.
      selectable={false}
      table="vendor"
      rowNoun="grant"
      emptyTitle="No data access grants"
      emptyHint={
        canManage ? (
          <Button size="sm" onClick={() => modal.open("create")}>
            Grant First Access
          </Button>
        ) : undefined
      }
    >
      {modal.is("create") && (
        <GrantForm
          users={users}
          scopes={scopes}
          onClose={modal.close}
          onSaved={(result) => {
            modal.close();
            // A partial success must never read as a total one: the skipped
            // pairs go in `details`, and a toast carrying details does not
            // auto-dismiss.
            show(
              result.message,
              result.skipped > 0 ? "info" : "success",
              result.skipped > 0 ? result.skipped_reasons : undefined
            );
            list.refetch();
          }}
        />
      )}

      {modal.is("delete") && modal.target && (
        <DeleteDialog
          // "grant", not "user" — the row is the delegation, and a dialog that
          // says "delete user" on this screen would be read as deleting one.
          noun="grant"
          name={`${modal.target.grantee.name} → ${modal.target.subject.name}`}
          subtitle={`${LEVEL_TONE[modal.target.access_level].label} access · ${modal.target.scope_label}`}
          onConfirm={() => dataAccessApi.remove(modal.target!.id)}
          onDeleted={() => {
            const who = modal.target!.grantee.name;
            modal.close();
            show(`Data access for ${who} removed.`);
            list.refetch();
          }}
          onClose={modal.close}
        />
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </ResourceIndex>
  );
}

/**
 * The create form, as a modal.
 *
 * Declared in this file rather than as its own `DataAccessForm` component
 * because there is no full-page route for it to also serve — the reference has
 * no standalone create page either, only the dialog on the index. The
 * `asModal`/`onDone` split that `UserForm` carries exists to let one component
 * render into both shells; with only one shell there is nothing to split.
 */
function GrantForm({
  users,
  scopes,
  onClose,
  onSaved,
}: {
  users: GrantParty[];
  scopes: ScopeOption[];
  onClose: () => void;
  onSaved: (result: {
    message: string;
    skipped: number;
    skipped_reasons: string[];
  }) => void;
}) {
  const [granteeId, setGranteeId] = useState("");
  const [subjectIds, setSubjectIds] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState(scopes[0]?.value ?? "*");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("view");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The grantee can never be their own subject, so they are removed from the
  // list rather than offered and then rejected. The API skips the pair anyway —
  // this is so the UI never presents a choice that cannot be honoured.
  const selectableSubjects = useMemo(
    () =>
      users.filter((u) => {
        if (u.id === granteeId) return false;
        const term = subjectSearch.trim().toLowerCase();
        if (!term) return true;
        return (
          u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
        );
      }),
    [users, granteeId, subjectSearch]
  );

  const toggleSubject = (id: string) =>
    setSubjectIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await dataAccessApi.create({
        grantee_id: granteeId,
        subject_ids: Array.from(subjectIds),
        scope,
        access_level: accessLevel,
      });
      onSaved(res.data);
    } catch (err) {
      const { extractApiError } = await import("@/lib/utils/apiError");
      setError(extractApiError(err, "Could not save the grant."));
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = Boolean(granteeId) && subjectIds.size > 0 && !saving;

  return (
    <FormModal
      open
      onClose={onClose}
      title="Grant Data Access"
      subtitle="Choose who receives access, and whose records they may reach"
      size="lg"
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {saving ? "Saving…" : "Grant Access"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Select
          label="Grantee"
          value={granteeId}
          placeholder="Select the user receiving access"
          options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
          onChange={(e) => {
            const next = e.target.value;
            setGranteeId(next);
            // Drop the new grantee from the subjects if they were already
            // picked, or the form would carry a pair the API will skip.
            setSubjectIds((current) => {
              if (!current.has(next)) return current;
              const copy = new Set(current);
              copy.delete(next);
              return copy;
            });
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {/*
            Falls back to the wildcard rather than rendering an empty dropdown.
            `/options` is a separate request, so a failure there — or opening
            this modal before it settles — would otherwise leave Scope with no
            choices, which reads as broken rather than as loading. `*` is the
            server's own default and the only scope that currently exists.
          */}
          <Select
            label="Scope"
            value={scope}
            options={scopes.length > 0 ? scopes : [{ value: "*", label: "All Modules" }]}
            onChange={(e) => setScope(e.target.value)}
          />
          <Select
            label="Access level"
            value={accessLevel}
            options={ACCESS_LEVEL_OPTIONS}
            onChange={(e) => setAccessLevel(e.target.value as AccessLevel)}
          />
        </div>

        {/*
          A checkbox list, not a shared multi-select: `components/common` has no
          multi-select component, and this module may not add one. Flagged in the
          handoff — if a `MultiSelect` lands, this is its first caller.
        */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-medium text-ink dark:text-gray-300">
              Whose records they may access
            </span>
            <span className="text-xs text-ink-label dark:text-night-muted">
              {subjectIds.size} selected
            </span>
          </div>

          <Input
            label="Search subjects"
            placeholder="Search users..."
            value={subjectSearch}
            onChange={(e) => setSubjectSearch(e.target.value)}
          />

          <div className="mt-2 max-h-56 overflow-auto rounded border border-brand/20 dark:border-night-border">
            {selectableSubjects.length === 0 ? (
              <p className="px-3 py-4 text-sm text-ink-label dark:text-night-muted">
                {granteeId ? "No matching users." : "Select a grantee first."}
              </p>
            ) : (
              selectableSubjects.map((u) => (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-brand/10 dark:hover:bg-brand/20"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-brand"
                    checked={subjectIds.has(u.id)}
                    onChange={() => toggleSubject(u.id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink dark:text-gray-100">
                      {u.name}
                    </span>
                    <span className="block truncate text-xs text-ink-label dark:text-night-muted">
                      {u.email}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>
    </FormModal>
  );
}
