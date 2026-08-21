"use client";

import { useState } from "react";

import PageHeading, { headingClasses } from "@/components/common/PageHeading";
import Button from "@/components/common/Button";
import Textarea from "@/components/common/Textarea";
import Toast, { useToast } from "@/components/common/Toast";
import type { ModerationQueueEntry } from "@/lib/api/directoryApi";
import {
  useApproveListingMutation,
  useListCategoriesQuery,
  useRejectListingMutation,
  useReviewQueueQuery,
} from "@/lib/api/endpoints/directoryEndpoints";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * The moderation queue — staff only, gated by `moderation-review`.
 *
 * ## Three rules from § 20.6.3, and each is visible in the markup
 *
 * **1. No bulk approve.** There is no select-all and no "approve visible". The
 * entire value of a curated directory is that somebody looked at each listing;
 * a bulk action is how a queue meant to be read becomes a queue that is cleared.
 * Adding one would be a two-line change and it must not be made.
 *
 * **2. It renders the listing as the public will see it.** A reviewer approving
 * a row in a table is approving a title and a status, not a page. Everything a
 * buyer would read is on screen — summary, description, price — because that is
 * what is being judged.
 *
 * **3. Rejecting requires a reason, in the UI as well as the API.** The button
 * stays disabled until something is typed. The API enforces it too; this is so a
 * reviewer discovers the requirement before they have composed nothing.
 *
 * ## Oldest first
 *
 * The API orders the queue by submission time ascending, and this page does not
 * re-sort. § 16.2 measures the age of the oldest item; a newest-first queue is
 * how the oldest item becomes permanently invisible to the person working it.
 *
 * ## 4. It says when approving would fail, before the click
 *
 * Each row carries `blockers` and `entitlement` — added to the queue on
 * 2026-08-20 for exactly this and **not rendered until 2026-08-21**. Without them
 * a reviewer reads a listing, judges it worth publishing, clicks Approve and gets
 * a 409 because the partner is at their tier's listing limit. Nothing on screen
 * had said so, and the failure looks like a broken button rather than a business
 * rule. The Approve button is now disabled with the reason beside it.
 *
 * Note what is *not* done: the row is not hidden. A blocked listing still needs
 * reading, and can still be sent back — rejecting is never blocked, because
 * telling a partner what to change does not depend on whether they have a slot
 * free.
 */
