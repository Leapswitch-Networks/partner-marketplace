"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Three states, matching LeapDesk's appearance tabs.
 *
 * `system` is not a third colour — it means "follow the OS and keep following it".
 * That is the part a two-state toggle cannot express: the old hook seeded itself
 * from `prefers-color-scheme` and then wrote a concrete value on first toggle, so
 * the OS was consulted once and never again.
 */
export type Appearance = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

/** What `system` currently resolves to. */
function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getStoredAppearance(): Appearance {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light" || stored === "system") return stored;
  // Anything else — including the absent key and the pre-3-way values this hook
  // used to write — falls back to following the OS.
  return "system";
}

function applyAppearance(appearance: Appearance): void {
  const dark = appearance === "dark" || (appearance === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const [appearance, setAppearance] = useState<Appearance>(getStoredAppearance);

  // Keep the DOM in sync with state — also covers SSR → client reconciliation,
  // where the server rendered without knowing the stored preference.
  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  // While on `system`, react to the OS flipping mid-session. Without this the
  // class is only recomputed on mount, so "System" would silently mean
  // "whatever the OS was when this tab opened".
  useEffect(() => {
    if (appearance !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearance("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [appearance]);

  const updateAppearance = useCallback((next: Appearance) => {
    localStorage.setItem(STORAGE_KEY, next);
    applyAppearance(next);
    setAppearance(next);
  }, []);

  /**
   * Two-state cycle for the nav-bar button, which has room for one icon.
   *
   * Deliberately resolves `system` before flipping, so the first press moves away
   * from whatever the user is actually looking at rather than appearing to do
   * nothing. Choosing `system` again is done from the appearance settings page.
   */
  const toggleTheme = useCallback(() => {
    const resolvedDark =
      appearance === "dark" || (appearance === "system" && systemPrefersDark());
    updateAppearance(resolvedDark ? "light" : "dark");
  }, [appearance, updateAppearance]);

  /** What is on screen right now — for icon choice and `aria-label`. */
  const resolvedTheme: "light" | "dark" =
    appearance === "system"
      ? typeof window !== "undefined" && systemPrefersDark()
        ? "dark"
        : "light"
      : appearance;

  return { appearance, resolvedTheme, updateAppearance, toggleTheme };
}
