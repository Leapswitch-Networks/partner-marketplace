"use client";

import { useState } from "react";
import useAppSelector from "@/lib/hooks/useAppSelector";
import useAppDispatch from "@/lib/hooks/useAppDispatch";
import { updateUserProfile } from "@/lib/store/authSlice";
import type { CurrentUser } from "@/types";

/** The editable subset of the identity, as form strings. */
function seedFrom(user: CurrentUser | null) {
  return {
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    designation: user?.designation ?? "",
    employee_id: user?.employee_id ?? "",
    personal_email: user?.personal_email ?? "",
    personal_mobile_number: user?.personal_mobile_number ?? "",
  };
}

const FIELD_CLASS =
  "block w-full rounded-[5px] border-2 border-surface-border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-night-border dark:bg-night-card dark:text-gray-100 dark:placeholder-gray-500 dark:disabled:bg-gray-800/50";

const LABEL_CLASS =
  "mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300";

/**
 * The editable half of the profile page.
 *
 * Field set matches LeapDesk's form with **one deliberate omission: email.**
 * LeapDesk edits the address and clears its verification stamp; PM's
 * `update_own_profile` refuses it on purpose — changing it breaks the link to a
 * Google account and to any pending invitation, so it is an admin action. Rather
 * than silently drop a field the user can see, the input is rendered disabled with
 * the reason next to it, so "why can't I change this" is answered in place.
 */
export default function EditProfileForm() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  // Seeded once from the stored identity, then owned by the form.
  //
  // Deliberately NOT re-synced from `user` by an effect. The store is refreshed by
  // unrelated things — an identity re-fetch after any 401 retry, for one — and an
  // effect on `user` would overwrite half-typed input at an arbitrary moment. A
  // successful save seeds from its own response instead, which is the only moment
  // the canonical row is genuinely newer than what is on screen.
  const [form, setForm] = useState(() => seedFrom(user));
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const isPartner = user.roles?.some((r) => r.name === "Partner") ?? false;

  // The API refuses a profile update from a Partner outright
  // (`ProfileUpdateRequest::authorize()` in LeapDesk, the same rule here), so the
  // form is not rendered rather than shown and rejected on submit.
  if (isPartner) return null;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const result = await dispatch(
      updateUserProfile({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        // Empty string means "clear it" — the API turns a blank into NULL. Sending
        // undefined would instead leave the old value in place, so a user could
        // never remove a designation once set.
        designation: form.designation.trim(),
        employee_id: form.employee_id.trim(),
        personal_email: form.personal_email.trim(),
        personal_mobile_number: form.personal_mobile_number.trim(),
      })
    );

    setSaving(false);
    if (updateUserProfile.fulfilled.match(result)) {
      // Re-seed from the saved row, not from what was typed — the API normalises
      // (trims, blanks to NULL), so this is where the two can legitimately differ.
      setForm(seedFrom(result.payload));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError((result.payload as string) ?? "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="overflow-hidden rounded-none bg-white ring-1 ring-surface-border dark:bg-night-card dark:ring-night-border">
      <div className="border-b border-surface-border px-6 py-4 dark:border-night-border">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Edit Profile
        </h3>
        <p className="mt-0.5 text-sm text-ink-label dark:text-night-muted">
          Update your personal information and contact details.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-5 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="first_name" className={LABEL_CLASS}>First Name</label>
              <input id="first_name" className={FIELD_CLASS} value={form.first_name}
                onChange={set("first_name")} required maxLength={100}
                autoComplete="given-name" placeholder="First name" />
            </div>
            <div>
              <label htmlFor="last_name" className={LABEL_CLASS}>Last Name</label>
              <input id="last_name" className={FIELD_CLASS} value={form.last_name}
                onChange={set("last_name")} required maxLength={100}
                autoComplete="family-name" placeholder="Last name" />
            </div>
          </div>

          <div>
            <label htmlFor="email" className={LABEL_CLASS}>Email Address</label>
            <input id="email" type="email" className={FIELD_CLASS} value={user.email}
              disabled readOnly autoComplete="email" />
            <p className="mt-1.5 text-[11px] text-ink-label dark:text-night-muted">
              Changing this would break the link to a Google sign-in and to any
              pending invitation, so an administrator has to do it.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="employee_id" className={LABEL_CLASS}>Employee ID</label>
              <input id="employee_id" className={FIELD_CLASS} value={form.employee_id}
                onChange={set("employee_id")} maxLength={50}
                autoComplete="off" placeholder="Employee ID" />
            </div>
            <div>
              <label htmlFor="designation" className={LABEL_CLASS}>Designation</label>
              <input id="designation" className={FIELD_CLASS} value={form.designation}
                onChange={set("designation")} maxLength={150}
                autoComplete="off" placeholder="Designation" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="personal_email" className={LABEL_CLASS}>Personal Email</label>
              <input id="personal_email" type="email" className={FIELD_CLASS}
                value={form.personal_email} onChange={set("personal_email")}
                maxLength={255} autoComplete="off" placeholder="Personal email" />
            </div>
            <div>
              <label htmlFor="personal_mobile_number" className={LABEL_CLASS}>Mobile Number</label>
              <input id="personal_mobile_number" className={FIELD_CLASS}
                value={form.personal_mobile_number} onChange={set("personal_mobile_number")}
                maxLength={30} autoComplete="off" placeholder="Mobile number" />
            </div>
          </div>

          {!user.email_verified_at && (
            <div className="flex items-start gap-3 rounded-[5px] border border-tone-warning/40 bg-tone-warning/15 p-3 dark:border-tone-warning/40 dark:bg-tone-warning/15">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-ink dark:text-tone-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-ink dark:text-tone-warning">
                Your email address is unverified. Check your inbox for the
                confirmation link.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-[5px] bg-tone-danger/10 px-3.5 py-2.5 text-sm text-tone-danger dark:bg-tone-danger/15 dark:text-tone-danger">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-surface-border bg-gray-50 px-6 py-4 dark:border-night-border dark:bg-night-card/40">
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 rounded-[5px] bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
          {success && (
            <p className="text-sm font-medium text-tone-success dark:text-brand-on-dark">
              Saved successfully.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
