"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for a failure in the root layout itself (PM-19).
 *
 * Two constraints make this file deliberately different from `app/error.tsx`,
 * and both are easy to get wrong:
 *
 * 1. **It must render its own `<html>` and `<body>`.** It replaces the root
 *    layout rather than rendering inside it, so if the layout is what broke,
 *    there is no document for this to attach to.
 * 2. **It cannot rely on anything the root layout sets up** — no `Providers`, no
 *    Redux store, no theme class, and no `next/font` variable. So the styling
 *    here is inline and self-contained on purpose; importing a component that
 *    reaches for the store would fail inside the error handler and produce the
 *    blank screen this exists to prevent.
 *
 * Colours are hardcoded for the same reason: `globals.css` may not have loaded.
 * `prefers-color-scheme` is used directly instead of the app's `.dark` class,
 * because the script that sets that class lives in the layout that just failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          background: "#ffffff",
          color: "#111827",
        }}
      >
        <div style={{ maxWidth: 480, padding: "0 24px", textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 16px",
              borderRadius: 16,
              background: "#fff7ed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              color: "#F97316",
            }}
            aria-hidden="true"
          >
            !
          </div>

          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            The application failed to start
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#6b7280", marginTop: 8 }}>
            Something went wrong before the page could load. Reloading may fix it. If it keeps
            happening, quote the reference below.
          </p>

          {error.digest && (
            <p
              style={{
                marginTop: 12,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 11,
                color: "#9ca3af",
              }}
            >
              Reference: {error.digest}
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#F97316",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload the application
          </button>
        </div>
      </body>
    </html>
  );
}
