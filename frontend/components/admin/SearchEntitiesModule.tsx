"use client";

import { useMemo, useState } from "react";

import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/common/ConfirmDialog";
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
  searchEntityApi,
  type EntityHealth,
  type SearchableEntity,
  type SearchableEntityPayload,
} from "@/lib/api/searchApi";
import { extractApiError } from "@/lib/utils/apiError";
import useModalState from "@/lib/hooks/useModalState";
import useResourceList from "@/lib/hooks/useResourceList";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import useRowAction from "@/lib/hooks/useRowAction";

const STATE_OPTIONS = [
  { value: "true", label: "Included" },
  { value: "false", label: "Excluded" },
];

/**
 * `broken` is `danger`, not `warning`: the type returns nothing at all, which is
 * a failure rather than a caution. `degraded` still works.
 */
const HEALTH_TONE: Record<EntityHealth, { tone: "success" | "warning" | "danger"; label: string }> = {
  ok: { tone: "success", label: "OK" },
  degraded: { tone: "warning", label: "Degraded" },
  broken: { tone: "danger", label: "Broken" },
};

type ModalMode = "create" | "edit" | "delete" | "toggle";

/**
 * The search registry — which record types the global search box looks in.
 *
 * **What makes this screen different from every other settings screen: the rows
 * are security configuration.** A row names a model and a set of columns, and
 * the API treats both as hostile input — the model name is resolved against an
 * allowlist in code, and each field is checked against the model's real,
 * non-sensitive columns. Anything else is dropped.
 *
 * That is why `health` is a first-class column rather than a detail: a row can
 * be saved, look correct, and return nothing, because the configuration it holds
 * was refused. The health reasons say which part, in the row.
 */
