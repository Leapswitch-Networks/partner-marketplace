"use client";

import { useEffect, useState } from "react";

import Button from "@/components/common/Button";
import Textarea from "@/components/common/Textarea";
import Toast, { useToast } from "@/components/common/Toast";
import {
  approveListing,
  listCategories,
  rejectListing,
  reviewQueue,
  type Category,
  type Listing,
} from "@/lib/api/directoryApi";
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
 */
export default function ModerationModule() {
  const { toasts, show, dismiss } = useToast();
  const [queue, setQueue] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = () =>
    reviewQueue()
      .then(setQueue)
      .catch((e) => show(extractApiError(e, "Could not load the queue."), "error"))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onApprove = async (listing: Listing) => {
    setBusy(listing.id);
    try {
      await approveListing(listing.id);
      show(`“${listing.title}” is live.`);
      await load();
    } catch (e) {
      show(extractApiError(e, "Could not approve the listing."), "error");
    } finally {
      setBusy(null);
    }
  };

  const onReject = async (listing: Listing) => {
    const reason = (reasons[listing.id] ?? "").trim();
    if (!reason) return;
    setBusy(listing.id);
    try {
      await rejectListing(listing.id, reason);
      show(`“${listing.title}” sent back with your notes.`);
      setReasons((prev) => ({ ...prev, [listing.id]: "" }));
      await load();
    } catch (e) {
      show(extractApiError(e, "Could not reject the listing."), "error");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p className="p-6 text-sm text-ink-muted dark:text-night-muted">Loading the queue…</p>;
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <h1 className="text-lg font-semibold text-ink dark:text-gray-100">Moderation queue</h1>
      <p className="mt-1 text-sm text-ink-muted dark:text-night-muted">
        {queue.length === 0
          ? "Nothing waiting. This is the state to keep it in."
          : `${queue.length} listing${queue.length === 1 ? "" : "s"} waiting, oldest first.`}
      </p>

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
          return (
            <li
              key={listing.id}
              className="rounded-[5px] border border-surface-border p-5 dark:border-night-border"
            >
              {/* Rendered as the public will see it — rule 2. */}
              <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-night-muted">
                {category?.name ?? "Uncategorised"} · partner {listing.partner_id.slice(0, 8)} ·
                submitted{" "}
                {listing.submitted_at ? new Date(listing.submitted_at).toLocaleString() : "—"}
              </p>
              <h2 className="mt-1 text-base font-semibold text-ink dark:text-gray-100">
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

              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => onApprove(listing)} loading={busy === listing.id}>
                  Approve and publish
                </Button>
                <Button
                  variant="danger"
                  onClick={() => onReject(listing)}
                  loading={busy === listing.id}
                  // Rule 3 — the requirement is discoverable before composing nothing.
                  disabled={!reason.trim()}
                >
                  Send back
                </Button>
              </div>
            </li>
          );
        })}
      </ol>

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
