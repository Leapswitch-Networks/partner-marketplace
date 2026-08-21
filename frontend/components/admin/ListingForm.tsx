"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { headingClasses } from "@/components/common/PageHeading";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Textarea from "@/components/common/Textarea";
import Toast, { useToast } from "@/components/common/Toast";
import type { Listing, PricingModel } from "@/lib/api/directoryApi";
import {
  useCreateListingMutation,
  useGetListingQuery,
  useListCategoriesQuery,
  useSubmitListingMutation,
  useUpdateListingMutation,
} from "@/lib/api/endpoints/directoryEndpoints";
import { extractApiError } from "@/lib/utils/apiError";

const PRICING: { value: PricingModel; label: string; hint: string }[] = [
  { value: "ON_REQUEST", label: "Price on request", hint: "Most common. No number shown publicly." },
  { value: "FROM", label: "Starting from", hint: "A floor price, shown as “From ₹X”." },
  { value: "FIXED", label: "Fixed price", hint: "One number, no negotiation implied." },
];

/** The editable shape of the form, kept separate from the API's payload type
 *  because `categoryId` is `number | ""` here — an unchosen select is not a
 *  number, and pretending otherwise is how a form submits `NaN`. */
interface Fields {
  title: string;
  summary: string;
  description: string;
  categoryId: number | "";
  pricingModel: PricingModel;
  price: string;
}

/**
 * The listing authoring form — **the screen the supply side depends on.**
 *
 * `DIRECTORY_BUILD_PUNCHLIST.md` 3.6 marks it the highest-risk work in the
 * product, and the risk is not technical: if this form is heavy or unclear, an
 * onboarded partner writes nothing and the directory stays empty while looking
 * like it is working.
 *
 * ## Four decisions that keep it light
 *
 * 1. **Five fields to save a draft.** Title, summary, category, pricing model,
 *    and optionally a description. Media and the spec table come later on the
 *    show page — asking for photographs before a partner has written a sentence
 *    is how a form gets abandoned at the top.
 * 2. **Save and submit are different buttons.** § 20.6.2. A partner must be able
 *    to leave something half-finished without it going to a reviewer, and must
 *    never submit by accident because Save was the only control.
 * 3. **The review consequence is stated before the click, not after.** Editing a
 *    published listing takes it off the public site until it is approved again.
 *    A partner who discovers that afterwards does not trust the tool again.
 * 4. **`price` is only asked for when the pricing model needs one.** The API
 *    rejects FIXED/FROM without a number (§ 20.2 rule 9), and a field that is
 *    sometimes required is clearer than one that is always shown and sometimes
 *    ignored.
 */
