"use client";

import { useState } from "react";

import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Modal from "@/components/common/Modal";
import { useSendUserEmailMutation } from "@/lib/api/endpoints/usersEndpoints";
import { extractApiError } from "@/lib/utils/apiError";
import type { ManagedUser } from "@/types";

/**
 * Send an ad-hoc message to one user, from the Users index.
 *
 * A modal rather than a page, deliberately: this is a transient action on a row
 * you are already looking at, it has no URL worth sharing, and nothing is lost
 * if it is dismissed. `CORE_COMPLETION_PLAN.md` § 2.2 keeps modals for exactly
 * this — transient actions and confirmations — while create and edit are pages.
 *
 * **Attachments landed 2026-08-12**, closing the parity gap this comment used to
 * record. The limits below are enforced server-side in `core/attachments.py` and
 * repeated here only so the user learns about a rejected file before uploading
 * it — the client-side copy is a courtesy, never the control.
 */

/** Mirrors `core/attachments.py`. The server re-checks all three, by magic bytes. */
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png";
const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
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
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sendEmail] = useSendUserEmailMutation();

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const tooLarge = totalBytes > MAX_TOTAL_BYTES;
  const canSend =
    subject.trim().length > 0 && message.trim().length > 0 && !tooLarge;

  /** Appends rather than replaces: picking twice should not lose the first pick. */
  const addFiles = (picked: FileList | null) => {
    if (!picked?.length) return;
    setError(null);
    setFiles((current) => {
      const merged = [...current];
      for (const file of Array.from(picked)) {
        // Same name and size twice is the double-click case, not two documents.
        if (merged.some((f) => f.name === file.name && f.size === file.size)) continue;
        merged.push(file);
      }
      if (merged.length > MAX_FILES) {
        setError(`Attach at most ${MAX_FILES} files.`);
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
  };

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      // `usersEndpoints.sendUserEmail` was written for this modal and had no
      // caller until now — it builds the multipart body and leaves Content-Type
      // unset so the browser writes its own boundary.
      const result = await sendEmail({
        id: user.id,
        data: {
          subject: subject.trim(),
          message: message.trim(),
          bcc_sender: bccSender,
        },
        files,
      }).unwrap();
      // A 200 does not mean it was delivered — the endpoint reports a refused
      // send as `sent: false` rather than a 5xx, so this has to be checked.
      if (result.sent) onSent(result.message);
      else setError(result.message);
    } catch (err) {
      // Reads the 422 branch, which is where attachment rejections arrive —
      // "'invoice.pdf' is not a valid PDF file" is the whole point of the check
      // and swallowing it for a generic message would make the modal unusable.
      setError(extractApiError(err, "Could not send the message. Try again."));
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

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email-attachments"
            className="text-xs font-medium text-ink dark:text-gray-200"
          >
            Attachments <span className="font-normal text-ink-label dark:text-night-muted">(optional)</span>
          </label>
          <input
            id="email-attachments"
            type="file"
            multiple
            accept={ACCEPT}
            onChange={(e) => {
              addFiles(e.target.files);
              // Cleared so picking the same file again after removing it still
              // fires a change event — the input holds its last value otherwise.
              e.target.value = "";
            }}
            className="w-full rounded-[5px] border-2 border-brand/20 bg-white px-3.5 py-2 text-xs text-ink outline-none transition file:mr-3 file:rounded-[4px] file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand hover:file:bg-brand/20 focus:border-brand dark:border-night-border dark:bg-night-card dark:text-gray-100"
          />

          {files.length > 0 && (
            <ul className="flex flex-col gap-1">
              {files.map((file) => (
                <li
                  key={`${file.name}-${file.size}`}
                  className="flex items-center justify-between gap-2 rounded-[5px] bg-surface-tile px-2.5 py-1.5 text-xs dark:bg-night-body"
                >
                  <span className="truncate text-ink dark:text-gray-200" title={file.name}>
                    {file.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-ink-label dark:text-night-muted">
                      {formatSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setFiles((current) => current.filter((f) => f !== file))
                      }
                      className="font-semibold text-tone-danger hover:underline"
                      aria-label={`Remove ${file.name}`}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p
            className={
              tooLarge
                ? "text-[11px] font-semibold text-tone-danger"
                : "text-[11px] text-ink-label dark:text-night-muted"
            }
          >
            {tooLarge
              ? `${formatSize(totalBytes)} attached — the total must stay under 25 MB.`
              : `Up to ${MAX_FILES} files, 25 MB in total. PDF, Word, Excel or images.`}
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs text-ink dark:text-gray-200">
          <input
            type="checkbox"
            checked={bccSender}
            onChange={(e) => setBccSender(e.target.checked)}
            className="h-3.5 w-3.5 accent-brand"
          />
          Send me a copy{files.length > 0 ? ", with the attachments" : ""}
        </label>
      </form>
    </Modal>
  );
}
