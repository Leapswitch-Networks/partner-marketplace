"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PageHeading from "@/components/common/PageHeading";
import Button from "@/components/common/Button";
import Toast, { useToast } from "@/components/common/Toast";
import {
  getListing,
  listCategories,
  submitListing,
  type Category,
  type Listing,
} from "@/lib/api/directoryApi";
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
 */
export default function ListingShow({ listingId }: { listingId: string }) {
  const router = useRouter();
  const { toasts, show, dismiss } = useToast();
  const { can } = usePermissions();

  const [listing, setListing] = useState<Listing | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([getListing(listingId), listCategories()])
      .then(([l, c]) => {
        setListing(l);
        setCategories(c);
      })
      .catch((e) => show(extractApiError(e, "Could not load the listing."), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  const onSubmit = async () => {
    setBusy(true);
    try {
      setListing(await submitListing(listingId));
      show("Sent for review.");
    } catch (e) {
      show(extractApiError(e, "Could not submit for review."), "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-sm text-ink-muted dark:text-night-muted">Loading…</p>;
  }
  if (!listing) {
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
