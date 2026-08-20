"use client";

import Link from "next/link";
import { useMemo } from "react";
import { type BadgeTone } from "@/components/common/Badge";
import ResourceIndex from "@/components/common/ResourceIndex";
import { badgeColumn, dateColumn, numberColumn } from "@/components/common/columns";
import { type Column } from "@/components/common/DataTable";
import Modal from "@/components/common/Modal";
import { navIcon } from "@/components/dashboard/navIcons";
import useModalState from "@/lib/hooks/useModalState";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import {
  useActivityFilterOptionsQuery,
  useListActivityQuery,
} from "@/lib/api/endpoints/activityEndpoints";
import {
  type ActivityEntry,
  type ActivityFilterOptions,
} from "@/lib/api/rbacApi";
import { formatDateTime } from "@/lib/utils/format";

/**
 * The Activity Log index — the read surface for the audit trail (PM-32).
 *
 * On the same shells and the same shared pieces as Users — see
 * `MODULE_PARITY_PLAN.md`. **Where it deliberately differs from Users, and why:**
 *
 * * **No row actions, no bulk actions, no selection.** There is nothing to do to
 *   an audit entry: the API has no write route and neither does this. A "delete"
 *   affordance on an audit trail would be the single most damaging button in the
 *   product. Parity means the same vocabulary, not the same feature list.
 * * **No `Actions` column**, for the same reason — an empty three-dot menu is
 *   worse than no column.
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

/** Nothing has been recorded yet, so every dropdown starts empty and hidden. */
const NO_OPTIONS: ActivityFilterOptions = {
  events: [],
  log_names: [],
  subject_types: [],
  causers: [],
  sources: [],
  // Until the real answer arrives, claim nothing: a horizon of 0 days that had
  // "never purged" attached would still render a sentence, and a sentence about
  // an audit trail's completeness must not be a placeholder.
  retention: {
    retention_days: 0,
    purge_ever_ran: false,
    last_purge_at: null,
    rows_removed_last_run: 0,
  },
};