export default function SearchEntitiesModule() {
  const { toasts, show, dismiss } = useToast();

  const q = useResourceQuery({
    filters: { search: "", group: "", enabled: "" },
    debounced: ["search"],
    // `sort_order` ascending — the column exists to let an admin decide which
    // section appears first in the results, so the table shows that order.
    defaultSortBy: "sort_order",
    defaultSortOrder: "asc",
    defaultPerPage: 25,
  });

  const [canManage, setCanManage] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const list = useResourceList<SearchableEntity>({
    ready: q.ready,
    deps: [q.applied, q.sortBy, q.sortOrder, q.page, q.perPage],
    errorMessage: "Could not load the search registry.",
    fetch: () =>
      searchEntityApi
        .list({
          search: q.applied.search || undefined,
          group: q.applied.group || undefined,
          enabled: q.applied.enabled === "" ? undefined : q.applied.enabled === "true",
          sort_by: q.sortBy,
          sort_order: q.sortOrder,
          page: q.page,
          per_page: q.perPage,
        })
        .then((res) => {
          setCanManage(res.data.can_manage);
          setGroups(res.data.groups);
          // The allowlist rides on the list response rather than a second
          // request: it is small, it changes only with a deploy, and the form
          // must not be able to offer a model the API would refuse.
          setAvailableModels(res.data.available_models);
          return res.data;
        }),
  });

  const modal = useModalState<ModalMode, SearchableEntity>();

  const { busy, run } = useRowAction<SearchableEntity>({
    onSuccess: list.patchRow,
    show,
    errorFallback: "Could not update the entity.",
  });

  const columns = useMemo<Column<SearchableEntity>[]>(
    () => [
      numberColumn(),
      actionsColumn((row) => [
        { label: "Edit", visible: canManage, onSelect: () => modal.open("edit", row) },
        {
          label: row.enabled ? "Exclude from search" : "Include in search",
          visible: canManage,
          disabled: busy === String(row.id),
          onSelect: () => modal.open("toggle", row),
        },
        {
          label: "Delete",
          destructive: true,
          visible: canManage,
          onSelect: () => modal.open("delete", row),
        },
      ]),
      badgeColumn<SearchableEntity>({
        id: "enabled",
        header: "Status",
        sortKey: "enabled",
        tone: (row) => (row.enabled ? "success" : "neutral"),
        label: (row) => (row.enabled ? "Included" : "Excluded"),
        disabled: (row) => busy === String(row.id),
        onClick: (row) => (canManage ? () => modal.open("toggle", row) : undefined),
        title: () => (canManage ? "Click to include or exclude this type" : undefined),
        width: "w-[110px]",
      }),
      {
        id: "entity",
        header: "Entity",
        sortKey: "label",
        cell: (row) => stackedCell(row.label, row.model_class),
      },
      {
        id: "group",
        header: "Group",
        sortKey: "group",
        cell: (row) => <span className="text-ink-label dark:text-night-muted">{row.group}</span>,
      },
      {
        id: "fields",
        header: "Fields",
        cell: (row) => (
          <span className="flex flex-wrap gap-1">
            {row.fields.length === 0 ? (
              <span className="text-ink-label dark:text-night-muted">—</span>
            ) : (
              row.fields.map((f) => (
                <Badge key={f} tone="neutral">
                  {f}
                </Badge>
              ))
            )}
          </span>
        ),
      },
      {
        id: "permission",
        header: "Permission",
        cell: (row) =>
          row.permission ? (
            <span className="text-ink-label dark:text-night-muted">{row.permission}</span>
          ) : (
            // Said out loud rather than shown as an em dash: "any signed-in
            // user" is a real access decision and reads as missing data
            // otherwise.
            <span className="text-ink-label dark:text-night-muted">Any signed-in user</span>
          ),
      },
      badgeColumn<SearchableEntity>({
        id: "health",
        header: "Health",
        tone: (row) => HEALTH_TONE[row.health].tone,
        label: (row) => HEALTH_TONE[row.health].label,
        // The reason is the useful part. A tooltip rather than a column, because
        // it is a sentence and the table is dense.
        title: (row) => row.health_reasons.join(" ") || undefined,
        width: "w-[110px]",
      }),
      dateColumn<SearchableEntity>({
        id: "updated",
        header: "Updated",
        sortKey: "created_at",
        value: (row) => row.updated_at,
        withTime: true,
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, canManage, modal.open]
  );

  return (
    <ResourceIndex<SearchableEntity, typeof q.filters>
      icon={navIcon("settings")}
      title="Search"
      description="Choose which records the global search box looks in"
      actions={
        canManage ? (
          <Button onClick={() => modal.open("create")}>Add entity</Button>
        ) : undefined
      }
      query={q}
      filters={[
        { type: "text", key: "search", placeholder: "Search entities...", label: "Search entities" },
        {
          type: "select",
          key: "group",
          placeholder: "All Groups",
          searchPlaceholder: "Search groups...",
          label: "Filter by group",
          options: groups.map((g) => ({ value: g, label: g })),
          hidden: groups.length < 2,
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
      // No bulk endpoint, so no selection — a checkbox column wired to nothing
      // is the failure the module contract exists to stop.
      selectable={false}
      table="vendor"
      rowNoun="entity"
      emptyTitle="No searchable entities"
      emptyHint={
        canManage ? (
          <Button size="sm" onClick={() => modal.open("create")}>
            Add First Entity
          </Button>
        ) : undefined
      }
    >
      {(modal.is("create") || modal.is("edit")) && (
        <SearchEntityForm
          asModal
          entity={modal.is("edit") ? modal.target : null}
          availableModels={availableModels}
          onDone={(action, saved) => {
            const wasEdit = modal.is("edit");
            modal.close();
            if (action === "saved") {
              show(`“${saved!.label}” ${wasEdit ? "updated" : "added"}.`);
              list.refetch();
            }
          }}
        />
      )}

      {modal.is("toggle") && modal.target && (
        <ConfirmDialog
          title={
            modal.target.enabled ? "Exclude from search" : "Include in search"
          }
          subtitle={modal.target.model_class}
          confirmLabel={modal.target.enabled ? "Exclude" : "Include"}
          busyLabel="Saving…"
          tone={modal.target.enabled ? "danger" : "primary"}
          errorFallback="Could not update the entity."
          // Through `run`, so `busy` actually gates this row's controls. Calling
          // the API here directly would leave those guards permanently false.
          onConfirm={() =>
            run(
              String(modal.target!.id),
              () => searchEntityApi.toggle(modal.target!.id),
              `“${modal.target!.label}” ${modal.target!.enabled ? "excluded from" : "included in"} search.`
            )
          }
          onConfirmed={modal.close}
          onClose={modal.close}
        >
          {modal.target.enabled ? (
            <>
              Stop searching{" "}
              <span className="font-semibold text-ink dark:text-gray-100">
                {modal.target.label}
              </span>
              ? It disappears from everyone&rsquo;s search results at once.
            </>
          ) : (
            <>
              Start searching{" "}
              <span className="font-semibold text-ink dark:text-gray-100">
                {modal.target.label}
              </span>
              ? Results stay limited to what each person may already see.
            </>
          )}
        </ConfirmDialog>
      )}

      {modal.is("delete") && modal.target && (
        <DeleteDialog
          noun="searchable entity"
          name={modal.target.label}
          subtitle={modal.target.model_class}
          onConfirm={() => searchEntityApi.remove(modal.target!.id)}
          onDeleted={() => {
            const label = modal.target!.label;
            modal.close();
            show(`“${label}” removed from search.`);
            list.refetch();
          }}
          onClose={modal.close}
        >
          This type stops appearing in search results. The records themselves are not
          touched.
        </DeleteDialog>
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </ResourceIndex>
  );
}

/**
 * Create/edit — one component, two shells.
 *
 * `asModal` renders into `FormModal`; without it the same fields render bare for
 * a future full-page route to wrap.
 */
export function SearchEntityForm({
  entity,
  availableModels,
  asModal = false,
  onDone,
}: {
  entity?: SearchableEntity | null;
  availableModels: string[];
  asModal?: boolean;
  onDone?: (action: "saved" | "cancelled", saved?: SearchableEntity) => void;
}) {
  const isEdit = Boolean(entity);

  const [modelClass, setModelClass] = useState(entity?.model_class ?? availableModels[0] ?? "");
  const [label, setLabel] = useState(entity?.label ?? "");
  const [group, setGroup] = useState(entity?.group ?? "Core");
  const [icon, setIcon] = useState(entity?.icon ?? "");
  const [fields, setFields] = useState((entity?.fields ?? []).join(", "));
  const [displayTemplate, setDisplayTemplate] = useState(entity?.display_template ?? "");
  const [subtitleTemplate, setSubtitleTemplate] = useState(entity?.subtitle_template ?? "");
  const [routeName, setRouteName] = useState(entity?.route_name ?? "");
  const [routeParamField, setRouteParamField] = useState(entity?.route_param_field ?? "id");
  const [permission, setPermission] = useState(entity?.permission ?? "");
  const [enabled, setEnabled] = useState(entity?.enabled ?? true);
  const [sortOrder, setSortOrder] = useState(String(entity?.sort_order ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedFields = useMemo(
    () =>
      fields
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
    [fields]
  );

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload: SearchableEntityPayload = {
      model_class: modelClass,
      label: label.trim(),
      group: group.trim(),
      icon: icon.trim() || null,
      fields: parsedFields,
      display_template: displayTemplate.trim(),
      subtitle_template: subtitleTemplate.trim() || null,
      route_name: routeName.trim(),
      route_param_field: routeParamField.trim() || "id",
      permission: permission.trim() || null,
      enabled,
      sort_order: Number(sortOrder) || 0,
    };
    try {
      const res = entity
        ? await searchEntityApi.update(entity.id, payload)
        : await searchEntityApi.create(payload);
      onDone?.("saved", res.data);
    } catch (err) {
      setError(extractApiError(err, "Could not save the entity."));
    } finally {
      setSaving(false);
    }
  };

  const canSubmit =
    Boolean(modelClass) &&
    label.trim().length > 0 &&
    group.trim().length > 0 &&
    parsedFields.length > 0 &&
    displayTemplate.trim().length > 0 &&
    routeName.trim().length > 0 &&
    !saving;

  const body = (
    <div className="space-y-4">
      {error && (
        <p className="rounded border border-tone-danger/30 bg-tone-danger/10 px-3 py-2 text-sm text-tone-danger">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/*
          A dropdown, not a text box. `model_class` is resolved against an
          allowlist in the API, so a free-text field could only ever produce a
          row that saves and then never returns results. The API validates it
          again on write — the dropdown is a convenience, never the check.
        */}
        <Select
          label="Model"
          value={modelClass}
          options={availableModels.map((m) => ({ value: m, label: m }))}
          onChange={(e) => setModelClass(e.target.value)}
          disabled={availableModels.length === 0}
        />
        <Input label="Label" required value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Group" required value={group} onChange={(e) => setGroup(e.target.value)} />
        <Input
          label="Icon"
          value={icon}
          placeholder="users"
          hint="navIcons key. Unknown keys render a dot."
          onChange={(e) => setIcon(e.target.value)}
        />
        <Input
          label="Sort order"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />
      </div>

      <Input
        label="Fields"
        required
        className="font-mono"
        value={fields}
        placeholder="first_name, last_name, email"
        hint="Comma-separated columns to match. Unknown or sensitive ones are refused and reported as health."
        onChange={(e) => setFields(e.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Display template"
          required
          className="font-mono"
          value={displayTemplate}
          placeholder="{first_name} {last_name}"
          hint="A missing field renders empty, never the placeholder."
          onChange={(e) => setDisplayTemplate(e.target.value)}
        />
        <Input
          label="Subtitle template"
          className="font-mono"
          value={subtitleTemplate}
          placeholder="{email}"
          onChange={(e) => setSubtitleTemplate(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Route"
          required
          className="font-mono"
          value={routeName}
          placeholder="/dashboard/users/{id}"
          hint="App-relative path with one placeholder."
          onChange={(e) => setRouteName(e.target.value)}
        />
        <Input
          label="Route parameter field"
          className="font-mono"
          value={routeParamField}
          onChange={(e) => setRouteParamField(e.target.value)}
        />
      </div>

      <Input
        label="Permission"
        value={permission}
        placeholder="user-view"
        hint="Required to search this type at all. Leave empty for any signed-in user. This is not row scoping — results are additionally limited to what each person may see."
        onChange={(e) => setPermission(e.target.value)}
      />

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span className="text-sm text-ink dark:text-gray-100">Include in search results</span>
      </label>
    </div>
  );

  if (!asModal) return body;

  return (
    <FormModal
      open
      onClose={() => onDone?.("cancelled")}
      title={isEdit ? "Edit searchable entity" : "Add searchable entity"}
      subtitle="Which records the global search box looks in, and what it shows"
      size="lg"
      footer={
        <>
          <Button variant="outline" type="button" onClick={() => onDone?.("cancelled")} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {saving ? "Saving…" : isEdit ? "Update entity" : "Add entity"}
          </Button>
        </>
      }
    >
      {body}
    </FormModal>
  );
}
