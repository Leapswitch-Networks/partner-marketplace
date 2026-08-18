"use client";

import { useEffect, useMemo, useState } from "react";
import { type BadgeTone } from "@/components/common/Badge";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DeleteDialog from "@/components/common/DeleteDialog";
import { type Column } from "@/components/common/DataTable";
import FormModal from "@/components/common/FormModal";
import ResourceIndex from "@/components/common/ResourceIndex";
import Select from "@/components/common/Select";
import PartnerForm from "@/components/admin/PartnerForm";
import PartnerShow from "@/components/admin/PartnerShow";
import Toast, { useToast } from "@/components/common/Toast";
import {
  actionsColumn,
  badgeColumn,
  dateColumn,
  numberColumn,
  stackedCell,
} from "@/components/common/columns";
import { navIcon } from "@/components/dashboard/navIcons";
import { partnersApi } from "@/lib/api/partnersApi";
import useModalState from "@/lib/hooks/useModalState";
import usePermissions from "@/lib/hooks/usePermissions";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import {
  useChangePartnerStatusMutation,
  useDeletePartnerMutation,
  useListPartnersQuery,
  useSetPartnerListedMutation,
  useSetPartnerVerificationMutation,
} from "@/lib/api/endpoints/partnersEndpoints";
import { extractApiError } from "@/lib/utils/apiError";
import type {
  PartnerDetailResponse,
  PartnerListItem,
  PartnerStatus,
  PartnerTier,
  VerificationLevel,
} from "@/types";

/**
 * The Partners index — `PARTNER_DIRECTORY_PLAN.md` § 15 row 2. Built against
 * `UsersModule`, the worked example: same shared pieces (`ResourceIndex`,
 * `useResourceQuery`/`useResourceList`/`useModalState`, `columns.tsx`,
 * `DeleteDialog`, `Toast`), same column order (`#`, `Actions`, `Status`, data).
 *
 * ## Where this deviates from Users, and why
 *
 * **No `useRowAction`.** Every write here — status, verification, listing — is a
 * state-machine transition with a consequence a plain toggle does not have
 * (sessions revoked, Leapswitch's endorsement, public visibility), so each opens
 * a confirming dialog rather than firing immediately from the row menu the way
 * Users' status toggle does. There is no "busy row" to track because there is no
 * unconfirmed write.
 *
 * **Status is a three-state machine, not a toggle.** `change_status` only
 * allows PENDING→{ACTIVE,SUSPENDED}, ACTIVE→SUSPENDED, SUSPENDED→ACTIVE — see
 * `partner_service._STATUS_TRANSITIONS`. The label and target below always
 * resolve to a transition the API accepts: anything not ACTIVE offers
 * "Activate" (→ACTIVE); ACTIVE offers "Suspend" (→SUSPENDED).
 */

const STATUS_TONE: Record<PartnerStatus, { tone: BadgeTone; label: string }> = {
  PENDING: { tone: "warning", label: "Pending" },
  ACTIVE: { tone: "success", label: "Active" },
  SUSPENDED: { tone: "danger", label: "Suspended" },
};

export const VERIFICATION_TONE: Record<VerificationLevel, { tone: BadgeTone; label: string }> = {
  UNVERIFIED: { tone: "neutral", label: "Unverified" },
  VERIFIED: { tone: "success", label: "Verified" },
  PREMIER: { tone: "brand", label: "Premier" },
};

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
];

const VERIFICATION_OPTIONS = [
  { value: "UNVERIFIED", label: "Unverified" },
  { value: "VERIFIED", label: "Verified" },
  { value: "PREMIER", label: "Premier" },
];

export const VERIFICATION_SELECT_OPTIONS: { value: VerificationLevel; label: string }[] = [
  { value: "UNVERIFIED", label: "Unverified" },
  { value: "VERIFIED", label: "Verified" },
  { value: "PREMIER", label: "Premier" },
];

const LISTED_OPTIONS = [
  { value: "true", label: "Listed" },
  { value: "false", label: "Unlisted" },
];

/** The next status a click may move a partner to, and its label. */
function statusAction(current: PartnerStatus): { label: string; target: PartnerStatus } {
  return current === "ACTIVE"
    ? { label: "Suspend", target: "SUSPENDED" }
    : { label: "Activate", target: "ACTIVE" };
}

type ModalMode = "delete" | "create" | "edit" | "view" | "status" | "verify" | "listing";

