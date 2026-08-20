"use client";

import { useMemo, useState } from "react";

import Button from "@/components/common/Button";
import FormModal from "@/components/common/FormModal";
import Input from "@/components/common/Input";
import ResourceIndex from "@/components/common/ResourceIndex";
import Textarea from "@/components/common/Textarea";
import Toggle from "@/components/common/Toggle";
import Toast, { useToast } from "@/components/common/Toast";
import { type Column } from "@/components/common/DataTable";
import { actionsColumn, badgeColumn, numberColumn, stackedCell } from "@/components/common/columns";
import { navIcon } from "@/components/dashboard/navIcons";
import {
  useListPartnerTiersQuery,
  useUpdatePartnerTierMutation,
} from "@/lib/api/endpoints/partnersEndpoints";
import { type UpdatePartnerTierPayload } from "@/lib/api/partnersApi";
import useModalState from "@/lib/hooks/useModalState";
import usePermissions from "@/lib/hooks/usePermissions";
import useResourceQuery from "@/lib/hooks/useResourceQuery";
import type { PartnerTier } from "@/types";

/**
 * Partner tiers — **reference data, not a CRUD module**.
 *
 * There is no create and no delete, and that is the API's shape rather than an
 * omission here: tiers are seeded from `backend/app/core/partner_tiers.py`, and
 * `name` is the key that file and every future entitlement check reference. Only
 * `PATCH /partners/tiers/{id}` exists. A tier you could delete is a tier a
 * partner row could point at and lose.
 *
 * ## Two things this screen has to say honestly
 *
 * **`max_listings = null` means unlimited, and must never be coerced to 0.** The
 * API comments say so on both the column and the schema. Blank in the form is
 * the way to express it; a numeric input cannot.
 *
 * **The limits are not enforced yet.** `max_listings` and `featured_slots` are
 * columns nothing checks — `PARTNER_DIRECTORY_PLAN.md` § 15 phase 4 owes the
 * enforcement on the listing publish path. Until then a tier is a label, and the
 * banner below says that rather than letting an admin believe they have capped
 * something.
 *
 * ## Filtering is client-side, deliberately
 *
 * `GET /partners/tiers` takes only `include_inactive` — no search, no sort, no
 * paging — because the table is a handful of seeded rows.
 *
 * ## The first module on the RTK Query data layer (PM-41)
 *
 * Converted 2026-08-17 as the worked example. Three things changed, and each is
 * the point of the exercise:
 *
 * * **The fetch is cached.** Navigating away and back renders from cache instead
 *   of re-requesting. Under the old fetch-on-mount hook every mount was a round trip.
 * * **There is no `refetch()` after a save.** The mutation declares
 *   `invalidatesTags`, so the list updates itself. That manual synchronisation
 *   was the thing most likely to be forgotten, and forgetting it showed stale
 *   rows with no error at all.
 * * **Filtering and sorting are a `useMemo` over cached data**, not a re-fetch.
 *   For five seeded rows a round trip per keystroke was always the wrong shape;
 *   the old version hid it inside `fetch`, where it read as if the server did it.
 */

const STATE_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

type ModalMode = "edit";

