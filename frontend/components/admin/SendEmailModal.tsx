"use client";

import { useState } from "react";

import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Modal from "@/components/common/Modal";
import { adminApi } from "@/lib/api/adminApi";
import type { ManagedUser } from "@/types";

/**
 * Send an ad-hoc message to one user, from the Users index.
 *
 * A modal rather than a page, deliberately: this is a transient action on a row
 * you are already looking at, it has no URL worth sharing, and nothing is lost
 * if it is dismissed. `CORE_COMPLETION_PLAN.md` § 2.2 keeps modals for exactly
 * this — transient actions and confirmations — while create and edit are pages.
 *
 * **No attachments.** The reference implementation accepts up to 25MB of
 * pdf/doc/xls/image files. Registered as a parity gap rather than silently
 * dropped; the endpoint does not accept them either.
 */
export default function SendEmailModal({
  user,
  onClose,
  onSent,
}: {
  user: ManagedUser;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [bccSender, setBccSender] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = subject.trim().length > 0 && message.trim().length > 0;

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const res = await adminApi.sendEmail(user.id, {
        subject: subject.trim(),
        message: message.trim(),
        bcc_sender: bccSender,
      });
      // A 200 does not mean it was delivered — the endpoint reports a refused
      // send as `sent: false` rather than a 5xx, so this has to be checked.
      if (res.data.sent) onSent(res.data.message);
      else setError(res.data.message);
    } catch {
      setError("Could not send the message. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={`Email ${user.full_name}`}
      subtitle={user.email}
      size="lg"
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="send-email-form" loading={sending} disabled={!canSend}>
            Send
          </Button>
        </>
      }
    >
      <form id="send-email-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
          >
            {error}
          </div>
        )}

        <Input
          label="Subject"
          id="email-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={255}
          required
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email-message"
            className="text-xs font-medium text-ink dark:text-gray-200"
          >
            Message
          </label>
          <textarea
            id="email-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            maxLength={10000}
            required
            className="w-full rounded-[5px] border-2 border-brand/20 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-night-border dark:bg-night-card dark:text-gray-100"
          />
          <p className="text-[11px] text-ink-label dark:text-night-muted">
            Sent as plain text. Your name and email address are added at the end so they can reply.
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs text-ink dark:text-gray-200">
          <input
            type="checkbox"
            checked={bccSender}
            onChange={(e) => setBccSender(e.target.checked)}
            className="h-3.5 w-3.5 accent-brand"
          />
          Send me a copy
        </label>
      </form>
    </Modal>
  );
}
