"use client";

import { useCallback, useMemo, useState } from "react";

import Badge, { type BadgeTone } from "@/components/common/Badge";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { type Column } from "@/components/common/DataTable";
import DeleteDialog from "@/components/common/DeleteDialog";
import FormModal from "@/components/common/FormModal";
import ResourceIndex from "@/components/common/ResourceIndex";
import Textarea from "@/components/common/Textarea";
import Toast, { useToast } from "@/components/common/Toast";
import {
  actionsColumn,
  badgeColumn,
  dateColumn,
  numberColumn,
  stackedCell,
} from "@/components/common/columns";
import { navIcon } from "@/components/dashboard/navIcons";
import {
  type ErrorGroup,
  type ErrorGroupDetail,
  type ErrorStatus,
} from "@/lib/api/errorApi";
import useModalState from "@/lib/hooks/useModalState";
import usePermissions from "@/lib/hooks/usePermissions";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import {
  useDeleteErrorMutation,
  useGetErrorQuery,
  useListErrorsQuery,
  useSetErrorStatusMutation,
} from "@/lib/api/endpoints/errorsEndpoints";
import { extractApiError } from "@/lib/utils/apiError";
import { formatDateTime } from "@/lib/utils/format";

/**
 * Error Tracking (LeapDesk parity, Module 17).
 *
 * A full index module — this one **is** a table, unlike Configuration and
 * Security: rows are genuinely compared against each other. "Which of these is
 * happening most, and which started today" is the question, and that is exactly
 * what a sortable grid answers.
 *
 * Triage, not authoring: there is no create. An error group exists because
 * something failed.
 */

const STATUS_META: Record<ErrorStatus, { tone: BadgeTone; label: string }> = {
  open: { tone: "danger", label: "Open" },
  resolved: { tone: "success", label: "Resolved" },
  // Two negative states, deliberately distinct — see the note on `ErrorStatus`.
  // "Not worth fixing" and "worth fixing, stop telling me" are different
  // decisions and collapsing them loses which one was made.
  ignored: { tone: "neutral", label: "Ignored" },
  muted: { tone: "warning", label: "Muted" },
};

const STATUS_OPTIONS = (Object.keys(STATUS_META) as ErrorStatus[]).map((s) => ({
  value: s,
  label: STATUS_META[s].label,
}));

type ModalMode = "view" | "triage" | "delete";

