"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import Badge, { type BadgeTone } from "@/components/common/Badge";
import Button, { buttonClasses } from "@/components/common/Button";
import ErrorState from "@/components/common/ErrorState";
import FormModal from "@/components/common/FormModal";
import Skeleton from "@/components/common/Skeleton";
import {
  AuditCard,
  Field,
  InfoCard,
  ShowPageGrid,
  ShowPageHeader,
  ShowPageMain,
  ShowPageSidebar,
} from "@/components/common/ShowPage";
import { navIcon } from "@/components/dashboard/navIcons";
import { partnersApi } from "@/lib/api/partnersApi";
import usePermissions from "@/lib/hooks/usePermissions";
import { extractApiError } from "@/lib/utils/apiError";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import type { PartnerDetailResponse, PartnerStatus, VerificationLevel } from "@/types";

/**
 * The partner detail surface — the Show of the Index / Form / Show contract.
 *
 * Renders `GET /partners/{id}`, which carries eighteen fields the list does not,
 * including the three the public schema deliberately withholds (`notes`,
 * `gst_number`, `pan_number`). This component is staff-facing and may show them;
 * `PartnerPublicResponse` is the allowlist for anything anonymous.
 *
 * ## Why "Published" is derived, not read
 *
 * `is_listed` alone does not mean a partner is visible. The backend's
 * `publicly_visible` requires **both** `is_listed` and `status == ACTIVE`, and
 * `set_listed` refuses to publish a non-ACTIVE organisation for exactly that
 * reason. Showing `is_listed` on its own would tell a reader a suspended partner
 * is live on the directory. The badge below uses `publicly_visible`, and the
 * Directory card shows the two inputs separately so the difference is legible.
 */

/** `Record<…>` on both, so losing a value is a type error rather than a blank badge. */
const STATUS_TONE: Record<PartnerStatus, { tone: BadgeTone; label: string }> = {
  PENDING: { tone: "warning", label: "Pending" },
  ACTIVE: { tone: "success", label: "Active" },
  SUSPENDED: { tone: "danger", label: "Suspended" },
};

const VERIFICATION_TONE: Record<VerificationLevel, { tone: BadgeTone; label: string }> = {
  UNVERIFIED: { tone: "neutral", label: "Unverified" },
  VERIFIED: { tone: "success", label: "Verified" },
  PREMIER: { tone: "brand", label: "Premier" },
};

