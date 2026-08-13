"use client";

import { useEffect, useMemo, useState } from "react";

import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import DeleteDialog from "@/components/common/DeleteDialog";
import FormModal from "@/components/common/FormModal";
import Input from "@/components/common/Input";
import ResourceIndex from "@/components/common/ResourceIndex";
import Select from "@/components/common/Select";
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
  credentialApi,
  providerApi,
  PASSWORD_CONFIRMATION_DETAIL,
  type ApiCredential,
  type ApiProvider,
  type CredentialFieldSchema,
  type CredentialPayload,
  type MaskedFieldValue,
} from "@/lib/api/credentialApi";
import { extractApiError } from "@/lib/utils/apiError";
import useModalState from "@/lib/hooks/useModalState";
import useResourceList from "@/lib/hooks/useResourceList";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import useRowAction from "@/lib/hooks/useRowAction";

const STATE_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

type ModalMode = "create" | "edit" | "delete" | "view";

/**
 * The API Credentials index.
 *
 * **Nothing on this screen shows a secret.** Values arrive masked from the API;
 * the only way to plaintext is the Reveal control on the detail dialog, which
 * calls a separate endpoint that requires a fresh password confirmation and
 * writes an audit entry on every use.
 *
 * The form is **generated from the provider's schema rows** — that is the point
 * of having a schema table rather than a JSON blob. Picking a provider renders
 * its declared fields, with encrypted ones as password inputs.
 */
