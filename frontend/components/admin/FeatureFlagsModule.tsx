"use client";

import { useEffect, useMemo, useState } from "react";

import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DeleteDialog from "@/components/common/DeleteDialog";
import FormModal from "@/components/common/FormModal";
import Input from "@/components/common/Input";
import ResourceIndex from "@/components/common/ResourceIndex";
import Textarea from "@/components/common/Textarea";
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
  featureFlagApi,
  type FeatureFlag,
  type FeatureFlagOptions,
  type FeatureFlagPayload,
  type RoleOption,
  type UserOption,
} from "@/lib/api/featureFlagApi";
import { extractApiError } from "@/lib/utils/apiError";
import useModalState from "@/lib/hooks/useModalState";
import useResourceList from "@/lib/hooks/useResourceList";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import useRowAction from "@/lib/hooks/useRowAction";

const STATE_OPTIONS = [
  { value: "true", label: "Enabled" },
  { value: "false", label: "Disabled" },
];

type ModalMode = "create" | "edit" | "delete" | "toggle";

/**
 * The Feature Flags index.
 *
 * A flag is a staged rollout done as an auditable admin action instead of a
 * code change. The two `target_*` lists are what make it a flag system rather
 * than a boolean table: a feature can be live for one role, or three named
 * people, with no migration.
 *
 * ## The one rule the whole screen exists to communicate
 *
 * **`enabled` is a master switch, and off means off for everyone — including
 * the targets.** Targeting narrows who a *live* flag reaches; it never switches
 * a dead one on. That is stated in the toggle's confirm dialog and in the form's
 * status panel rather than only in a tooltip, because reading it backwards
 * ("disabled except for the people I listed") is what makes an incident
 * unrecoverable by the one control an operator reaches for.
 *
 * **"Everyone" is the state most likely to be misread as "nobody".** Both target
 * lists empty means the flag is on for all users once enabled. The server
 * computes `targets_everyone` so the table, the form and any future client all
 * say so on the same rule.
 */
