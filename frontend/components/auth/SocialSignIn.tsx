"use client";

import { useState } from "react";
import { authApi } from "@/lib/api/authApi";

/**
 * Viho's "Sign in with" divider and social tile row.
 *
 * **Deliberately one tile, not Viho's four.** The theme shows LinkedIn, Twitter,
 * Facebook and Instagram; we have exactly one federated provider, and rendering
 * four buttons that cannot sign anyone in would be fidelity to the picture at the
 * cost of fidelity to the product. Google gets Viho's tile treatment instead.
 *
 * This is also the first UI to reach `authApi.googleAuthorizeUrl` — the endpoint
 * has existed with no button anywhere in the app.
 *
 * The divider is a 1px rule with the caption sitting on an opaque background to
 * punch a hole through it. Viho hardcodes `#fff` there, which is exactly why its
 * own divider breaks in dark mode; ours takes the card colour in both themes.
 */
export default function SocialSignIn({ invitation }: { invitation?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startGoogle = async () => {
    setError(null);
    setPending(true);
    try {
      const res = await authApi.googleAuthorizeUrl(invitation);
      // Full-page navigation, not an XHR — Google blocks cross-origin AJAX on
      // the consent screen. Not resetting `pending`: the browser is leaving.
      window.location.href = res.data.authorization_url;
    } catch {
      setError("Could not start Google sign-in. Try again.");
      setPending(false);
    }
  };

  return (
    <div className="mb-[30px] flex flex-col items-center">
      <div className="relative my-[30px] w-full text-center">
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-ink-muted/40 dark:bg-night-muted/30"
        />
        <span className="relative inline-block bg-white px-3 text-base font-semibold text-ink-muted dark:bg-night-card dark:text-night-muted">
          Sign in with
        </span>
      </div>

      <button
        type="button"
        onClick={startGoogle}
        disabled={pending}
        aria-label="Sign in with Google"
        title="Sign in with Google"
        className="flex h-[35px] w-[35px] items-center justify-center rounded-[5px] bg-brand/[.08] text-brand dark:text-brand-on-dark transition-colors hover:bg-brand hover:text-white focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand/20"
      >
        {pending ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.344-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" />
          </svg>
        )}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-xs text-tone-danger">
          {error}
        </p>
      )}
    </div>
  );
}
