"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Button from "@/components/common/Button";
import FormModal from "@/components/common/FormModal";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import { navIcon } from "@/components/dashboard/navIcons";
import { invitationApi, roleApi } from "@/lib/api/rbacApi";
import { ACCOUNT_TYPE_LABELS, type AccountType, type Role } from "@/types";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * Invite one or more people — the reference's multi-row repeater, on our bulk
 * endpoint.
 *
 * **Not built on `ResourceForm`.** That shell exists for editing one record with
 * a fixed field set, and this is a variable-length list of rows for a resource
 * that cannot be edited at all once created. Forcing it through would mean
 * making `record`, dirty-tracking and the single-submit footer all optional for
 * one caller — the same judgement as the roles matrix.
 *
 * Two bugs in the reference's version are deliberately not reproduced, both
 * registered as divergences:
 *
 *  - **Its remove-row button discards typed input** — it splices by index while
 *    the inputs are keyed by index too, so removing row 2 of 3 leaves row 3's
 *    text in row 2's box. Rows here carry a stable `uid`.
 *  - **It silently skips duplicate emails.** Ours flags them before submit, so
 *    "I invited five people and four arrived" cannot happen quietly.
 */

interface Row {
  /** Stable across removals. Array index is not — that is the reference's bug. */
  uid: number;
  email: string;
  role_id: string;
  account_type: AccountType;
}

let nextUid = 1;
const blankRow = (): Row => ({ uid: nextUid++, email: "", role_id: "", account_type: "external" });

/** Links the modal footer's submit button to the form it sits outside of. */
const FORM_ID = "invitation-form";

