"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Button from "@/components/common/Button";
import DeleteDialog from "@/components/common/DeleteDialog";
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
import type { Listing, ListingStatus } from "@/lib/api/directoryApi";
import {
  useDeleteListingMutation,
  useListCategoriesQuery,
  useListListingsQuery,
  useSubmitListingMutation,
} from "@/lib/api/endpoints/directoryEndpoints";
import useModalState from "@/lib/hooks/useModalState";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import { usePermissions } from "@/lib/hooks/usePermissions";

type ModalMode = "delete";

const STATUS_OPTIONS: { value: ListingStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_REVIEW", label: "In review" },
  { value: "PUBLISHED", label: "Published" },
  { value: "REJECTED", label: "Rejected" },
];

/** Tone per status. Rejected is the one that must stand out — it is the only
 *  state that needs the partner to do something. */
const STATUS_TONE: Record<ListingStatus, "success" | "warning" | "danger" | "info"> = {
  PUBLISHED: "success",
  PENDING_REVIEW: "warning",
  REJECTED: "danger",
  DRAFT: "info",
};

/**
 * The listings index — **one component for partners and staff both**.
 *
 * `PARTNER_DIRECTORY_PLAN.md` § 20.6.0 ①: there is no `/partner/listings` and no
 * `/admin/listings`. The API scopes the rows, so a partner sees their own and a
 * staff member sees everyone's, and neither needs a different screen.
 *
 * ## What differs between the two audiences is one column and one button
 *
 * Not a different page. Staff see whose listing it is; partners do not need to
 * be told. Partners get "New listing"; staff get it only if they somehow hold
 * `listing-create`, which they normally do not — and the button is gated on the
 * permission rather than on a role name, so the two cannot drift apart.
 *
 * ## Rejection reason is on the row, not behind a click
 *
 * § 20.6.1 is explicit. A partner whose listing was rejected has exactly one
 * thing to do, and making them open a detail page to find out what it is turns a
 * two-minute fix into an abandoned listing.
 */
