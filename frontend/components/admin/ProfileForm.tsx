"use client";

import { useState } from "react";

import Avatar from "@/components/common/Avatar";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import { FormGrid, FormSection } from "@/components/common/ResourceForm";
import { navIcon } from "@/components/dashboard/navIcons";
import useAppDispatch from "@/lib/hooks/useAppDispatch";
import useAppSelector from "@/lib/hooks/useAppSelector";
import { updateUserProfile } from "@/lib/store/authSlice";
import { formatDate } from "@/lib/utils/format";
import { getRoleLabel, getUserDisplayName } from "@/lib/utils/user";

/**
 * Your own profile.
 *
 * Brought onto the shared form pieces on 2026-08-12 — `MODULE_PARITY_PLAN` step
 * 5's last open item, and the last flat form in the app.
 *
 * **The email field was a control wired to nothing.** It rendered as an editable
 * input, `isDirty` counted a change to it, and the button lit up — but the
 * profile endpoint takes `first_name` and `last_name` and has ignored `email`
 * since it stopped accepting one. You could type a new address, press Save, see
 * "Profile updated successfully", and nothing whatever had happened. That is the
 * same class of defect as the bulk-action buttons found on 2026-08-11 and the
 * `sortKey` that sent a parameter no route read.
 *
 * It is read-only now **with the reason shown inline**, which is the position
 * `LEAPDESK_PARITY_PLAN.md` § Still open already records: changing an address
 * breaks the Google account link and every outstanding invitation, so it is an
 * administrator's action rather than a self-service one.
 */
export default function ProfileForm() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const storedName = getUserDisplayName(user);

  const [name, setName] = useState(storedName);
  const [syncedFrom, setSyncedFrom] = useState(user?.id);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refills the field when the *account* changes — a reload, or signing in as
  // someone else. Adjusted during render rather than in an effect: React
  // documents this pattern for exactly this case, and the effect version is what
  // `react-hooks/set-state-in-effect` objects to. It deliberately does not
  // resync on every store write, which would discard what someone was typing
  // the moment anything else touched the user.
  if (user?.id !== syncedFrom) {
    setSyncedFrom(user?.id);
    setName(storedName);
  }

  // Only the field the endpoint actually reads. Counting the email here is what
  // made the old form claim it had saved something it had not.
  const isDirty = name !== storedName;
  const memberSince = user?.created_at ? formatDate(user.created_at) : null;

  const initials =
    storedName
      .split(" ")
      .map((word: string) => word[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "—";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDirty) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    // The endpoint takes first and last name separately. Split on the first
    // space, which is the same rule the admin form uses.
    const trimmed = name.trim();
    const spaceAt = trimmed.indexOf(" ");
    const result = await dispatch(
      updateUserProfile({
        first_name: spaceAt > 0 ? trimmed.slice(0, spaceAt) : trimmed,
        last_name: spaceAt > 0 ? trimmed.slice(spaceAt + 1).trim() : "",
      })
    );

    setSaving(false);
    if (updateUserProfile.fulfilled.match(result)) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError((result.payload as string) ?? "Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex max-w-3xl flex-col gap-4">
      <FormSection
        title="Your account"
        description="How you appear to everyone else in this workspace."
        icon={navIcon("users")}
      >
        <div className="flex items-center gap-4 pb-4">
          <Avatar initials={initials} size="lg" />
          <div>
            <p className="text-sm font-semibold text-ink dark:text-gray-100">
              {storedName || "—"}
            </p>
            <p className="text-xs text-ink-label dark:text-night-muted">{user?.email ?? "—"}</p>
            {memberSince && (
              <p className="mt-0.5 text-[11px] text-ink-label dark:text-night-muted">
                Member since {memberSince}
              </p>
            )}
          </div>
        </div>

        <FormGrid>
          <Input
            label="Full name"
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={100}
          />
          <Input
            label="Email address"
            id="profile-email"
            type="email"
            value={user?.email ?? ""}
            readOnly
            disabled
            hint="Changing this breaks the Google account link and any outstanding invitation, so an administrator has to do it."
          />
        </FormGrid>
      </FormSection>

      <FormSection
        title="Access"
        description="Set by an administrator. Shown here so you know what you hold."
        icon={navIcon("roles")}
      >
        <div className="flex flex-wrap items-center gap-2 py-2">
          <span className="inline-flex items-center rounded-md bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand dark:bg-brand/20 dark:text-brand-on-dark">
            {getRoleLabel(user) || "—"}
          </span>
          <span className="text-[11px] text-ink-label dark:text-night-muted">
            Assigned by the system · cannot be changed here
          </span>
        </div>
      </FormSection>

      {error && (
        <p
          role="alert"
          className="rounded-[5px] bg-tone-danger/10 px-3.5 py-2.5 text-sm text-tone-danger dark:bg-tone-danger/15"
        >
          {error}
        </p>
      )}

      {success && (
        <p className="flex items-center gap-2 rounded-[5px] bg-tone-success/10 px-3.5 py-2.5 text-sm text-tone-success dark:bg-tone-success/20 dark:text-brand-on-dark">
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Profile updated.
        </p>
      )}

      <div>
        <Button type="submit" loading={saving} disabled={!isDirty}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
