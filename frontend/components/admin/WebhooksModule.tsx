"use client";

import { useEffect, useMemo, useState } from "react";

import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import DeleteDialog from "@/components/common/DeleteDialog";
import FormModal from "@/components/common/FormModal";
import Input from "@/components/common/Input";
import Modal from "@/components/common/Modal";
import ResourceIndex from "@/components/common/ResourceIndex";
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
import { platformApi, type ApiConsumer } from "@/lib/api/platformApi";
import {
  webhookApi,
  type WebhookCreated,
  type WebhookDelivery,
  type WebhookEndpoint,
  type WebhookEvent,
} from "@/lib/api/webhookApi";
import { extractApiError } from "@/lib/utils/apiError";
import { formatDateTime } from "@/lib/utils/format";
import useModalState from "@/lib/hooks/useModalState";
import useResourceList from "@/lib/hooks/useResourceList";
import useResourceQuery from "@/lib/hooks/useResourceQuery";

/**
 * Outbound webhooks — where events go, and what happened when they went.
 *
 * **The delivery log with a redeliver button is the module.** Everything else
 * here is registration; without the log, a webhook that failed silently is
 * unrecoverable — the event happened, the receiver missed it, and nothing can
 * replay it. That is why `Deliveries` is the first row action rather than buried
 * in a detail page.
 *
 * ## Two states that look the same and are not
 *
 * **Switched off** is a person's decision. **Auto-disabled** is ours, after ten
 * consecutive failures — the endpoint was trying and failing, and we stopped.
 * The table distinguishes them, because "why did this stop working" has two very
 * different answers and only one of them is someone's fault.
 */

type ModalMode = "create" | "edit" | "delete" | "deliveries" | "secret";

const STATUS_TONE = {
  delivered: "success",
  failed: "danger",
  pending: "warning",
} as const;

function stateOf(row: WebhookEndpoint): { label: string; tone: "success" | "danger" | "warning" } {
  if (row.disabled_at) return { label: "Auto-disabled", tone: "danger" };
  if (!row.is_active) return { label: "Switched off", tone: "warning" };
  return { label: "Active", tone: "success" };
}

