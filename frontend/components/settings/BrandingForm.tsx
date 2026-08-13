"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import { authApi } from "@/lib/api/authApi";
import settingsApi, {
  type BrandColourRefusal,
  type UpdateBrandingPayload,
} from "@/lib/api/settingsApi";
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
 *
 * `chrome_subtitle` and `app_short_name` left this form on 2026-08-13: nothing has
 * rendered either since the subtitle came out of the chrome the same day, and a
 * field that edits nothing teaches admins that saving does nothing. The API still
 * accepts both, so removing the inputs loses no stored data.
 */
type TextField = "app_name" | "monogram" | "tagline";

const FIELDS: {
  key: TextField;
  label: string;
  hint: string;
  maxLength: number;
}[] = [
  {
    key: "app_name",
    label: "Application name",
    hint: "Shown in the sidebar, the top bar, the browser tab, sign-in and every email.",
    maxLength: 120,
  },
  {
    key: "monogram",
    label: "Monogram",
    hint: "One or two characters for the square badge and the generated tab icon.",
    maxLength: 2,
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

  // ── The colour engine's client half (2026-08-13) ──────────────────────────
  // `customHex` is the picker's text; `customActive` says whether a custom
  // colour (rather than the preset grid) is the current choice. Contrast and
  // refusal both come from the backend — the preview endpoint runs the same
  // derivation as saving, so what you see is exactly what Save will do.
  const [customHex, setCustomHex] = useState(initial.brand_color ?? "#24695c");
  const [customActive, setCustomActive] = useState(initial.theme_source === "custom");
  const [contrast, setContrast] = useState<{ white_on_brand: number; on_dark_on_card: number } | null>(null);
  const [refusal, setRefusal] = useState<BrandColourRefusal | null>(null);

  // The live preview writes the candidate variables as inline styles on <html>,
  // which override the server's <style> without touching it; reverting is just
  // removing what we set. A ref, not state: the DOM is the state here, and
  // re-rendering over a style write would be noise.
  const previewKeys = useRef<string[]>([]);
  const applyPreviewVars = (vars: Record<string, string>) => {
    const root = document.documentElement;
    for (const key of previewKeys.current) root.style.removeProperty(key);
    for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
    previewKeys.current = Object.keys(vars);
  };
  const clearPreview = () => {
    const root = document.documentElement;
    for (const key of previewKeys.current) root.style.removeProperty(key);
    previewKeys.current = [];
  };
  // Leaving the page must not leave a candidate theme painted on it.
  useEffect(() => clearPreview, []);

  /** Preview a candidate (colour or preset) through the backend's own derivation. */
  const preview = async (candidate: { brand_color?: string; theme_preset?: string }) => {
    setRefusal(null);
    try {
      const res = await settingsApi.previewTheme(candidate);
      applyPreviewVars(res.data.css_variables);
      setContrast(res.data.contrast);
      if (res.data.brand_color) setCustomHex(res.data.brand_color);
    } catch (err: unknown) {
      const detail = (err as { response?: { status?: number; data?: { detail?: unknown } } })
        .response;
      if (detail?.status === 422 && detail.data && typeof detail.data.detail === "object") {
        setRefusal(detail.data.detail as BrandColourRefusal);
        setContrast(null);
      } else {
        setError(extractApiError(err, "Could not preview that colour."));
      }
    }
  };

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
    const payload: UpdateBrandingPayload = {
      theme_preset: values.theme_preset,
      // Explicit null when the grid is the choice: saving a preset must clear a
      // custom colour, or the colour keeps winning and the preset click lies.
      brand_color: customActive ? customHex : null,
    };
    for (const { key } of FIELDS) {
      payload[key] = values[key].trim() || null;
    }

    try {
      const res = await settingsApi.updateBranding(payload);
      // The server's <style> now says what the inline preview was saying.
      clearPreview();
      applyBranding(res.data);
    } catch (err: unknown) {
      const detail = (err as { response?: { status?: number; data?: { detail?: unknown } } })
        .response;
      if (detail?.status === 422 && detail.data && typeof detail.data.detail === "object") {
        setRefusal(detail.data.detail as BrandColourRefusal);
        return;
      }
      throw err;
    }
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
      <p className="text-sm text-ink-label dark:text-night-muted">
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
          <p className="mt-1 text-xs text-ink-label dark:text-night-muted">{hint}</p>
        </div>
      ))}

      <p className="text-xs text-ink-label dark:text-night-muted">
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
        <p className="mt-0.5 text-xs text-ink-label dark:text-night-muted">
          Pick a preset or any colour of your own. Every shade the interface needs —
          hovers, dark mode, card washes, borders, success chips — derives from the
          one you choose, and the derivation refuses a colour whose button labels
          would be unreadable. Choosing previews the whole page live; nothing changes
          for anyone else until you save.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {themes.map((preset) => {
            const active = !customActive && values.theme_preset === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={active}
                title={`White on brand ${preset.contrast_white_on_brand}:1 · dark mode ${preset.contrast_on_dark_on_card}:1`}
                onClick={() => {
                  setValues((current) => ({ ...current, theme_preset: preset.key }));
                  setCustomActive(false);
                  setSaved(false);
                  void preview({ theme_preset: preset.key });
                }}
                className={`flex items-center gap-2 rounded-[5px] border px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                  active
                    ? "border-brand bg-brand/10 text-gray-900 dark:border-brand-on-dark dark:bg-brand/20 dark:text-gray-100"
                    : "border-surface-border text-ink-label dark:text-night-muted hover:bg-gray-50 dark:border-night-border dark:text-gray-400 dark:hover:bg-night-body"
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
                <span className="min-w-0">
                  <span className="block truncate">{preset.label}</span>
                  <span className="block text-[10px] tabular-nums text-ink-muted dark:text-night-muted">
                    {preset.contrast_white_on_brand}:1 · {preset.contrast_on_dark_on_card}:1
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Custom colour ──────────────────────────────────────────────── */}
        <div
          className={`mt-3 flex flex-wrap items-center gap-2 rounded-[5px] border px-2.5 py-2 ${
            customActive
              ? "border-brand bg-brand/10 dark:border-brand-on-dark dark:bg-brand/20"
              : "border-surface-border dark:border-night-border"
          }`}
        >
          <input
            type="color"
            aria-label="Pick a custom brand colour"
            value={/^#[0-9a-fA-F]{6}$/.test(customHex) ? customHex : "#24695c"}
            onChange={(event) => {
              setCustomHex(event.target.value);
              setCustomActive(true);
              setSaved(false);
              void preview({ brand_color: event.target.value });
            }}
            className="h-8 w-10 cursor-pointer rounded-[3px] border-0 bg-transparent p-0"
          />
          {/* A bare input, not the shared `Input`: that component mandates a
              visible label block, and this field's label is the swatch beside it. */}
          <input
            type="text"
            aria-label="Custom brand colour hex"
            value={customHex}
            maxLength={7}
            spellCheck={false}
            onChange={(event) => {
              setCustomHex(event.target.value);
              setCustomActive(true);
              setSaved(false);
              // Only ask the backend once the text is a plausible colour; every
              // keystroke of "#8" would 422 pointlessly.
              if (/^#?[0-9a-fA-F]{6}$/.test(event.target.value.trim())) {
                void preview({ brand_color: event.target.value.trim() });
              }
            }}
            className="w-28 rounded-[5px] border border-surface-border bg-transparent px-2.5 py-1.5 font-mono text-xs text-ink focus:border-brand focus:outline-none dark:border-night-border dark:text-gray-200"
          />
          <span className="text-xs text-ink-label dark:text-night-muted">
            Custom colour {customActive ? "— active" : ""}
          </span>
          {contrast && customActive && !refusal && (
            <span className="text-[10px] tabular-nums text-ink-muted dark:text-night-muted">
              white on brand {contrast.white_on_brand}:1 · dark mode {contrast.on_dark_on_card}:1
            </span>
          )}
        </div>

        {refusal && (
          <div className="mt-2 space-y-2 rounded-[5px] border border-tone-danger/40 bg-tone-danger/5 px-3 py-2">
            <p className="text-xs text-tone-danger" role="alert">
              {refusal.message}
            </p>
            {refusal.suggestion && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCustomHex(refusal.suggestion as string);
                  setCustomActive(true);
                  void preview({ brand_color: refusal.suggestion as string });
                }}
              >
                <span
                  className="mr-1.5 inline-block h-3 w-3 rounded-[2px] align-middle"
                  style={{ backgroundColor: refusal.suggestion }}
                />
                Use {refusal.suggestion} instead
              </Button>
            )}
          </div>
        )}

        <p className="mt-2 text-xs text-ink-label dark:text-night-muted">
          The numbers are WCAG contrast — button labels, and brand text in dark mode.
          4.5:1 is the floor and the form will not let you go under it.
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
          <Button
            variant="outline"
            onClick={() => {
              setValues(resolved);
              setCustomHex(resolved.brand_color ?? "#24695c");
              setCustomActive(resolved.theme_source === "custom");
              setRefusal(null);
              setContrast(null);
              // Drop any candidate theme painted by the live preview — the
              // server's <style> is the truth again.
              clearPreview();
            }}
            disabled={busy}
          >
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}
