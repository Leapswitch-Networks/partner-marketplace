"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

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
import type { Enquiry, EnquiryStatus } from "@/lib/api/directoryApi";
import { useListEnquiriesQuery } from "@/lib/api/endpoints/directoryEndpoints";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import { usePermissions } from "@/lib/hooks/usePermissions";

const STATUS_OPTIONS: { value: EnquiryStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "RESPONDED", label: "Responded" },
  { value: "CLOSED", label: "Closed" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

const TONE: Record<EnquiryStatus, "success" | "warning" | "danger" | "info"> = {
  NEW: "warning",
  RESPONDED: "info",
  WON: "success",
  CLOSED: "info",
  LOST: "danger",
};

/**
 * The enquiry inbox — the partner's, and staff oversight, from one component.
 *
 * § 20.6.1 calls this the most important authenticated page in the product, and
 * the reason is § 16.1: enquiries per listed partner per month, and the share
 * answered, is the one number. This is where the numerator arrives.
 *
 * ## NEW is styled as a warning, not as good news
 *
 * An unanswered enquiry is work outstanding, and colouring it green would make
 * a full inbox look like success. § 16.2's unanswered rate is the measure that
 * should be near zero — every one of them is a buyer who will not come back.
 *
 * ## Staff see this page and cannot act on it
 *
 * They hold `enquiry-view` and not `enquiry-respond`, so the thread opens
 * read-only for them. That is enforced by the API, not by hiding a button —
 * § 20.6.1: staff may never reply as the partner.
 */
export default function EnquiriesModule() {
  const router = useRouter();
  const { toasts, dismiss } = useToast();
  const { can } = usePermissions();
  const seesEveryPartner = can("moderation-review");

  const q = useResourceQuery({
    filters: { status: "", unanswered: "" },
    defaultSortBy: "created_at",
    defaultSortOrder: "desc",
  });

  // PM-41: RTK Query. The invalidation matters more here than anywhere else in
  // the product — replying to an enquiry stamps its response time and flips its
  // status, so the inbox and the unanswered filter are both stale the moment the
  // thread is answered. The mutation's tags refresh this list without the thread
  // page having to know it exists.
  const listQuery = useListEnquiriesQuery(
    {
      page: q.page,
      per_page: q.perPage,
      status: (q.applied.status || undefined) as EnquiryStatus | undefined,
      // Tri-state: "" means no filter, so it must not collapse to false.
      unanswered: q.applied.unanswered === "" ? undefined : q.applied.unanswered === "true",
    },
    { skip: !q.ready },
  );
  const page = listQuery.data;
  const rows = page?.items ?? [];

  const columns = useMemo<Column<Enquiry>[]>(() => {
    const cols: Column<Enquiry>[] = [
      numberColumn(),
      actionsColumn<Enquiry>((row) => [
        { label: "Open thread", onSelect: () => router.push(`/dashboard/enquiries/${row.id}`) },
      ]),
      badgeColumn<Enquiry>({
        id: "status",
        header: "Status",
        tone: (row) => TONE[row.status],
        label: (row) => STATUS_OPTIONS.find((s) => s.value === row.status)?.label ?? row.status,
      }),
      {
        id: "buyer",
        header: "From",
        cell: (row) =>
          stackedCell(
            row.buyer_name,
            <span className="text-xs text-ink-muted dark:text-night-muted">
              {row.company ?? row.buyer_email}
            </span>,
          ),
      },
      { id: "reference", header: "Reference", cell: (row) => row.reference },
      {
        id: "answered",
        header: "Answered",
        cell: (row) =>
          row.first_responded_at ? (
            new Date(row.first_responded_at).toLocaleDateString()
          ) : (
            <span className="font-medium text-tone-danger">Not yet</span>
          ),
      },
      dateColumn<Enquiry>({ id: "created_at", header: "Received", value: (row) => row.created_at }),
    ];
    if (seesEveryPartner) {
      cols.splice(3, 0, { id: "partner_id", header: "Partner", cell: (row) => row.partner_id });
    }
    return cols;
  }, [router, seesEveryPartner]);

  const unanswered = rows.filter((r) => !r.first_responded_at).length;

  return (
    <ResourceIndex<Enquiry, { status: string; unanswered: string }>
      title="Enquiries"
      description="Buyers who described what they need and asked for you specifically."
      icon={navIcon("enquiries")}
      stats={[
        { label: "On this page", value: rows.length },
        // The number that should be near zero — § 16.2.
        { label: "Not yet answered", value: unanswered, tone: unanswered > 0 ? "danger" : "success" },
      ]}
      statsLoading={listQuery.isFetching}
      query={q}
      filters={[
        {
          type: "select",
          key: "status",
          label: "Status",
          placeholder: "Any status",
          options: STATUS_OPTIONS,
        },
        {
          type: "select",
          key: "unanswered",
          label: "Answered",
          placeholder: "Any",
          options: [
            { value: "true", label: "Not yet answered" },
            { value: "false", label: "Answered" },
          ],
        },
      ]}
      columns={columns}
      result={listQuery}
      rowKey={(row) => row.id}
      errorMessage="Could not load enquiries."
      rowNoun="enquiry"
      table="vendor"
      emptyTitle="No enquiries yet"
      emptyHint="They arrive here the moment somebody sends one from your public profile."
    >
      <Toast toasts={toasts} onDismiss={dismiss} />
    </ResourceIndex>
  );
}