export default function WebhooksModule() {
  const { toasts, show, dismiss } = useToast();
  const modal = useModalState<ModalMode, WebhookEndpoint>();

  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [consumers, setConsumers] = useState<ApiConsumer[]>([]);
  const [issued, setIssued] = useState<WebhookCreated | null>(null);

  const q = useResourceQuery({
    filters: { search: "", is_active: "" },
    debounced: ["search"],
    defaultSortBy: "created_at",
    defaultSortOrder: "desc",
    defaultPerPage: 15,
  });

  const list = useResourceList<WebhookEndpoint>({
    ready: q.ready,
    deps: [q.applied, q.sortBy, q.sortOrder, q.page, q.perPage],
    errorMessage: "Could not load the webhooks.",
    fetch: () =>
      webhookApi
        .list({
          search: q.applied.search || undefined,
          is_active:
            q.applied.is_active === "" ? undefined : q.applied.is_active === "true",
          sort_by: q.sortBy,
          sort_order: q.sortOrder,
          page: q.page,
          per_page: q.perPage,
        })
        .then((res) => res.data),
  });

  useEffect(() => {
    webhookApi.events().then((res) => setEvents(res.data)).catch(() => setEvents([]));
    platformApi
      .list({ per_page: 100 })
      .then((res) => setConsumers(res.data.items))
      .catch(() => setConsumers([]));
  }, []);

  const sendTest = async (row: WebhookEndpoint) => {
    try {
      const res = await webhookApi.test(row.id);
      const ok = res.data.status === "delivered";
      show(
        ok
          ? `Delivered — the receiver answered ${res.data.response_status}.`
          : `Not delivered: ${res.data.response_status ?? "no response"}. Open Deliveries for the detail.`,
        ok ? "success" : "error"
      );
      list.refetch();
    } catch (err) {
      show(extractApiError(err, "Could not send the test."), "error");
    }
  };

  const columns = useMemo<Column<WebhookEndpoint>[]>(
    () => [
      numberColumn<WebhookEndpoint>(),
      actionsColumn<WebhookEndpoint>((row) => [
        { label: "Deliveries", onSelect: () => modal.open("deliveries", row) },
        { label: "Send test", onSelect: () => void sendTest(row) },
        { label: "Edit", onSelect: () => modal.open("edit", row) },
        { label: "Delete", onSelect: () => modal.open("delete", row), destructive: true },
      ]),
      badgeColumn<WebhookEndpoint>({
        id: "state",
        header: "State",
        tone: (row) => stateOf(row).tone,
        label: (row) => stateOf(row).label,
        width: "w-[140px]",
        sortKey: "is_active",
      }),
      {
        id: "endpoint",
        header: "Endpoint",
        cell: (row) => stackedCell(row.name, row.url),
        sortKey: "name",
      },
      {
        id: "events",
        header: "Subscribed to",
        cell: (row) => (
          <span className="text-ink dark:text-gray-300">{row.events.join(", ")}</span>
        ),
      },
      {
        id: "failures",
        header: "Failures",
        cell: (row) =>
          row.failure_count > 0 ? (
            <span className="font-semibold text-tone-danger">{row.failure_count} in a row</span>
          ) : (
            <span className="text-ink-label dark:text-night-muted">—</span>
          ),
        sortKey: "failure_count",
        headerClassName: "w-[120px]",
      },
      dateColumn<WebhookEndpoint>({
        id: "last_delivery_at",
        header: "Last delivery",
        value: (row) => row.last_delivery_at,
        withTime: true,
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modal.open]
  );

  return (
    <ResourceIndex<WebhookEndpoint, typeof q.filters>
      icon={navIcon("webhooks")}
      title="Webhooks"
      description="Where we post events, and what happened when we did"
      query={q}
      actions={<Button onClick={() => modal.open("create")}>Add a webhook</Button>}
      filters={[
        {
          type: "text",
          key: "search",
          placeholder: "Search name or URL…",
          label: "Search webhooks",
        },
        {
          type: "select",
          key: "is_active",
          placeholder: "All states",
          label: "Filter by state",
          options: [
            { value: "true", label: "Active" },
            { value: "false", label: "Not active" },
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
      rowNoun="webhook"
      emptyTitle="No webhooks yet"
      emptyHint="Add one when a registered system wants to be told about events as they happen."
    >
      {(modal.is("create") || modal.is("edit")) && (
        <WebhookForm
          endpoint={modal.is("edit") ? modal.target : null}
          events={events}
          consumers={consumers}
          onClose={modal.close}
          onSaved={(message, created) => {
            modal.close();
            show(message, "success");
            list.refetch();
            if (created) {
              setIssued(created);
              modal.open("secret");
            }
          }}
        />
      )}

      {modal.is("delete") && modal.target && (
        <DeleteDialog
          noun="webhook"
          name={modal.target.name}
          subtitle={modal.target.url}
          onConfirm={() => webhookApi.remove(modal.target!.id)}
          onDeleted={() => {
            modal.close();
            show("Webhook removed.", "success");
            list.refetch();
          }}
          onClose={modal.close}
        >
          <p>Its delivery history goes with it, so a failed delivery cannot be replayed afterwards.</p>
        </DeleteDialog>
      )}

      {modal.is("deliveries") && modal.target && (
        <DeliveryLog endpoint={modal.target} onClose={modal.close} show={show} />
      )}

      {modal.is("secret") && issued && (
        <SecretReveal
          issued={issued}
          onClose={() => {
            // The plaintext lives in this component's state and nowhere else.
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

function WebhookForm({
  endpoint,
  events,
  consumers,
  onClose,
  onSaved,
}: {
  endpoint: WebhookEndpoint | null;
  events: WebhookEvent[];
  consumers: ApiConsumer[];
  onClose: () => void;
  onSaved: (message: string, created?: WebhookCreated) => void;
}) {
  const [consumerId, setConsumerId] = useState(endpoint?.api_consumer_id ?? "");
  const [name, setName] = useState(endpoint?.name ?? "");
  const [url, setUrl] = useState(endpoint?.url ?? "");
  const [selected, setSelected] = useState<string[]>(endpoint?.events ?? []);
  const [active, setActive] = useState(endpoint?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (endpoint) {
        await webhookApi.update(endpoint.id, {
          name: name.trim(),
          url: url.trim(),
          events: selected,
          is_active: active,
        });
        onSaved(`'${name.trim()}' updated.`);
      } else {
        const res = await webhookApi.create({
          api_consumer_id: consumerId,
          name: name.trim(),
          url: url.trim(),
          events: selected,
          is_active: active,
        });
        onSaved("Webhook added.", res.data);
      }
    } catch (err) {
      // The 422 here is often the destination guard — "that URL resolves to a
      // private address" — which is precise and actionable, so it must survive.
      setError(extractApiError(err, "Could not save the webhook."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={endpoint ? `Edit webhook: ${endpoint.name}` : "Add a webhook"}
      size="lg"
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="webhook-form"
            loading={saving}
            disabled={selected.length === 0 || (!endpoint && !consumerId)}
          >
            {endpoint ? "Update webhook" : "Add webhook"}
          </Button>
        </>
      }
    >
      <form id="webhook-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
          >
            {error}
          </div>
        )}

        {!endpoint && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="webhook-consumer"
              className="text-xs font-medium text-ink dark:text-gray-200"
            >
              Which system
            </label>
            <select
              id="webhook-consumer"
              value={consumerId}
              onChange={(e) => setConsumerId(e.target.value)}
              required
              className="w-full rounded-[5px] border-2 border-brand/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand dark:border-night-border dark:bg-night-card dark:text-gray-100"
            >
              <option value="">Choose a registered system…</option>
              {consumers.map((consumer) => (
                <option key={consumer.id} value={consumer.id}>
                  {consumer.name} ({consumer.slug})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-ink-label dark:text-night-muted">
              A webhook belongs to a system, not to a person — register one under Platform API
              first if it is not listed.
            </p>
          </div>
        )}

        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Partner sync"
          required
        />
        <Input
          label="URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/hooks/partner-marketplace"
          hint="Must be reachable from the internet. Private, loopback and cloud-metadata addresses are refused."
          required
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink dark:text-gray-200">Events</span>
          {events.map((event) => (
            <label
              key={event.name}
              className="flex cursor-pointer items-start gap-2 rounded-[5px] bg-surface-tile px-2.5 py-2 dark:bg-night-body"
            >
              <input
                type="checkbox"
                checked={selected.includes(event.name)}
                onChange={() =>
                  setSelected((current) =>
                    current.includes(event.name)
                      ? current.filter((e) => e !== event.name)
                      : [...current, event.name]
                  )
                }
                className="mt-0.5 h-3.5 w-3.5 accent-brand"
              />
              <span>
                <span className="block font-mono text-xs text-ink dark:text-gray-200">
                  {event.name}
                </span>
                <span className="block text-[11px] text-ink-label dark:text-night-muted">
                  {event.description}
                </span>
              </span>
            </label>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-ink dark:text-gray-200">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-3.5 w-3.5 accent-brand"
          />
          Active
          {endpoint?.disabled_at && (
            <span className="text-[11px] text-tone-warning">
              — re-enabling also clears the {endpoint.failure_count} recorded failures
            </span>
          )}
        </label>
      </form>
    </FormModal>
  );
}

function DeliveryLog({
  endpoint,
  onClose,
  show,
}: {
  endpoint: WebhookEndpoint;
  onClose: () => void;
  show: (message: string, tone?: "success" | "error") => void;
}) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await webhookApi.deliveries(endpoint.id);
        if (live) setDeliveries(res.data);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [endpoint.id]);

  const redeliver = async (delivery: WebhookDelivery) => {
    setBusy(delivery.id);
    try {
      const res = await webhookApi.redeliver(delivery.id);
      setDeliveries((current) =>
        current.map((d) => (d.id === delivery.id ? res.data : d))
      );
      show(
        res.data.status === "delivered"
          ? "Redelivered successfully."
          : `Still failing: ${res.data.response_status ?? "no response"}.`,
        res.data.status === "delivered" ? "success" : "error"
      );
    } catch (err) {
      show(extractApiError(err, "Could not redeliver."), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal onClose={onClose} title={`Deliveries: ${endpoint.name}`} subtitle={endpoint.url} size="xl">
      {loading ? (
        <p className="py-6 text-center text-xs text-ink-label dark:text-night-muted">Loading…</p>
      ) : deliveries.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-label dark:text-night-muted">
          Nothing has been sent to this endpoint yet.
        </p>
      ) : (
        <ul className="flex max-h-[26rem] flex-col gap-1.5 overflow-y-auto">
          {deliveries.map((delivery) => (
            <li
              key={delivery.id}
              className="rounded-[5px] bg-surface-tile px-2.5 py-2 text-xs dark:bg-night-body"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[delivery.status]}>{delivery.status}</Badge>
                  <span className="font-mono text-ink dark:text-gray-200">{delivery.event}</span>
                </span>
                <span className="flex items-center gap-2 text-ink-label dark:text-night-muted">
                  {delivery.response_status ?? "no response"} ·{" "}
                  {delivery.attempts} attempt{delivery.attempts === 1 ? "" : "s"} ·{" "}
                  {delivery.duration_ms ?? "—"} ms
                  {delivery.status !== "delivered" && (
                    <button
                      type="button"
                      onClick={() => redeliver(delivery)}
                      disabled={busy === delivery.id}
                      className="font-semibold text-brand hover:underline disabled:opacity-50 dark:text-brand-on-dark"
                    >
                      {busy === delivery.id ? "Sending…" : "Redeliver"}
                    </button>
                  )}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-ink-label dark:text-night-muted">
                {formatDateTime(delivery.created_at)}
                {delivery.next_attempt_at &&
                  ` · next attempt ${formatDateTime(delivery.next_attempt_at)}`}
              </p>
              {delivery.response_body && delivery.status !== "delivered" && (
                <pre className="mt-1 max-h-24 overflow-auto rounded-[4px] bg-white/60 p-2 font-mono text-[10px] text-ink dark:bg-black/20 dark:text-gray-300">
                  {delivery.response_body}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-[11px] text-ink-label dark:text-night-muted">
        Failed deliveries record when their next attempt is due, but nothing retries them
        automatically — there is no background worker. <strong>Redeliver is the retry that
        works today.</strong>
      </p>
    </Modal>
  );
}

function SecretReveal({
  issued,
  onClose,
  show,
}: {
  issued: WebhookCreated;
  onClose: () => void;
  show: (message: string, tone?: "success" | "error") => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.secret);
      show("Signing secret copied.", "success");
    } catch {
      show("Could not copy — select it and copy manually.", "error");
    }
  };

  return (
    <Modal onClose={onClose} title="Copy this signing secret" subtitle={issued.endpoint.url} size="lg">
      <div className="flex flex-col gap-3 text-xs">
        <div className="rounded-[5px] border border-tone-warning/40 bg-tone-warning/10 px-3 py-2 text-ink dark:text-gray-200">
          {issued.warning}
        </div>
        <code className="block break-all rounded-[5px] bg-surface-tile px-3 py-2.5 font-mono text-[11px] text-ink dark:bg-night-body dark:text-gray-200">
          {issued.secret}
        </code>
        <p className="text-[11px] text-ink-label dark:text-night-muted">
          Every delivery carries <span className="font-mono">X-PMP-Signature</span>, an HMAC-SHA256
          of <span className="font-mono">{"{timestamp}.{body}"}</span> using this secret. The
          timestamp is signed too, so a receiver that checks its age is checking something the
          signature covers — that is what stops a captured payload being replayed.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={copy}>
            Copy
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