export default function ModerationModule() {
  const { toasts, show, dismiss } = useToast();
  const [reasons, setReasons] = useState<Record<string, string>>({});

  // `isFetching`, not `isLoading`: after approving a row the queue refetches, and
  // `isLoading` is false for that second fetch — so keying the spinner off it
  // would leave the just-approved row on screen until the response landed.
  const { data: queue = [], isFetching, isError } = useReviewQueueQuery();
  // The category list is a picker, cached across every screen that shows one. An
  // empty array on failure is deliberate: a missing category name degrades to
  // "Uncategorised" and must not stop a reviewer working the queue.
  const { data: categories = [] } = useListCategoriesQuery();

  // No `refetch` after either write. Both mutations invalidate `Listing`/LIST,
  // which this query provides — so the queue reloads itself, and the partner's
  // *other* rows get their blockers recomputed, which is the case a manual
  // reload of one row would have missed.
  const [approve, { isLoading: approving }] = useApproveListingMutation();
  const [reject, { isLoading: rejecting }] = useRejectListingMutation();
  const [busyId, setBusyId] = useState<string | null>(null);

  const onApprove = async (listing: ModerationQueueEntry) => {
    setBusyId(listing.id);
    try {
      await approve(listing.id).unwrap();
      show(`“${listing.title}” is live.`);
    } catch (e) {
      show(extractApiError(e, "Could not approve the listing."), "error");
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (listing: ModerationQueueEntry) => {
    const reason = (reasons[listing.id] ?? "").trim();
    if (!reason) return;
    setBusyId(listing.id);
    try {
      await reject({ id: listing.id, reason }).unwrap();
      show(`“${listing.title}” sent back with your notes.`);
      setReasons((prev) => ({ ...prev, [listing.id]: "" }));
    } catch (e) {
      show(extractApiError(e, "Could not reject the listing."), "error");
    } finally {
      setBusyId(null);
    }
  };

  if (isFetching && queue.length === 0) {
    return <p className="p-6 text-sm text-ink-muted dark:text-night-muted">Loading the queue…</p>;
  }
  if (isError) {
    return (
      <p className="p-6 text-sm text-tone-danger">
        Could not load the queue. Reload the page to try again.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <PageHeading
        title="Moderation queue"
        description={
          queue.length === 0
            ? "Nothing waiting. This is the state to keep it in."
            : `${queue.length} listing${queue.length === 1 ? "" : "s"} waiting, oldest first.`
        }
      />

      {queue.length === 0 && (
        <div className="mt-6 rounded-[5px] border border-surface-border p-8 text-center dark:border-night-border">
          <p className="text-sm text-ink-muted dark:text-night-muted">
            An empty queue is the healthy state. § 16.2 measures how old the oldest waiting item is —
            not how many you cleared.
          </p>
        </div>
      )}

      <ol className="mt-6 space-y-6">
        {queue.map((listing) => {
          const category = categories.find((c) => c.id === listing.category_id);
          const reason = reasons[listing.id] ?? "";
          const blocked = listing.blockers.length > 0;
          const busy = busyId === listing.id;
          return (
            <li
              key={listing.id}
              className="rounded-[5px] border border-surface-border p-5 dark:border-night-border"
            >
              {/* Rendered as the public will see it — rule 2. */}
              <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-night-muted">
                {category?.name ?? "Uncategorised"} · {listing.partner_name} · submitted{" "}
                {listing.submitted_at ? new Date(listing.submitted_at).toLocaleString() : "—"}
              </p>
              <h2 className={`${headingClasses("section")} mt-1 text-ink dark:text-gray-100`}>
                {listing.title}
              </h2>
              <p className="mt-1 text-sm text-ink-label dark:text-night-muted">{listing.summary}</p>
              <p className="mt-2 text-sm font-medium text-ink dark:text-gray-100">
                {listing.pricing_model === "ON_REQUEST"
                  ? "Price on request"
                  : `${listing.pricing_model === "FROM" ? "From " : ""}${listing.currency} ${listing.price}`}
              </p>
              {listing.description && (
                <p className="mt-3 whitespace-pre-wrap border-t border-surface-border pt-3 text-sm text-ink-label dark:border-night-border dark:text-night-muted">
                  {listing.description}
                </p>
              )}

              <div className="mt-4">
                <Textarea
                  label="Reason (required to send back)"
                  value={reason}
                  onChange={(e) =>
                    setReasons((prev) => ({ ...prev, [listing.id]: e.target.value }))
                  }
                  rows={2}
                  placeholder="What does the partner need to change?"
                />
              </div>

              {/*
                Rule 4 — why Approve is unavailable, stated where the button is.
                A disabled control with no explanation is indistinguishable from a
                broken one.
              */}
              {blocked && (
                <div className="mt-4 rounded-[5px] border border-tone-warning/50 bg-tone-warning/10 p-3 text-sm">
                  <p className="font-medium text-ink dark:text-gray-100">
                    Cannot be published yet
                  </p>
                  <ul className="mt-1 list-inside list-disc text-ink-label dark:text-night-muted">
                    {listing.blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => onApprove(listing)}
                  loading={busy && approving}
                  disabled={blocked}
                >
                  Approve and publish
                </Button>
                <Button
                  variant="danger"
                  onClick={() => onReject(listing)}
                  loading={busy && rejecting}
                  // Rule 3 — the requirement is discoverable before composing nothing.
                  // Never disabled by `blocked`: sending a listing back does not
                  // depend on the partner having a slot free.
                  disabled={!reason.trim()}
                >
                  Send back
                </Button>
                {!listing.entitlement.unlimited && listing.entitlement.max_listings !== null && (
                  <span className="text-xs text-ink-muted dark:text-night-muted">
                    {listing.entitlement.published} of {listing.entitlement.max_listings} published
                    {listing.entitlement.tier ? ` · ${listing.entitlement.tier}` : ""}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