export default function ActivityModule() {
  /*
    Loaded once and then held: these change only when a new *kind* of action
    first occurs, so refetching them alongside every filter change would be
    waste. One request rather than four, and every list is read from the data —
    a module or subject type nothing has ever written does not appear as an
    option that finds nothing.

    `NO_OPTIONS` is still the fallback, which keeps the old rule that a failed
    dropdown is not worth an error banner: the text search and the date range
    work without it (PM-41 § 4.6 — this replaced a fetch-into-state guarded by a
    `live` flag against the unmount race, which the query owns now).
  */
  const { data: options = NO_OPTIONS } = useActivityFilterOptionsQuery();

  /** One mode. Same hook as the others so all four modules read the same way. */
  const modal = useModalState<"detail", ActivityEntry>();

  // Four filters the API already supported and the UI never exposed —
  // subject_type, the date range and hide_system — plus the three it did, plus
  // `source` and `causer_id`, added with the 2026-08-12 parity work.
  const q = useResourceQuery({
    filters: {
      search: "",
      log_name: "",
      event: "",
      subject_type: "",
      causer_id: "",
      source: "",
      date_from: "",
      date_to: "",
      hide_system: "",
    },
    debounced: ["search"],
    defaultSortBy: "id",
    defaultSortOrder: "desc",
    // Fixed 30 to match Users — the owner's number, 2026-08-10 — so switching
    // modules keeps the same row density. `autoPerPage` went with the change
    // (2026-08-13): it recomputes on every resize until the user picks a size,
    // so it and a seeded default cannot both own this number, which is exactly
    // why this screen used to open at a different count than every other.
    defaultPerPage: 30,
  });

  /*
    Sorting is real now, and the note that stood here is worth keeping in short
    form because it was right about the thing it was right about.

    Until 2026-08-11 the `When` column declared `sortKey: "created_at"` while the
    endpoint read no sort parameter at all — a control that rendered an arrow,
    took a click and did nothing. It was removed rather than papered over, and
    `MODULE_PARITY_PLAN.md` § 3 step 6 recorded the open question: should the
    audit trail get a real oldest-first toggle?

    **It should, and now it has one.** Reading an incident forward is the case
    that argues for it. `id` remains the default and the tiebreak, so the ordering
    the service documents — rows written in one transaction share a timestamp, so
    only `id` is a total order — still holds under every sort.
  */
  const listQuery = useListActivityQuery(
    {
      page: q.page,
      per_page: q.perPage,
      sort_by: q.sortBy,
      sort_order: q.sortOrder,
      ...(q.applied.search ? { search: q.applied.search } : {}),
      ...(q.applied.log_name ? { log_name: q.applied.log_name } : {}),
      ...(q.applied.event ? { event: q.applied.event } : {}),
      ...(q.applied.subject_type ? { subject_type: q.applied.subject_type } : {}),
      ...(q.applied.causer_id ? { causer_id: q.applied.causer_id } : {}),
      ...(q.applied.source ? { source: q.applied.source } : {}),
      ...(q.applied.date_from ? { date_from: q.applied.date_from } : {}),
      ...(q.applied.date_to ? { date_to: q.applied.date_to } : {}),
      ...(q.applied.hide_system === "1" ? { hide_system: true } : {}),
    },
    { skip: !q.ready },
  );

  // Page reset happens in the setters above, not in an effect reacting to them.
  // An effect would be a genuine synchronous setState-in-effect — the rule is
  // right about that one — and it also reads backwards: "the filter changed, so
  // now fix the page" instead of "changing a filter means starting at page 1".

  const columns = useMemo<Column<ActivityEntry>[]>(
    () => [
      // Was `(q.page - 1) * q.perPage + i + 1` on top of an index that already
      // carries the page offset — page 2 started at 51. See `columns.tsx`.
      numberColumn<ActivityEntry>(),
      {
        // Sits where `Actions` does on every other module, and holds the only
        // thing you can do to an audit row: read it.
        id: "detail",
        header: "Details",
        cell: (row) =>
          row.properties ? (
            // px-2 keeps a hit area now that the cell itself has none.
            <div className="flex justify-center px-2">
              <button
                type="button"
                onClick={() => modal.open("detail", row)}
                className="font-semibold text-brand hover:underline dark:text-brand-on-dark"
              >
                View
              </button>
            </div>
          ) : null,
        // Same classes as `actionsColumn`, which this column stands in for —
        // it had `w-[80px]` plus the default cell padding, so on this one
        // screen the second column sat wider than everywhere else.
        className: "text-center !px-0 w-0",
        headerClassName: "text-center !px-0 w-0",
        hideable: false,
      },
      badgeColumn<ActivityEntry>({
        id: "event",
        header: "Event",
        tone: (row) => toneFor(row.event),
        label: (row) => humanise(row.event),
        width: "w-[170px]",
        sortKey: "event",
      }),
      badgeColumn<ActivityEntry>({
        id: "module",
        header: "Module",
        // Neutral for all of them: this says which part of the system a row came
        // from, and no part of the system is more alarming than another. The
        // Event column is what carries urgency, and two competing tones in one
        // row means neither reads.
        tone: () => "neutral",
        label: (row) => row.module_label,
        width: "w-[150px]",
        sortKey: "log_name",
      }),
      dateColumn<ActivityEntry>({
        id: "when",
        header: "When",
        value: (row) => row.created_at,
        withTime: true,
        // The exact instant, on hover. The formatted value drops seconds and the
        // offset, which are the two things you want reconstructing an incident.
        title: (row) => new Date(row.created_at).toISOString(),
        sortKey: "created_at",
      }),
      {
        id: "who",
        header: "Who",
        cell: (row) =>
          row.causer_name ?? (
            // An unauthenticated actor is the normal case for a failed login, not
            // missing data — saying so beats an empty cell that reads as a bug.
            <span className="text-ink-label dark:text-night-muted" title="No authenticated actor">
              Not signed in
            </span>
          ),
      },
      {
        id: "description",
        header: "What happened",
        cell: (row) => <span className="text-ink dark:text-gray-300">{row.description}</span>,
        sortKey: "description",
      },
      {
        id: "subject",
        header: "Record",
        cell: (row) => {
          if (!row.subject_type) {
            return <span className="text-ink-label dark:text-night-muted">—</span>;
          }
          const label = `${row.subject_type}${
            row.subject_id ? ` ${row.subject_id.slice(0, 8)}` : ""
          }`;
          // No link is the honest state for a record with no page — a link to a
          // route that does not exist is a 404 the reader blames on the record.
          // The server decides which is which; see `subject_url` in `rbacApi`.
          return row.subject_url ? (
            <Link
              href={row.subject_url}
              className="font-semibold text-brand hover:underline dark:text-brand-on-dark"
              title={`Open this ${row.subject_type}`}
            >
              {label}
            </Link>
          ) : (
            <span className="text-ink dark:text-gray-300">{label}</span>
          );
        },
        headerClassName: "w-[180px]",
      },
    ],
    // `modal.open` is the stable `useCallback`; the rule wants the whole `modal`
    // object, which is rebuilt every render and would defeat this memo entirely.
    // Same disable as the other three modules.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modal.open]
  );

  /**
   * **Why an audit index states its own horizon.**
   *
   * A trail that ends somewhere looks identical to a trail with nothing in it:
   * a reader filters to last year, sees an empty table, and concludes the thing
   * did not happen. The reference publishes a static retention number for this
   * reason. Ours adds the part a config value cannot know — whether the purge
   * has ever actually run — because that is what decides which of the two an
   * empty result means.
   *
   * Empty string until the real numbers arrive, so nothing is claimed on a
   * placeholder.
   */
  const retentionNote = useMemo(() => {
    const r = options.retention;
    if (!r.retention_days) return "";
    if (!r.purge_ever_ran) {
      return `Kept ${r.retention_days} days by policy, but nothing has ever been deleted — this trail is complete.`;
    }
    const when = r.last_purge_at ? formatDateTime(r.last_purge_at) : "an earlier run";
    return `Rows older than ${r.retention_days} days are removed. Last purge ${when} removed ${r.rows_removed_last_run.toLocaleString()}.`;
  }, [options.retention]);

  return (
    <ResourceIndex<ActivityEntry, typeof q.filters>
      icon={navIcon("activity")}
      title="Activity Log"
      // The count moved out of here to the pager, which already says
      // "1–25 of 137" and does not go stale between fetches — same change Users
      // made. What is left is the sentence that says what the page is *for*.
      description={`Every recorded action — read-only.${retentionNote ? ` ${retentionNote}` : ""}`}
      query={q}
      filters={[
        {
          type: "text",
          key: "search",
          // Reaches the causer's name and email as of 2026-08-12 — "show me
          // everything Ayush did" is the search people actually type.
          placeholder: "Search description, subject, module or person…",
          label: "Search activity",
        },
        {
          // Every list below is read from the data and scoped to what this
          // reader may see, so an option that would return an empty table is
          // never offered. Hidden until the first load returns rather than
          // rendered blank.
          type: "select",
          key: "log_name",
          placeholder: "All modules",
          label: "Filter by module",
          options: options.log_names,
          hidden: options.log_names.length === 0,
        },
        {
          type: "select",
          key: "event",
          placeholder: "All events",
          label: "Filter by event",
          options: options.events,
          hidden: options.events.length === 0,
        },
        {
          type: "select",
          key: "subject_type",
          placeholder: "All records",
          label: "Filter by record type",
          options: options.subject_types,
          hidden: options.subject_types.length === 0,
        },
        {
          type: "select",
          key: "causer_id",
          placeholder: "All people",
          label: "Filter by who did it",
          options: options.causers,
          // One option means the reader is sandboxed to their own rows, and a
          // dropdown offering only yourself is furniture.
          hidden: options.causers.length < 2,
        },
        {
          type: "select",
          key: "source",
          placeholder: "All sources",
          label: "Filter by source",
          options: options.sources,
          hidden: options.sources.length === 0,
        },
        { type: "date", key: "date_from", label: "From date" },
        { type: "date", key: "date_to", label: "To date" },
        { type: "check", key: "hide_system", label: "Hide automation" },
      ]}
      columns={columns}
      result={listQuery}
      rowKey={(r) => String(r.id)}
      errorMessage="Could not load the activity log."
      table="vendor"
      rowNoun="entry"
      // No `filtersActive` branch here: `ResourceIndex` passes it down and the
      // table already picks the "filters hid everything" copy itself. Deciding it
      // twice is how the two messages drift apart.
      emptyTitle="Nothing recorded yet"
      emptyHint="Actions appear here as they happen."
    >

      {modal.is("detail") && modal.target && (
        <Modal
          onClose={modal.close}
          title={humanise(modal.target.event)}
          subtitle={formatDateTime(modal.target.created_at)}
        >
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-ink dark:text-gray-300">{modal.target.description}</p>
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-xs">
              <dt className="text-ink-label dark:text-night-muted">Actor</dt>
              <dd className="text-ink dark:text-gray-300">
                {modal.target.causer_name ?? "Not signed in"}
              </dd>
              <dt className="text-ink-label dark:text-night-muted">Module</dt>
              <dd className="text-ink dark:text-gray-300">{modal.target.module_label}</dd>
              {/* Lifted out of the raw JSON below because it answers the first
                  question asked of an unattributed row: was this a person, or
                  was it the seeder? A row written before 2026-08-12 carries no
                  source, and says so rather than guessing. */}
              <dt className="text-ink-label dark:text-night-muted">Source</dt>
              <dd className="text-ink dark:text-gray-300">
                {typeof modal.target.properties?.source === "string" ? (
                  String(modal.target.properties.source)
                ) : (
                  <span className="text-ink-label dark:text-night-muted" title="Recorded before the source discriminator shipped">
                    Not recorded
                  </span>
                )}
              </dd>
              {modal.target.subject_type && (
                <>
                  <dt className="text-ink-label dark:text-night-muted">Subject</dt>
                  <dd className="font-mono text-ink dark:text-gray-300">
                    {modal.target.subject_url ? (
                      <Link
                        href={modal.target.subject_url}
                        className="font-semibold text-brand hover:underline dark:text-brand-on-dark"
                      >
                        {modal.target.subject_type} {modal.target.subject_id?.slice(0, 8)}
                      </Link>
                    ) : (
                      <>
                        {modal.target.subject_type} {modal.target.subject_id?.slice(0, 8)}
                      </>
                    )}
                  </dd>
                </>
              )}
              {modal.target.batch_uuid && (
                <>
                  <dt className="text-ink-label dark:text-night-muted">Batch</dt>
                  <dd
                    className="font-mono text-ink dark:text-gray-300"
                    title="Part of one bulk operation"
                  >
                    {modal.target.batch_uuid.slice(0, 8)}
                  </dd>
                </>
              )}
            </dl>
            {modal.target.properties && (
              <div>
                <p className="mb-1 text-xs font-semibold text-ink-label dark:text-night-muted">
                  Detail
                </p>
                {/* Raw JSON on purpose. `properties` holds arbitrary shapes —
                    before/after diffs, IPs, skip reasons — and inventing a
                    renderer per shape would go stale the moment a call site adds
                    a key. Passwords and tokens are stripped server-side. */}
                <pre className="max-h-64 overflow-auto rounded-[5px] bg-surface-tile p-3 font-mono text-[11px] text-ink dark:bg-night-body dark:text-gray-300">
                  {JSON.stringify(modal.target.properties, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </ResourceIndex>
  );
}
