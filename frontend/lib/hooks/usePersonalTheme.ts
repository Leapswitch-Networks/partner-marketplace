"use client";

import { useEffect } from "react";

import settingsApi from "@/lib/api/settingsApi";
import useAppSelector from "@/lib/hooks/useAppSelector";

/**
 * Applies the signed-in user's own brand theme, and caches it for the next load.
 *
 * ## The layering, and why the cache is a requirement
 *
 * The installation's theme is resolved on the server and written into a `<style>` in
 * the root layout. A **personal** one cannot be: an httpOnly cookie is not
 * forwardable server-side (`AGENTS.md` § 5), so the server has no idea who is asking
 * before the page renders. So:
 *
 *   1. server `<style>`      — the installation default. The floor
 *   2. blocking inline script — reads this cache, applies it before first paint
 *   3. this hook             — reconciles against `/auth/me`, writes the cache back
 *
 * Without step 2 there is no way to know the user's theme before paint, so every
 * load would flash the installation's colours and then swap. That is why the cache
 * exists; it is not a round-trip saving.
 *
 * ## It costs no extra request in the common case
 *
 * `resolved_theme` already rides on `/auth/me`, which every authenticated page load
 * makes anyway. The preview call below happens only when the resolved theme differs
 * from what is cached — so on a normal load, nothing extra is fetched at all.
 *
 * ## Why the server derives the variables
 *
 * `core/theme.py` owns the derivation: the tints, the night border, the success
 * tone, the accent family, both chart ramps. Re-implementing that in TypeScript
 * would drift from the Python, and the symptom would be tints subtly wrong under
 * some themes only. So the client asks the server what a preset resolves to and
 * caches the answer.
 *
 * ## 🔴 Cleared on sign-out
 *
 * `localStorage` is per-origin, not per-user. Without an explicit clear, user A signs
 * out, user B signs in on the same browser, and B sees A's colours until hydration
 * finishes. Not a data leak — a preset key is not sensitive — but it looks exactly
 * like the bug where a page shows the wrong account's state, and it would be
 * reported as one. See `clearPersonalTheme`, called from the logout thunk.
 */

const KEY_STORE = "pmp.theme.key";
const VARS_STORE = "pmp.theme.vars";

/** Only well-formed `--name: n n n` pairs are ever applied. Mirrors `themeStyleRule`. */
const NAME = /^--[a-z-]+$/;
const CHANNELS = /^\d{1,3}( \d{1,3}){2}$/;

function apply(vars: Record<string, string>) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(vars)) {
    if (NAME.test(name) && CHANNELS.test(value)) root.style.setProperty(name, value);
  }
}

/** Drop the override and the cache. Called on sign-out. */
export function clearPersonalTheme() {
  try {
    const cached = localStorage.getItem(VARS_STORE);
    if (cached) {
      // Remove the properties rather than overwriting them, so the server-rendered
      // installation `<style>` becomes visible again instead of being shadowed by a
      // stale inline value.
      const root = document.documentElement;
      for (const name of Object.keys(JSON.parse(cached) as Record<string, string>)) {
        if (NAME.test(name)) root.style.removeProperty(name);
      }
    }
    localStorage.removeItem(KEY_STORE);
    localStorage.removeItem(VARS_STORE);
  } catch {
    // A blocked or full localStorage must not break signing out.
  }
}

export default function usePersonalTheme() {
  const user = useAppSelector((s) => s.auth.user);
  const resolved = user?.resolved_theme ?? null;

  useEffect(() => {
    if (!user) return;

    // `resolved_theme` is null when the installation runs a CUSTOM brand colour: no
    // preset key can name one. The server-rendered `<style>` is already correct in
    // that case, so drop any override and leave it alone.
    if (!resolved) {
      clearPersonalTheme();
      return;
    }

    let cancelled = false;
    try {
      if (localStorage.getItem(KEY_STORE) === resolved) return; // already applied
    } catch {
      // Unreadable storage: fall through and fetch. Worse performance, right colours.
    }

    settingsApi
      .previewTheme({ theme_preset: resolved })
      .then(({ data }) => {
        if (cancelled) return;
        const vars = data.css_variables ?? {};
        apply(vars);
        try {
          localStorage.setItem(KEY_STORE, resolved);
          localStorage.setItem(VARS_STORE, JSON.stringify(vars));
        } catch {
          // Applied for this page; simply not cached for the next one.
        }
      })
      .catch(() => {
        // A failed resolve leaves the installation default rendering, which is a
        // correct page in the wrong colour — never an unstyled one.
      });

    return () => {
      cancelled = true;
    };
  }, [user, resolved]);
}
