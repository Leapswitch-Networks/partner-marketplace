"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import Button from "@/components/common/Button";
import FormModal from "@/components/common/FormModal";
import Input from "@/components/common/Input";
import ResourceForm, { FormGrid, FormSection } from "@/components/common/ResourceForm";
import Select from "@/components/common/Select";
import Skeleton from "@/components/common/Skeleton";
import Textarea from "@/components/common/Textarea";
import { navIcon } from "@/components/dashboard/navIcons";
import {
  partnersApi,
  type CreatePartnerPayload,
  type UpdatePartnerPayload,
} from "@/lib/api/partnersApi";
import type { PartnerDetailResponse, PartnerTier } from "@/types";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * Create and edit a partner organisation — **one component, both modes**, the
 * Index / Form / Show contract in `CORE_COMPLETION_PLAN.md` § 2.1. Built against
 * `UserForm`, the worked example, and it keeps that file's structure so the two
 * read the same: shared `fields`, two shells, `asModal` picking between them.
 *
 * ## Three fields this form deliberately does NOT have
 *
 * `status`, `verification_level` and `is_listed` are absent, matching
 * `UpdatePartnerRequest` on the API. Each has its own endpoint and its own
 * permission because each carries a consequence a general edit must not: login
 * for every account in the organisation, Leapswitch's published endorsement, and
 * visibility to the anonymous internet. Putting any of them here would make
 * `partner-update` a superset of the three permissions that exist to separate
 * them. They are driven from the row menu in `PartnersModule` instead.
 *
 * `slug` is absent for a related reason — it is derived from `name` on create
 * and is the partner's permanent public URL. `partner_service._unique_slug`
 * never reuses one, because recycling a slug silently redirects inbound links
 * and accumulated search ranking to a different company.
 *
 * ## `founded_year` is a string in this form, on purpose
 *
 * The obvious `z.coerce.number()` is the exact shape that broke the production
 * build in TECH_DEBT **PM-24**: a coercing schema's `z.input` is `unknown` while
 * its `z.output` is `number`, so `zodResolver` and `useForm` disagree and `tsc`
 * fails. That was fixed there with React Hook Form's three-generic form. Here
 * the field is simply kept as text and parsed once in `onSubmit`, which avoids
 * the divergence rather than working around it — and an empty year has to mean
 * `null` regardless, which a numeric input cannot express.
 */

const YEAR = /^\d{4}$/;

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  legal_name: z.string().max(255),
  tier_id: z.string(),

  tagline: z.string().max(200),
  about: z.string(),
  website: z.string().max(255),
  // Not `z.email()`: the field is optional, and an empty string is the normal
  // "not provided" value from an uncontrolled input. Validated only when filled.
  public_email: z
    .string()
    .max(255)
    .refine((v) => v === "" || z.email().safeParse(v).success, {
      message: "Enter a valid email address",
    }),
  public_phone: z.string().max(30),
  founded_year: z
    .string()
    .refine((v) => v === "" || YEAR.test(v), { message: "Enter a four-digit year" })
    .refine((v) => v === "" || (Number(v) >= 1800 && Number(v) <= 2200), {
      // Mirrors `CreatePartnerRequest.founded_year`'s `ge=1800, le=2200`. Kept in
      // step deliberately: a value this rejects would be a 422 from the API, and
      // a value the API rejects should never leave the form.
      message: "Year must be between 1800 and 2200",
    }),
  employee_range: z.string().max(50),

  gst_number: z.string().max(30),
  pan_number: z.string().max(30),
  billing_address: z.string(),
  city: z.string().max(100),
  state: z.string().max(100),
  country: z.string().max(100),
  postal_code: z.string().max(20),

  agreement_signed_at: z.string(),
  notes: z.string(),
});

type FormValues = z.infer<typeof schema>;

/** Links the footer's submit button to the form it sits outside of. */
const FORM_ID = "partner-form";

