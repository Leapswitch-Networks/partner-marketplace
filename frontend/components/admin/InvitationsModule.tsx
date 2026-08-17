"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import { type Column } from "@/components/common/DataTable";
import {
  actionsColumn,
  badgeColumn,
  dateColumn,
  numberColumn,
} from "@/components/common/columns";
import InvitationForm from "@/components/admin/InvitationForm";
import Modal from "@/components/common/Modal";
import ResourceIndex from "@/components/common/ResourceIndex";
import Toast, { useToast } from "@/components/common/Toast";
import { navIcon } from "@/components/dashboard/navIcons";
import { invitationApi } from "@/lib/api/rbacApi";
import useModalState from "@/lib/hooks/useModalState";
import usePermissions from "@/lib/hooks/usePermissions";
import useResourceList from "@/lib/hooks/useResourceList";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import { ACCOUNT_TYPE_LABELS, type AccountType, type Invitation } from "@/types";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * Invitations index.
 *
 * The reference's version is the weakest screen in its core: no filters at all,
 * the table hard-scoped to `status='pending'` server-side, no sorting, and
 * pagination bars that render but do nothing because the controller returns an
 * unpaginated `->get()`. Ours gets real filtering, sorting and paging for free
 * from `ResourceIndex`, which is a superset — no behaviour of theirs is lost.
 * The divergences are registered in `CORE_COMPLETION_PLAN.md` § 1.1.
 */

const STATUS_TONE: Record<Invitation["status"], "success" | "warning" | "danger" | "neutral"> = {
  pending: "warning",
  accepted: "success",
  expired: "neutral",
  cancelled: "danger",
};

/**
 * The badge rendered `row.status` raw, so the column read `pending` / `accepted`
 * in lower case while every other badge in the app is sentence case. The wire
 * value is lower case and stays that way; only the label changes.
 */
const STATUS_LABEL: Record<Invitation["status"], string> = {
  pending: "Pending",
  accepted: "Accepted",
  expired: "Expired",
  cancelled: "Cancelled",
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: "external", label: ACCOUNT_TYPE_LABELS.external },
  { value: "internal", label: ACCOUNT_TYPE_LABELS.internal },
];

/*
 * The private `StatCard` that used to live here moved to
 * `components/common/StatTiles.tsx` on 2026-08-17, along with the two inlined
 * copies in `ApiDocsModule` and `WorkerJobsModule`. Its contrast finding — the
 * figure stays ink and the tone rides a dot beside the label — survived the move
 * and is documented on `StatTile.tone`, because it was the only one of the three
 * implementations that had measured anything.
 */

