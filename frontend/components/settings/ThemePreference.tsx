"use client";

import { useState } from "react";

import PageHeading from "@/components/common/PageHeading";
import { type ThemePresetOption } from "@/lib/api/settingsApi";
import { authApi } from "@/lib/api/authApi";
import useAppDispatch from "@/lib/hooks/useAppDispatch";
import useAppSelector from "@/lib/hooks/useAppSelector";
import { setUser } from "@/lib/store/authSlice";
import { cn } from "@/lib/utils/cn";

/**
 * A personal theme, on the profile page beside timezone and sidebar.
 *
 * ## Why it is here and not on Settings → Branding
 *
 * Branding is **installation-wide**: one row, `CHECK (id = 1)`, super-admin only,
 * password-confirmed and audited. Its model docstring draws the line — *"this table
 * holds what the application is, not what a user prefers."* Routing a personal
 * preference through that screen would put a per-user control on the page that
 * changes what everyone sees.
 *
 * ## Inherit is a real option, not the absence of one
 *
 * "Use the installation's theme" clears the override rather than storing today's
 * default. The difference matters: an administrator who rebrands must reach everyone
 * who never deliberately opted out, and must not override those who did. That is why
 * the column has no database default and why clearing is spelled `"inherit"` — on a
 * partial update, `null` means "not supplied" for every other field.
 *
 * ## Presets only
 *
 * No custom hex here, deliberately. Every preset is contrast-audited, so a closed set
 * means no user can pick their way to an unreadable interface. The custom colour
 * stays an administrator's decision, where it is one deliberate choice for the whole
 * installation rather than a per-account footgun.
 */
export default function ThemePreference({ themes }: { themes: ThemePresetOption[] }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chosen = user?.theme_preference ?? null;

  const choose = async (key: string | null) => {
    setBusy(key ?? "inherit");
    setError(null);
    try {
      // `PATCH /auth/me` — the same endpoint that writes the timezone. Not a new
      // `/me/preferences` route: that would be a second way to do something the
      // project already does.
      const { data } = await authApi.updateProfile({ theme_preference: key ?? "inherit" });
      dispatch(setUser(data));
      // The apply-and-cache is `usePersonalTheme`'s job and it reacts to the user
      // object changing — so nothing to do here but hand it the new identity.
    } catch {
      setError("That theme could not be saved. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  if (!themes.length) return null;

  return (
    <section>
      <PageHeading
        size="section"
        as="h3"
        title="Theme"
        description="Yours only. It follows your account to any machine you sign in on."
      />

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* Inherit first, because it is the state most accounts are in. */}
        <button
          type="button"
          onClick={() => void choose(null)}
          disabled={busy !== null}
          aria-pressed={chosen === null}
          className={cn(
            "flex items-center gap-2 rounded-[5px] border px-2.5 py-2 text-left text-xs font-medium transition-colors disabled:opacity-60",
            chosen === null
              ? "border-brand bg-brand/10 text-ink dark:border-brand-on-dark dark:bg-brand/20 dark:text-white"
              : "border-surface-border text-ink-label hover:bg-brand/5 dark:border-night-border dark:text-night-muted"
          )}
        >
          <span className="h-5 w-6 shrink-0 rounded-[3px] border border-dashed border-current opacity-50" />
          <span className="min-w-0">
            <span className="block truncate">Installation</span>
            <span className="block text-[10px] text-ink-muted dark:text-night-muted">
              follow the default
            </span>
          </span>
        </button>

        {themes.map((preset) => {
          const active = chosen === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => void choose(preset.key)}
              disabled={busy !== null}
              aria-pressed={active}
              title={`White on brand ${preset.contrast_white_on_brand}:1 · dark mode ${preset.contrast_on_dark_on_card}:1`}
              className={cn(
                "flex items-center gap-2 rounded-[5px] border px-2.5 py-2 text-left text-xs font-medium transition-colors disabled:opacity-60",
                active
                  ? "border-brand bg-brand/10 text-ink dark:border-brand-on-dark dark:bg-brand/20 dark:text-white"
                  : "border-surface-border text-ink-label hover:bg-brand/5 dark:border-night-border dark:text-night-muted"
              )}
            >
              {/* The preset's own hexes as inline styles, not brand utilities: a
                  swatch must show the colour it WOULD apply, and `bg-brand` would
                  render whichever theme is already live. */}
              <span className="flex shrink-0 overflow-hidden rounded-[3px]">
                <span className="h-5 w-3" style={{ backgroundColor: preset.brand }} />
                <span className="h-5 w-3" style={{ backgroundColor: preset.brand_on_dark }} />
              </span>
              <span className="min-w-0">
                <span className="block truncate">{preset.label}</span>
                <span className="block text-[10px] tabular-nums text-ink-muted dark:text-night-muted">
                  {preset.contrast_white_on_brand}:1
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-2 text-xs font-medium text-tone-danger dark:text-[rgb(var(--tone-danger-on-dark))]">
          {error}
        </p>
      )}
    </section>
  );
}
