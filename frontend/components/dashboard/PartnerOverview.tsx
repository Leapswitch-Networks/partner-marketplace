"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getMyOrganisation, listEnquiries, listListings } from "@/lib/api/directoryApi";

/**
 * The `/dashboard` landing content **for a partner**.
 *
 * § 20.6.1 asks for listings against entitlement, new and unanswered enquiries,
 * and median response time. Three of those four are here; the median is not,
 * and its absence is deliberate — see below.
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
  const [state, setState] = useState<{
    organisation: string;
    listed: boolean;
    verification: string;
    listings: { total: number; published: number; drafts: number; rejected: number };
    enquiries: { total: number; unanswered: number };
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([
      getMyOrganisation(),
      listListings({ per_page: 100 }),
      listEnquiries({ per_page: 100 }),
    ])
      .then(([org, listings, enquiries]) => {
        const rows = listings.items;
        setState({
          organisation: org.name,
          listed: org.is_listed,
          verification: org.verification_level,
          listings: {
            total: rows.length,
            published: rows.filter((r) => r.status === "PUBLISHED").length,
            drafts: rows.filter((r) => r.status === "DRAFT").length,
            rejected: rows.filter((r) => r.status === "REJECTED").length,
          },
          enquiries: {
            total: enquiries.items.length,
            unanswered: enquiries.items.filter((e) => !e.first_responded_at).length,
          },
        });
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed || !state) return null;

  const needsAttention = state.enquiries.unanswered > 0 || state.listings.rejected > 0;

  return (
    <div className="mb-8">
      {/* The one thing a partner should act on, before anything else. */}
      {needsAttention && (
        <div className="mb-4 rounded-[5px] border border-tone-danger/40 bg-tone-danger/5 p-4">
          <p className="text-sm font-semibold text-tone-danger">Waiting on you</p>
          <ul className="mt-2 space-y-1 text-sm text-ink-label dark:text-night-muted">
            {state.enquiries.unanswered > 0 && (
              <li>
                <Link href="/dashboard/enquiries?unanswered=true" className="underline">
                  {state.enquiries.unanswered} enquir
                  {state.enquiries.unanswered === 1 ? "y" : "ies"} not yet answered
                </Link>
              </li>
            )}
            {state.listings.rejected > 0 && (
              <li>
                <Link href="/dashboard/listings?status=REJECTED" className="underline">
                  {state.listings.rejected} listing
                  {state.listings.rejected === 1 ? "" : "s"} need changes
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      {!state.listed && (
        <div className="mb-4 rounded-[5px] border border-tone-warning/50 bg-tone-warning/10 p-4 text-sm text-ink dark:text-gray-100">
          <strong>You are not in the public directory yet.</strong> Leapswitch lists a partner once
          verification is complete — it is not something you can switch on, and nothing you do here
          is wasted while you wait.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Published listings", value: state.listings.published, href: "/dashboard/listings?status=PUBLISHED" },
          { label: "Drafts", value: state.listings.drafts, href: "/dashboard/listings?status=DRAFT" },
          { label: "Enquiries received", value: state.enquiries.total, href: "/dashboard/enquiries" },
          { label: "Not yet answered", value: state.enquiries.unanswered, href: "/dashboard/enquiries?unanswered=true" },
        ].map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="rounded-[5px] border border-surface-border p-4 no-underline transition-colors hover:border-brand dark:border-night-border"
          >
            <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-night-muted">
              {tile.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-ink dark:text-gray-100">{tile.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
