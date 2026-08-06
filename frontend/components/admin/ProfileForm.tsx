"use client";

import { useState, useEffect } from "react";
import useAppSelector from "@/lib/hooks/useAppSelector";
import useAppDispatch from "@/lib/hooks/useAppDispatch";
import { updateUserProfile } from "@/lib/store/authSlice";
import { getRoleLabel, getUserDisplayName } from "@/lib/utils/user";

export default function ProfileForm() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const storedName = getUserDisplayName(user);
  const storedEmail = user?.email ?? "";

  const [name, setName] = useState(storedName);
  const [email, setEmail] = useState(storedEmail);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep fields in sync whenever the store user changes (reload, post-save)
  useEffect(() => {
    setName(getUserDisplayName(user));
    setEmail(user?.email ?? "");
  }, [user]);

  const isDirty = name !== storedName || email !== storedEmail;

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isDirty) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    // The profile endpoint takes first/last name and no longer accepts email —
    // changing an email would break the Google account link, so it is an admin
    // action. Split the single field on the first space.
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
      setError(result.payload as string ?? "Something went wrong. Please try again.");
    }
  };

  const initials = storedName
    .split(" ")
    .map((w: string) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "—";

  return (
    <div className="max-w-lg">
      <p className="text-sm text-gray-500 dark:text-gray-400">Update your name and email address.</p>

      {/* Avatar + meta */}
      <div className="mt-6 flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
          {initials}
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{storedName || "—"}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{user?.email ?? "—"}</p>
          {memberSince && (
            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">Member since {memberSince}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="profile-name" className="block text-xs font-semibold text-gray-700 mb-1.5 dark:text-gray-300">
            Full name
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={100}
            className="block w-full rounded-[5px] border-2 border-surface-border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-night-border dark:bg-night-card dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>

        <div>
          <label htmlFor="profile-email" className="block text-xs font-semibold text-gray-700 mb-1.5 dark:text-gray-300">
            Email address
          </label>
          <input
            id="profile-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="block w-full rounded-[5px] border-2 border-surface-border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-night-border dark:bg-night-card dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>

        {/* Role — read-only */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 dark:text-gray-300">Role</label>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand dark:text-brand-on-dark dark:bg-brand/20 dark:text-brand-on-dark">
              {getRoleLabel(user) || "—"}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">Assigned by the system · cannot be changed</span>
          </div>
        </div>

        {error && (
          <p className="rounded-[5px] bg-tone-danger/10 px-3.5 py-2.5 text-sm text-tone-danger dark:bg-tone-danger/15 dark:text-tone-danger">{error}</p>
        )}

        {success && (
          <p className="rounded-[5px] bg-tone-success/10 px-3.5 py-2.5 text-sm text-tone-success flex items-center gap-2 dark:bg-tone-success/20 dark:text-brand-on-dark">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Profile updated successfully.
          </p>
        )}

        <div className="pt-1">
          <button
            type="submit"
            disabled={saving || !isDirty}
            className="inline-flex items-center gap-2 rounded-[5px] bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
