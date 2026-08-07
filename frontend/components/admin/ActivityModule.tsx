"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Badge, { type BadgeTone } from "@/components/common/Badge";
import ResourceIndex from "@/components/common/ResourceIndex";
import { type Column } from "@/components/common/DataTable";
import Modal from "@/components/common/Modal";
import useAutoPerPage from "@/lib/hooks/useAutoPerPage";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import { activityApi, type ActivityEntry } from "@/lib/api/rbacApi";

/**
 * The Activity Log index — the read surface for the audit trail (PM-32).
 *
 * Built on the mandatory index-page layout, same as Users and Roles. **No row
 * actions and no bulk actions**, because there is nothing to do to an audit entry:
 * the API has no write route and neither does this. A "delete" affordance on an
 * audit trail would be the single most damaging button in the product.
 *
 * The one interaction is opening a row to read its `properties` — the before/after
 * diff, the IP, the reason a login failed. That detail is the whole value of the
 * trail and does not fit in a table cell.
 */

/** Tone per event, so a timeline is scannable without reading every row. */
const EVENT_TONES: Record<string, BadgeTone> = {
  login: "success",
  logout: "neutral",
  failed_login: "danger",
  created: "success",
  updated: "info",
  deleted: "danger",
  status_changed: "warning",
  roles_changed: "brand",
  two_factor_enabled: "success",
  two_factor_disabled: "warning",
  two_factor_reset_by_admin: "danger",
  recovery_code_used: "warning",
  lockout_cleared: "warning",
  email_verified: "success",
  password_changed: "warning",
};

function toneFor(event: string | null): BadgeTone {
  return (event && EVENT_TONES[event]) || "neutral";
}