export default function InvitationForm({
  /**
   * Renders into `FormModal` instead of the bespoke full-page shell, and calls
   * `onDone` instead of navigating. The rows, the duplicate detection and the
   * submit are shared; only the chrome around them differs.
   */
  asModal = false,
  onDone,
}: {
  asModal?: boolean;
  onDone?: (action: "saved" | "cancelled") => void;
} = {}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [links, setLinks] = useState<{ email: string; url: string }[] | null>(null);

  useEffect(() => {
    roleApi
      .list()
      .then((res) => setRoles(res.data))
      .catch(() => setRoles([]));
  }, []);

  const update = (uid: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));

  const filled = rows.filter((r) => r.email.trim());

  /** Case-insensitive: the API normalises, so `A@x.com` and `a@x.com` collide. */
  const duplicates = (() => {
    const seen = new Map<string, number>();
    for (const row of filled) {
      const key = row.email.trim().toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  })();

  const canSubmit = filled.length > 0 && duplicates.size === 0 && !saving;

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setServerError(null);
    try {
      const payload = filled.map((r) => ({
        email: r.email.trim(),
        role_id: r.role_id ? Number(r.role_id) : null,
        account_type: r.account_type,
        note: note.trim() || null,
      }));
      const res =
        payload.length === 1
          ? { data: [(await invitationApi.create(payload[0])).data] }
          : await invitationApi.createMany(payload);

      // `email_sent` false means the invitee received nothing, so the link is
      // surfaced rather than dropped — that is the difference between "we
      // emailed them" and "copy this and send it yourself". When true the API
      // withholds the link deliberately: it is a live credential.
      const undelivered = res.data
        .filter((i) => !i.email_sent && i.accept_url)
        .map((i) => ({ email: i.email, url: i.accept_url as string }));

      // The link view is shown either way — it holds credentials that exist
      // nowhere else, so closing straight to the table would lose them.
      if (undelivered.length > 0) setLinks(undelivered);
      else if (asModal) onDone?.("saved");
      else router.push("/dashboard/invitations");
    } catch (err) {
      setServerError(extractApiError(err, "Could not send the invitations."));
    } finally {
      setSaving(false);
    }
  };

  const roleOptions = roles.map((r) => ({ value: String(r.id), label: r.display_name }));

  if (links) {
    const linkList = (
      <div className="space-y-2">
        {links.map((l) => (
          <div
            key={l.email}
            className="rounded-[5px] border border-brand/20 p-3 dark:border-night-border"
          >
            <p className="mb-1 text-xs font-semibold text-ink dark:text-gray-200">{l.email}</p>
            <code className="block break-all font-mono text-[11px] text-ink-label dark:text-night-muted">
              {l.url}
            </code>
          </div>
        ))}
      </div>
    );

    const blurb = `No email was delivered for ${links.length} invitation${
      links.length === 1 ? "" : "s"
    }, so the links are shown here. Each expires in 7 days.`;

    if (asModal) {
      return (
        <FormModal
          open
          // Not dismissible: these links exist nowhere else and are gone once
          // this closes. A stray Escape or backdrop click must not be what
          // destroys a credential the invitee has not received.
          dismissible={false}
          onClose={() => onDone?.("saved")}
          icon={navIcon("invitations")}
          title="Send these links"
          subtitle={blurb}
          footer={
            <Button type="button" onClick={() => onDone?.("saved")}>
              Done
            </Button>
          }
        >
          {linkList}
        </FormModal>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-3">
          <h1 className="text-sm font-bold text-ink dark:text-white">Send these links</h1>
          <p className="mt-0.5 text-[11px] text-ink-label dark:text-night-muted">{blurb}</p>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">{linkList}</div>
        <div className="mt-3 flex justify-end">
          <Button onClick={() => router.push("/dashboard/invitations")}>Done</Button>
        </div>
      </div>
    );
  }

  /** The rows and the note — everything between the header and the footer. */
  const body = (
    <>
      {serverError && (
            <div
              role="alert"
              className="mb-4 rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
            >
              {serverError}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {rows.map((row) => {
              const dup = duplicates.has(row.email.trim().toLowerCase());
              return (
                <div key={row.uid} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[220px] flex-1">
                    <Input
                      label="Email"
                      type="email"
                      value={row.email}
                      onChange={(e) => update(row.uid, { email: e.target.value })}
                      error={dup ? "Duplicate — each address can appear once" : undefined}
                    />
                  </div>
                  <div className="min-w-[150px] flex-1">
                    <Select
                      label="Role"
                      placeholder="No role"
                      options={roleOptions}
                      value={row.role_id}
                      onChange={(e) => update(row.uid, { role_id: e.target.value })}
                    />
                  </div>
                  <div className="min-w-[130px]">
                    <Select
                      label="Type"
                      options={[
                        { value: "external", label: ACCOUNT_TYPE_LABELS.external },
                        { value: "internal", label: ACCOUNT_TYPE_LABELS.internal },
                      ]}
                      value={row.account_type}
                      onChange={(e) =>
                        update(row.uid, { account_type: e.target.value as AccountType })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((r) => r.uid !== row.uid))}
                    disabled={rows.length === 1}
                    aria-label={`Remove ${row.email || "this row"}`}
                    className="mb-0.5 h-9 shrink-0 rounded-[5px] border border-brand/20 px-3 text-xs text-ink-label transition-colors hover:bg-tone-danger/10 hover:text-tone-danger disabled:cursor-not-allowed disabled:opacity-40 dark:border-night-border"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, blankRow()])}
            disabled={rows.length >= 50}
            className="mt-3 rounded-[5px] border border-brand/20 px-3 py-1.5 text-xs font-medium text-ink-label transition-colors hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 dark:border-night-border"
          >
            Add another
          </button>

          <div className="mt-4">
            <Input
              label="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              hint="Stored against every invitation in this batch. Not shown to the invitee."
            />
          </div>
    </>
  );

  /** The count and the two buttons — the footer, in both shells. */
  const footer = (cancel: () => void) => (
    <>
      {/* The running count sits *inside* the footer rather than above the button,
          because "fix the duplicates first" explains why Send is disabled and
          needs to be next to it. */}
      <p className="mr-auto text-[11px] text-ink-label dark:text-night-muted">
        {filled.length} to send
        {duplicates.size > 0 && " · fix the duplicates first"}
      </p>
      <Button variant="outline" type="button" onClick={cancel}>
        Cancel
      </Button>
      <Button type="submit" form={FORM_ID} loading={saving} disabled={!canSubmit}>
        Send {filled.length > 1 ? `${filled.length} invitations` : "invitation"}
      </Button>
    </>
  );

  if (asModal) {
    return (
      <FormModal
        open
        onClose={() => onDone?.("cancelled")}
        icon={navIcon("invitations")}
        title="Invite people"
        subtitle="Each invitation grants its role when accepted. Add a row per person — up to 50."
        // `xl`: a row is email + role + type + Remove on one line, and at the
        // default 672px they wrap to two lines per invitee, which turns a
        // five-person batch into a very tall scroll.
        size="xl"
        footer={footer(() => onDone?.("cancelled"))}
      >
        <form id={FORM_ID} onSubmit={submit} noValidate>
          {body}
        </form>
      </FormModal>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <form
        id={FORM_ID}
        onSubmit={submit}
        noValidate
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-brand/20 bg-surface-wash dark:border-night-border dark:bg-night-card"
      >
        <div className="shrink-0 border-b border-brand/20 px-4 py-3 dark:border-night-border sm:px-5">
          <h1 className="text-sm font-bold text-ink dark:text-white">Invite people</h1>
          <p className="mt-0.5 text-[11px] text-ink-label dark:text-night-muted">
            Each invitation grants its role when accepted. Add a row per person — up to 50.
          </p>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{body}</div>

        <div className="flex shrink-0 items-center gap-2 border-t border-brand/20 px-4 py-3 dark:border-night-border sm:px-5">
          {footer(() => router.push("/dashboard/invitations"))}
        </div>
      </form>
    </div>
  );
}
