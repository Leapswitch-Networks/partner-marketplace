"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import { authApi } from "@/lib/api/authApi";
import settingsApi, { type UpdateBrandingPayload } from "@/lib/api/settingsApi";
import BrandAssetUpload from "@/components/settings/BrandAssetUpload";
import type { Branding, ThemePreset } from "@/lib/branding";
import usePermissions from "@/lib/hooks/usePermissions";
import { extractApiError } from "@/lib/utils/apiError";

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

/**
 * The free-text keys only.
 *
 * Explicitly narrowed rather than `keyof Branding`, which also covers
 * `theme_preset` and `theme_css_variables` — the first is chosen from a list, the
 * second is computed by the backend and must never be editable. Widening this back
 * to `keyof Branding` puts a text box over the palette.
 */
type TextField = "app_name" | "app_short_name" | "monogram" | "chrome_subtitle" | "tagline";

const FIELDS: {
  key: TextField;
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

export default function BrandingForm({
  initial,
  themes,
}: {
  initial: Branding;
  themes: ThemePreset[];
}) {
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

  /**
   * Adopt a `Branding` the API just returned, and make the change visible.
   *
   * Shared by the text save and both uploads so all three invalidate the cache the
   * same way. Without the revalidation the sidebar, brand colour and favicon keep
   * their previous values for up to five minutes — observed, and it reads as a save
   * that did nothing.
   */
  const applyBranding = (next: Branding) => {
    setValues(next);
    setResolved(next);
    setSaved(true);
    void fetch("/api/revalidate-branding", { method: "POST" })
      .catch(() => undefined)
      .then(() => router.refresh());
  };

  const setField = (key: TextField, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    // Trimmed-empty is sent as null, which clears the override rather than blanking
    // the application's name. See the component docstring.
    const payload: UpdateBrandingPayload = { theme_preset: values.theme_preset };
    for (const { key } of FIELDS) {
      payload[key] = values[key].trim() || null;
    }

    const res = await settingsApi.updateBranding(payload);
    applyBranding(res.data);
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
        setError(extractApiError(err, "Something went wrong."));
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

      <BrandAssetUpload
        asset="logo"
        label="Logo"
        hint="Replaces the badge in the sidebar and top bar. SVG, PNG, JPEG or WebP, up to 512 KB. SVG is sharpest — it scales to any size."
        currentUrl={values.logo_url}
        onChanged={applyBranding}
        onNeedsPassword={(retry) => setPendingAction(() => retry)}
      />

      <BrandAssetUpload
        asset="favicon"
        label="Favicon"
        hint="The browser tab icon. SVG, PNG or ICO, up to 512 KB. Square works best; ICO or PNG is the safest for older browsers."
        currentUrl={values.favicon_url}
        square
        onChanged={applyBranding}
        onNeedsPassword={(retry) => setPendingAction(() => retry)}
      />

      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Brand colour</p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          A fixed set rather than a colour picker. Each one ships a light counterpart
          for dark mode, and both halves are contrast-checked — a freely chosen colour
          would be unreadable in one theme or the other.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {themes.map((preset) => {
            const active = values.theme_preset === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setValues((current) => ({ ...current, theme_preset: preset.key }));
                  setSaved(false);
                }}
                className={`flex items-center gap-2 rounded-[5px] border px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                  active
                    ? "border-brand bg-brand/10 text-gray-900 dark:border-brand-on-dark dark:bg-brand/20 dark:text-gray-100"
                    : "border-surface-border text-gray-600 hover:bg-gray-50 dark:border-night-border dark:text-gray-400 dark:hover:bg-night-body"
                }`}
              >
                {/* Swatches use the preset's own hexes as inline styles, not brand
                    utilities: these must show the colour they *would* apply, and a
                    `bg-brand` swatch would render whatever theme is already live. */}
                <span className="flex shrink-0 overflow-hidden rounded-[3px]">
                  <span className="h-5 w-3" style={{ backgroundColor: preset.brand }} />
                  <span
                    className="h-5 w-3"
                    style={{ backgroundColor: preset.brand_on_dark }}
                  />
                </span>
                <span className="truncate">{preset.label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          Saving a new colour reloads the page — the theme is applied server-side.
        </p>
      </div>

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
