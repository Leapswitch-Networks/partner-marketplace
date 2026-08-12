"use client";

import { useEffect, useMemo, useState } from "react";

import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DeleteDialog from "@/components/common/DeleteDialog";
import FormModal from "@/components/common/FormModal";
import Input from "@/components/common/Input";
import Modal from "@/components/common/Modal";
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
  platformApi,
  type Ability,
  type ApiConsumer,
  type IssuedToken,
} from "@/lib/api/platformApi";
import { extractApiError } from "@/lib/utils/apiError";
import { formatDateTime } from "@/lib/utils/format";
import useModalState from "@/lib/hooks/useModalState";
import useResourceList from "@/lib/hooks/useResourceList";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import useRowAction from "@/lib/hooks/useRowAction";

/**
 * The Platform API index — which systems may call us, and with what.
 *
 * ## The three things this screen exists to make visible
 *
 * **A consumer is a system, never a person.** The slug names the system; the
 * owner email names who to ring about it. Naming a consumer after whoever asked
 * for it breaks when they change role, leaves a second project by the same person
 * nowhere to go, and makes an audit row read as though a human made the call when
 * a server did.
 *
 * **"Registered but holding no token" is its own state**, and it is a filter
 * rather than a footnote: it is neither active nor disabled, and it is the
 * difference between access *granted* and access *working*.
 *
 * **A token is shown once.** The reveal is a dedicated modal with a copy button
 * and a warning about how to send it, because that moment is the only one in
 * which the value exists — it is stored as a SHA-256 digest and cannot be
 * recovered from anything.
 *
 * `Switch off` is separated from `Edit` for the same reason the API separates
 * them: it is what someone reaches for at 2am, and it must not require opening a
 * form and sending a whole record.
 */

type ModalMode = "create" | "edit" | "delete" | "toggle" | "detail" | "issue" | "reveal";

const EXPIRY_CHOICES = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "", label: "Never expires" },
];

const SENSITIVITY_TONE = {
  low: "neutral",
  medium: "warning",
  high: "danger",
} as const;

function tokenState(consumer: ApiConsumer): { label: string; tone: "success" | "warning" | "neutral" } {
  const live = consumer.tokens.filter((t) => !t.revoked_at);
  if (live.length === 0) return { label: "No token", tone: "warning" };
  return { label: `${live.length} token${live.length === 1 ? "" : "s"}`, tone: "success" };
}