export default function PartnerTiersModule() {
  const { can } = usePermissions();
  const { toasts, show, dismiss } = useToast();

  const q = useResourceQuery({
    filters: { search: "", is_active: "" },
    debounced: ["search"],
    defaultSortBy: "sort_order",
    defaultSortOrder: "asc",
    defaultPerPage: 30,
  });

  // `include_inactive` always true: the filter below decides what is shown, and
  // fetching only actives would make the "Inactive" filter return nothing.
  const { data: tiers = [], isLoading, error, refetch } = useListPartnerTiersQuery(true);

  const rows = useMemo(() => {
    const term = q.applied.search.trim().toLowerCase();
    return tiers
      .filter((t) =>
        q.applied.is_active === "" ? true : String(t.is_active) === q.applied.is_active
      )
      .filter(
        (t) =>
          term === "" ||
          t.display_name.toLowerCase().includes(term) ||
          t.name.toLowerCase().includes(term)
      )
      .slice()
      .sort((a, b) => {
        const dir = q.sortOrder === "asc" ? 1 : -1;
        if (q.sortBy === "display_name") return a.display_name.localeCompare(b.display_name) * dir;
        if (q.sortBy === "max_listings") {
          // NULL is unlimited, so it sorts as the largest value rather than as
          // zero — which is what `?? 0` would have done, putting the most
          // generous tier at the bottom of a descending sort.
          const av = a.max_listings ?? Number.POSITIVE_INFINITY;
          const bv = b.max_listings ?? Number.POSITIVE_INFINITY;
          return (av - bv) * dir;
        }
        return (a.sort_order - b.sort_order) * dir;
      });
    // `.slice()` before `.sort()`: RTK Query hands back the cached array, and
    // sorting in place would mutate the store's own object.
  }, [tiers, q.applied.is_active, q.applied.search, q.sortBy, q.sortOrder]);

  const modal = useModalState<ModalMode, PartnerTier>();

  const columns = useMemo<Column<PartnerTier>[]>(
    () => [
      numberColumn(),
      actionsColumn<PartnerTier>((row) => [
        {
          label: "Edit",
          visible: can("partner-tier-manage"),
          onSelect: () => modal.open("edit", row),
        },
      ]),
      badgeColumn<PartnerTier>({
        id: "state",
        header: "Status",
        tone: (row) => (row.is_active ? "success" : "neutral"),
        label: (row) => (row.is_active ? "Active" : "Inactive"),
      }),
      {
        id: "tier",
        header: "Tier",
        sortKey: "display_name",
        cell: (row) => stackedCell(row.display_name, <span className="font-mono">{row.name}</span>),
      },
      {
        id: "listings",
        header: "Max listings",
        sortKey: "max_listings",
        cell: (row) => (
          <span className="text-ink-label dark:text-night-muted">
            {row.is_unlimited ? "Unlimited" : row.max_listings}
          </span>
        ),
      },
      {
        id: "featured",
        header: "Featured slots",
        cell: (row) => (
          <span className="text-ink-label dark:text-night-muted">{row.featured_slots}</span>
        ),
      },
      {
        id: "order",
        header: "Order",
        sortKey: "sort_order",
        cell: (row) => (
          <span className="text-ink-label dark:text-night-muted">{row.sort_order}</span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modal.open, can]
  );

  return (
    <ResourceIndex<PartnerTier, typeof q.filters>
      icon={navIcon("partnerTiers")}
      title="Partner Tiers"
      description="What each tier entitles a partner organisation to. Seeded reference data — tiers are edited, never created or deleted"
      query={q}
      filters={[
        { type: "text", key: "search", placeholder: "Search tiers...", label: "Search tiers" },
        {
          type: "select",
          key: "is_active",
          placeholder: "Active & Inactive",
          searchPlaceholder: "Search...",
          label: "Filter by state",
          options: STATE_OPTIONS,
        },
      ]}
      columns={columns}
      rows={rows}
      // `PartnerTier.id` is an int — a serial PK, unlike the UUID string every
      // other module carries — and `rowKey` is typed `(row) => string`.
      rowKey={(r) => String(r.id)}
      loading={isLoading}
      // RTK Query's error is `{ status, data }` with `data` already a readable
      // message — see `baseQuery.ts`. `ResourceIndex` wants a string or null.
      error={error ? ((error as { data?: string }).data ?? "Could not load partner tiers.") : null}
      onRetry={refetch}
      total={rows.length}
      pages={1}
      table="vendor"
      rowNoun="tier"
      emptyTitle="No partner tiers found"
    >
      <p className="mb-4 rounded-[5px] border border-tone-warning/40 bg-tone-warning/15 px-3 py-2 text-xs text-ink dark:border-tone-warning/40 dark:text-tone-warning">
        <strong>Not enforced yet.</strong> Listing allowance and featured slots are recorded here but
        nothing checks them — enforcement lands with the listings module. Treat these as the intended
        entitlement, not an applied cap.
      </p>

      {modal.is("edit") && modal.target && (
        <EditTierModal
          tier={modal.target}
          onClose={modal.close}
          // No `patchRow` and no `refetch`: `updatePartnerTier` invalidates the
          // PartnerTier LIST tag, so this query refetches itself. That is the
          // manual synchronisation PM-41 exists to remove.
          onSaved={(next) => {
            modal.close();
            show(`${next.display_name} updated.`);
          }}
        />
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </ResourceIndex>
  );
}

/**
 * Edit what a tier grants.
 *
 * `name` is absent — it is the seed key, and renaming it here would leave the
 * database and `core/partner_tiers.py` disagreeing until the next seed silently
 * renamed it back. The API omits it from `UpdatePartnerTierRequest` for the same
 * reason, so a field here would only produce a value the server drops.
 */
function EditTierModal({
  tier,
  onClose,
  onSaved,
}: {
  tier: PartnerTier;
  onClose: () => void;
  onSaved: (next: PartnerTier) => void;
}) {
  const [displayName, setDisplayName] = useState(tier.display_name);
  const [description, setDescription] = useState(tier.description ?? "");
  // Held as a string so blank can mean "unlimited". A `number` input would make
  // the empty state indistinguishable from 0, which is the opposite meaning.
  const [maxListings, setMaxListings] = useState(
    tier.max_listings === null ? "" : String(tier.max_listings)
  );
  const [featuredSlots, setFeaturedSlots] = useState(String(tier.featured_slots));
  const [isActive, setIsActive] = useState(tier.is_active);

  const [updateTier, { isLoading: busy }] = useUpdatePartnerTierMutation();
  const [error, setError] = useState<string | null>(null);

  const invalid =
    displayName.trim() === "" ||
    (maxListings !== "" && !/^\d+$/.test(maxListings)) ||
    !/^\d+$/.test(featuredSlots);

  const submit = async () => {
    setError(null);
    const data: UpdatePartnerTierPayload = {
      display_name: displayName.trim(),
      description: description.trim() || null,
      max_listings: maxListings === "" ? null : Number(maxListings),
      featured_slots: Number(featuredSlots),
      is_active: isActive,
    };
    try {
      // `.unwrap()` turns the mutation's `{ data } | { error }` union into a
      // resolved value or a throw, so the try/catch below reads normally.
      onSaved(await updateTier({ id: tier.id, data }).unwrap());
    } catch (err) {
      setError((err as { data?: string }).data ?? "Could not update this tier.");
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      size="md"
      icon={navIcon("partnerTiers")}
      title={`Edit ${tier.display_name}`}
      subtitle={tier.name}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} loading={busy} disabled={invalid}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <Textarea
          label="Description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Input
          label="Max listings"
          inputMode="numeric"
          placeholder="Unlimited"
          hint="Leave blank for unlimited. Zero means the tier may list nothing."
          value={maxListings}
          onChange={(e) => setMaxListings(e.target.value)}
        />

        <Input
          label="Featured slots"
          inputMode="numeric"
          value={featuredSlots}
          onChange={(e) => setFeaturedSlots(e.target.value)}
        />

        <div className="flex flex-col gap-1">
          <Toggle label="Active" checked={isActive} onChange={setIsActive} />
          {/* `Toggle` is label-only by design, so the explanation sits beside it
              rather than being added as a prop for one call site. */}
          <p className="text-xs text-ink-muted dark:text-night-muted">
            An inactive tier cannot be assigned to a partner. Existing partners keep it.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
          >
            {error}
          </p>
        )}
      </div>
    </FormModal>
  );
}