export default function FeatureFlagsModule() {
  const { toasts, show, dismiss } = useToast();

  const q = useResourceQuery({
    filters: { search: "", enabled: "" },
    debounced: ["search"],
    // Alphabetical by name, ascending — the reference's `orderBy('name')`. This
    // is the one list in the app that is not newest-first, and deliberately: a
    // flag is looked up by name, not discovered by recency.
    defaultSortBy: "name",
    defaultSortOrder: "asc",
    defaultPerPage: 25,
  });

  const list = useResourceList<FeatureFlag>({
    ready: q.ready,
    deps: [q.applied, q.sortBy, q.sortOrder, q.page, q.perPage],
    errorMessage: "Could not load feature flags.",
    fetch: () =>
      featureFlagApi
        .list({
          search: q.applied.search || undefined,
          // Tri-state: "" means no filter, so it must not collapse to false.
          enabled: q.applied.enabled === "" ? undefined : q.applied.enabled === "true",
          sort_by: q.sortBy,
          sort_order: q.sortOrder,
          page: q.page,
          per_page: q.perPage,
        })
        .then((res) => {
          setCanManage(res.data.can_manage);
          return res.data;
        }),
  });

  const modal = useModalState<ModalMode, FeatureFlag>();

  const [canManage, setCanManage] = useState(false);
  const [options, setOptions] = useState<FeatureFlagOptions>({ roles: [], users: [] });

  // Targeting pickers, fetched once. Not a `useResourceList` — unpaged,
  // unfiltered, and a failure must leave the table readable rather than
  // blocking it.
  useEffect(() => {
    featureFlagApi
      .options()
      .then((res) => setOptions(res.data))
      .catch(() => setOptions({ roles: [], users: [] }));
  }, []);

  // Per-row write: marks the row busy, patches it from the record the write
  // returned, and reports through the toast.
  const { busy, run } = useRowAction<FeatureFlag>({
    onSuccess: list.patchRow,
    show,
    errorFallback: "Could not change the flag.",
  });

  // --- columns: #, Actions, Status, then data ------------------------------
  const columns = useMemo<Column<FeatureFlag>[]>(
    () => [
      numberColumn(),
      actionsColumn((row) => [
        {
          label: "Edit",
          visible: canManage,
          onSelect: () => modal.open("edit", row),
        },
        {
          label: row.enabled ? "Disable" : "Enable",
          visible: canManage,
          disabled: busy === String(row.id),
          hint: row.enabled
            ? "Turns it off for everyone, including targets"
            : "Turns it on for its targets",
          onSelect: () => modal.open("toggle", row),
        },
        {
          label: "Delete",
          destructive: true,
          visible: canManage,
          onSelect: () => modal.open("delete", row),
        },
      ]),
      badgeColumn<FeatureFlag>({
        id: "enabled",
        header: "Enabled",
        sortKey: "enabled",
        tone: (row) => (row.enabled ? "success" : "neutral"),
        label: (row) => (row.enabled ? "Enabled" : "Disabled"),
        disabled: (row) => busy === String(row.id),
        // Confirms first. This badge is the easiest control on the page to hit
        // by accident and it changes what other people can see.
        onClick: (row) => (canManage ? () => modal.open("toggle", row) : undefined),
        title: () =>
          canManage
            ? "Click to change. Off means off for everyone, including targets"
            : undefined,
        width: "w-[110px]",
      }),
      {
        id: "name",
        header: "Flag",
        sortKey: "name",
        // Name over key — the reference's own two-line cell. `stackedCell` ranks
        // by weight and colour, never by size.
        cell: (row) => stackedCell(row.name, row.key),
      },
      {
        id: "targeting",
        header: "Targeting",
        cell: (row) => {
          const roles = row.target_roles ?? [];
          const users = row.target_user_ids ?? [];

          if (row.targets_everyone) {
            return <span className="text-ink-label dark:text-night-muted">Everyone</span>;
          }

          return (
            <span className="flex flex-wrap gap-1">
              {roles.map((r) => (
                <Badge key={r} tone="brand">
                  {r}
                </Badge>
              ))}
              {users.length > 0 && (
                <Badge tone="neutral">
                  {users.length} user{users.length === 1 ? "" : "s"}
                </Badge>
              )}
            </span>
          );
        },
      },
      {
        id: "description",
        header: "Description",
        cell: (row) => (
          <span className="truncate text-ink-label dark:text-night-muted">
            {row.description || "—"}
          </span>
        ),
      },
      dateColumn<FeatureFlag>({
        id: "updated",
        header: "Updated",
        sortKey: "updated_at",
        value: (row) => row.updated_at,
        withTime: true,
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, canManage, modal.open]
  );

  return (
    <ResourceIndex<FeatureFlag, typeof q.filters>
      icon={navIcon("settings")}
      title="Feature Flags"
      // The reference's description, verbatim.
      description="Staged rollout without a code change. Target roles or people before going to everyone."
      actions={
        canManage ? (
          <Button onClick={() => modal.open("create")}>New flag</Button>
        ) : undefined
      }
      query={q}
      filters={[
        {
          type: "text",
          key: "search",
          placeholder: "Search flags...",
          label: "Search flags",
        },
        {
          type: "select",
          key: "enabled",
          placeholder: "All States",
          searchPlaceholder: "Search states...",
          label: "Filter by state",
          options: STATE_OPTIONS,
        },
      ]}
      columns={columns}
      rows={list.rows}
      rowKey={(r) => String(r.id)}
      loading={list.loading}
      error={list.error}
      onRetry={list.refetch}
      total={list.total}
      pages={list.pages}
      // No selection: there is no bulk endpoint, and a checkbox column wired to
      // nothing is the failure the module contract was written to stop.
      selectable={false}
      table="vendor"
      rowNoun="flag"
      emptyTitle="No feature flags yet"
      emptyHint={
        canManage ? (
          <Button size="sm" onClick={() => modal.open("create")}>
            Create First Flag
          </Button>
        ) : undefined
      }
    >
      {(modal.is("create") || modal.is("edit")) && (
        <FeatureFlagForm
          asModal
          flag={modal.is("edit") ? modal.target : null}
          roles={options.roles}
          users={options.users}
          onDone={(action, saved) => {
            const wasEdit = modal.is("edit");
            modal.close();
            if (action === "saved") {
              show(`Feature flag “${saved!.name}” ${wasEdit ? "updated" : "created"}.`);
              list.refetch();
            }
          }}
        />
      )}

      {/*
        Toggling confirms first. It is one click on a badge, and it changes what
        other people can see — the same reasoning that put a confirm on the Users
        status badge.
      */}
      {modal.is("toggle") && modal.target && (
        <ConfirmDialog
          title={modal.target.enabled ? "Disable feature flag" : "Enable feature flag"}
          subtitle={modal.target.key}
          confirmLabel={modal.target.enabled ? "Disable" : "Enable"}
          busyLabel={modal.target.enabled ? "Disabling…" : "Enabling…"}
          tone={modal.target.enabled ? "danger" : "primary"}
          errorFallback="Could not change the flag."
          /*
            Delegated to `useRowAction.run` rather than calling the API here.
            `run` is what sets `busy`, and `busy` is what disables this row's
            badge and its Enable/Disable menu item — calling the API directly
            would leave both guards permanently false, which is a control wired
            to nothing rather than a missing feature.

            `run` reports its own failure through the toast, so `onConfirmed`
            only has to close.
          */
          onConfirm={() =>
            run(
              String(modal.target!.id),
              () => featureFlagApi.toggle(modal.target!.id),
              `“${modal.target!.name}” ${modal.target!.enabled ? "disabled" : "enabled"}.`
            )
          }
          onConfirmed={modal.close}
          onClose={modal.close}
        >
          {modal.target.enabled ? (
            <>
              Turn off{" "}
              <span className="font-semibold text-ink dark:text-gray-100">
                {modal.target.name}
              </span>
              ? It goes off for <span className="font-semibold">everyone</span>, including
              any targeted roles and users.
            </>
          ) : (
            <>
              Turn on{" "}
              <span className="font-semibold text-ink dark:text-gray-100">
                {modal.target.name}
              </span>
              ?{" "}
              {modal.target.targets_everyone
                ? "It has no targeting, so it goes live for everyone."
                : "It goes live for its targeted roles and users only."}
            </>
          )}
        </ConfirmDialog>
      )}

      {modal.is("delete") && modal.target && (
        <DeleteDialog
          noun="feature flag"
          name={modal.target.name}
          subtitle={modal.target.key}
          onConfirm={() => featureFlagApi.remove(modal.target!.id)}
          onDeleted={() => {
            const name = modal.target!.name;
            modal.close();
            show(`Feature flag “${name}” deleted.`);
            list.refetch();
          }}
          onClose={modal.close}
        >
          {/* The reference's warning, verbatim in substance: deleting is not
              neutral, because every check of the key silently becomes false. */}
          Any code checking this flag will fall back to <strong>OFF</strong>, which may
          hide a feature that is currently live.
        </DeleteDialog>
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </ResourceIndex>
  );
}

/**
 * The create/edit form — **one component, two shells.**
 *
 * `asModal` renders into `FormModal` and calls `onDone`; without it the same
 * fields render bare, for a future `/settings/feature-flags/[id]/edit` page to
 * wrap. The schema, the payload and the submit are shared, and only the chrome
 * differs — a second component per mode is how two spellings of one form appear.
 *
 * Create and edit are the same shell because the write is the same: a full
 * replace. `flag` being null is what tells them apart.
 */
export function FeatureFlagForm({
  flag,
  roles,
  users,
  asModal = false,
  onDone,
}: {
  flag?: FeatureFlag | null;
  roles: RoleOption[];
  users: UserOption[];
  asModal?: boolean;
  onDone?: (action: "saved" | "cancelled", saved?: FeatureFlag) => void;
}) {
  const isEdit = Boolean(flag);

  const [key, setKey] = useState(flag?.key ?? "");
  const [name, setName] = useState(flag?.name ?? "");
  const [description, setDescription] = useState(flag?.description ?? "");
  const [enabled, setEnabled] = useState(flag?.enabled ?? false);
  const [targetRoles, setTargetRoles] = useState<Set<string>>(
    new Set(flag?.target_roles ?? [])
  );
  const [targetUsers, setTargetUsers] = useState<Set<string>>(
    new Set(flag?.target_user_ids ?? [])
  );
  const [userSearch, setUserSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetsEveryone = targetRoles.size === 0 && targetUsers.size === 0;

  const visibleUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    );
  }, [users, userSearch]);

  const toggleIn = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload: FeatureFlagPayload = {
      key: key.trim(),
      name: name.trim(),
      description: description.trim() || null,
      enabled,
      target_roles: Array.from(targetRoles),
      target_user_ids: Array.from(targetUsers),
    };
    try {
      const res = flag
        ? await featureFlagApi.update(flag.id, payload)
        : await featureFlagApi.create(payload);
      onDone?.("saved", res.data);
    } catch (err) {
      setError(extractApiError(err, "Could not save the feature flag."));
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = key.trim().length > 0 && name.trim().length > 0 && !saving;

  const body = (
    <div className="space-y-5">
      {error && (
        <p className="rounded border border-tone-danger/30 bg-tone-danger/10 px-3 py-2 text-sm text-tone-danger">
          {error}
        </p>
      )}

      {/*
        Status first, matching the reference's field order — and it is the right
        order regardless: it is the field that decides whether anything below it
        has any effect.
      */}
      <section>
        <SectionHeading
          title="Status"
          subtitle="Off means off for everyone, including targeted roles and users"
        />
        <label className="mt-2 flex cursor-pointer items-center justify-between gap-4 rounded border border-brand/20 px-4 py-3 dark:border-night-border">
          <span>
            <span className="block text-sm font-medium text-ink dark:text-gray-100">
              {enabled ? "Enabled" : "Disabled"}
            </span>
            <span className="block text-xs text-ink-label dark:text-night-muted">
              {enabled
                ? targetsEveryone
                  ? "Live for everyone"
                  : "Live for the targets below only"
                : "Nobody sees this feature"}
            </span>
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            aria-label="Enabled"
          />
        </label>
      </section>

      <section>
        <SectionHeading title="Details" />
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Key"
            required
            // `Input` has no `mono` prop (its `Textarea` sibling does) but it
            // forwards `className` onto the input element, so this is the same
            // treatment the reference gives the key field.
            className="font-mono"
            value={key}
            placeholder="partner.self_serve_listings"
            // The reference's hint, verbatim — it is the one warning that stops
            // a rename from silently breaking every check in the codebase.
            hint="What your code checks. Changing it later breaks existing checks."
            onChange={(e) => setKey(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <Textarea
            label="Description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-brand/20 pb-2 dark:border-night-border">
          <div>
            <h3 className="text-sm font-semibold text-ink dark:text-gray-100">Targeting</h3>
            <p className="text-xs text-ink-label dark:text-night-muted">
              Leave both empty to reach everyone once enabled
            </p>
          </div>
          <span className="text-xs text-ink-label dark:text-night-muted">
            {targetsEveryone
              ? "Everyone"
              : `${targetRoles.size} role(s), ${targetUsers.size} user(s)`}
          </span>
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-ink-label dark:text-night-muted">
            Roles
          </p>
          {roles.length === 0 ? (
            <p className="text-sm text-ink-label dark:text-night-muted">
              No roles available.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {roles.map((role) => (
                <Chip
                  key={role.id}
                  label={role.display_name}
                  // Targets store the role NAME, while the chip shows the display
                  // name. Sending the display name would silently target nothing.
                  selected={targetRoles.has(role.name)}
                  onClick={() => setTargetRoles((s) => toggleIn(s, role.name))}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-ink-label dark:text-night-muted">
            Individual users
          </p>
          <Input
            label="Search users"
            placeholder="Search users..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
          <div className="mt-2 grid max-h-56 grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2">
            {visibleUsers.length === 0 ? (
              <p className="px-1 py-2 text-sm text-ink-label dark:text-night-muted">
                No matching users.
              </p>
            ) : (
              visibleUsers.map((u) => (
                <Chip
                  key={u.id}
                  label={u.name}
                  hint={u.email}
                  selected={targetUsers.has(u.id)}
                  onClick={() => setTargetUsers((s) => toggleIn(s, u.id))}
                />
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );

  if (!asModal) return body;

  return (
    <FormModal
      open
      onClose={() => onDone?.("cancelled")}
      title={isEdit ? "Edit Feature Flag" : "New Feature Flag"}
      subtitle={
        isEdit ? "Update this flag and who it reaches" : "Declare a flag your code can check"
      }
      size="lg"
      footer={
        <>
          <Button
            variant="outline"
            type="button"
            onClick={() => onDone?.("cancelled")}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {saving
              ? isEdit
                ? "Updating…"
                : "Creating…"
              : isEdit
                ? "Update Flag"
                : "Create Flag"}
          </Button>
        </>
      }
    >
      {body}
    </FormModal>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-brand/20 pb-2 dark:border-night-border">
      <h3 className="text-sm font-semibold text-ink dark:text-gray-100">{title}</h3>
      {subtitle && (
        <p className="text-xs text-ink-label dark:text-night-muted">{subtitle}</p>
      )}
    </div>
  );
}

/**
 * A selectable chip. A real `<button aria-pressed>`, not a styled div — this is
 * the only control in the targeting section, and a div cannot be reached with a
 * keyboard.
 *
 * Hover is `brand/10`, never a grey: `UI_PATTERNS.md` § The Signed-In Chrome Is
 * Green rules out hovering to a grey on the green surface.
 */
function Chip({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        "flex items-center justify-between gap-2 rounded border px-3 py-2 text-left transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2",
        "ring-offset-surface-wash dark:ring-offset-night-card",
        selected
          ? "border-brand bg-brand/10 text-ink dark:text-gray-100"
          : "border-brand/20 text-ink-label hover:bg-brand/10 hover:text-brand dark:border-night-border dark:text-night-muted dark:hover:bg-brand/20",
      ].join(" ")}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        {hint && <span className="block truncate text-xs">{hint}</span>}
      </span>
      <span
        className={[
          "flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] leading-none",
          selected ? "border-brand bg-brand text-white" : "border-brand/30",
        ].join(" ")}
        aria-hidden
      >
        {selected ? "✓" : ""}
      </span>
    </button>
  );
}
