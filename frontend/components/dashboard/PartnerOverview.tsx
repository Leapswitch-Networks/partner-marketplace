"use client";

import Link from "next/link";

import { useGetMyOverviewQuery } from "@/lib/api/endpoints/directoryEndpoints";

/**
 * The `/dashboard` landing content **for a partner**.
 *
 * § 20.6.1 asks for listings against entitlement, new and unanswered enquiries,
 * and median response time. Three of those four are here; the median is not,
 * and its absence is deliberate — see below.
 *
 * ## Every number comes from the server — this was not true until 2026-08-21
 *
 * The page used to fetch a page of listings and a page of enquiries and reduce
 * them in the browser. That was wrong three ways, and all three rendered
 * cleanly:
 *
 * * `items.length` was reported as the total, so a partner with more listings
 *   than the page size was told they had exactly the page size.
 * * `unanswered` was recomputed from `first_responded_at` — which stopped
 *   matching the server when PM-47 excluded spam from that measure. This page
 *   would have gone on counting junk against the partner after the fix.
 * * 200 rows were fetched to render four numbers.
 *
 * `GET /partners/me/overview` returns the four figures and the entitlement in one
 * call. It is tagged with `Listing` and `Enquiry` LIST, so answering an enquiry
 * or publishing a listing refreshes this page with no code here to remember it.
 *
 * ## Why unanswered enquiries lead, and are red
 *
 * § 16.2 makes the unanswered rate the number that should be near zero, and
 * every one of them is a buyer who will not come back. Putting the count of
 * *received* enquiries first would make a full inbox look like success; the
 * question a partner should be answering when they open this page is "is anyone
 * waiting on me".
 *
 * ## No median response time, yet
 *
 * § 20.4: omit the block, never fake it. With a handful of enquiries a median is
 * one slow reply away from being meaningless, and showing it would make a
 * partner optimise a number that is mostly noise. It arrives when the volume
 * makes it honest.
 */
export default function PartnerOverview() {
  // Not `isLoading`: on a refetch triggered by answering an enquiry, `isLoading`
  // is false while `isFetching` is true, and rendering nothing in that window
  // would make the whole block disappear mid-interaction.
  const { data, isError } = useGetMyOverviewQuery();

  // A staff member has no organisation, so this 404s for them by design. There is
  // nothing to say about it — the rest of the dashboard is theirs.
  if (isError || !data) return null;

  const { listings, enquiries, entitlement } = data;
  const needsAttention = enquiries.unanswered > 0 || listings.rejected > 0;

  return (
    <div className="mb-8">
      {/* The one thing a partner should act on, before anything else. */}
      {needsAttention && (
        <div className="mb-4 rounded-[5px] border border-tone-danger/40 bg-tone-danger/5 p-4">
          <p className="text-sm font-semibold text-tone-danger">Waiting on you</p>
          <ul className="mt-2 space-y-1 text-sm text-ink-label dark:text-night-muted">
            {enquiries.unanswered > 0 && (
              <li>
                <Link href="/dashboard/enquiries?unanswered=true" className="underline">
                  {enquiries.unanswered} enquir{enquiries.unanswered === 1 ? "y" : "ies"} not yet
                  answered
                </Link>
              </li>
            )}
            {listings.rejected > 0 && (
              <li>
                <Link href="/dashboard/listings?status=REJECTED" className="underline">
                  {listings.rejected} listing{listings.rejected === 1 ? " needs" : "s need"} changes
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      {!data.is_listed && (
        <div className="mb-4 rounded-[5px] border border-tone-warning/50 bg-tone-warning/10 p-4 text-sm text-ink dark:text-gray-100">
          <strong>You are not in the public directory yet.</strong> Leapswitch lists a partner once
          verification is complete — it is not something you can switch on, and nothing you do here
          is wasted while you wait.
        </div>
      )}

      {/*
        Entitlement — the § 20.6.1 item that was specified and never rendered.
        Shown only when the tier actually caps something: a partner on no tier is
        unlimited, and "unlimited listings" is a sentence about billing, not
        information this page exists to give.
      */}
      {!entitlement.unlimited && entitlement.max_listings !== null && (
        <div
          className={`mb-4 rounded-[5px] border p-4 text-sm ${
            entitlement.at_limit
              ? "border-tone-warning/50 bg-tone-warning/10"
              : "border-surface-border dark:border-night-border"
          }`}
        >
          <p className="text-ink dark:text-gray-100">
            <strong>
              {entitlement.published} of {entitlement.max_listings} listings published
            </strong>
            {entitlement.tier && (
              <span className="text-ink-muted dark:text-night-muted"> · {entitlement.tier}</span>
            )}
          </p>
          {entitlement.at_limit ? (
            /*
              Says what the partner can do, not just what they cannot. A limit
              message with no way forward reads as a fault in the product.
            */
            <p className="mt-1 text-ink-label dark:text-night-muted">
              You have used every slot your tier allows. Unpublish one to publish something else, or
              talk to us about a larger tier.
            </p>
          ) : (
            <p className="mt-1 text-ink-label dark:text-night-muted">
              {entitlement.remaining} more available.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Published listings",
            value: listings.published,
            href: "/dashboard/listings?status=PUBLISHED",
          },
          { label: "Drafts", value: listings.draft, href: "/dashboard/listings?status=DRAFT" },
          { label: "Enquiries received", value: enquiries.total, href: "/dashboard/enquiries" },
          {
            label: "Not yet answered",
            value: enquiries.unanswered,
            href: "/dashboard/enquiries?unanswered=true",
          },
        ].map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="rounded-[5px] border border-brand/20 p-4 no-underline transition-colors hover:border-brand dark:border-night-border"
          >
            <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-night-muted">
              {tile.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-ink dark:text-gray-100">{tile.value}</p>
          </Link>
        ))}
      </div>

      {/*
        Spam is reported, not hidden. A total that drops with no explanation looks
        like enquiries going missing, and it is the only evidence the
        classification is being used proportionately.
      */}
      {enquiries.spam > 0 && (
        <p className="mt-3 text-xs text-ink-muted dark:text-night-muted">
          {enquiries.spam} enquir{enquiries.spam === 1 ? "y" : "ies"} marked as spam — excluded from
          the figures above.
        </p>
      )}
    </div>
  );
}