export default function InvitationsModule() {
  const { can } = usePermissions();
  const { toasts, show, dismiss } = useToast();

  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);

  const q = useResourceQuery({
    filters: { search: "", status: "", account_type: "" },
    debounced: ["search"],
    defaultSortBy: "created_at",
    defaultSortOrder: "desc",
    // Fixed 30, matching Users' owner-set default — `autoPerPage` removed
    // 2026-08-13 because the two cannot coexist: it recomputes on every
    // resize until the user picks a size, so a seeded default alongside it
    // would silently resize back to whatever fits.
    defaultPerPage: 30,
  });

  const list = useResourceList<Invitation>({
    ready: q.ready,
    deps: [q.applied, q.sortBy, q.sortOrder, q.page, q.perPage],
    errorMessage: "Could not load invitations.",
    fetch: () =>
      invitationApi
        .list({
          search: q.applied.search || undefined,
          status: (q.applied.status as Invitation["status"]) || undefined,
          account_type: (q.applied.account_type as AccountType) || undefined,
          sort_by: q.sortBy,
          sort_order: q.sortOrder,
          page: q.page,
          per_page: q.perPage,
        })
        .then((res) => res.data),
  });

  /**
   * `create` opens the invite form as a modal, matching Users — owner's call,
   * 2026-08-11. `/dashboard/invitations/new` still exists and still renders the
   * full-page shell; it is the deep-linkable version.
   *
   * The resend link dialog is not in here: it is not opened *on* a row, it is
   * raised by a response, and it carries a credential rather than a record.
   */
  const modal = useModalState<"create" | "cancel", Invitation>();

  /** Refetched after every write: a resend or cancel moves a row between cards. */
  const loadStats = useCallback(() => {
    invitationApi
      .stats()
      .then((res) => setStats(res.data as unknown as Record<string, number>))
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleResend = async (invitation: Invitation) => {
    setBusy(invitation.id);
    try {
      const res = await invitationApi.resend(invitation.id);
      // `accept_url` comes back only when no email was actually delivered —
      // console backend, or a send failure. Surfacing it is the difference
      // between "we emailed them" and "copy this and send it yourself".
      if (res.data.accept_url) setLink({ email: invitation.email, url: res.data.accept_url });
      else show(`Invitation resent to ${invitation.email}.`);
      await list.refetch();
      loadStats();
    } catch (err) {
      show(extractApiError(err, "Could not resend."), "error");
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    const target = modal.target;
    if (!target) return;
    setBusy(target.id);
    try {
      await invitationApi.cancel(target.id);
      show(`Invitation to ${target.email} cancelled.`);
      modal.close();
      await list.refetch();
      loadStats();
    } catch (err) {
      show(extractApiError(err, "Could not cancel."), "error");
    } finally {
      setBusy(null);
    }
  };

  const columns = useMemo<Column<Invitation>[]>(
    () => [
      // Was open-coded as `(q.page - 1) * q.perPage + i + 1`, on top of an index
      // that already carries the page offset — so page 2 started at 51 instead of
      // 26. See the table in `columns.tsx`.
      numberColumn<Invitation>(),
      actionsColumn<Invitation>((row) => [
        {
          label: "Resend",
          // Only a pending invitation can be resent. An accepted or cancelled one
          // refuses server-side, so offering it would put an action on screen
          // that can only ever return an error.
          visible: can("invitation-resend") && row.status === "pending",
          disabled: busy === row.id,
          hint: "Issues a new link and invalidates the old one",
          onSelect: () => handleResend(row),
        },
        {
          label: "Cancel",
          destructive: true,
          visible: can("invitation-cancel") && row.status === "pending",
          disabled: busy === row.id,
          onSelect: () => modal.open("cancel", row),
        },
      ]),
      badgeColumn<Invitation>({
        id: "status",
        header: "Status",
        sortKey: "status",
        tone: (row) => STATUS_TONE[row.status],
        label: (row) => STATUS_LABEL[row.status],
        width: "w-[110px]",
      }),
      { id: "email", header: "Email", cell: (row) => row.email, sortKey: "email" },
      {
        id: "role",
        header: "Role",
        cell: (row) =>
          row.role ? (
            <Badge tone="brand">{row.role.display_name}</Badge>
          ) : (
            <span className="text-ink-label dark:text-night-muted">—</span>
          ),
      },
      badgeColumn<Invitation>({
        id: "account_type",
        header: "Type",
        tone: (row) => (row.account_type === "internal" ? "info" : "neutral"),
        label: (row) => ACCOUNT_TYPE_LABELS[row.account_type],
        width: "w-[90px]",
      }),
      {
        id: "invited_by",
        header: "Invited by",
        cell: (row) =>
          row.invited_by_name ?? (
            <span className="text-ink-label dark:text-night-muted">—</span>
          ),
      },
      dateColumn<Invitation>({
        id: "expires_at",
        header: "Expires",
        sortKey: "expires_at",
        value: (row) => row.expires_at,
      }),
      dateColumn<Invitation>({
        id: "last_sent_at",
        header: "Last sent",
        // Newly exposed. The API has sorted on it since the list endpoint landed
        // and the table never showed it — and it is the column you want when
        // deciding whether to chase someone again.
        sortKey: "last_sent_at",
        value: (row) => row.last_sent_at,
        fallback: "Not sent",
        withTime: true,
      }),
      {
        id: "resent",
        header: "Resent",
        // The reference has no such column. A repeatedly resent invitation is
        // either a delivery problem or someone being chased, and both are worth
        // seeing before you resend it again.
        cell: (row) => (
          <span className="tabular-nums text-ink-label dark:text-night-muted">
            {row.resent_count}
          </span>
        ),
        className: "text-center",
        headerClassName: "w-[80px] text-center",
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can, busy, modal.open]
  );

  return (
    <ResourceIndex<Invitation, typeof q.filters>
      icon={navIcon("invitations")}
      title="Invitations"
      // The count moved to the pager, which says "1–25 of 137" and does not go
      // stale between fetches. What stays is the sentence explaining the concept.
      description="An invitation is a role grant with a delay on it"
      actions={
        can("invitation-create") ? (
          <Button onClick={() => modal.open("create")}>
            {navIcon("userAdd")}
            Invite
          </Button>
        ) : undefined
      }
      query={q}
      filters={[
        { type: "text", key: "search", placeholder: "Search email or note…", label: "Search invitations" },
        { type: "select", key: "status", placeholder: "All statuses", label: "Filter by status", options: STATUS_OPTIONS },
        { type: "select", key: "account_type", placeholder: "All types", label: "Filter by account type", options: ACCOUNT_TYPE_OPTIONS },
      ]}
      stats={
        stats
          ? [
              { label: "Pending", value: stats.pending, tone: "warning", hint: "sent, not yet accepted" },
              { label: "Accepted", value: stats.accepted, tone: "success", hint: "became an account" },
              { label: "Expired", value: stats.expired, tone: "neutral", hint: "lapsed before use" },
              { label: "Cancelled", value: stats.cancelled, tone: "danger", hint: "withdrawn by an admin" },
            ]
          : undefined
      }
      columns={columns}
      rows={list.rows}
      rowKey={(r) => r.id}
      loading={list.loading}
      error={list.error}
      onRetry={list.refetch}
      total={list.total}
      pages={list.pages}
      table="vendor"
      rowNoun="invitation"
      emptyTitle="No invitations"
      emptyHint={
        can("invitation-create") ? (
          <Button size="sm" onClick={() => modal.open("create")}>
            Send First Invitation
          </Button>
        ) : undefined
      }
    >
      {modal.is("create") && (
        <InvitationForm
          asModal
          onDone={(action) => {
            modal.close();
            if (action === "saved") {
              show("Invitations sent.");
              list.refetch();
              loadStats();
            }
          }}
        />
      )}

      {modal.is("cancel") && modal.target && (
        // Not `DeleteDialog`: cancelling is not deleting. The record stays, it
        // stops working — and the copy has to say which, because "delete" would
        // imply the row disappears from this table and it does not.
        <Modal
          onClose={modal.close}
          title="Cancel this invitation?"
          subtitle={modal.target.email}
          footer={
            <>
              <Button variant="outline" type="button" onClick={modal.close}>
                Keep it
              </Button>
              <Button variant="danger" onClick={handleCancel} loading={busy === modal.target.id}>
                Cancel invitation
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink dark:text-gray-300">
            The link stops working immediately. Cancelling is final — send a new invitation rather
            than trying to restore this one.
          </p>
        </Modal>
      )}

      {link && (
        <Modal
          onClose={() => setLink(null)}
          title="Send this link"
          subtitle={link.email}
          footer={
            <Button type="button" onClick={() => setLink(null)}>
              Done
            </Button>
          }
        >
          <p className="mb-2 text-xs text-ink dark:text-gray-300">
            No email was delivered, so the link is shown here instead. It expires in 7 days and
            replaces any previous link for this invitation.
          </p>
          <code className="block break-all rounded-[5px] border border-brand/20 bg-white px-3 py-2 font-mono text-[11px] dark:border-night-border dark:bg-night-card">
            {link.url}
          </code>
        </Modal>
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </ResourceIndex>
  );
}