export default function ApiConsumersModule() {
  const { toasts, show, dismiss } = useToast();
  const modal = useModalState<ModalMode, ApiConsumer>();

  const [abilities, setAbilities] = useState<Ability[]>([]);
  const [issued, setIssued] = useState<IssuedToken | null>(null);

  const q = useResourceQuery({
    filters: { search: "", active: "", has_tokens: "" },
    debounced: ["search"],
    defaultSortBy: "created_at",
    defaultSortOrder: "desc",
    defaultPerPage: 15,
  });

  const list = useResourceList<ApiConsumer>({
    ready: q.ready,
    deps: [q.applied, q.sortBy, q.sortOrder, q.page, q.perPage],
    errorMessage: "Could not load the registered systems.",
    fetch: () =>
      platformApi
        .list({
          search: q.applied.search || undefined,
          // Tri-state: "" is "no filter" and must not collapse to false.
          active: q.applied.active === "" ? undefined : q.applied.active === "true",
          has_tokens:
            q.applied.has_tokens === "" ? undefined : q.applied.has_tokens === "true",
          sort_by: q.sortBy,
          sort_order: q.sortOrder,
          page: q.page,
          per_page: q.perPage,
        })
        .then((res) => res.data),
  });

  // Read from the API, never typed into this file: the same catalogue is what
  // write-time validation checks against, so a list kept here would eventually
  // offer an ability the server rejects.
  useEffect(() => {
    platformApi
      .abilities()
      .then((res) => setAbilities(res.data))
      .catch(() => setAbilities([]));
  }, []);

  const { busy, run } = useRowAction<ApiConsumer>({
    onSuccess: list.patchRow,
    show,
    errorFallback: "Could not change that system.",
  });

  const columns = useMemo<Column<ApiConsumer>[]>(
    () => [
      numberColumn<ApiConsumer>(),
      actionsColumn<ApiConsumer>((row) => [
        { label: "View", onSelect: () => modal.open("detail", row) },
        { label: "Issue token", onSelect: () => modal.open("issue", row) },
        { label: "Edit", onSelect: () => modal.open("edit", row) },
        {
          label: row.active ? "Switch off" : "Switch on",
          onSelect: () => modal.open("toggle", row),
          disabled: busy === row.id,
        },
        { label: "Delete", onSelect: () => modal.open("delete", row), destructive: true },
      ]),
      badgeColumn<ApiConsumer>({
        id: "active",
        header: "Access",
        tone: (row) => (row.active ? "success" : "danger"),
        label: (row) => (row.active ? "Active" : "Switched off"),
        width: "w-[130px]",
        sortKey: "active",
      }),
      badgeColumn<ApiConsumer>({
        id: "tokens",
        header: "Tokens",
        tone: (row) => tokenState(row).tone,
        label: (row) => tokenState(row).label,
        width: "w-[120px]",
      }),
      {
        id: "system",
        header: "System",
        cell: (row) => stackedCell(row.name, row.slug),
        sortKey: "name",
      },
      {
        id: "owner",
        header: "Who to contact",
        cell: (row) =>
          row.owner_email ? (
            stackedCell(row.owner_email, row.owner_name ?? "—")
          ) : (
            <span className="text-ink-label dark:text-night-muted">Nobody named</span>
          ),
      },
      dateColumn<ApiConsumer>({
        id: "created_at",
        header: "Registered",
        value: (row) => row.created_at,
        sortKey: "created_at",
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modal.open, busy]
  );

  return (
    <ResourceIndex<ApiConsumer, typeof q.filters>
      icon={navIcon("platformApi")}
      title="Platform API"
      description="Systems permitted to call our API, and the tokens they hold"
      query={q}
      actions={
        <Button onClick={() => modal.open("create")}>Register a system</Button>
      }
      filters={[
        {
          type: "text",
          key: "search",
          placeholder: "Search name, slug or owner…",
          label: "Search systems",
        },
        {
          type: "select",
          key: "active",
          placeholder: "All access",
          label: "Filter by access",
          options: [
            { value: "true", label: "Active" },
            { value: "false", label: "Switched off" },
          ],
        },
        {
          // The state that is neither active nor disabled. See the component note.
          type: "select",
          key: "has_tokens",
          placeholder: "All tokens",
          label: "Filter by token",
          options: [
            { value: "true", label: "Holds a token" },
            { value: "false", label: "No token — cannot call" },
          ],
        },
      ]}
      columns={columns}
      rows={list.rows}
      rowKey={(row) => row.id}
      loading={list.loading}
      error={list.error}
      onRetry={list.refetch}
      total={list.total}
      pages={list.pages}
      table="vendor"
      rowNoun="system"
      emptyTitle="No systems registered"
      emptyHint="Register one when a machine needs standing access to this API."
    >
      {(modal.is("create") || modal.is("edit")) && (
        <ConsumerForm
          consumer={modal.is("edit") ? modal.target : null}
          onClose={modal.close}
          onSaved={(message) => {
            modal.close();
            show(message, "success");
            list.refetch();
          }}
        />
      )}

      {modal.is("toggle") && modal.target && (
        <ConfirmDialog
          title={modal.target.active ? "Switch this system off" : "Switch this system on"}
          subtitle={modal.target.slug}
          confirmLabel={modal.target.active ? "Switch off" : "Switch on"}
          tone={modal.target.active ? "danger" : "primary"}
          errorFallback="Could not change the access."
          onConfirm={() =>
            run(modal.target!.id, () =>
              platformApi.setActive(modal.target!.id, !modal.target!.active),
              modal.target!.active
                ? "Access switched off. Its tokens stop working immediately."
                : "Access switched on."
            )
          }
          onConfirmed={modal.close}
          onClose={modal.close}
        >
          <p>
            {modal.target.active ? (
              <>
                Every token this system holds stops working on its next call. The tokens are
                not revoked — switching it back on restores them, which is what makes this
                safe to do at 2am.
              </>
            ) : (
              <>Its existing tokens start working again immediately.</>
            )}
          </p>
        </ConfirmDialog>
      )}

      {modal.is("delete") && modal.target && (
        <DeleteDialog
          noun="system"
          name={modal.target.slug}
          subtitle={modal.target.name}
          onConfirm={() => platformApi.remove(modal.target!.id)}
          onDeleted={() => {
            modal.close();
            show("System removed, along with its tokens.", "success");
            list.refetch();
          }}
          onClose={modal.close}
        >
          <p>
            Its tokens are destroyed with it and cannot be restored. Its request history is
            kept — that record is who made those calls.
          </p>
        </DeleteDialog>
      )}

      {modal.is("detail") && modal.target && (
        <ConsumerDetail
          consumer={modal.target}
          onClose={modal.close}
          onChanged={list.refetch}
          show={show}
        />
      )}

      {modal.is("issue") && modal.target && (
        <IssueTokenForm
          consumer={modal.target}
          abilities={abilities}
          onClose={modal.close}
          onIssued={(result) => {
            setIssued(result);
            modal.open("reveal", modal.target!);
            list.refetch();
          }}
        />
      )}

      {modal.is("reveal") && issued && (
        <TokenReveal
          issued={issued}
          onClose={() => {
            // Discarded here, deliberately. The plaintext lives in this
            // component's state and nowhere else — not Redux, not localStorage.
            setIssued(null);
            modal.close();
          }}
          show={show}
        />
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </ResourceIndex>
  );
}

/** Create or edit a system. */
function ConsumerForm({
  consumer,
  onClose,
  onSaved,
}: {
  consumer: ApiConsumer | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(consumer?.name ?? "");
  const [slug, setSlug] = useState(consumer?.slug ?? "");
  const [description, setDescription] = useState(consumer?.description ?? "");
  const [ownerName, setOwnerName] = useState(consumer?.owner_name ?? "");
  const [ownerEmail, setOwnerEmail] = useState(consumer?.owner_email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description.trim() || null,
        owner_name: ownerName.trim() || null,
        owner_email: ownerEmail.trim(),
      };
      if (consumer) {
        await platformApi.update(consumer.id, payload);
        onSaved(`'${payload.slug}' updated.`);
      } else {
        await platformApi.create(payload);
        onSaved(`'${payload.slug}' registered. Issue it a token when it is ready to call.`);
      }
    } catch (err) {
      setError(extractApiError(err, "Could not save the system."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={consumer ? `Edit system: ${consumer.slug}` : "Register a system"}
      size="lg"
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="consumer-form" loading={saving}>
            {consumer ? "Update system" : "Register system"}
          </Button>
        </>
      }
    >
      <form id="consumer-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
          >
            {error}
          </div>
        )}

        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="RIaaS Reporting"
          required
        />
        <Input
          label="Slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="riaas-reporting"
          hint="Lowercase words separated by hyphens. Name the system, never a person — a consumer named after whoever asked for it breaks when they move on."
          required
        />
        <Input
          label="Who to contact"
          type="email"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          placeholder="team@example.com"
          hint="Required: someone must be contactable when this integration needs revoking."
          required
        />
        <Input
          label="Contact name"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="Optional"
        />
        <Textarea
          label="What it does"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Optional — what this system uses the API for."
        />
      </form>
    </FormModal>
  );
}

/** A system's tokens and its recent calls. */
function ConsumerDetail({
  consumer,
  onClose,
  onChanged,
  show,
}: {
  consumer: ApiConsumer;
  onClose: () => void;
  onChanged: () => void;
  show: (message: string, tone?: "success" | "error") => void;
}) {
  const [tokens, setTokens] = useState(consumer.tokens);
  const [revoking, setRevoking] = useState<string | null>(null);

  const revoke = async (tokenId: string) => {
    setRevoking(tokenId);
    try {
      await platformApi.revokeToken(consumer.id, tokenId);
      const res = await platformApi.get(consumer.id);
      setTokens(res.data.tokens);
      show("Token revoked. It stops working immediately.", "success");
      onChanged();
    } catch (err) {
      show(extractApiError(err, "Could not revoke the token."), "error");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <Modal onClose={onClose} title={consumer.name} subtitle={consumer.slug} size="xl">
      <div className="flex flex-col gap-3 text-xs">
        {consumer.description && (
          <p className="text-ink dark:text-gray-300">{consumer.description}</p>
        )}

        <div>
          <p className="mb-1 font-semibold text-ink dark:text-gray-100">Tokens</p>
          {tokens.length === 0 ? (
            <p className="text-ink-label dark:text-night-muted">
              None issued. This system is registered but cannot call anything.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {tokens.map((token) => (
                <li
                  key={token.id}
                  className="rounded-[5px] bg-surface-tile px-2.5 py-2 dark:bg-night-body"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-ink dark:text-gray-200">
                      {token.name}{" "}
                      <span className="font-mono font-normal text-ink-label dark:text-night-muted">
                        {token.prefix}…
                      </span>
                    </span>
                    {token.revoked_at ? (
                      <Badge tone="danger">Revoked</Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => revoke(token.id)}
                        disabled={revoking === token.id}
                        className="font-semibold text-tone-danger hover:underline disabled:opacity-50"
                      >
                        {revoking === token.id ? "Revoking…" : "Revoke"}
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-label dark:text-night-muted">
                    {token.abilities.join(", ") || "no abilities"} ·{" "}
                    {token.expires_at
                      ? `expires ${formatDateTime(token.expires_at)}`
                      : "never expires"}{" "}
                    ·{" "}
                    {token.last_used_at
                      ? `last used ${formatDateTime(token.last_used_at)}`
                      : "never used"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-[11px] text-ink-label dark:text-night-muted">
          A token cannot be re-read — only its first characters are stored in the clear. If one
          is lost, revoke it and issue another.
        </p>
      </div>
    </Modal>
  );
}

/** Grant abilities and mint. */
function IssueTokenForm({
  consumer,
  abilities,
  onClose,
  onIssued,
}: {
  consumer: ApiConsumer;
  abilities: Ability[];
  onClose: () => void;
  onIssued: (issued: IssuedToken) => void;
}) {
  const [name, setName] = useState("");
  const [granted, setGranted] = useState<string[]>([]);
  const [expiry, setExpiry] = useState("90");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (ability: string) =>
    setGranted((current) =>
      current.includes(ability)
        ? current.filter((a) => a !== ability)
        : [...current, ability]
    );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await platformApi.issueToken(consumer.id, {
        name: name.trim() || "Token",
        abilities: granted,
        expires_in_days: expiry ? Number(expiry) : null,
      });
      onIssued(res.data);
    } catch (err) {
      setError(extractApiError(err, "Could not issue the token."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={`Issue a token to ${consumer.slug}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="issue-token-form"
            loading={saving}
            disabled={granted.length === 0}
          >
            Issue token
          </Button>
        </>
      }
    >
      <form id="issue-token-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
          >
            {error}
          </div>
        )}

        {!consumer.active && (
          <div className="rounded-[5px] border border-tone-warning/40 bg-tone-warning/10 px-3 py-2 text-xs text-ink dark:text-gray-200">
            This system is switched off, so the token will not work until you switch it back on.
          </div>
        )}

        <Input
          label="What is this token for"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nightly export job"
          required
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink dark:text-gray-200">Abilities</span>
          {abilities.length === 0 ? (
            <p className="text-[11px] text-ink-label dark:text-night-muted">
              No abilities are published yet, so there is nothing a token could be granted.
            </p>
          ) : (
            abilities.map((ability) => (
              <label
                key={ability.name}
                className="flex cursor-pointer items-start gap-2 rounded-[5px] bg-surface-tile px-2.5 py-2 dark:bg-night-body"
              >
                <input
                  type="checkbox"
                  checked={granted.includes(ability.name)}
                  onChange={() => toggle(ability.name)}
                  className="mt-0.5 h-3.5 w-3.5 accent-brand"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-xs font-semibold text-ink dark:text-gray-200">
                    {ability.label}
                    <Badge tone={SENSITIVITY_TONE[ability.sensitivity]}>
                      {ability.sensitivity}
                    </Badge>
                  </span>
                  {/* Written for the person granting it, not for a developer —
                      this is the only moment anyone reads what a token opens up. */}
                  <span className="block text-[11px] text-ink-label dark:text-night-muted">
                    {ability.description}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink dark:text-gray-200">Expires</span>
          <div className="flex flex-wrap gap-2">
            {EXPIRY_CHOICES.map((choice) => (
              <label
                key={choice.label}
                className={`cursor-pointer rounded-[5px] border-2 px-2.5 py-1 text-xs ${
                  expiry === choice.value
                    ? "border-brand text-ink dark:text-gray-100"
                    : "border-brand/20 text-ink-label dark:border-night-border dark:text-night-muted"
                }`}
              >
                <input
                  type="radio"
                  name="expiry"
                  value={choice.value}
                  checked={expiry === choice.value}
                  onChange={() => setExpiry(choice.value)}
                  className="sr-only"
                />
                {choice.label}
              </label>
            ))}
          </div>
          {expiry === "" && (
            <p className="text-[11px] text-tone-warning">
              A token that never expires is one nobody has to remember to renew — and one
              nobody notices is still valid two years after the project ended.
            </p>
          )}
        </div>
      </form>
    </FormModal>
  );
}

/** The one-time reveal. */
function TokenReveal({
  issued,
  onClose,
  show,
}: {
  issued: IssuedToken;
  onClose: () => void;
  show: (message: string, tone?: "success" | "error") => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.token);
      show("Token copied to the clipboard.", "success");
    } catch {
      show("Could not copy — select the token and copy it manually.", "error");
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Copy this token now"
      subtitle={issued.detail.name}
      size="lg"
    >
      <div className="flex flex-col gap-3 text-xs">
        <div className="rounded-[5px] border border-tone-warning/40 bg-tone-warning/10 px-3 py-2 text-ink dark:text-gray-200">
          {issued.warning}
        </div>

        <code className="block break-all rounded-[5px] bg-surface-tile px-3 py-2.5 font-mono text-[11px] text-ink dark:bg-night-body dark:text-gray-200">
          {issued.token}
        </code>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-ink-label dark:text-night-muted">
            {issued.detail.abilities.join(", ")} ·{" "}
            {issued.detail.expires_at
              ? `expires ${formatDateTime(issued.detail.expires_at)}`
              : "never expires"}
          </span>
          <span className="flex gap-2">
            <Button variant="outline" onClick={copy}>
              Copy
            </Button>
            <Button onClick={onClose}>Done</Button>
          </span>
        </div>
      </div>
    </Modal>
  );
}