export default function PartnerShow({
  partnerId,
  /** Renders the same content inside `FormModal` instead of the full page. */
  asModal = false,
  onClose,
  onEdit,
}: {
  partnerId: string;
  asModal?: boolean;
  onClose?: () => void;
  onEdit?: () => void;
}) {
  const { can } = usePermissions();
  const [partner, setPartner] = useState<PartnerDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await partnersApi.get(partnerId);
      setPartner(res.data);
    } catch (err) {
      setError(extractApiError(err, "Could not load this partner."));
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    // Deferred by a microtask rather than called in the effect body — same
    // reasoning as `UserShow`: `load` sets state, and calling it synchronously
    // here costs a second render pass and trips `react-hooks/set-state-in-effect`.
    void Promise.resolve().then(load);
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !partner) {
    return (
      <ErrorState
        // `ErrorState` takes an Error because it doubles as the route-level
        // `error.tsx` boundary, which React hands one.
        error={new Error(error ?? "The partner could not be found.")}
        reset={load}
        title="Could not load this partner"
        description="The record may have been deleted, or you may not have permission to view it."
        compact
      />
    );
  }

  const status = STATUS_TONE[partner.status];
  const verification = VERIFICATION_TONE[partner.verification_level];

  /** The cards, shared by the page and the modal. */
  const sections = (
    <>
      <InfoCard title="Organisation">
        <Field label="Trading name" value={partner.name} />
        <Field label="Legal name" value={partner.legal_name} />
        <Field label="Slug" value={<span className="font-mono">{partner.slug}</span>} />
        <Field label="Tier" value={partner.tier?.display_name} />
        <Field
          label="Listing allowance"
          value={
            partner.tier
              ? partner.tier.is_unlimited
                ? "Unlimited"
                : String(partner.tier.max_listings)
              : null
          }
        />
        <Field label="Members" value={String(partner.user_count)} />
      </InfoCard>

      <InfoCard title="Directory profile">
        <Field label="Tagline" value={partner.tagline} />
        <Field
          label="Website"
          value={
            partner.website ? (
              <a
                href={partner.website}
                target="_blank"
                rel="noreferrer noopener"
                className="text-brand hover:underline"
              >
                {partner.website}
              </a>
            ) : null
          }
        />
        <Field label="Public email" value={partner.public_email} />
        <Field label="Public phone" value={partner.public_phone} />
        <Field label="Founded" value={partner.founded_year ? String(partner.founded_year) : null} />
        <Field label="Employees" value={partner.employee_range} />
      </InfoCard>

      <InfoCard title="Location">
        <Field label="City" value={partner.city} />
        <Field label="State" value={partner.state} />
        <Field label="Country" value={partner.country} />
        <Field label="Postal code" value={partner.postal_code} />
        <Field label="Billing address" value={partner.billing_address} />
      </InfoCard>

      <InfoCard title="Directory status">
        <Field label="Organisation status" value={<Badge tone={status.tone}>{status.label}</Badge>} />
        <Field
          label="Verification"
          value={<Badge tone={verification.tone}>{verification.label}</Badge>}
        />
        <Field label="Verified on" value={partner.verified_at ? formatDate(partner.verified_at) : null} />
        <Field
          label="Listed flag"
          value={
            partner.is_listed ? (
              <Badge tone="success">On</Badge>
            ) : (
              <Badge tone="neutral">Off</Badge>
            )
          }
        />
        {/* The derived answer, kept next to its two inputs. `is_listed` alone
            does not put a partner on the directory — the organisation must also
            be ACTIVE. */}
        <Field
          label="Visible publicly"
          value={
            partner.publicly_visible ? (
              <Badge tone="success">Yes</Badge>
            ) : (
              <Badge tone="warning">No</Badge>
            )
          }
        />
      </InfoCard>

      {/* Staff-only, and the card title says so. Every field here is absent from
          `PartnerPublicResponse` by deliberate omission, not by filtering. */}
      <InfoCard title="Compliance (internal)">
        <Field label="GST number" value={partner.gst_number} />
        <Field label="PAN number" value={partner.pan_number} />
        <Field
          label="Agreement signed"
          value={partner.agreement_signed_at ? formatDate(partner.agreement_signed_at) : null}
        />
        <Field label="Notes" value={partner.notes} />
      </InfoCard>

      <AuditCard createdAt={partner.created_at} updatedAt={partner.updated_at} />

      {can("activity-view") && (
        <Link
          href={`/dashboard/activity?subject_type=Partner&subject_id=${partner.id}`}
          className="inline-flex items-center justify-center rounded-[5px] border border-brand/20 px-3 py-2 text-xs font-medium text-ink-label transition-colors hover:bg-brand/10 hover:text-brand dark:border-night-border dark:text-gray-400 dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
        >
          View this partner&rsquo;s activity
        </Link>
      )}
    </>
  );

  if (asModal) {
    return (
      <FormModal
        open
        onClose={() => onClose?.()}
        icon={navIcon("partners")}
        title={partner.name}
        subtitle={partner.slug}
        // `xl` and a two-column grid, same reasoning as `UserShow`: six cards
        // against a 60vh body is mostly scrollbar at the default width.
        size="xl"
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => onClose?.()}>
              Close
            </Button>
            {partner.can_edit && onEdit && (
              <Button type="button" onClick={onEdit}>
                Edit Partner
              </Button>
            )}
          </>
        }
      >
        {/* Badges move into the body — the modal header already carries the name
            and slug, and a third row on it crowds the close button. */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge tone={verification.tone}>{verification.label}</Badge>
          {partner.publicly_visible && <Badge tone="brand">Listed</Badge>}
          {partner.tier && <Badge tone="neutral">{partner.tier.display_name}</Badge>}
        </div>
        {/* `items-start` is load-bearing: without it a grid item stretches to its
            row height, so the four-field Compliance card grows an empty tail to
            match the six-field Organisation card beside it. */}
        <div className="grid items-start gap-4 md:grid-cols-2">{sections}</div>
      </FormModal>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ShowPageHeader
        eyebrow="Partner"
        title={partner.name}
        id={partner.id}
        description={partner.tagline ?? undefined}
        badges={[
          { label: status.label, tone: status.tone },
          { label: verification.label, tone: verification.tone },
          ...(partner.publicly_visible ? [{ label: "Listed", tone: "brand" as const }] : []),
          ...(partner.tier ? [{ label: partner.tier.display_name, tone: "neutral" as const }] : []),
        ]}
        backHref="/dashboard/partners"
        backLabel="Back to Partners"
        actions={
          partner.can_edit ? (
            <Link href={`/dashboard/partners/${partner.id}/edit`} className={buttonClasses()}>
              Edit
            </Link>
          ) : undefined
        }
      />

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
        <ShowPageGrid>
          <ShowPageMain>
            <InfoCard title="Organisation">
              <Field label="Trading name" value={partner.name} />
              <Field label="Legal name" value={partner.legal_name} />
              <Field label="Slug" value={<span className="font-mono">{partner.slug}</span>} />
              <Field label="Tier" value={partner.tier?.display_name} />
              <Field
                label="Listing allowance"
                value={
                  partner.tier
                    ? partner.tier.is_unlimited
                      ? "Unlimited"
                      : String(partner.tier.max_listings)
                    : null
                }
              />
              <Field label="Members" value={String(partner.user_count)} />
            </InfoCard>

            <InfoCard title="Directory profile">
              <Field label="Tagline" value={partner.tagline} />
              <Field label="About" value={partner.about} />
              <Field
                label="Website"
                value={
                  partner.website ? (
                    <a
                      href={partner.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-brand hover:underline"
                    >
                      {partner.website}
                    </a>
                  ) : null
                }
              />
              <Field label="Public email" value={partner.public_email} />
              <Field label="Public phone" value={partner.public_phone} />
              <Field
                label="Founded"
                value={partner.founded_year ? String(partner.founded_year) : null}
              />
              <Field label="Employees" value={partner.employee_range} />
            </InfoCard>

            <InfoCard title="Location">
              <Field label="City" value={partner.city} />
              <Field label="State" value={partner.state} />
              <Field label="Country" value={partner.country} />
              <Field label="Postal code" value={partner.postal_code} />
              <Field label="Billing address" value={partner.billing_address} />
            </InfoCard>
          </ShowPageMain>

          <ShowPageSidebar>
            <InfoCard title="Directory status">
              <Field
                label="Organisation status"
                value={<Badge tone={status.tone}>{status.label}</Badge>}
              />
              <Field
                label="Verification"
                value={<Badge tone={verification.tone}>{verification.label}</Badge>}
              />
              <Field
                label="Verified on"
                value={partner.verified_at ? formatDateTime(partner.verified_at) : null}
              />
              <Field
                label="Listed flag"
                value={
                  partner.is_listed ? (
                    <Badge tone="success">On</Badge>
                  ) : (
                    <Badge tone="neutral">Off</Badge>
                  )
                }
              />
              <Field
                label="Visible publicly"
                value={
                  partner.publicly_visible ? (
                    <Badge tone="success">Yes</Badge>
                  ) : (
                    <Badge tone="warning">No</Badge>
                  )
                }
              />
            </InfoCard>

            <InfoCard title="Compliance (internal)">
              <Field label="GST number" value={partner.gst_number} />
              <Field label="PAN number" value={partner.pan_number} />
              <Field
                label="Agreement signed"
                value={partner.agreement_signed_at ? formatDate(partner.agreement_signed_at) : null}
              />
              <Field label="Notes" value={partner.notes} />
            </InfoCard>

            <AuditCard createdAt={partner.created_at} updatedAt={partner.updated_at} />

            {can("activity-view") && (
              <Link
                href={`/dashboard/activity?subject_type=Partner&subject_id=${partner.id}`}
                className="inline-flex items-center justify-center rounded-[5px] border border-brand/20 px-3 py-2 text-xs font-medium text-ink-label transition-colors hover:bg-brand/10 hover:text-brand dark:border-night-border dark:text-gray-400 dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
              >
                View this partner&rsquo;s activity
              </Link>
            )}
          </ShowPageSidebar>
        </ShowPageGrid>
      </div>
    </div>
  );
}
