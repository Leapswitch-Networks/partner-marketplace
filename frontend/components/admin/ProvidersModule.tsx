"use client";

import { useMemo, useState } from "react";

import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
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
  type ApiProvider,
  type CredentialFieldSchema,
  type ProviderPayload,
} from "@/lib/api/credentialApi";
import { extractApiError } from "@/lib/utils/apiError";
import useModalState from "@/lib/hooks/useModalState";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import {
  useCreateProviderMutation,
  useDeleteProviderMutation,
  useListProvidersQuery,
  useUpdateProviderMutation,
} from "@/lib/api/endpoints/apiCredentialsEndpoints";

const STATE_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

type ModalMode = "create" | "edit" | "delete";

/**
 * API service providers — the catalogue the credential form is generated from.
 *
 * A provider declares its fields, and each declaration says whether that field
 * is encrypted. **`is_encrypted` is the single most consequential control on
 * this screen**: turning it off for a field means that field's value is stored
 * readable from then on, so the form says so at the point of the switch rather
 * than in documentation.
 *
 * System providers are seeded from code and resolved by slug (`resolve("mail")`).
 * Their slug cannot be edited and they cannot be deleted — the API refuses both,
 * and the UI hides the affordances rather than offering something that 422s.
 */
export default function ProvidersModule() {
  const { toasts, show, dismiss } = useToast();

  const q = useResourceQuery({
    filters: { search: "", category: "", is_active: "" },
    debounced: ["search"],
    defaultSortBy: "display_order",
    defaultSortOrder: "asc",
    // 30, matching Users' owner-set default so switching modules keeps the
    // same density (2026-08-13).
    defaultPerPage: 30,
  });

  // PM-41 § 4.5. `is_active` and `category` are filters here as well as things
  // the writes change, so a patched row could sit in a view it left.
  const listQuery = useListProvidersQuery(
    {
      search: q.applied.search || undefined,
      category: q.applied.category || undefined,
      is_active: q.applied.is_active === "" ? undefined : q.applied.is_active === "true",
      sort_by: q.sortBy,
      sort_order: q.sortOrder,
      page: q.page,
      per_page: q.perPage,
    },
    { skip: !q.ready },
  );
  const page = listQuery.data;

  // Both ride on the list envelope — read off the response rather than copied
  // into state from inside the fetch callback. `can_manage` comes from the same
  // permission constant the write routes are guarded on.
  const canManage = page?.can_manage ?? false;
  const categories = page?.categories ?? [];

  const modal = useModalState<ModalMode, ApiProvider>();

  const [updateProvider] = useUpdateProviderMutation();
  const [deleteProvider] = useDeleteProviderMutation();

  /*
    An id, not a boolean. It disables the one row being written rather than the
    whole table: a boolean would either freeze every row while one writes, or
    freeze none and let the same row be clicked twice — and a second click on a
    toggle sends it straight back, which reads as the action having silently
    failed.
  */
  const [busy, setBusy] = useState<string | null>(null);

  const toggleActive = async (row: ApiProvider) => {
    setBusy(String(row.id));
    try {
      await updateProvider({
        id: row.id,
        data: {
          name: row.name,
          slug: row.slug,
          description: row.description,
          icon: row.icon,
          documentation_url: row.documentation_url,
          setup_steps: row.setup_steps,
          category: row.category,
          is_active: !row.is_active,
          display_order: row.display_order,
          // `schemas` omitted — the API leaves the declarations alone when it is
          // absent, so toggling a provider cannot disturb the field rows its
          // stored values hang off.
        },
      }).unwrap();
      show(`${row.name} is now ${row.is_active ? "inactive" : "active"}.`);
    } catch (err) {
      show(extractApiError(err, "Could not update the provider."), "error");
    } finally {
      setBusy(null);
    }
  };

  const columns = useMemo<Column<ApiProvider>[]>(
    () => [
      numberColumn(),
      actionsColumn((row) => [
        { label: "Edit", visible: canManage, onSelect: () => modal.open("edit", row) },
        {
          label: row.is_active ? "Deactivate" : "Activate",
          visible: canManage,
          disabled: busy === String(row.id),
          onSelect: () => void toggleActive(row),
        },
        {
          label: "Delete",
          destructive: true,
          // A system provider is resolved by slug in code. The API refuses to
          // delete one; hiding it beats offering a button that always errors.
          visible: canManage && !row.is_system,
          onSelect: () => modal.open("delete", row),
        },
      ]),
      badgeColumn<ApiProvider>({
        id: "is_active",
        header: "Status",
        sortKey: "is_active",
        tone: (row) => (row.is_active ? "success" : "neutral"),
        label: (row) => (row.is_active ? "Active" : "Inactive"),
        width: "w-[100px]",
      }),
      {
        id: "provider",
        header: "Provider",
        sortKey: "name",
        cell: (row) => stackedCell(row.name, row.slug),
      },
      {
        id: "category",
        header: "Category",
        sortKey: "category",
        cell: (row) => <span className="text-ink-label dark:text-night-muted">{row.category}</span>,
      },
      {
        id: "fields",
        header: "Fields",
        cell: (row) => {
          const encrypted = row.schemas.filter((s) => s.is_encrypted).length;
          return (
            <span className="text-ink-label dark:text-night-muted">
              {row.schemas.length} declared
              {encrypted > 0 && `, ${encrypted} encrypted`}
            </span>
          );
        },
      },
      {
        id: "credentials",
        header: "Configured",
        cell: (row) =>
          row.credential_count === 0 ? (
            <span className="text-ink-label dark:text-night-muted">None</span>
          ) : (
            <Badge tone="brand">
              {row.credential_count} environment{row.credential_count === 1 ? "" : "s"}
            </Badge>
          ),
      },
      badgeColumn<ApiProvider>({
        id: "is_system",
        header: "Type",
        tone: (row) => (row.is_system ? "info" : "neutral"),
        label: (row) => (row.is_system ? "System" : "Custom"),
        width: "w-[100px]",
      }),
      dateColumn<ApiProvider>({
        id: "created",
        header: "Created",
        sortKey: "created_at",
        value: (row) => row.created_at,
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, canManage, modal.open]
  );

  return (
    <ResourceIndex<ApiProvider, typeof q.filters>
      icon={navIcon("apiCredentials")}
      title="API Providers"
      description="Third parties we hold credentials for, and the fields each one needs"
      actions={
        canManage ? (
          <Button onClick={() => modal.open("create")}>
            {navIcon("apiCredentials")}
            Add provider
          </Button>
        ) : undefined
      }
      query={q}
      filters={[
        { type: "text", key: "search", placeholder: "Search providers...", label: "Search providers" },
        {
          type: "select",
          key: "category",
          placeholder: "All Categories",
          searchPlaceholder: "Search categories...",
          label: "Filter by category",
          options: categories.map((c) => ({ value: c, label: c })),
          hidden: categories.length < 2,
        },
        {
          type: "select",
          key: "is_active",
          placeholder: "All States",
          searchPlaceholder: "Search states...",
          label: "Filter by state",
          options: STATE_OPTIONS,
        },
      ]}
      columns={columns}
      result={listQuery}
      rowKey={(r) => String(r.id)}
      errorMessage="Could not load providers."
      selectable={false}
      table="vendor"
      rowNoun="provider"
      emptyTitle="No providers"
      emptyHint={
        canManage ? (
          <Button size="sm" onClick={() => modal.open("create")}>
            Add First Provider
          </Button>
        ) : undefined
      }
    >
      {(modal.is("create") || modal.is("edit")) && (
        <ProviderForm
          asModal
          provider={modal.is("edit") ? modal.target : null}
          onDone={(action, saved) => {
            const wasEdit = modal.is("edit");
            modal.close();
            if (action === "saved") {
              // The form's own mutations invalidate the collection.
              show(`“${saved!.name}” ${wasEdit ? "updated" : "added"}.`);
            }
          }}
        />
      )}

      {modal.is("delete") && modal.target && (
        <DeleteDialog
          noun="provider"
          name={modal.target.name}
          subtitle={modal.target.slug}
          onConfirm={() => deleteProvider(modal.target!.id).unwrap()}
          onDeleted={() => {
            const name = modal.target!.name;
            modal.close();
            show(`“${name}” and its stored credentials deleted.`);
          }}
          onClose={modal.close}
        >
          {/*
            Said explicitly because "delete provider" reads much smaller than it
            is: the cascade removes every credential and every stored secret for
            this provider, in every environment.
          */}
          This also deletes <strong>every credential stored against it</strong>, in every
          environment. Anything resolving them will stop working immediately.
        </DeleteDialog>
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </ResourceIndex>
  );
}

/** Create/edit — one component, two shells. */
export function ProviderForm({
  provider,
  asModal = false,
  onDone,
}: {
  provider?: ApiProvider | null;
  asModal?: boolean;
  onDone?: (action: "saved" | "cancelled", saved?: ApiProvider) => void;
}) {
  const isEdit = Boolean(provider);

  const [name, setName] = useState(provider?.name ?? "");
  const [slug, setSlug] = useState(provider?.slug ?? "");
  const [description, setDescription] = useState(provider?.description ?? "");
  const [icon, setIcon] = useState(provider?.icon ?? "");
  const [docUrl, setDocUrl] = useState(provider?.documentation_url ?? "");
  const [category, setCategory] = useState(provider?.category ?? "general");
  const [displayOrder, setDisplayOrder] = useState(String(provider?.display_order ?? 0));
  const [setupSteps, setSetupSteps] = useState((provider?.setup_steps ?? []).join("\n"));
  const [isActive, setIsActive] = useState(provider?.is_active ?? true);
  const [fields, setFields] = useState<FieldDraft[]>(
    (provider?.schemas ?? []).map(toDraft)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createProvider] = useCreateProviderMutation();
  const [updateProviderRecord] = useUpdateProviderMutation();

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload: ProviderPayload = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      icon: icon.trim() || null,
      documentation_url: docUrl.trim() || null,
      setup_steps: setupSteps.trim() ? setupSteps.split("\n").map((s) => s.trim()).filter(Boolean) : null,
      category: category.trim() || "general",
      is_active: isActive,
      display_order: Number(displayOrder) || 0,
      schemas: fields.map((f) => ({
        field_key: f.field_key.trim(),
        field_label: f.field_label.trim(),
        field_type: f.field_type,
        field_options: null,
        is_required: f.is_required,
        is_encrypted: f.is_encrypted,
        validation_rules: null,
        placeholder: f.placeholder.trim() || null,
        help_text: f.help_text.trim() || null,
        default_value: f.default_value.trim() || null,
      })),
    };
    try {
      const saved = provider
        ? await updateProviderRecord({ id: provider.id, data: payload }).unwrap()
        : await createProvider(payload).unwrap();
      onDone?.("saved", saved);
    } catch (err) {
      setError(extractApiError(err, "Could not save the provider."));
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = name.trim().length > 0 && slug.trim().length > 0 && !saving;

  const body = (
    <div className="space-y-4">
      {error && (
        <p className="rounded border border-tone-danger/30 bg-tone-danger/10 px-3 py-2 text-sm text-tone-danger">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Slug"
          required
          className="font-mono"
          value={slug}
          placeholder="anthropic"
          // A system provider's slug is resolved by code, so the API refuses to
          // change it. Disabling beats a 422 the operator has to read.
          disabled={Boolean(provider?.is_system)}
          hint={
            provider?.is_system
              ? "System provider — code resolves this slug, so it cannot change."
              : "Lowercase. Code resolves credentials by this."
          }
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>

      <Textarea
        label="Description"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <Input
          label="Icon"
          value={icon}
          placeholder="key"
          hint="navIcons key. Unknown keys render a dot."
          onChange={(e) => setIcon(e.target.value)}
        />
        <Input
          label="Display order"
          type="number"
          value={displayOrder}
          onChange={(e) => setDisplayOrder(e.target.value)}
        />
      </div>

      <Input
        label="Documentation URL"
        type="url"
        value={docUrl}
        onChange={(e) => setDocUrl(e.target.value)}
      />

      <Textarea
        label="Setup steps"
        rows={3}
        value={setupSteps}
        hint="One step per line. Shown beside the credential form."
        onChange={(e) => setSetupSteps(e.target.value)}
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-ink dark:text-gray-100">
            Fields this provider needs
          </span>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => setFields((f) => [...f, blankDraft()])}
          >
            Add field
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-ink-label dark:text-night-muted">
            No fields yet. A provider with no fields generates an empty credential form.
          </p>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={index}
                className="rounded border border-brand/20 p-3 dark:border-night-border"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Key"
                    className="font-mono"
                    value={field.field_key}
                    placeholder="api_key"
                    onChange={(e) => updateField(setFields, index, { field_key: e.target.value })}
                  />
                  <Input
                    label="Label"
                    value={field.field_label}
                    placeholder="API Key"
                    onChange={(e) => updateField(setFields, index, { field_label: e.target.value })}
                  />
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Type"
                    value={field.field_type}
                    placeholder="text | password | url | email | number | select | boolean"
                    onChange={(e) => updateField(setFields, index, { field_type: e.target.value })}
                  />
                  <Input
                    label="Placeholder"
                    value={field.placeholder}
                    onChange={(e) => updateField(setFields, index, { placeholder: e.target.value })}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand"
                      checked={field.is_required}
                      onChange={(e) =>
                        updateField(setFields, index, { is_required: e.target.checked })
                      }
                    />
                    <span className="text-sm text-ink dark:text-gray-100">Required</span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand"
                      checked={field.is_encrypted}
                      onChange={(e) =>
                        updateField(setFields, index, { is_encrypted: e.target.checked })
                      }
                    />
                    <span className="text-sm text-ink dark:text-gray-100">Encrypted</span>
                  </label>

                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => setFields((f) => f.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>

                {/*
                  The consequence, at the switch. Turning this off means the
                  value is stored readable from the next save onward — and the
                  values already stored stay encrypted, so the column ends up
                  holding both. Worth saying here rather than in a doc nobody
                  opens while editing a form.
                */}
                {!field.is_encrypted && (
                  <p className="mt-2 text-xs text-tone-danger">
                    Not encrypted — this value will be stored readable. Only turn this off
                    for settings that are not secrets.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        <span className="text-sm text-ink dark:text-gray-100">Active</span>
      </label>
    </div>
  );

  if (!asModal) return body;

  return (
    <FormModal
      open
      onClose={() => onDone?.("cancelled")}
      title={isEdit ? "Edit provider" : "Add provider"}
      subtitle="Declare the fields this provider needs; the credential form is generated from them"
      size="lg"
      footer={
        <>
          <Button variant="outline" type="button" onClick={() => onDone?.("cancelled")} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {saving ? "Saving…" : isEdit ? "Update provider" : "Add provider"}
          </Button>
        </>
      }
    >
      {body}
    </FormModal>
  );
}

interface FieldDraft {
  field_key: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  is_encrypted: boolean;
  placeholder: string;
  help_text: string;
  default_value: string;
}

function blankDraft(): FieldDraft {
  return {
    field_key: "",
    field_label: "",
    field_type: "text",
    is_required: true,
    // Encrypted by default, matching the column default. A field someone forgot
    // to think about should be protected, not exposed.
    is_encrypted: true,
    placeholder: "",
    help_text: "",
    default_value: "",
  };
}

function toDraft(schema: CredentialFieldSchema): FieldDraft {
  return {
    field_key: schema.field_key,
    field_label: schema.field_label,
    field_type: schema.field_type,
    is_required: schema.is_required,
    is_encrypted: schema.is_encrypted,
    placeholder: schema.placeholder ?? "",
    help_text: schema.help_text ?? "",
    default_value: schema.default_value ?? "",
  };
}

function updateField(
  setFields: React.Dispatch<React.SetStateAction<FieldDraft[]>>,
  index: number,
  patch: Partial<FieldDraft>
) {
  setFields((current) =>
    current.map((field, i) => (i === index ? { ...field, ...patch } : field))
  );
}