export default function CredentialsModule() {
  const { toasts, show, dismiss } = useToast();

  const q = useResourceQuery({
    filters: { search: "", provider_id: "", environment: "", is_active: "" },
    debounced: ["search"],
    defaultSortBy: "created_at",
    defaultSortOrder: "desc",
    // 30, matching Users' owner-set default so switching modules keeps the
    // same density (2026-08-13).
    defaultPerPage: 30,
  });

  const [canManage, setCanManage] = useState(false);
  const [canReveal, setCanReveal] = useState(false);
  const [environments, setEnvironments] = useState<string[]>([]);
  const [providers, setProviders] = useState<ApiProvider[]>([]);

  const list = useResourceList<ApiCredential>({
    ready: q.ready,
    deps: [q.applied, q.sortBy, q.sortOrder, q.page, q.perPage],
    errorMessage: "Could not load credentials.",
    fetch: () =>
      credentialApi
        .list({
          search: q.applied.search || undefined,
          provider_id: q.applied.provider_id ? Number(q.applied.provider_id) : undefined,
          environment: q.applied.environment || undefined,
          is_active:
            q.applied.is_active === "" ? undefined : q.applied.is_active === "true",
          sort_by: q.sortBy,
          sort_order: q.sortOrder,
          page: q.page,
          per_page: q.perPage,
        })
        .then((res) => {
          setCanManage(res.data.can_manage);
          setCanReveal(res.data.can_reveal);
          setEnvironments(res.data.environments);
          return res.data;
        }),
  });

  const modal = useModalState<ModalMode, ApiCredential>();

  // Providers drive both the filter and the create form's field generation.
  // Fetched once; a failure must leave the table readable rather than block it.
  useEffect(() => {
    providerApi
      .list({ is_active: true, per_page: 100 })
      .then((res) => setProviders(res.data.items))
      .catch(() => setProviders([]));
  }, []);

  const { busy, run } = useRowAction<ApiCredential>({
    onSuccess: list.patchRow,
    show,
    errorFallback: "Could not update the credential.",
  });

  const columns = useMemo<Column<ApiCredential>[]>(
    () => [
      numberColumn(),
      actionsColumn((row) => [
        { label: "View", onSelect: () => modal.open("view", row) },
        { label: "Edit", visible: canManage, onSelect: () => modal.open("edit", row) },
        {
          label: row.is_active ? "Deactivate" : "Activate",
          visible: canManage,
          disabled: busy === String(row.id),
          hint: row.is_active
            ? "Stops this credential resolving"
            : "Lets this credential resolve again",
          onSelect: () =>
            run(
              String(row.id),
              () =>
                credentialApi.update(row.id, {
                  provider_id: row.provider.id,
                  environment: row.environment,
                  name: row.name,
                  is_active: !row.is_active,
                  notes: row.notes,
                  // Empty: every encrypted field is left untouched by the blank
                  // rule, and no secret is round-tripped to flip a boolean.
                  field_values: {},
                }),
              `${row.provider.name} (${row.environment}) is now ${row.is_active ? "inactive" : "active"}.`
            ),
        },
        {
          label: "Delete",
          destructive: true,
          visible: canManage,
          onSelect: () => modal.open("delete", row),
        },
      ]),
      badgeColumn<ApiCredential>({
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
        cell: (row) => stackedCell(row.provider.name, row.name || row.provider.slug),
      },
      badgeColumn<ApiCredential>({
        id: "environment",
        header: "Environment",
        sortKey: "environment",
        // Production is the one worth noticing in a list — it is the row whose
        // key is live.
        tone: (row) => (row.environment === "production" ? "warning" : "info"),
        label: (row) => row.environment,
        width: "w-[120px]",
      }),
      {
        id: "fields",
        header: "Fields",
        cell: (row) => (
          <span className="text-ink-label dark:text-night-muted">
            {row.configured_fields} of {row.total_fields} set
          </span>
        ),
      },
      {
        id: "secrets",
        header: "Secrets",
        cell: (row) => {
          const encrypted = row.values.filter((v) => v.is_encrypted && v.is_set);
          if (encrypted.length === 0) {
            return <span className="text-ink-label dark:text-night-muted">None</span>;
          }
          return (
            <span className="flex flex-wrap gap-1">
              {encrypted.map((v) => (
                <Badge key={v.field_key} tone="neutral">
                  {v.field_label}
                </Badge>
              ))}
            </span>
          );
        },
      },
      dateColumn<ApiCredential>({
        id: "last_used",
        header: "Last used",
        sortKey: "last_used_at",
        value: (row) => row.last_used_at,
        withTime: true,
        // "Never" states a fact; an em dash reads as missing data. A credential
        // nothing has resolved is exactly what an operator wants to spot.
        fallback: "Never",
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, canManage, modal.open]
  );

  return (
    <ResourceIndex<ApiCredential, typeof q.filters>
      icon={navIcon("apiCredentials")}
      title="API Credentials"
      description="Encrypted credentials for third-party integrations, per environment"
      actions={
        canManage ? (
          <Button onClick={() => modal.open("create")}>
            {navIcon("apiCredentials")}
            Add credential
          </Button>
        ) : undefined
      }
      query={q}
      filters={[
        { type: "text", key: "search", placeholder: "Search credentials...", label: "Search credentials" },
        {
          type: "select",
          key: "provider_id",
          placeholder: "All Providers",
          searchPlaceholder: "Search providers...",
          label: "Filter by provider",
          options: providers.map((p) => ({ value: String(p.id), label: p.name })),
          hidden: providers.length === 0,
        },
        {
          type: "select",
          key: "environment",
          placeholder: "All Environments",
          searchPlaceholder: "Search environments...",
          label: "Filter by environment",
          options: environments.map((e) => ({ value: e, label: e })),
          hidden: environments.length === 0,
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
      rows={list.rows}
      rowKey={(r) => String(r.id)}
      loading={list.loading}
      error={list.error}
      onRetry={list.refetch}
      total={list.total}
      pages={list.pages}
      selectable={false}
      table="vendor"
      rowNoun="credential"
      emptyTitle="No credentials configured"
      emptyHint={
        canManage ? (
          <Button size="sm" onClick={() => modal.open("create")}>
            Add First Credential
          </Button>
        ) : undefined
      }
    >
      {(modal.is("create") || modal.is("edit")) && (
        <CredentialForm
          asModal
          credential={modal.is("edit") ? modal.target : null}
          providers={providers}
          environments={environments}
          onDone={(action) => {
            const wasEdit = modal.is("edit");
            modal.close();
            if (action === "saved") {
              show(`Credentials ${wasEdit ? "updated" : "saved"}.`);
              list.refetch();
            }
          }}
        />
      )}

      {modal.is("view") && modal.target && (
        <CredentialDetail
          credential={modal.target}
          canReveal={canReveal}
          onClose={modal.close}
          onNotice={show}
        />
      )}

      {modal.is("delete") && modal.target && (
        <DeleteDialog
          noun="credential"
          name={`${modal.target.provider.name} (${modal.target.environment})`}
          subtitle={modal.target.name ?? modal.target.provider.slug}
          onConfirm={() => credentialApi.remove(modal.target!.id)}
          onDeleted={() => {
            const label = modal.target!.provider.name;
            modal.close();
            show(`Credentials for ${label} deleted.`);
            list.refetch();
          }}
          onClose={modal.close}
        >
          Every stored field for this environment is removed. Anything resolving these
          credentials will stop working immediately.
        </DeleteDialog>
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </ResourceIndex>
  );
}

/**
 * The detail dialog — masked values, with a per-field Reveal.
 *
 * Reveal is one field at a time, matching the endpoint. Someone who needs the
 * SMTP host does not also pull the token into their browser, and the audit entry
 * names the field that was actually read.
 */
function CredentialDetail({
  credential,
  canReveal,
  onClose,
  onNotice,
}: {
  credential: ApiCredential;
  canReveal: boolean;
  onClose: () => void;
  onNotice: (message: string, tone?: "success" | "error" | "info") => void;
}) {
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const reveal = async (value: MaskedFieldValue) => {
    setBusyKey(value.field_key);
    try {
      const res = await credentialApi.reveal(credential.id, value.field_key);
      setRevealed((current) => ({ ...current, [value.field_key]: res.data.value ?? "" }));
      onNotice(`“${value.field_label}” revealed. This has been recorded.`, "info");
    } catch (err) {
      const message = extractApiError(err, "Could not reveal the value.");
      // A missing password confirmation is a prompt, not a failure — and above
      // all not a sign-out. The API answers 403 with this exact wording.
      onNotice(
        message === PASSWORD_CONFIRMATION_DETAIL
          ? "Confirm your password in Settings → Security, then try again."
          : message,
        "error"
      );
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={`${credential.provider.name} — ${credential.environment}`}
      subtitle={credential.name ?? credential.provider.slug}
      size="lg"
      footer={
        <Button variant="outline" type="button" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-3">
        {credential.values.length === 0 ? (
          <p className="text-sm text-ink-label dark:text-night-muted">
            This provider declares no fields.
          </p>
        ) : (
          credential.values.map((value) => (
            <div
              key={value.field_key}
              className="rounded border border-brand/20 px-3 py-2 dark:border-night-border"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink dark:text-gray-100">
                  {value.field_label}
                  {value.is_encrypted && (
                    <Badge tone="neutral" >
                      encrypted
                    </Badge>
                  )}
                </span>

                {value.is_encrypted && value.is_set && canReveal && (
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    disabled={busyKey === value.field_key}
                    onClick={() => reveal(value)}
                  >
                    {revealed[value.field_key] !== undefined
                      ? "Hide"
                      : busyKey === value.field_key
                        ? "Revealing…"
                        : "Reveal"}
                  </Button>
                )}
              </div>

              <p className="mt-1 break-all font-mono text-ink-label dark:text-night-muted">
                {!value.is_set
                  ? "Not set"
                  : revealed[value.field_key] !== undefined
                    ? revealed[value.field_key]
                    : value.masked_value}
              </p>
            </div>
          ))
        )}

        {credential.notes && (
          <div>
            <p className="text-sm font-medium text-ink dark:text-gray-100">Notes</p>
            <p className="text-ink-label dark:text-night-muted">{credential.notes}</p>
          </div>
        )}
      </div>
    </FormModal>
  );
}

/**
 * Create/edit — one component, two shells.
 *
 * The fields are **generated from the selected provider's schema rows**. That is
 * the whole reason the schema table exists: adding a provider is a data change,
 * not a form to write.
 */
export function CredentialForm({
  credential,
  providers,
  environments,
  asModal = false,
  onDone,
}: {
  credential?: ApiCredential | null;
  providers: ApiProvider[];
  environments: string[];
  asModal?: boolean;
  onDone?: (action: "saved" | "cancelled") => void;
}) {
  const isEdit = Boolean(credential);

  const [providerId, setProviderId] = useState(
    String(credential?.provider.id ?? providers[0]?.id ?? "")
  );
  const [environment, setEnvironment] = useState(credential?.environment ?? "production");
  const [name, setName] = useState(credential?.name ?? "");
  const [isActive, setIsActive] = useState(credential?.is_active ?? true);
  const [notes, setNotes] = useState(credential?.notes ?? "");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = useMemo(
    () => providers.find((p) => String(p.id) === providerId) ?? null,
    [providers, providerId]
  );

  const schemas = useMemo<CredentialFieldSchema[]>(
    () => [...(provider?.schemas ?? [])].sort((a, b) => a.display_order - b.display_order),
    [provider]
  );

  // On edit, preload from the API — which returns **empty strings for encrypted
  // fields**. That is deliberate: the form never holds a secret, so it cannot
  // leak one, and a blank encrypted field on save means "leave it alone".
  useEffect(() => {
    // No reset on the create path: this component unmounts when the dialog
    // closes, so `fieldValues` is already `{}` on the next open. Clearing it
    // here would be a `setState` in an effect body for no effect.
    if (!credential) return;

    credentialApi
      .formValues(credential.id)
      .then((res) => setFieldValues(res.data))
      // A failed preload leaves the form blank rather than half-filled. Blank is
      // safe here: every encrypted field is blank anyway, and a blank encrypted
      // field on save means "leave the stored value alone".
      .catch(() => setFieldValues({}));
  }, [credential]);

  const setField = (key: string, value: string) =>
    setFieldValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload: CredentialPayload = {
      provider_id: Number(providerId),
      environment,
      name: name.trim() || null,
      is_active: isActive,
      notes: notes.trim() || null,
      field_values: fieldValues,
    };
    try {
      if (credential) await credentialApi.update(credential.id, payload);
      else await credentialApi.create(payload);
      onDone?.("saved");
    } catch (err) {
      setError(extractApiError(err, "Could not save the credentials."));
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = Boolean(providerId) && Boolean(environment) && !saving;

  const body = (
    <div className="space-y-4">
      {error && (
        <p className="rounded border border-tone-danger/30 bg-tone-danger/10 px-3 py-2 text-sm text-tone-danger">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Provider"
          value={providerId}
          options={providers.map((p) => ({ value: String(p.id), label: p.name }))}
          // Changing the provider changes which fields exist, so an edit keeps
          // its provider — the alternative is a form that silently discards the
          // values it was holding.
          disabled={isEdit}
          onChange={(e) => {
            setProviderId(e.target.value);
            setFieldValues({});
          }}
        />
        <Select
          label="Environment"
          value={environment}
          options={environments.map((e) => ({ value: e, label: e }))}
          onChange={(e) => setEnvironment(e.target.value)}
        />
      </div>

      <Input
        label="Name"
        value={name}
        placeholder="Optional label"
        hint="Shown in the list. Leave blank to use the provider name."
        onChange={(e) => setName(e.target.value)}
      />

      {provider?.setup_steps && provider.setup_steps.length > 0 && (
        <div className="rounded border border-brand/20 px-3 py-2 dark:border-night-border">
          <p className="text-sm font-medium text-ink dark:text-gray-100">
            How to get these
          </p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-ink-label dark:text-night-muted">
            {provider.setup_steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {provider.documentation_url && (
            <a
              href={provider.documentation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-brand underline dark:text-brand-on-dark"
            >
              Provider documentation
            </a>
          )}
        </div>
      )}

      {/* The generated fields. */}
      {schemas.length === 0 ? (
        <p className="text-sm text-ink-label dark:text-night-muted">
          This provider declares no fields yet. Add them on the Providers screen.
        </p>
      ) : (
        <div className="space-y-4">
          {schemas.map((schema) => (
            <GeneratedField
              key={schema.field_key}
              schema={schema}
              value={fieldValues[schema.field_key] ?? ""}
              isEdit={isEdit}
              onChange={(v) => setField(schema.field_key, v)}
            />
          ))}
        </div>
      )}

      <Textarea
        label="Notes"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        <span className="text-sm text-ink dark:text-gray-100">
          Active — this credential may be resolved
        </span>
      </label>
    </div>
  );

  if (!asModal) return body;

  return (
    <FormModal
      open
      onClose={() => onDone?.("cancelled")}
      title={isEdit ? "Edit credentials" : "Add credentials"}
      subtitle={
        isEdit
          ? "Leave a secret blank to keep the stored value"
          : "Fields are generated from the provider's schema"
      }
      size="lg"
      footer={
        <>
          <Button variant="outline" type="button" onClick={() => onDone?.("cancelled")} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {saving ? "Saving…" : isEdit ? "Update credentials" : "Save credentials"}
          </Button>
        </>
      }
    >
      {body}
    </FormModal>
  );
}

/** One schema row rendered as its declared input type. */
function GeneratedField({
  schema,
  value,
  isEdit,
  onChange,
}: {
  schema: CredentialFieldSchema;
  value: string;
  isEdit: boolean;
  onChange: (value: string) => void;
}) {
  const label = schema.field_label + (schema.is_required ? " *" : "");

  // On edit, an encrypted field arrives blank and blank means "unchanged". Say
  // so in the hint, or an operator reads the empty box as "the secret is gone".
  const hint =
    isEdit && schema.is_encrypted
      ? schema.help_text
        ? `${schema.help_text} Leave blank to keep the stored value.`
        : "Leave blank to keep the stored value."
      : schema.help_text ?? undefined;

  if (schema.field_type === "boolean") {
    return (
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand"
          checked={value === "1" || value === "true"}
          onChange={(e) => onChange(e.target.checked ? "1" : "0")}
        />
        <span className="text-sm text-ink dark:text-gray-100">{schema.field_label}</span>
      </label>
    );
  }

  if (schema.field_type === "select") {
    const options = Array.isArray(schema.field_options)
      ? schema.field_options.map((o) => ({ value: String(o), label: String(o) }))
      : Object.entries(schema.field_options ?? {}).map(([v, l]) => ({
          value: v,
          label: String(l),
        }));
    return (
      <Select
        label={label}
        value={value}
        options={options}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Input
      label={label}
      // Encrypted or password-typed fields render as password inputs, matching
      // `should_mask` on the API. A field can be typed `password` without being
      // encrypted, and it still must not be rendered in the clear.
      type={
        schema.is_encrypted || schema.field_type === "password"
          ? "password"
          : schema.field_type === "number"
            ? "number"
            : schema.field_type === "email"
              ? "email"
              : schema.field_type === "url"
                ? "url"
                : "text"
      }
      autoComplete="off"
      value={value}
      placeholder={schema.placeholder ?? undefined}
      hint={hint}
      className={schema.is_encrypted ? "font-mono" : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
