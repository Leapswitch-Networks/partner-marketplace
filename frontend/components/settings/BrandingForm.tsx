"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import { authApi } from "@/lib/api/authApi";
import settingsApi, { type UpdateBrandingPayload } from "@/lib/api/settingsApi";
import type { Branding } from "@/lib/branding";
import usePermissions from "@/lib/hooks/usePermissions";

/**
 * Edit the installation's identity.
 *
 * Seeded from the server-resolved branding passed in as a prop, so there is **no
 * fetch-on-mount** — the form renders populated on first paint, and this component
 * adds nothing to PM-30's `set-state-in-effect` count.
 *
 * A blank field means *"clear the override"*, not *"set it to empty"*: it is sent as
 * `null` and the value falls back to the deployment's environment variable. That is
 * why the placeholders show the resolved value — it is what you get back if you
 * clear the box.
 */

const FIELDS: {
  key: keyof Branding;
  label: string;
  hint: string;
  maxLength: number;
}[] = [
  {
    key: "app_name",
    label: "Application name",
    hint: "Shown in the sidebar, the top bar and the sign-in screen.",
    maxLength: 120,
  },
  {
    key: "app_short_name",
    label: "Short name",
    hint: "Used where space is tight, such as the collapsed sidebar.",
    maxLength: 40,
  },
  {
    key: "monogram",
    label: "Monogram",
    hint: "One or two characters for the square badge. Longer text will clip.",
    maxLength: 2,
  },
  {
    key: "chrome_subtitle",
    label: "Sidebar subtitle",
    hint: "The small uppercase line under the name.",
    maxLength: 60,
  },
  {
    key: "tagline",
    label: "Tagline",
    hint: "One sentence on the sign-in screen describing what this is.",
    maxLength: 200,
  },
];

export default function BrandingForm({ initial }: { initial: Branding }) {
  const router = useRouter();
  const { isSuperAdmin } = usePermissions();

  const [values, setValues] = useState<Branding>(initial);
  const [resolved, setResolved] = useState<Branding>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Held as a thunk so the original submit can be replayed verbatim once the
  // password is accepted, rather than reconstructed from state that may have moved.
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [password, setPassword] = useState("");

  const setField = (key: keyof Branding, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    // Trimmed-empty is sent as null, which clears the override rather than blanking
    // the application's name. See the component docstring.
    const payload: UpdateBrandingPayload = {};
    for (const { key } of FIELDS) {
      payload[key] = values[key].trim() || null;
    }

    const res = await settingsApi.updateBranding(payload);
    setValues(res.data);
    setResolved(res.data);
    setSaved(true);
    // The chrome is rendered from a server-side cached fetch, so a client-side
    // state update alone would leave the sidebar showing the old name until the
    // cache expired. This re-renders the server components with the new value.
    router.refresh();
  };

  /**
   * Run an action, prompting for the password when the API asks for it.
   *
   * The backend answers **403** with `X-Password-Confirmation-Required`, not 401 —
   * mistaking it for a dead session would sign the user out instead of asking them
   * to confirm. Same handling as `TwoFactorSettings`.
   */
  const run = async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { detail?: string } } })
        .response;
      if (response?.status === 403) {
        setPendingAction(() => action);
      } else {
        setError(response?.data?.detail ?? "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async () => {
    setBusy(true);
    setError(null);
    try {
      await authApi.confirmPassword({ password });
      const retry = pendingAction;
      setPendingAction(null);
      setPassword("");
      if (retry) await retry();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data
        ?.detail;
      setError(detail ?? "That password is incorrect.");
    } finally {
      setBusy(false);
    }
  };

  // Rendering-only gate — the route is guarded by `require_super_admin` on the API,
  // which is the actual control. This exists so a non-super-admin who reaches the
  // page sees an explanation rather than a form that 403s on submit.
  if (!isSuperAdmin) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Only a super administrator can change the application&rsquo;s identity.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {FIELDS.map(({ key, label, hint, maxLength }) => (
        <div key={key}>
          <Input
            label={label}
            value={values[key]}
            maxLength={maxLength}
            placeholder={resolved[key]}
            onChange={(event) => setField(key, event.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
        </div>
      ))}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Clearing a field restores this deployment&rsquo;s configured default rather than
        leaving it blank.
      </p>

      {error && (
        <p className="text-sm text-tone-danger" role="alert">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="text-sm text-brand dark:text-brand-on-dark" role="status">
          Saved. The sidebar and sign-in screen now use these values.
        </p>
      )}

      {pendingAction ? (
        <div className="space-y-3 rounded-none bg-surface-wash p-4 dark:bg-night-body">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Confirm your password to change the application&rsquo;s identity.
          </p>
          <Input
            label="Current password"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={submitPassword} disabled={busy || !password}>
              {busy ? "Confirming…" : "Confirm"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPendingAction(null);
                setPassword("");
              }}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button onClick={() => run(save)} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
          <Button variant="outline" onClick={() => setValues(resolved)} disabled={busy}>
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}
