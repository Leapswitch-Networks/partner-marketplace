"use client";

import { useRouter } from "next/navigation";

import PageHeading from "@/components/common/PageHeading";
import Button from "@/components/common/Button";
import Toast, { useToast } from "@/components/common/Toast";
import {
  useGetListingQuery,
  useListCategoriesQuery,
  useSubmitListingMutation,
} from "@/lib/api/endpoints/directoryEndpoints";
import { extractApiError } from "@/lib/utils/apiError";
import { usePermissions } from "@/lib/hooks/usePermissions";

/**
 * One listing, read-only, with its state made obvious.
 *
 * ## The rejection reason is the whole point of this page
 *
 * § 20.6.1 puts it prominently, and a partner whose listing was rejected has
 * exactly one thing to do. Burying the reason turns a two-minute fix into an
 * abandoned listing — so it is the first thing under the title, in the one tone
 * on this surface that means "you need to act".
 *
 * ## Submitting invalidates the index, not just this page
 *
 * Converted to the cached data layer 2026-08-21. The old version replaced its own
 * local copy of the listing after submitting and told nothing else — so
 * `/dashboard/listings` still showed DRAFT until it was reloaded by hand, and the
 * moderation queue did not know a new item had arrived. `submitListing`
 * invalidates `Listing`/LIST, so both correct themselves.
 */
export default function ListingShow({ listingId }: { listingId: string }) {
  const router = useRouter();
  const { toasts, show, dismiss } = useToast();
  const { can } = usePermissions();

  const { data: listing, isLoading, isError } = useGetListingQuery(listingId);
  // The shared picker cache — this page needs one category name, and every other
  // screen showing a category list has already paid for the request.
  const { data: categories = [] } = useListCategoriesQuery();
  const [submit, { isLoading: busy }] = useSubmitListingMutation();

  const onSubmit = async () => {
    try {
      // No local assignment of the result. The mutation invalidates this row's tag,
      // so the query above refetches — which also keeps the index and the
      // moderation queue honest, neither of which this page knows about.
      await submit(listingId).unwrap();
      show("Sent for review.");
    } catch (e) {
      show(extractApiError(e, "Could not submit for review."), "error");
    }
  };

  if (isLoading) {
    return <p className="p-6 text-sm text-ink-muted dark:text-night-muted">Loading…</p>;
  }
  // `isError` and "not found" are one message on purpose: for the person reading
  // it, a 404 and a failed request are the same event — the listing is not on
  // screen — and inventing two wordings implies a distinction they cannot act on.
  if (isError || !listing) {
    return <p className="p-6 text-sm text-ink-muted dark:text-night-muted">Listing not found.</p>;
  }

  const category = categories.find((c) => c.id === listing.category_id);

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <PageHeading title={listing.title} />
          <p className="text-sm text-ink-muted dark:text-night-muted">
            {category?.name ?? "Uncategorised"} · {listing.status.replace("_", " ").toLowerCase()}
          </p>
        </div>
        <div className="flex gap-2">
          {can("listing-update") && (
            <Button
              variant="outline"
              onClick={() => router.push(`/dashboard/listings/${listing.id}/edit`)}
            >
              Edit
            </Button>
          )}
          {(listing.status === "DRAFT" || listing.status === "REJECTED") && (
            <Button onClick={onSubmit} loading={busy}>
              Send for review
            </Button>
          )}
        </div>
      </div>

      {listing.status === "REJECTED" && listing.rejection_reason && (
        <div className="mt-4 rounded-[5px] border border-tone-danger/50 bg-tone-danger/10 p-4">
          <p className="text-sm font-semibold text-tone-danger">Changes requested</p>
          <p className="mt-1 text-sm text-ink dark:text-gray-100">{listing.rejection_reason}</p>
        </div>
      )}

      {listing.status === "PENDING_REVIEW" && (
        <p className="mt-4 rounded-[5px] border border-tone-warning/50 bg-tone-warning/10 p-4 text-sm text-ink dark:text-gray-100">
          In review. A person reads every listing before it is published — you do not need to do
          anything.
        </p>
      )}

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-ink-muted dark:text-night-muted">Summary</dt>
          <dd className="text-sm text-ink dark:text-gray-100">{listing.summary}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted dark:text-night-muted">Price</dt>
          <dd className="text-sm text-ink dark:text-gray-100">
            {listing.pricing_model === "ON_REQUEST"
              ? "On request"
              : `${listing.pricing_model === "FROM" ? "From " : ""}${listing.currency} ${listing.price}`}
          </dd>
        </div>
      </dl>

      {listing.description && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-ink dark:text-gray-100">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-label dark:text-night-muted">
            {listing.description}
          </p>
        </div>
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