export default function ErrorsModule() {
  const { can } = usePermissions();
  const { toasts, show, dismiss } = useToast();

  const q = useResourceQuery({
    filters: { search: "", status: "", module: "" },
    debounced: ["search"],
    // Newest sighting first, not highest count: the question is "is something
    // broken right now", and an old error with a huge count would otherwise pin
    // itself to the top and push today's regression off the first screen.
    defaultSortBy: "last_seen_at",
    defaultSortOrder: "desc",
    // 30, matching Users' owner-set default so switching modules keeps the
    // same density (2026-08-13).
    defaultPerPage: 30,
  });

  // PM-41 § 4.5. `status` is both a filter here and the thing every write
  // changes, so `patchRow` could leave a resolved group sitting in a list
  // filtered to `open`. Invalidation re-runs the filtered query instead.
  const listQuery = useListErrorsQuery(
    {
      search: q.applied.search || undefined,
      status: (q.applied.status as ErrorStatus) || undefined,
      module: q.applied.module || undefined,
      sort_by: q.sortBy,
      sort_order: q.sortOrder,
      page: q.page,
      per_page: q.perPage,
    },
    { skip: !q.ready },
  );

  const modal = useModalState<ModalMode, ErrorGroup>();
  const [setErrorStatus] = useSetErrorStatusMutation();
  const [deleteError] = useDeleteErrorMutation();

  /*
    An id, not a boolean. It disables the one row being written rather than the
    whole table: a boolean would either freeze every row while one writes, or
    freeze none and let the same row be clicked twice — and a second click on a
    toggle sends it straight back, which reads as the action having silently
    failed.
  */
  const [busy, setBusy] = useState<string | null>(null);

  /*
    The detail is a cache entry keyed on the row id, replacing the
    fetch-into-state that used to run here. Two things fall out of that: reopening
    a group is free, and a triage invalidates that id — so the modal's copy of
    `status` and `notes` cannot drift behind the table it was opened from.

    The `skip` gate is the same one the other converted modules use, rather than
    RTK Query's `skipToken` — one way of expressing "not yet" per § 5. The `?? 0`
    is never requested: `skip` is true for exactly the states where there is no
    row, and it keeps the argument honestly a `number` instead of a cast.
  */
  const viewing = modal.is("view") ? modal.target : null;
  const { data: detail, isFetching: detailLoading } = useGetErrorQuery(viewing?.id ?? 0, {
    skip: !viewing,
  });

  const openDetail = useCallback(
    (row: ErrorGroup) => {
      modal.open("view", row);
    },
    [modal]
  );

  const toggleResolved = async (row: ErrorGroup) => {
    setBusy(String(row.id));
    try {
      await setErrorStatus({
        id: row.id,
        status: row.status === "resolved" ? "open" : "resolved",
      }).unwrap();
      show(row.status === "resolved" ? "Reopened." : "Marked resolved.");
    } catch (err) {
      show(extractApiError(err, "Action failed."), "error");
    } finally {
      setBusy(null);
    }
  };

  const columns = useMemo<Column<ErrorGroup>[]>(
    () => [
      numberColumn(),
      actionsColumn<ErrorGroup>((row) => [
        { label: "View", onSelect: () => void openDetail(row) },
        {
          label: "Triage",
          visible: can("error-manage"),
          disabled: busy === String(row.id),
          onSelect: () => modal.open("triage", row),
        },
        {
          label: row.status === "resolved" ? "Reopen" : "Mark resolved",
          visible: can("error-manage"),
          disabled: busy === String(row.id),
          onSelect: () => void toggleResolved(row),
        },
        {
          label: "Delete",
          destructive: true,
          visible: can("error-manage"),
          hint: "Removes the group and every sighting of it",
          onSelect: () => modal.open("delete", row),
        },
      ]),
      badgeColumn<ErrorGroup>({
        id: "status",
        header: "Status",
        sortKey: "status",
        tone: (row) => STATUS_META[row.status].tone,
        label: (row) => STATUS_META[row.status].label,
        width: "w-[110px]",
      }),
      {
        id: "error",
        header: "Error",
        sortKey: "exception_class",
        cell: (row) => stackedCell(row.exception_class, row.latest_message),
      },
      {
        id: "where",
        header: "Where",
        cell: (row) => (
          <span className="truncate font-mono text-ink-label dark:text-night-muted">
            {row.path ?? "—"}
            <span className="opacity-60">
              {" "}
              · {row.file.split("/").pop()}:{row.line}
            </span>
          </span>
        ),
      },
      {
        id: "count",
        header: "Seen",
        sortKey: "occurrence_count",
        cell: (row) => (
          <span className="tabular-nums font-semibold text-ink dark:text-gray-100">
            {row.occurrence_count.toLocaleString()}
          </span>
        ),
        className: "text-center",
        headerClassName: "w-[80px] text-center",
      },
      dateColumn<ErrorGroup>({
        id: "last_seen",
        header: "Last seen",
        sortKey: "last_seen_at",
        value: (row) => row.last_seen_at,
        withTime: true,
      }),
      dateColumn<ErrorGroup>({
        id: "first_seen",
        header: "First seen",
        sortKey: "first_seen_at",
        value: (row) => row.first_seen_at,
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, can, modal.open, openDetail]
  );

  return (
    <ResourceIndex<ErrorGroup, typeof q.filters>
      icon={navIcon("errors")}
      title="Error Tracking"
      description="Distinct application errors, grouped. Fixing one row fixes every sighting behind it."
      query={q}
      filters={[
        { type: "text", key: "search", placeholder: "Search errors...", label: "Search errors" },
        {
          type: "select",
          key: "status",
          placeholder: "All statuses",
          searchPlaceholder: "Search statuses...",
          label: "Filter by status",
          options: STATUS_OPTIONS,
        },
      ]}
      columns={columns}
      result={listQuery}
      rowKey={(r) => String(r.id)}
      errorMessage="Could not load errors."
      table="vendor"
      rowNoun="error"
      emptyTitle="No errors recorded"
      emptyHint="Nothing has failed since tracking was switched on."
    >
      {modal.is("view") && modal.target && (
        <ErrorDetailModal
          group={modal.target}
          detail={detail ?? null}
          loading={detailLoading}
          onClose={modal.close}
        />
      )}

      {modal.is("triage") && modal.target && (
        <TriageModal
          group={modal.target}
          onClose={modal.close}
          onDone={(updated) => {
            // No `patchRow`: the mutation invalidated this row and the
            // collection, so the table already has the server's version.
            modal.close();
            show(`Marked ${STATUS_META[updated.status].label.toLowerCase()}.`);
          }}
        />
      )}

      {modal.is("delete") && modal.target && (
        <DeleteDialog
          noun="error"
          name={modal.target.exception_class}
          subtitle={modal.target.path ?? undefined}
          onConfirm={() => deleteError(modal.target!.id).unwrap()}
          onDeleted={() => {
            modal.close();
            show("Error deleted.");
          }}
          onClose={modal.close}
        >
          <p className="text-xs text-ink-label dark:text-night-muted">
            {/* Said out loud because the alternative is right there and is almost
                always the better choice. */}
            This removes {modal.target.occurrence_count.toLocaleString()} recorded sighting(s) and
            the evidence behind them. To stop it appearing without losing the record, mark it{" "}
            <strong>resolved</strong> or <strong>ignored</strong> instead.
          </p>
        </DeleteDialog>
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </ResourceIndex>
  );
}

/** Read one error: where it happens, and the most recent sightings. */
function ErrorDetailModal({
  group,
  detail,
  loading,
  onClose,
}: {
  group: ErrorGroup;
  detail: ErrorGroupDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  const latest = detail?.occurrences[0];

  return (
    <FormModal
      open
      onClose={onClose}
      icon={navIcon("activity")}
      title={group.exception_class}
      subtitle={group.latest_message}
      size="xl"
      footer={
        <Button variant="outline" type="button" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <Badge tone={STATUS_META[group.status].tone}>{STATUS_META[group.status].label}</Badge>
        <Badge tone="neutral">{group.occurrence_count.toLocaleString()} sightings</Badge>
        <Badge tone="neutral">{group.module}</Badge>
      </div>

      <dl className="mb-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-xs">
        <dt className="text-ink-label dark:text-night-muted">Where</dt>
        {/* `break-all`: a long file path or trace id has no natural break point
            and otherwise overflows the column — matches WebhooksModule's
            signing-secret `<code>`. */}
        <dd className="break-all font-mono text-ink dark:text-gray-200">
          {group.file}:{group.line}
        </dd>
        <dt className="text-ink-label dark:text-night-muted">Route</dt>
        <dd className="break-all font-mono text-ink dark:text-gray-200">
          {group.method ?? ""} {group.path ?? "—"}
        </dd>
        <dt className="text-ink-label dark:text-night-muted">First seen</dt>
        <dd className="text-ink dark:text-gray-200">{formatDateTime(group.first_seen_at)}</dd>
        <dt className="text-ink-label dark:text-night-muted">Last seen</dt>
        <dd className="text-ink dark:text-gray-200">{formatDateTime(group.last_seen_at)}</dd>
        {group.notes && (
          <>
            <dt className="text-ink-label dark:text-night-muted">Notes</dt>
            <dd className="text-ink dark:text-gray-200">{group.notes}</dd>
          </>
        )}
      </dl>

      {loading && (
        <p className="text-xs text-ink-label dark:text-night-muted">Loading sightings…</p>
      )}

      {latest?.stack_trace && (
        <div className="mb-4">
          <p className="mb-1 text-xs font-semibold text-ink dark:text-gray-200">
            Stack trace — most recent sighting
          </p>
          <pre className="max-h-64 overflow-auto rounded-[5px] bg-surface-tile p-3 font-mono text-[11px] text-ink dark:bg-night-body dark:text-gray-300">
            {latest.stack_trace}
          </pre>
        </div>
      )}

      {detail && detail.occurrences.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink dark:text-gray-200">
            {/* The cap is stated rather than implied — `occurrences.length` is
                not the count, and a list that silently truncates reads as one
                that is complete. */}
            Recent sightings — {detail.occurrences.length} of{" "}
            {detail.occurrence_total.toLocaleString()}
          </p>
          <div className="flex flex-col gap-1.5">
            {detail.occurrences.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-[5px] border border-brand/20 px-3 py-1.5 text-xs dark:border-night-border"
              >
                <span className="truncate font-mono text-ink-label dark:text-night-muted">
                  {o.method} {o.url ?? "—"}
                </span>
                <span className="whitespace-nowrap tabular-nums text-ink-label dark:text-night-muted">
                  {formatDateTime(o.occurred_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </FormModal>
  );
}

/** Set a status and record why. */
function TriageModal({
  group,
  onClose,
  onDone,
}: {
  group: ErrorGroup;
  onClose: () => void;
  onDone: (updated: ErrorGroup) => void;
}) {
  // No `onError` prop: `ConfirmDialog` catches a rejected `onConfirm`, renders
  // the message in place and **stays open**. Passing one would put the same
  // failure in a toast as well, and close a dialog whose whole contract is that
  // it does not close on failure.
  const [status, setStatus] = useState<ErrorStatus>(group.status);
  const [notes, setNotes] = useState(group.notes ?? "");
  const [setErrorStatus] = useSetErrorStatusMutation();

  return (
    <ConfirmDialog
      title="Triage error"
      subtitle={group.exception_class}
      confirmLabel="Save"
      busyLabel="Saving…"
      tone="primary"
      errorFallback="Could not update this error."
      onConfirm={async () => {
        // Deliberately not caught: `ConfirmDialog` renders a rejection in place
        // and stays open, which is why there is no `onError` here.
        const updated = await setErrorStatus({
          id: group.id,
          status,
          notes: notes.trim() || null,
        }).unwrap();
        onDone(updated);
      }}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={`rounded-[5px] border px-3 py-1.5 text-xs font-semibold transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40
                ${
                  status === opt.value
                    ? "border-brand bg-brand/10 text-brand dark:text-brand-on-dark"
                    : "border-brand/20 text-ink-label hover:bg-brand/10 hover:text-brand dark:border-night-border dark:text-night-muted"
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Textarea
          label="Notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          hint="Why this decision. The most useful thing to write is why an error is being ignored."
        />

        {/* Stated because it is the one status whose meaning is not obvious from
            its name, and getting it wrong means an error silently reappears. */}
        {status === "resolved" && (
          <p className="text-xs text-ink-label dark:text-night-muted">
            A new sighting will reopen this automatically. Ignored and muted are not reopened.
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}
