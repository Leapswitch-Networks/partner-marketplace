"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import { type Column } from "@/components/common/DataTable";
import Modal from "@/components/common/Modal";
import ResourceIndex from "@/components/common/ResourceIndex";
import RowActions from "@/components/common/RowActions";
import Toast, { useToast } from "@/components/common/Toast";
import { invitationApi } from "@/lib/api/rbacApi";
import useAutoPerPage from "@/lib/hooks/useAutoPerPage";
import usePermissions from "@/lib/hooks/usePermissions";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import type { Invitation } from "@/types";

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

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: "partner", label: "Partner" },
  { value: "staff", label: "Staff" },
];

function apiMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { detail?: unknown }; status?: number } })?.response;
  const detail = response?.data?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (!response) return "Network error — check your connection and try again.";
  return `${fallback} (${response.status ?? "unknown"})`;
}

/** Summary card. Counts come from their own endpoint — see `stats`. */
function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex-1 rounded-[5px] border border-brand/20 px-3 py-2 dark:border-night-border">
      <p className={`text-lg font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[11px] text-ink-label dark:text-night-muted">{label}</p>
    </div>
  );
}

export default function InvitationsModule() {
  const router = useRouter();
  const { can } = usePermissions();
  const { toast, show, dismiss } = useToast();
  const autoPerPage = useAutoPerPage();

  const [rows, setRows] = useState<Invitation[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [target, setTarget] = useState<Invitation | null>(null);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);

  const q = useResourceQuery({
    filters: { search: "", status: "", account_type: "" },
    debounced: ["search"],
    defaultSortBy: "created_at",
    defaultSortOrder: "desc",
    autoPerPage,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await invitationApi.list({
        search: q.applied.search || undefined,
        status: (q.applied.status as Invitation["status"]) || undefined,
        account_type: (q.applied.account_type as "staff" | "partner") || undefined,
        sort_by: q.sortBy,
        sort_order: q.sortOrder,
        page: q.page,
        per_page: q.perPage,
      });
      setRows(res.data.items);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      setError(apiMessage(err, "Could not load invitations."));
    } finally {
      setLoading(false);
    }
  }, [q.applied, q.sortBy, q.sortOrder, q.page, q.perPage]);

  useEffect(() => {
    if (!q.ready) return;
    load();
  }, [load, q.ready]);

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
      await load();
      loadStats();
    } catch (err) {
      show(apiMessage(err, "Could not resend."), "error");
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    if (!target) return;
    setBusy(target.id);
    try {
      await invitationApi.cancel(target.id);
      show(`Invitation to ${target.email} cancelled.`);
      setTarget(null);
      await load();
      loadStats();
    } catch (err) {
      show(apiMessage(err, "Could not cancel."), "error");
    } finally {
      setBusy(null);
    }
  };

  const columns = useMemo<Column<Invitation>[]>(
    () => [
      {
        id: "number",
        header: "#",
        cell: (_row, i) => (
          <span className="tabular-nums text-ink-label">{(q.page - 1) * q.perPage + i + 1}</span>
        ),
        className: "text-center px-0.5",
        headerClassName: "w-10 text-center px-0.5",
        hideable: false,
      },
      {
        id: "actions",
        header: "Actions",
        cell: (row) => (
          <div className="flex justify-center">
            <RowActions
              actions={[
                {
                  label: "Resend",
                  // Only a pending invitation can be resent. An accepted or
                  // cancelled one refuses server-side, so offering it would put
                  // an action on screen that can only ever return an error.
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
                  onSelect: () => setTarget(row),
                },
              ]}
            />
          </div>
        ),
        className: "!px-0 w-0",
        headerClassName: "!px-0 w-0 text-center",
        hideable: false,
      },
      {
        id: "status",
        header: "Status",
        cell: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
        sortKey: "status",
        className: "text-center",
        headerClassName: "text-center",
      },
      { id: "email", header: "Email", cell: (row) => row.email, sortKey: "email" },
      {
        id: "role",
        header: "Role",
        cell: (row) =>
          row.role ? <Badge tone="brand">{row.role.display_name}</Badge> : <span className="text-ink-label">—</span>,
      },
      {
        id: "account_type",
        header: "Type",
        cell: (row) => (row.account_type === "staff" ? "Staff" : "Partner"),
      },
      {
        id: "invited_by",
        header: "Invited by",
        cell: (row) => row.invited_by_name ?? <span className="text-ink-label">—</span>,
      },
      {
        id: "expires_at",
        header: "Expires",
        cell: (row) => new Date(row.expires_at).toLocaleDateString(undefined, { dateStyle: "medium" }),
        sortKey: "expires_at",
      },
      {
        id: "resent",
        header: "Resent",
        // The reference has no such column. A repeatedly resent invitation is
        // either a delivery problem or someone being chased, and both are worth
        // seeing before you resend it again.
        cell: (row) => <span className="tabular-nums">{row.resent_count}</span>,
        className: "text-center",
        headerClassName: "text-center",
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can, busy, q.page, q.perPage]
  );

  return (
    <ResourceIndex<Invitation, typeof q.filters>
      title="Invitations"
      description={`${total} invitation${total === 1 ? "" : "s"} · an invitation is a role grant with a delay on it`}
      actions={
        can("invitation-create") ? (
          <Button onClick={() => router.push("/dashboard/invitations/new")}>Invite</Button>
        ) : undefined
      }
      query={q}
      filters={[
        { type: "text", key: "search", placeholder: "Search email or note…", label: "Search invitations" },
        { type: "select", key: "status", placeholder: "All statuses", label: "Filter by status", options: STATUS_OPTIONS },
        { type: "select", key: "account_type", placeholder: "All types", label: "Filter by account type", options: ACCOUNT_TYPE_OPTIONS },
      ]}
      filterExtras={
        stats ? (
          <div className="flex w-full shrink-0 gap-2 sm:w-auto">
            <StatCard label="Pending" value={stats.pending} tone="text-tone-warning" />
            <StatCard label="Accepted" value={stats.accepted} tone="text-tone-success" />
            <StatCard label="Expired" value={stats.expired} tone="text-ink-label" />
            <StatCard label="Cancelled" value={stats.cancelled} tone="text-tone-danger" />
          </div>
        ) : undefined
      }
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      loading={loading}
      error={error}
      onRetry={load}
      total={total}
      pages={pages}
      emptyTitle="No invitations"
      emptyHint={can("invitation-create") ? "Use “Invite” to send the first one." : undefined}
    >
      {target && (
        <Modal
          onClose={() => setTarget(null)}
          title="Cancel this invitation?"
          subtitle={target.email}
          footer={
            <>
              <Button variant="outline" type="button" onClick={() => setTarget(null)}>
                Keep it
              </Button>
              <Button onClick={handleCancel} loading={busy === target.id}>
                Cancel invitation
              </Button>
            </>
          }
        >
          <p className="text-xs text-ink dark:text-gray-300">
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

      <Toast toast={toast} onDismiss={dismiss} />
    </ResourceIndex>
  );
}