export default function PartnersModule({ initialModal }: { initialModal?: ModalMode }) {
  const { can } = usePermissions();
  const { toasts, show, dismiss } = useToast();

  const q = useResourceQuery({
    filters: { search: "", status: "", verification_level: "", is_listed: "", tier_id: "" },
    debounced: ["search"],
    defaultSortBy: "created_at",
    defaultSortOrder: "desc",
    // 30, matching Users — the owner's default density, 2026-08-10.
    defaultPerPage: 30,
  });

  // PM-41. `partnersEndpoints` already existed and this module was the last
  // thing still not using it — the endpoints were written first and the module
  // never followed, which is how a data layer ends up with one consumer.
  //
  // Every write below now relies on `invalidatesTags` rather than `patchRow`.
  // That matters here more than in a plain CRUD screen: the four state actions
  // change `status`, `verification_level` and `is_listed`, all of which are
  // *filters* on this table — so a patched row can sit in a filtered view it no
  // longer belongs to, which is exactly the stale-row-with-no-error case the
  // old pattern could not fix.
  const {
    data: page,
    isFetching,
    error,
    refetch,
  } = useListPartnersQuery(
    {
      search: q.applied.search || undefined,
      status: (q.applied.status as PartnerStatus) || undefined,
      verification_level: (q.applied.verification_level as VerificationLevel) || undefined,
      tier_id: q.applied.tier_id ? Number(q.applied.tier_id) : undefined,
      is_listed: q.applied.is_listed === "" ? undefined : q.applied.is_listed === "true",
      sort_by: q.sortBy,
      sort_order: q.sortOrder,
      page: q.page,
      per_page: q.perPage,
    },
    // The query hook has no `ready` gate, so the URL-restore race is handled
    // here: without it the first render fires a throwaway request with default
    // filters before the real one.
    { skip: !q.ready },
  );
  const rows = page?.items ?? [];

  const modal = useModalState<ModalMode, PartnerListItem>(initialModal);
  const [changeStatus] = useChangePartnerStatusMutation();
  const [setListed] = useSetPartnerListedMutation();
  const [removePartner] = useDeletePartnerMutation();

  const [tiers, setTiers] = useState<PartnerTier[]>([]);

  // Tiers drive both the filter and the form's picker; fetched once, like
  // Users fetches roles. A failure is silent rather than blocking the page —
  // a partner without `partner-tier-view` should still see the partners list.
  useEffect(() => {
    if (!can("partner-tier-view")) return;
    partnersApi
      .listTiers()
      .then((res) => setTiers(res.data))
      .catch(() => setTiers([]));
  }, [can]);

  const tierFilterOptions = tiers.map((t) => ({ value: String(t.id), label: t.display_name }));

  // --- columns: #, Actions, Status, then data (fixed order, UI_PATTERNS.md) ---
  const columns = useMemo<Column<PartnerListItem>[]>(
    () => [
      numberColumn(),
      actionsColumn<PartnerListItem>((row) => {
        const status = statusAction(row.status);
        return [
          {
            // First, and with no permission of its own — if you can see the row
            // you can open it. Same rule as Users.
            label: "View",
            onSelect: () => modal.open("view", row),
          },
          {
            label: "Edit",
            visible: row.can_edit,
            onSelect: () => modal.open("edit", row),
          },
          {
            label: status.label,
            visible: row.can_change_status,
            onSelect: () => modal.open("status", row),
          },
          {
            label: "Verify…",
            visible: row.can_verify,
            onSelect: () => modal.open("verify", row),
          },
          {
            label: row.is_listed ? "Unlist" : "Publish",
            visible: row.can_publish,
            onSelect: () => modal.open("listing", row),
          },
          {
            label: "Delete",
            destructive: true,
            visible: row.can_delete,
            onSelect: () => modal.open("delete", row),
          },
        ];
      }),
      badgeColumn<PartnerListItem>({
        id: "status",
        header: "Status",
        sortKey: "status",
        tone: (row) => STATUS_TONE[row.status].tone,
        label: (row) => STATUS_TONE[row.status].label,
      }),
      {
        id: "partner",
        header: "Partner",
        sortKey: "name",
        cell: (row) => stackedCell(row.name, <span className="font-mono">{row.slug}</span>),
      },
      badgeColumn<PartnerListItem>({
        id: "tier",
        header: "Tier",
        tone: (row) => (row.tier ? "brand" : "neutral"),
        label: (row) => row.tier?.display_name ?? "No tier",
      }),
      badgeColumn<PartnerListItem>({
        id: "verification",
        header: "Verification",
        sortKey: "verification_level",
        tone: (row) => VERIFICATION_TONE[row.verification_level].tone,
        label: (row) => VERIFICATION_TONE[row.verification_level].label,
      }),
      badgeColumn<PartnerListItem>({
        id: "listed",
        header: "Listed",
        tone: (row) => (row.is_listed ? "success" : "neutral"),
        label: (row) => (row.is_listed ? "Listed" : "Unlisted"),
        width: "w-[100px]",
      }),
      {
        id: "city",
        header: "City",
        sortKey: "city",
        cell: (row) => (
          <span className="text-ink-label dark:text-night-muted">{row.city ?? "—"}</span>
        ),
      },
      dateColumn<PartnerListItem>({
        id: "created",
        header: "Created",
        sortKey: "created_at",
        value: (row) => row.created_at,
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modal.open]
  );

  return (
    <ResourceIndex<PartnerListItem, typeof q.filters>
      icon={navIcon("partners")}
      title="Partners"
      description="Onboard, verify and publish the partner organisations that make up the directory"
      actions={
        can("partner-create") ? (
          <Button onClick={() => modal.open("create")}>
            {navIcon("partners")}
            Add Partner
          </Button>
        ) : undefined
      }
      query={q}
      filters={[
        { type: "text", key: "search", placeholder: "Search partners...", label: "Search partners" },
        {
          type: "select",
          key: "status",
          placeholder: "All Status",
          searchPlaceholder: "Search status...",
          label: "Filter by status",
          options: STATUS_OPTIONS,
        },
        {
          type: "select",
          key: "verification_level",
          placeholder: "All Verification",
          searchPlaceholder: "Search verification...",
          label: "Filter by verification level",
          options: VERIFICATION_OPTIONS,
        },
        {
          type: "select",
          key: "is_listed",
          placeholder: "Listed & Unlisted",
          searchPlaceholder: "Search...",
          label: "Filter by directory visibility",
          options: LISTED_OPTIONS,
        },
        {
          type: "select",
          key: "tier_id",
          placeholder: "All Tiers",
          searchPlaceholder: "Search tiers...",
          label: "Filter by tier",
          options: tierFilterOptions,
          // Hidden rather than empty — same rule as Users' role filter.
          hidden: tierFilterOptions.length === 0,
        },
      ]}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      loading={isFetching}
      error={error ? "Could not load partners." : null}
      onRetry={refetch}
      total={page?.total ?? 0}
      pages={page?.pages ?? 0}
      table="vendor"
      rowNoun="partner"
      emptyTitle="No partners found"
      emptyHint={
        can("partner-create") ? (
          <Button size="sm" onClick={() => modal.open("create")}>
            Onboard First Partner
          </Button>
        ) : undefined
      }
    >
      {/*
        Create / edit / view as modals, each refreshing the table on a save so
        the row reflects the change without a reload — same contract as Users.
      */}
      {(modal.is("create") || modal.is("edit")) && (
        <PartnerForm
          asModal
          partnerId={modal.is("edit") ? modal.target?.id : undefined}
          onDone={(action) => {
            const wasEdit = modal.is("edit");
            modal.close();
            if (action === "saved") {
              show(wasEdit ? "Partner updated." : "Partner onboarded.");
              // The form's own create/update mutations invalidate the list, so
              // there is nothing to refetch here.
            }
          }}
        />
      )}

      {modal.is("view") && modal.target && (
        <PartnerShow
          asModal
          partnerId={modal.target.id}
          onClose={modal.close}
          // `switchTo`, not `open` — it keeps the row.
          onEdit={() => modal.switchTo("edit")}
        />
      )}

      {/*
        Activate/Suspend confirms first — unlike Users' status toggle, this one
        revokes every session in the organisation on suspend, which is not
        something a stray click should be able to do.
      */}
      {modal.is("status") && modal.target && (
        <ConfirmDialog
          title={`${statusAction(modal.target.status).label} partner`}
          subtitle={modal.target.slug}
          confirmLabel={statusAction(modal.target.status).label}
          busyLabel={
            modal.target.status === "ACTIVE" ? "Suspending…" : "Activating…"
          }
          tone={modal.target.status === "ACTIVE" ? "danger" : "primary"}
          errorFallback="Could not change status."
          onConfirm={async () => {
            // No `patchRow`: the mutation's tags refresh the row and the list,
            // and a status change can move a row out of the active filter.
            await changeStatus({
              id: modal.target!.id,
              status: statusAction(modal.target!.status).target,
            }).unwrap();
          }}
          onConfirmed={() => {
            const name = modal.target!.name;
            const label = statusAction(modal.target!.status).label;
            modal.close();
            show(`${name} — ${label.toLowerCase()}d.`);
          }}
          onClose={modal.close}
        >
          {modal.target.status === "ACTIVE" ? (
            <>
              Suspend{" "}
              <span className="font-semibold text-ink dark:text-gray-100">{modal.target.name}</span>?
              Every user in this organisation is signed out immediately and cannot sign in again until
              reinstated.
            </>
          ) : (
            <>
              Activate{" "}
              <span className="font-semibold text-ink dark:text-gray-100">{modal.target.name}</span>?
              Its users will be able to sign in immediately.
            </>
          )}
        </ConfirmDialog>
      )}

      {modal.is("verify") && modal.target && (
        <VerifyPartnerModal
          partner={modal.target}
          onClose={modal.close}
          onSaved={(next) => {
            // Verification is invalidated by its own mutation — see
            // `VerifyPartnerModal`. Patching here would race that refetch.
            modal.close();
            show(`${next.name} — verification set to ${VERIFICATION_TONE[next.verification_level].label}.`);
          }}
        />
      )}

      {modal.is("listing") && modal.target && (
        <ConfirmDialog
          title={modal.target.is_listed ? "Remove from directory" : "Publish to directory"}
          subtitle={modal.target.slug}
          confirmLabel={modal.target.is_listed ? "Unlist" : "Publish"}
          busyLabel={modal.target.is_listed ? "Removing…" : "Publishing…"}
          tone={modal.target.is_listed ? "danger" : "primary"}
          errorFallback="Could not change directory visibility."
          onConfirm={async () => {
            await setListed({
              id: modal.target!.id,
              is_listed: !modal.target!.is_listed,
            }).unwrap();
          }}
          onConfirmed={() => {
            const name = modal.target!.name;
            const nowListed = !modal.target!.is_listed;
            modal.close();
            show(`${name} is now ${nowListed ? "published to" : "removed from"} the directory.`);
          }}
          onClose={modal.close}
        >
          {modal.target.is_listed ? (
            <>
              Remove{" "}
              <span className="font-semibold text-ink dark:text-gray-100">{modal.target.name}</span>{" "}
              from the public directory? Its listing stops being visible immediately.
            </>
          ) : (
            <>
              Publish{" "}
              <span className="font-semibold text-ink dark:text-gray-100">{modal.target.name}</span>{" "}
              to the public directory? Only an ACTIVE partner can be published.
            </>
          )}
        </ConfirmDialog>
      )}

      {modal.is("delete") && modal.target && (
        <DeleteDialog
          noun="partner"
          name={modal.target.name}
          subtitle={modal.target.slug}
          // The API refuses while anyone still belongs to the organisation —
          // same shape as Roles' `user_count` guard.
          confirmDisabled={modal.target.user_count > 0}
          onConfirm={async () => {
            await removePartner(modal.target!.id).unwrap();
          }}
          onDeleted={() => {
            const name = modal.target!.name;
            modal.close();
            show(`${name} deleted.`);
          }}
          onClose={modal.close}
        >
          {modal.target.user_count > 0 && (
            <p className="rounded-[5px] border border-tone-warning/40 bg-tone-warning/15 px-3 py-2 text-xs text-ink dark:border-tone-warning/40 dark:text-tone-warning">
              {modal.target.user_count} user(s) still belong to this organisation. Move or remove
              them first — the API will refuse otherwise.
            </p>
          )}
        </DeleteDialog>
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </ResourceIndex>
  );
}

/**
 * Set what Leapswitch vouches for.
 *
 * A small `FormModal` rather than a `ConfirmDialog` — `verification_level` is a
 * three-way categorical (`UNVERIFIED` / `VERIFIED` / `PREMIER`), not a boolean,
 * and a confirm dialog has no field for "which one". Exported so `PartnerShow`'s
 * header action reuses the exact same picker rather than growing a second one.
 */
export function VerifyPartnerModal({
  partner,
  onClose,
  onSaved,
}: {
  partner: PartnerListItem;
  onClose: () => void;
  onSaved: (next: PartnerDetailResponse) => void;
}) {
  const [setVerification] = useSetPartnerVerificationMutation();
  const [level, setLevel] = useState<VerificationLevel>(partner.verification_level);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // The mutation invalidates both the row and the list, so the caller no
      // longer patches anything — it just closes and reports.
      const next = await setVerification({ id: partner.id, verification_level: level }).unwrap();
      onSaved(next);
    } catch (err) {
      setError(extractApiError(err, "Could not update verification."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      icon={navIcon("partners")}
      title={`Verify ${partner.name}`}
      subtitle="What Leapswitch vouches for — ranked above any paid placement"
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} loading={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <Select
        label="Verification level"
        options={VERIFICATION_SELECT_OPTIONS}
        value={level}
        onChange={(e) => setLevel(e.target.value as VerificationLevel)}
      />

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
        >
          {error}
        </p>
      )}
    </FormModal>
  );
}
