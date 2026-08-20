"use client";

import { useEffect, useState } from "react";

import PageHeading from "@/components/common/PageHeading";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Textarea from "@/components/common/Textarea";
import Toast, { useToast } from "@/components/common/Toast";
import {
  getMyOrganisation,
  listCategories,
  setMyExpertise,
  updateMyOrganisation,
  type Category,
  type OwnOrganisation,
} from "@/lib/api/directoryApi";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * `/dashboard/organisation` — the partner's own public profile.
 *
 * ## What is shown read-only, and why that is the honest choice
 *
 * Verification level, listing status and account status are displayed but not
 * editable, because they are **Leapswitch's judgement about this partner, not
 * theirs** — § 20.6.1. Hiding them entirely would be worse: a partner who cannot
 * see that they are unlisted has no way to understand why nobody is finding
 * them, and will assume the directory is broken rather than that they are
 * awaiting review.
 *
 * ## Expertise is a picker over the taxonomy, never free text
 *
 * § 6.2, and it is not a style preference: each selection becomes a pivot row
 * that the public directory filter joins on. A text field here would produce
 * "Kubernetes", "kubernetes" and "K8s" as three different things a buyer can
 * filter by, and the filter would find none of them reliably.
 *
 * ## Internal fields are absent from this screen entirely
 *
 * No `notes`, no GST or PAN. They are not disabled inputs — they are not
 * fetched, not rendered, and not writable by the endpoint this page calls.
 */
export default function OrganisationModule() {
  const { toasts, show, dismiss } = useToast();

  const [org, setOrg] = useState<OwnOrganisation | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([getMyOrganisation(), listCategories()])
      .then(([o, c]) => {
        setOrg(o);
        setCategories(c);
        setSelected((o.expertise ?? []).map((e) => e.id));
        setForm({
          name: o.name ?? "",
          tagline: o.tagline ?? "",
          about: o.about ?? "",
          website: o.website ?? "",
          public_email: o.public_email ?? "",
          public_phone: o.public_phone ?? "",
          founded_year: o.founded_year ? String(o.founded_year) : "",
          employee_range: o.employee_range ?? "",
          city: o.city ?? "",
          state: o.state ?? "",
          country: o.country ?? "",
          service_areas: o.service_areas ?? "",
        });
      })
      .catch((e) => show(extractApiError(e, "Could not load your organisation."), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key: string) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const onSave = async () => {
    setSaving(true);
    try {
      const next = await updateMyOrganisation({
        name: form.name.trim(),
        tagline: form.tagline.trim() || null,
        about: form.about.trim() || null,
        website: form.website.trim() || null,
        public_email: form.public_email.trim() || null,
        public_phone: form.public_phone.trim() || null,
        founded_year: form.founded_year ? Number(form.founded_year) : null,
        employee_range: form.employee_range.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        country: form.country.trim() || null,
        service_areas: form.service_areas.trim() || null,
      });
      setOrg(next);
      show("Saved.");
    } catch (e) {
      show(extractApiError(e, "Could not save."), "error");
    } finally {
      setSaving(false);
    }
  };

  const onSaveExpertise = async () => {
    setSaving(true);
    try {
      const next = await setMyExpertise(selected);
      setOrg(next);
      show("Expertise updated — buyers can filter for these.");
    } catch (e) {
      show(extractApiError(e, "Could not save your expertise."), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-sm text-ink-muted dark:text-night-muted">Loading…</p>;
  }
  if (!org) {
    return (
      <p className="p-6 text-sm text-ink-muted dark:text-night-muted">
        Your account is not attached to an organisation.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <PageHeading
        title="Your organisation"
        description="This is what buyers see on your public profile."
      />

      {/* Read-only, and shown rather than hidden — see the docstring. */}
      <dl className="mt-4 flex flex-wrap gap-6 rounded-[5px] bg-surface-wash p-4 text-sm dark:bg-night-body">
        <div>
          <dt className="text-xs text-ink-muted dark:text-night-muted">Verification</dt>
          <dd className="font-medium text-ink dark:text-gray-100">{org.verification_level}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted dark:text-night-muted">In the directory</dt>
          <dd className="font-medium text-ink dark:text-gray-100">
            {org.is_listed ? "Yes" : "Not yet"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted dark:text-night-muted">Account</dt>
          <dd className="font-medium text-ink dark:text-gray-100">{org.status}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-ink-muted dark:text-night-muted">
        These three are set by Leapswitch, not by you — they are what our verification means.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Input label="Name" value={form.name} onChange={set("name")} />
        <Input label="Tagline" value={form.tagline} onChange={set("tagline")} />
        <Input label="Website" value={form.website} onChange={set("website")} />
        <Input label="Public email" value={form.public_email} onChange={set("public_email")} />
        <Input label="Public phone" value={form.public_phone} onChange={set("public_phone")} />
        <Input label="Founded" type="number" value={form.founded_year} onChange={set("founded_year")} />
        <Input label="Team size" value={form.employee_range} onChange={set("employee_range")} />
        <Input label="City" value={form.city} onChange={set("city")} />
        <Input label="State" value={form.state} onChange={set("state")} />
        <Input label="Country" value={form.country} onChange={set("country")} />
      </div>

      <div className="mt-5 space-y-5">
        <Textarea label="About" value={form.about} onChange={set("about")} rows={6} />
        <Textarea
          label="Service areas"
          value={form.service_areas}
          onChange={set("service_areas")}
          rows={2}
          placeholder="Pune, Mumbai, Remote — all India"
        />
      </div>

      <div className="mt-6">
        <Button onClick={onSave} loading={saving}>
          Save profile
        </Button>
      </div>

      <hr className="my-8 border-surface-border dark:border-night-border" />

      <PageHeading size="section" title="Expertise" />
      <p className="mt-1 text-sm text-ink-muted dark:text-night-muted">
        Pick what you do. This is exactly what buyers filter the directory by, so anything you leave
        unticked is a search you will not appear in.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {categories.map((c) => (
          <label key={c.id} className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="accent-brand"
              checked={selected.includes(c.id)}
              onChange={(e) =>
                setSelected((prev) =>
                  e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                )
              }
            />
            <span className="text-ink dark:text-gray-100">
              {c.parent_id ? "— " : ""}
              {c.name}
            </span>
          </label>
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-ink-muted dark:text-night-muted">
            No categories exist yet. Leapswitch owns the taxonomy — ask us to add one.
          </p>
        )}
      </div>

      <div className="mt-5">
        <Button onClick={onSaveExpertise} loading={saving}>
          Save expertise
        </Button>
      </div>

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