const EMPLOYEE_RANGE_OPTIONS = [
  { value: "1-10", label: "1–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
  { value: "201-500", label: "201–500" },
  { value: "501-1000", label: "501–1000" },
  { value: "1000+", label: "1000+" },
];

const EMPTY: FormValues = {
  name: "",
  legal_name: "",
  tier_id: "",
  tagline: "",
  about: "",
  website: "",
  public_email: "",
  public_phone: "",
  founded_year: "",
  employee_range: "",
  gst_number: "",
  pan_number: "",
  billing_address: "",
  city: "",
  state: "",
  country: "",
  postal_code: "",
  agreement_signed_at: "",
  notes: "",
};

/** `"" | "2026-08-17"` → `null | ISO 8601`. The API field is a `datetime`. */
function toIsoOrNull(date: string): string | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** ISO 8601 → the `yyyy-MM-dd` an `<input type="date">` requires. */
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

/** `""` → `null`, anything else trimmed. The API treats null as "not set". */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export default function PartnerForm({
  partnerId,
  /**
   * Renders into `FormModal` instead of the full-page `ResourceForm`, and calls
   * `onDone` instead of navigating. Everything else is shared, which is the
   * whole reason this is a prop rather than a second component.
   */
  asModal = false,
  onDone,
}: {
  partnerId?: string;
  asModal?: boolean;
  onDone?: (action: "saved" | "cancelled") => void;
}) {
  const router = useRouter();

  const [record, setRecord] = useState<PartnerDetailResponse | null>(null);
  const [tiers, setTiers] = useState<PartnerTier[]>([]);
  const [loading, setLoading] = useState(Boolean(partnerId));
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  const { reset, register, formState } = form;

  // Tiers drive the picker. A failure is silent and leaves the select empty
  // rather than blocking the form: `tier_id` is nullable on the API and
  // `_resolve_tier` falls back to the seeded default, so a partner can be
  // onboarded without one.
  useEffect(() => {
    partnersApi
      .listTiers()
      .then((res) => setTiers(res.data))
      .catch(() => setTiers([]));
  }, []);

  useEffect(() => {
    if (!partnerId) return;
    let cancelled = false;
    partnersApi
      .get(partnerId)
      .then((res) => {
        if (cancelled) return;
        const partner = res.data;
        setRecord(partner);
        // `reset`, not per-field `setValue`: it re-baselines the form so
        // `isDirty` means "changed since load", which is what the unsaved-changes
        // guard in `ResourceForm` needs. Seeding with setValue leaves the form
        // dirty on arrival and prompts on every exit.
        reset({
          name: partner.name,
          legal_name: partner.legal_name ?? "",
          tier_id: partner.tier ? String(partner.tier.id) : "",
          tagline: partner.tagline ?? "",
          about: partner.about ?? "",
          website: partner.website ?? "",
          public_email: partner.public_email ?? "",
          public_phone: partner.public_phone ?? "",
          founded_year: partner.founded_year ? String(partner.founded_year) : "",
          employee_range: partner.employee_range ?? "",
          gst_number: partner.gst_number ?? "",
          pan_number: partner.pan_number ?? "",
          billing_address: partner.billing_address ?? "",
          city: partner.city ?? "",
          state: partner.state ?? "",
          country: partner.country ?? "",
          postal_code: partner.postal_code ?? "",
          agreement_signed_at: toDateInput(partner.agreement_signed_at),
          notes: partner.notes ?? "",
        });
      })
      .catch(
        (err) =>
          !cancelled && setServerError(extractApiError(err, "Could not load this partner."))
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [partnerId, reset]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    // One payload shape for both calls: `UpdatePartnerPayload` is
    // `Partial<CreatePartnerPayload>` plus the two asset paths, so the create
    // branch can narrow rather than the edit branch widening.
    const payload: CreatePartnerPayload = {
      name: values.name.trim(),
      legal_name: orNull(values.legal_name),
      tier_id: values.tier_id ? Number(values.tier_id) : null,
      tagline: orNull(values.tagline),
      about: orNull(values.about),
      website: orNull(values.website),
      public_email: orNull(values.public_email),
      public_phone: orNull(values.public_phone),
      founded_year: values.founded_year ? Number(values.founded_year) : null,
      employee_range: orNull(values.employee_range),
      gst_number: orNull(values.gst_number),
      pan_number: orNull(values.pan_number),
      billing_address: orNull(values.billing_address),
      city: orNull(values.city),
      state: orNull(values.state),
      country: orNull(values.country),
      postal_code: orNull(values.postal_code),
      agreement_signed_at: toIsoOrNull(values.agreement_signed_at),
      notes: orNull(values.notes),
    };

    try {
      if (record) {
        await partnersApi.update(record.id, payload satisfies UpdatePartnerPayload);
      } else {
        await partnersApi.create(payload);
      }
      // Set before navigating so the dirty guard does not prompt on the way out.
      setSaved(true);
      if (asModal) onDone?.("saved");
      else router.push("/dashboard/partners");
    } catch (err) {
      setServerError(
        extractApiError(
          err,
          record ? "Could not update partner." : "Could not onboard partner."
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const tierOptions = tiers.map((t) => ({ value: String(t.id), label: t.display_name }));
  const isEditMode = Boolean(record);

  /** The fields, declared once and rendered by whichever shell is active. */
  const fields = (
    <>
      <FormSection
        title="Identity"
        description="The trading name is what appears in the directory. The legal name is for paperwork."
      >
        <FormGrid>
          <Input label="Trading name" error={formState.errors.name?.message} {...register("name")} />
          <Input
            label="Legal name"
            error={formState.errors.legal_name?.message}
            {...register("legal_name")}
          />
        </FormGrid>

        <FormGrid>
          {/* `Select` carries no `hint` slot, so the guidance sits under the
              grid rather than being invented as a new prop for one field. */}
          <Select
            label="Tier"
            placeholder="Default tier"
            options={tierOptions}
            {...register("tier_id")}
          />
          <Input
            label="Founded year"
            inputMode="numeric"
            placeholder="e.g. 2014"
            error={formState.errors.founded_year?.message}
            {...register("founded_year")}
          />
        </FormGrid>

        <p className="text-[11px] text-ink-muted dark:text-night-muted">
          Tier decides what the organisation is entitled to list. Blank uses the seeded default.
        </p>

        {isEditMode && record && (
          <Input
            label="Slug (public URL, not editable)"
            value={record.slug}
            readOnly
            disabled
            hint="Derived from the trading name on creation and never changed — it is the partner's permanent public URL."
          />
        )}
      </FormSection>

      <FormSection
        title="Directory profile"
        description="What a buyer sees. Everything here is publishable."
      >
        <Input
          label="Tagline"
          placeholder="One line on what they do"
          error={formState.errors.tagline?.message}
          {...register("tagline")}
        />

        <Textarea
          label="About"
          rows={4}
          error={formState.errors.about?.message}
          {...register("about")}
        />

        <FormGrid>
          <Input
            label="Website"
            placeholder="https://"
            error={formState.errors.website?.message}
            {...register("website")}
          />
          <Select
            label="Employee range"
            placeholder="Not stated"
            options={EMPLOYEE_RANGE_OPTIONS}
            {...register("employee_range")}
          />
        </FormGrid>

        <FormGrid>
          <Input
            label="Public email"
            type="email"
            error={formState.errors.public_email?.message}
            {...register("public_email")}
          />
          <Input
            label="Public phone"
            error={formState.errors.public_phone?.message}
            {...register("public_phone")}
          />
        </FormGrid>
      </FormSection>

      <FormSection
        title="Location"
        description="City and country appear on the directory listing; the rest is billing detail."
      >
        <FormGrid>
          <Input label="City" error={formState.errors.city?.message} {...register("city")} />
          <Input label="State" error={formState.errors.state?.message} {...register("state")} />
        </FormGrid>

        <FormGrid>
          <Input
            label="Country"
            error={formState.errors.country?.message}
            {...register("country")}
          />
          <Input
            label="Postal code"
            error={formState.errors.postal_code?.message}
            {...register("postal_code")}
          />
        </FormGrid>

        <Textarea
          label="Billing address"
          rows={3}
          error={formState.errors.billing_address?.message}
          {...register("billing_address")}
        />
      </FormSection>

      <FormSection
        title="Compliance and agreement"
        description="Internal. None of this is published to the directory."
      >
        <FormGrid>
          {/* `Input` has no `mono` prop — that is `Textarea`'s. The monospace
              treatment comes through `className`, which `Input` forwards. */}
          <Input
            label="GST number"
            className="font-mono"
            error={formState.errors.gst_number?.message}
            {...register("gst_number")}
          />
          <Input
            label="PAN number"
            className="font-mono"
            error={formState.errors.pan_number?.message}
            {...register("pan_number")}
          />
        </FormGrid>

        <Input
          label="Agreement signed on"
          type="date"
          error={formState.errors.agreement_signed_at?.message}
          {...register("agreement_signed_at")}
        />

        <Textarea
          label="Internal notes"
          rows={3}
          hint="Staff-only. Never returned by a public route — see PartnerPublicResponse."
          error={formState.errors.notes?.message}
          {...register("notes")}
        />
      </FormSection>

      {!isEditMode && (
        <p className="text-[11px] text-ink-label dark:text-night-muted">
          A new partner is always created <strong>PENDING</strong> and unlisted. Onboarding does not
          grant login — activating the organisation is a separate, permissioned action.
        </p>
      )}
    </>
  );

  if (asModal) {
    return (
      <FormModal
        open
        onClose={() => onDone?.("cancelled")}
        icon={navIcon("partners")}
        // `xl`, matching `UserShow`'s reasoning: this form carries four sections
        // and twenty fields against a body capped at 60vh, and `FormGrid` needs
        // the width to actually produce two columns.
        size="xl"
        title={isEditMode ? `Edit Partner: ${record?.name ?? ""}` : "Onboard Partner"}
        subtitle={
          isEditMode
            ? "Update the organisation's directory profile and compliance details"
            : "Add a partner organisation to the directory"
        }
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => onDone?.("cancelled")}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} loading={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? isEditMode
                  ? "Updating…"
                  : "Onboarding…"
                : isEditMode
                  ? "Update Partner"
                  : "Onboard Partner"}
            </Button>
          </>
        }
      >
        {/* The submit button lives in the footer, outside this element, so it is
            wired by `form=` rather than by nesting. */}
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {serverError && (
            <div
              role="alert"
              className="mb-4 rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
            >
              {serverError}
            </div>
          )}
          <div className="flex flex-col gap-5">{fields}</div>
        </form>
      </FormModal>
    );
  }

  return (
    <ResourceForm
      form={form}
      record={record}
      resourceName="Partner"
      recordLabel={record?.name}
      icon={navIcon("partners")}
      backHref="/dashboard/partners"
      serverError={serverError}
      onSubmit={onSubmit}
      skipDirtyGuard={saved}
    >
      {fields}
    </ResourceForm>
  );
}