export default function ListingsModule() {
  const router = useRouter();
  const { toasts, show, dismiss } = useToast();
  const { can } = usePermissions();
  const canCreate = can("listing-create");
  const canDelete = can("listing-delete");
  // Staff see every partner's listings, so they need to know whose is whose.
  const seesEveryPartner = can("moderation-review");

  const q = useResourceQuery({
    filters: { status: "" },
    defaultSortBy: "created_at",
    defaultSortOrder: "desc",
  });

  // PM-41: RTK Query rather than fetch-on-mount. Three things this buys that
  // `useResourceList` could not — and each was a real defect class in the old
  // pattern rather than a nicety:
  //
  //  * a cache, so navigating away and back does not refetch what was on screen
  //    a second ago
  //  * invalidation, so a mutation refreshes the table without a hand-written
  //    `refetch()` that is silent when forgotten
  //  * deduplication, so two components needing this list make one request
  const {
    data: page,
    isFetching,
    error,
    refetch,
  } = useListListingsQuery(
    {
      page: q.page,
      per_page: q.perPage,
      status: (q.applied.status || undefined) as ListingStatus | undefined,
    },
    // The query hook has no equivalent of `useResourceList`'s `ready` gate, so
    // the URL-restore race is handled here: skip until the query state has been
    // read from the address bar, or the first render fires a throwaway request
    // with default filters.
    { skip: !q.ready },
  );
  const rows = page?.items ?? [];

  // Reference data, and now shared: the taxonomy admin and the authoring form
  // ask for the same list, and RTK Query serves all three from one request
  // instead of three. A failure still leaves the table readable — the fallback
  // is an empty array, not a thrown render.
  const { data: categories = [] } = useListCategoriesQuery();
  const categoryName = useCallback(
    (id: number) => categories.find((c) => c.id === id)?.name ?? "—",
    [categories],
  );

  const modal = useModalState<ModalMode, Listing>();
  const [submitListing, { isLoading: submitting }] = useSubmitListingMutation();
  const [deleteListing] = useDeleteListingMutation();
  const [busyId, setBusyId] = useState<string | null>(null);

  // No `useRowAction` here, and no `patchRow`. The mutation's `invalidatesTags`
  // refreshes the row and the list, so patching local state by hand would be a
  // second source of truth racing the first.
  const onSubmitForReview = async (row: Listing) => {
    setBusyId(row.id);
    try {
      await submitListing(row.id).unwrap();
      show("Sent for review — a person reads every one.");
    } catch {
      show("Could not submit for review.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const columns = useMemo<Column<Listing>[]>(() => {
    const cols: Column<Listing>[] = [
      numberColumn(),
      {
        id: "title",
        header: "Listing",
        cell: (row) =>
          stackedCell(
            row.title,
            <span className="text-xs text-ink-muted dark:text-night-muted">
              {categoryName(row.category_id)}
            </span>,
          ),
      },
      badgeColumn<Listing>({
        id: "status",
        header: "Status",
        tone: (row) => STATUS_TONE[row.status],
        label: (row) => STATUS_OPTIONS.find((s) => s.value === row.status)?.label ?? row.status,
      }),
      {
        id: "price",
        header: "Price",
        cell: (row) =>
          row.pricing_model === "ON_REQUEST"
            ? "On request"
            : `${row.pricing_model === "FROM" ? "From " : ""}${row.currency} ${row.price ?? "—"}`,
      },
      dateColumn<Listing>({ id: "created_at", header: "Created", value: (row) => row.created_at }),
      // `visible` rather than a conditional array: the menu must never offer an
      // action the API would refuse, and passing the flag through keeps the two
      // in step (see `actionsColumn`'s note).
      actionsColumn<Listing>((row) => [
        { label: "Open", onSelect: () => router.push(`/dashboard/listings/${row.id}`) },
        {
          label: "Edit",
          onSelect: () => router.push(`/dashboard/listings/${row.id}/edit`),
          visible: can("listing-update"),
        },
        {
          label: "Submit for review",
          // `run` takes the row id and an action resolving to an axios-shaped
          // `{ data }`. `directoryApi` unwraps `.data` for its callers, so it is
          // re-wrapped here rather than making every other consumer dig through
          // an envelope it does not need.
          onSelect: () => void onSubmitForReview(row),
          visible: row.status === "DRAFT" || row.status === "REJECTED",
          disabled: busyId === row.id || submitting,
          hint: "A person reads every listing before it is published",
        },
        {
          label: "Delete",
          onSelect: () => modal.open("delete", row),
          destructive: true,
          visible: canDelete,
        },
      ]),
    ];
    if (seesEveryPartner) {
      cols.splice(2, 0, { id: "partner_id", header: "Partner", cell: (row) => row.partner_id });
    }
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryName, busyId, submitting, canDelete, seesEveryPartner, can, router]);

  return (
    <>
      <ResourceIndex<Listing, { status: string }>
        title="Listings"
        description="What you publish in the directory. Every listing is reviewed before it goes live."
        icon={navIcon("listings")}
        actions={
          canCreate ? (
            <Button onClick={() => router.push("/dashboard/listings/new")}>New listing</Button>
          ) : null
        }
        query={q}
        filters={[
          {
            type: "select",
            key: "status",
            label: "Status",
            placeholder: "Any status",
            options: STATUS_OPTIONS,
          },
        ]}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={isFetching}
        error={error ? "Could not load listings." : null}
        onRetry={refetch}
        total={page?.total ?? 0}
        pages={page?.pages ?? 0}
        rowNoun="listing"
        table="vendor"
        emptyTitle="No listings yet"
        emptyHint={
          canCreate
            ? "Create one, and it goes to review before it appears in the directory."
            : "Nothing here yet."
        }
      >
        {/* Rejections surface above the table, not inside it. A partner opening
            this page needs to see the thing needing action before they scan. */}
        {rows.some((r) => r.status === "REJECTED") && (
          <div className="mb-4 rounded-[5px] border border-tone-danger/40 bg-tone-danger/5 p-4">
            <p className="text-sm font-semibold text-tone-danger">Some listings need changes</p>
            <ul className="mt-2 space-y-1">
              {rows
                .filter((r) => r.status === "REJECTED")
                .map((r) => (
                  <li key={r.id} className="text-sm text-ink-label dark:text-night-muted">
                    <strong>{r.title}</strong> — {r.rejection_reason ?? "No reason recorded."}
                  </li>
                ))}
            </ul>
          </div>
        )}

        {modal.is("delete") && modal.target && (
          <DeleteDialog
            noun="listing"
            name={modal.target.title}
            subtitle="It disappears from the directory immediately."
            onConfirm={async () => {
              await deleteListing(modal.target!.id).unwrap();
            }}
            onDeleted={() => {
              const title = modal.target!.title;
              modal.close();
              show(`Listing “${title}” deleted.`);
              // No refetch: `invalidatesTags` on the mutation already did it.
            }}
            onClose={modal.close}
          />
        )}
        <Toast toasts={toasts} onDismiss={dismiss} />
      </ResourceIndex>
    </>
  );
}
