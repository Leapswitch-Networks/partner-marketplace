"use client";

import { useState } from "react";

import { headingClasses } from "@/components/common/PageHeading";
import Button from "@/components/common/Button";
import Textarea from "@/components/common/Textarea";
import Toast, { useToast } from "@/components/common/Toast";
import type { EnquiryStatus } from "@/lib/api/directoryApi";
import {
  useGetEnquiryQuery,
  useReplyEnquiryMutation,
  useUpdateEnquiryStatusMutation,
} from "@/lib/api/endpoints/directoryEndpoints";
import { usePermissions } from "@/lib/hooks/usePermissions";

/**
 * Human labels. The *options offered* come from the server —
 * `enquiry.allowed_transitions` — because the lifecycle table lives in
 * `enquiry_service` and a second copy here would drift. When it drifted, this
 * dropdown would offer a move the API refuses with a 409, and an operator reads
 * that as the page being broken rather than as the move being illegal.
 *
 * Exhaustive by type, so adding a status to `EnquiryStatus` without a label here
 * fails the build instead of rendering a raw enum value at someone.
 */
const STATUS_LABEL: Record<EnquiryStatus, string> = {
  NEW: "New",
  VIEWED: "Opened",
  RESPONDED: "Responded",
  CLOSED: "Closed",
  WON: "Won",
  LOST: "Lost",
  SPAM: "Spam",
};

/**
 * One enquiry, as a conversation.
 *
 * ## Replying here is not a convenience
 *
 * It is the only place `first_responded_at` is written, and that column is the
 * numerator of the only trust signal the public surface can honestly show. A
 * partner who answers from their own mail client leaves the enquiry at NEW
 * forever, and § 16's one number reads zero while the product works fine. The
 * page says so rather than assuming anyone would guess it.
 *
 * ## Staff see this and cannot write to it
 *
 * `enquiry-respond` is granted to partners and deliberately not to staff
 * (§ 20.6.1) — a buyer would have no way to know they were talking to us rather
 * than to the company they wrote to. The composer is replaced with a note
 * explaining that, rather than hidden: a staff member who cannot find the reply
 * box will assume it is broken.
 */
export default function EnquiryThread({ enquiryId }: { enquiryId: string }) {
  const { toasts, show, dismiss } = useToast();
  const { can } = usePermissions();
  const canRespond = can("enquiry-respond");

  const { data: enquiry, isLoading: loading } = useGetEnquiryQuery(enquiryId);
  const [reply, { isLoading: sending }] = useReplyEnquiryMutation();
  const [setStatus] = useUpdateEnquiryStatusMutation();
  const [body, setBody] = useState("");

  // No manual reload after either write. Both mutations invalidate this thread
  // AND the inbox list, so the badge counts on `/dashboard/enquiries` are right
  // the moment this page changes something — which the old hand-rolled reload
  // could not do, because it did not know the other page existed.
  const onReply = async () => {
    if (!body.trim()) return;
    try {
      await reply({ id: enquiryId, body: body.trim() }).unwrap();
      setBody("");
      show("Reply sent.");
    } catch {
      show("Could not send the reply.", "error");
    }
  };

  const onStatus = async (status: EnquiryStatus) => {
    try {
      await setStatus({ id: enquiryId, status }).unwrap();
      show(`Marked ${STATUS_LABEL[status].toLowerCase()}.`);
    } catch (err) {
      // A 409 is not a fault — it is the lifecycle refusing a move, and it
      // arrives with a message naming what *is* allowed from here. Showing that
      // beats a generic failure, which would leave the operator guessing.
      const detail = (err as { data?: unknown } | null)?.data;
      show(
        typeof detail === "string" && detail.length > 0
          ? detail
          : "Could not change the status.",
        "error",
      );
    }
  };

  if (loading) {
    return <p className="p-6 text-sm text-ink-muted dark:text-night-muted">Loading…</p>;
  }
  if (!enquiry) {
    return <p className="p-6 text-sm text-ink-muted dark:text-night-muted">Enquiry not found.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className={`${headingClasses()} text-ink dark:text-gray-100`}>
            {enquiry.buyer_name}
          </h1>
          <p className="text-sm text-ink-muted dark:text-night-muted">
            {enquiry.company ? `${enquiry.company} · ` : ""}
            {enquiry.buyer_email}
            {enquiry.buyer_phone ? ` · ${enquiry.buyer_phone}` : ""}
          </p>
          <p className="mt-1 text-xs text-ink-muted dark:text-night-muted">
            Reference {enquiry.reference} ·{" "}
            {enquiry.first_responded_at
              ? `first answered ${new Date(enquiry.first_responded_at).toLocaleString()}`
              : "not yet answered"}
          </p>
        </div>
        {canRespond && (
          <select
            value={enquiry.status}
            onChange={(e) => onStatus(e.target.value as EnquiryStatus)}
            aria-label="Enquiry status"
            className="rounded-[5px] border border-surface-border bg-white px-3 py-2 text-sm text-ink dark:border-night-border dark:bg-night-card dark:text-gray-100"
          >
            {[enquiry.status, ...(enquiry.allowed_transitions ?? [])].map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        )}
      </div>

      {(enquiry.budget_range || enquiry.timeline) && (
        <dl className="mt-4 flex flex-wrap gap-6 rounded-[5px] bg-surface-wash p-3 text-sm dark:bg-night-body">
          {enquiry.budget_range && (
            <div>
              <dt className="text-xs text-ink-muted dark:text-night-muted">Budget</dt>
              <dd className="font-medium text-ink dark:text-gray-100">{enquiry.budget_range}</dd>
            </div>
          )}
          {enquiry.timeline && (
            <div>
              <dt className="text-xs text-ink-muted dark:text-night-muted">Timeline</dt>
              <dd className="font-medium text-ink dark:text-gray-100">{enquiry.timeline}</dd>
            </div>
          )}
        </dl>
      )}

      <ol className="mt-6 space-y-4">
        {(enquiry.messages ?? []).map((m) => (
          <li
            key={m.id}
            className={
              m.direction === "FROM_BUYER"
                ? "rounded-[5px] border border-surface-border p-4 dark:border-night-border"
                : "rounded-[5px] border border-brand/30 bg-brand/5 p-4"
            }
          >
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-night-muted">
              {m.direction === "FROM_BUYER" ? enquiry.buyer_name : "You"} ·{" "}
              {new Date(m.created_at).toLocaleString()}
            </p>
            <p className="whitespace-pre-wrap text-sm text-ink dark:text-gray-100">{m.body}</p>
          </li>
        ))}
      </ol>

      {canRespond ? (
        <div className="mt-6">
          <Textarea
            label="Reply"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Answer here — this is what records your response time."
          />
          <div className="mt-3">
            <Button onClick={onReply} loading={sending} disabled={!body.trim()}>
              Send reply
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-6 rounded-[5px] border border-surface-border p-4 text-sm text-ink-muted dark:border-night-border dark:text-night-muted">
          <strong className="text-ink dark:text-gray-100">Read only.</strong> Only the partner this
          enquiry was sent to can reply — a buyer needs to know who is answering them.
        </p>
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