/** `two_factor_reset_by_admin` → `Two factor reset by admin`. */
function humanise(event: string | null): string {
  if (!event) return "—";
  const spaced = event.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export default function ActivityModule() {
  const [rows, setRows] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const autoPerPage = useAutoPerPage();
  const [events, setEvents] = useState<string[]>([]);
  const [detail, setDetail] = useState<ActivityEntry | null>(null);

  // Four filters the API already supported and the UI never exposed —
  // subject_type, the date range and hide_system — plus the three it did.
  const q = useResourceQuery({
    filters: {
      search: "",
      log_name: "",
      event: "",
      subject_type: "",
      date_from: "",
      date_to: "",
      hide_system: "",
    },
    debounced: ["search"],
    defaultSortBy: "id",
    defaultSortOrder: "desc",
    autoPerPage,
  });

  const load = useCallback(
    async (isLive: () => boolean = () => true) => {
      setLoading(true);
      setError(null);
      try {
        const res = await activityApi.list({
          page: q.page,
          per_page: q.perPage,
          ...(q.applied.search ? { search: q.applied.search } : {}),
          ...(q.applied.log_name ? { log_name: q.applied.log_name } : {}),
          ...(q.applied.event ? { event: q.applied.event } : {}),
          ...(q.applied.subject_type ? { subject_type: q.applied.subject_type } : {}),
          ...(q.applied.date_from ? { date_from: q.applied.date_from } : {}),
          ...(q.applied.date_to ? { date_to: q.applied.date_to } : {}),
          ...(q.applied.hide_system === "1" ? { hide_system: true } : {}),
        });
        if (!isLive()) return;
        setRows(res.data.items);
        setTotal(res.data.total);
        setPages(res.data.pages);
      } catch {
        if (isLive()) setError("Could not load the activity log.");
      } finally {
        if (isLive()) setLoading(false);
      }
    },
    [q.page, q.perPage, q.applied]
  );

  useEffect(() => {
    // `ready` is false until the query string has been applied; fetching before
    // then issues a throwaway request with default filters.
    if (!q.ready) return;
    let live = true;
    void load(() => live);
    return () => {
      live = false;
    };
  }, [load, q.ready]);

  // Loaded once: the event list changes only when a new kind of action first
  // occurs, so refetching it alongside every filter change would be waste.
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await activityApi.events();
        if (live) setEvents(res.data.sort());
      } catch {
        // A failed dropdown is not worth an error banner — the text search and
        // the log-name filter still work without it.
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  // Page reset happens in the setters above, not in an effect reacting to them.
  // An effect would be a genuine synchronous setState-in-effect — the rule is
  // right about that one — and it also reads backwards: "the filter changed, so
  // now fix the page" instead of "changing a filter means starting at page 1".

  const columns = useMemo<Column<ActivityEntry>[]>(
    () => [
      {
        id: "index",
        header: "#",
        cell: (_row, i) => (q.page - 1) * q.perPage + i + 1,
        className: "w-10 text-center px-0.5 text-gray-400",
        headerClassName: "w-10 text-center px-0.5",
        hideable: false,
      },
      {
        id: "when",
        header: "When",
        sortKey: "created_at",
        cell: (row) => (
          <span
            className="whitespace-nowrap text-gray-500 dark:text-gray-400"
            title={new Date(row.created_at).toISOString()}
          >
            {new Date(row.created_at).toLocaleString()}
          </span>
        ),
      },
      {
        id: "event",
        header: "Event",
        cell: (row) => <Badge tone={toneFor(row.event)}>{humanise(row.event)}</Badge>,
      },
      {
        id: "who",
        header: "Who",
        cell: (row) =>
          row.causer_name ?? (
            // An unauthenticated actor is the normal case for a failed login, not
            // missing data — saying so beats an empty cell that reads as a bug.
            <span className="text-gray-400 dark:text-gray-500" title="No authenticated actor">
              Not signed in
            </span>
          ),
      },
      {
        id: "description",
        header: "What happened",
        cell: (row) => <span className="text-gray-700 dark:text-gray-300">{row.description}</span>,
      },
      {
        id: "detail",
        header: "",
        cell: (row) =>
          row.properties ? (
            <button
              type="button"
              onClick={() => setDetail(row)}
              className="text-brand dark:text-brand-on-dark hover:underline"
            >
              Details
            </button>
          ) : null,
        className: "text-right",
        hideable: false,
      },
    ],
    [q.page, q.perPage]
  );

  return (
    <ResourceIndex<ActivityEntry, typeof q.filters>
      title="Activity Log"
      description={`${total} recorded action${total === 1 ? "" : "s"} — read-only`}
      query={q}
      filters={[
        { type: "text", key: "search", placeholder: "Search description, subject or log…", label: "Search activity" },
        {
          type: "select",
          key: "log_name",
          placeholder: "All logs",
          label: "Filter by log",
          options: [
            { value: "auth", label: "Auth" },
            { value: "default", label: "Default" },
          ],
        },
        {
          type: "select",
          key: "event",
          placeholder: "All events",
          label: "Filter by event",
          options: events.map((e) => ({ value: e, label: e })),
          // Read from the data, so it is empty until the first load returns.
          hidden: events.length === 0,
        },
        {
          type: "select",
          key: "subject_type",
          placeholder: "All subjects",
          label: "Filter by subject type",
          options: [
            { value: "User", label: "User" },
            { value: "Role", label: "Role" },
          ],
        },
        { type: "date", key: "date_from", label: "From date" },
        { type: "date", key: "date_to", label: "To date" },
        { type: "check", key: "hide_system", label: "Hide automation" },
      ]}
      columns={columns}
      rows={rows}
      rowKey={(r) => String(r.id)}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      total={total}
      pages={pages}
      emptyTitle={q.filtersActive ? "No matching activity" : "Nothing recorded yet"}
      emptyHint={
        q.filtersActive ? "Try a different filter." : "Actions appear here as they happen."
      }
    >

      {detail && (
        <Modal
          onClose={() => setDetail(null)}
          title={humanise(detail.event)}
          subtitle={new Date(detail.created_at).toLocaleString()}
        >
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-gray-700 dark:text-gray-300">{detail.description}</p>
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-xs">
              <dt className="text-gray-400 dark:text-gray-500">Actor</dt>
              <dd className="text-gray-700 dark:text-gray-300">
                {detail.causer_name ?? "Not signed in"}
              </dd>
              {detail.subject_type && (
                <>
                  <dt className="text-gray-400 dark:text-gray-500">Subject</dt>
                  <dd className="font-mono text-gray-700 dark:text-gray-300">
                    {detail.subject_type} {detail.subject_id?.slice(0, 8)}
                  </dd>
                </>
              )}
              {detail.batch_uuid && (
                <>
                  <dt className="text-gray-400 dark:text-gray-500">Batch</dt>
                  <dd
                    className="font-mono text-gray-700 dark:text-gray-300"
                    title="Part of one bulk operation"
                  >
                    {detail.batch_uuid.slice(0, 8)}
                  </dd>
                </>
              )}
            </dl>
            {detail.properties && (
              <div>
                <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Detail
                </p>
                {/* Raw JSON on purpose. `properties` holds arbitrary shapes —
                    before/after diffs, IPs, skip reasons — and inventing a
                    renderer per shape would go stale the moment a call site adds
                    a key. Passwords and tokens are stripped server-side. */}
                <pre className="max-h-64 overflow-auto rounded-[5px] bg-gray-50 p-3 font-mono text-[11px] text-gray-700 dark:bg-night-card dark:text-gray-300">
                  {JSON.stringify(detail.properties, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </ResourceIndex>
  );
}