export default function ListingForm({ listingId }: { listingId?: string }) {
  const router = useRouter();
  const { toasts, show, dismiss } = useToast();
  const editing = Boolean(listingId);

  const { data: categories = [] } = useListCategoriesQuery();
  const { data: existing, isLoading: loading } = useGetListingQuery(listingId ?? "", {
    skip: !listingId,
  });

  const [create, { isLoading: creating }] = useCreateListingMutation();
  const [update, { isLoading: updating }] = useUpdateListingMutation();
  const [submit, { isLoading: submitting }] = useSubmitListingMutation();
  const saving = creating || updating || submitting;

  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * ## Fields are derived, not copied into state by an effect
   *
   * The old version loaded the listing and then `setTitle(...)` &c. inside an
   * effect. Two problems with that, and the second is the one a user meets:
   * `react-hooks/set-state-in-effect` flags it, and a refetch — which the cache
   * now does on its own after any invalidation — would overwrite whatever the
   * partner had typed since. Deriving means a refetch cannot eat keystrokes.
   *
   * `edits` holds only what has actually been touched, so an untouched field
   * follows the server's value and a touched one holds its own.
   */
  const [edits, setEdits] = useState<Partial<Fields>>({});

  const fields = useMemo<Fields>(
    () => ({
      title: existing?.title ?? "",
      summary: existing?.summary ?? "",
      description: existing?.description ?? "",
      categoryId: existing?.category_id ?? "",
      pricingModel: existing?.pricing_model ?? "ON_REQUEST",
      price: existing?.price != null ? String(existing.price) : "",
      ...edits,
    }),
    [existing, edits]
  );

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setEdits((prev) => ({ ...prev, [key]: value }));

  const { title, summary, description, categoryId, pricingModel, price } = fields;

  /** Client-side validation mirrors the API's, so the common mistakes never
   *  cost a round trip. The API remains the authority — this is convenience. */
  const validate = () => {
    const next: Record<string, string> = {};
    if (title.trim().length < 3) next.title = "Give it a title of at least 3 characters.";
    if (summary.trim().length < 10) next.summary = "A one-line summary, at least 10 characters.";
    if (categoryId === "") next.category = "Pick the category a buyer would look under.";
    if (pricingModel !== "ON_REQUEST" && !price.trim()) {
      next.price = "This pricing model needs a number. Use “Price on request” if there isn't one.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const persist = async (): Promise<Listing | null> => {
    if (!validate()) return null;
    const payload = {
      title: title.trim(),
      summary: summary.trim(),
      description: description.trim() || null,
      category_id: Number(categoryId),
      pricing_model: pricingModel,
      price: pricingModel === "ON_REQUEST" ? null : Number(price),
    };
    return editing && listingId
      ? update({ id: listingId, data: payload }).unwrap()
      : create(payload).unwrap();
  };

  const onSaveDraft = async () => {
    try {
      const saved = await persist();
      if (!saved) return;
      show(editing ? "Saved." : "Draft saved. It is not public yet.");
      router.push(`/dashboard/listings/${saved.id}`);
    } catch (e) {
      show(extractApiError(e, "Could not save the listing."), "error");
    }
  };

  const onSaveAndSubmit = async () => {
    try {
      const saved = await persist();
      if (!saved) return;
      // Already back in review from the edit itself — submitting again would be
      // a redundant transition the API rejects with a 409.
      if (saved.status !== "PENDING_REVIEW") await submit(saved.id).unwrap();
      show("Sent for review. A person reads every listing before it is published.");
      router.push(`/dashboard/listings/${saved.id}`);
    } catch (e) {
      show(extractApiError(e, "Could not submit the listing."), "error");
    }
  };

  if (loading) {
    return <p className="p-6 text-sm text-ink-muted dark:text-night-muted">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <h1 className={`${headingClasses()} text-ink dark:text-gray-100`}>
        {editing ? "Edit listing" : "New listing"}
      </h1>

      {/* The consequence, stated BEFORE the click — see the docstring. */}
      {editing && existing?.status === "PUBLISHED" && (
        <p className="mt-3 rounded-[5px] border border-tone-warning/50 bg-tone-warning/10 p-3 text-sm text-ink dark:text-gray-100">
          <strong>This listing is live.</strong> Saving a change to the title, summary, description,
          category or price sends it back for review, and it leaves the public directory until it is
          approved again.
        </p>
      )}

      {editing && existing?.status === "REJECTED" && existing.rejection_reason && (
        <p className="mt-3 rounded-[5px] border border-tone-danger/50 bg-tone-danger/10 p-3 text-sm text-ink dark:text-gray-100">
          <strong>Changes requested:</strong> {existing.rejection_reason}
        </p>
      )}

      <div className="mt-6 space-y-5">
        <Input
          label="Title"
          value={title}
          onChange={(e) => set("title", e.target.value)}
          error={errors.title}
          placeholder="Managed Kubernetes for production workloads"
        />

        <Input
          label="One-line summary"
          value={summary}
          onChange={(e) => set("summary", e.target.value)}
          error={errors.summary}
          placeholder="What a buyer sees on the card, before they click."
        />

        <div>
          <label
            htmlFor="listing-category"
            className="mb-1 block text-sm font-medium text-ink-label dark:text-night-muted"
          >
            Category
          </label>
          <select
            id="listing-category"
            value={categoryId}
            onChange={(e) => set("categoryId", e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-[5px] border border-surface-border bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-night-border dark:bg-night-card dark:text-gray-100"
          >
            <option value="">Choose a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parent_id ? "— " : ""}
                {c.name}
              </option>
            ))}
          </select>
          {errors.category && <p className="mt-1 text-xs text-tone-danger">{errors.category}</p>}
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-ink-label dark:text-night-muted">
            Pricing
          </span>
          <div className="space-y-2">
            {PRICING.map((option) => (
              <label key={option.value} className="flex items-start gap-2.5 text-sm">
                <input
                  type="radio"
                  name="pricing_model"
                  value={option.value}
                  checked={pricingModel === option.value}
                  onChange={() => set("pricingModel", option.value)}
                  className="mt-1 accent-brand"
                />
                <span>
                  <span className="font-medium text-ink dark:text-gray-100">{option.label}</span>
                  <span className="block text-xs text-ink-muted dark:text-night-muted">
                    {option.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Only asked for when it is needed — see decision 4. */}
        {pricingModel !== "ON_REQUEST" && (
          <Input
            label="Price (INR)"
            type="number"
            value={price}
            onChange={(e) => set("price", e.target.value)}
            error={errors.price}
            placeholder="14000"
          />
        )}

        <Textarea
          label="Description (optional)"
          value={description}
          onChange={(e) => set("description", e.target.value)}
          rows={8}
          placeholder="What is included, what is not, and who it suits. You can add this later."
        />
      </div>

      {/* Two buttons, deliberately. Save must never mean submit. */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={onSaveDraft} loading={saving}>
          Save draft
        </Button>
        <Button onClick={onSaveAndSubmit} loading={saving}>
          {editing ? "Save and send for review" : "Send for review"}
        </Button>
        <Button variant="light" onClick={() => router.push("/dashboard/listings")}>
          Cancel
        </Button>
      </div>

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
