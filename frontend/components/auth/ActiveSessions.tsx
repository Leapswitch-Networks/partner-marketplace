"use client";

import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import { authApi, type SessionInfo } from "@/lib/api/authApi";
import { formatDate } from "@/lib/utils/format";

/**
 * "Where am I signed in" — the user's own live sessions, with a way to end them.
 *
 * LeapDesk has no equivalent: Laravel's session table makes it possible but
 * Fortify does not expose it, so this is parity-plus rather than a port.
 *
 * **No password confirmation on any action here, deliberately.** Signing a device
 * out is defensive; friction in front of "I don't recognise this login" is how
 * people give up on acting on it. The confirmation gate exists for *weakening*
 * security — disabling 2FA — not for strengthening it.
 */

/** `Mozilla/5.0 (Macintosh…) Chrome/…` → `Chrome on macOS`. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const browser =
    // Order matters: Edge and Opera both contain "Chrome", and Chrome contains
    // "Safari". Most specific first, or everything reads as Chrome.
    /Edg\//.test(userAgent) ? "Edge"
    : /OPR\//.test(userAgent) ? "Opera"
    : /Chrome\//.test(userAgent) ? "Chrome"
    : /Firefox\//.test(userAgent) ? "Firefox"
    : /Safari\//.test(userAgent) ? "Safari"
    : /curl\//.test(userAgent) ? "curl"
    : "Unknown browser";

  const os =
    /Windows/.test(userAgent) ? "Windows"
    : /Macintosh|Mac OS X/.test(userAgent) ? "macOS"
    : /Android/.test(userAgent) ? "Android"
    : /iPhone|iPad|iOS/.test(userAgent) ? "iOS"
    : /Linux/.test(userAgent) ? "Linux"
    : null;

  return os ? `${browser} on ${os}` : browser;
}

function relative(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function ActiveSessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (isLive: () => boolean = () => true) => {
    try {
      const res = await authApi.listSessions();
      if (isLive()) setSessions(res.data);
    } catch {
      if (isLive()) setError("Could not load your sessions.");
    } finally {
      if (isLive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let live = true;
    void load(() => live);
    return () => {
      live = false;
    };
  }, [load]);

  const revokeOne = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await authApi.revokeSession(id);
      await load();
    } catch {
      setError("Could not sign that device out.");
    } finally {
      setBusy(null);
    }
  };

  const revokeOthers = async () => {
    setBusy("others");
    setError(null);
    try {
      await authApi.revokeOtherSessions();
      await load();
    } catch {
      setError("Could not sign the other devices out.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Loading sessions…</p>;
  }

  const others = sessions.filter((s) => !s.is_current).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Where you&apos;re signed in
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            End any session you don&apos;t recognise. Signing out a device makes its
            saved login stop working immediately.
          </p>
        </div>
        {others > 0 && (
          <Button
            variant="outline"
            onClick={revokeOthers}
            loading={busy === "others"}
          >
            Sign out {others} other{others === 1 ? "" : "s"}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-tone-danger">
          {error}
        </p>
      )}

      <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {sessions.map((session) => (
          <li key={session.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                {/* user_agent is untrusted, self-reported text. Rendered as text —
                    React escapes it — and only ever used for display. */}
                <span className="truncate">{describeDevice(session.user_agent)}</span>
                {session.is_current && <Badge tone="success">This device</Badge>}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                {session.ip_address ?? "unknown address"} · active{" "}
                {relative(session.last_seen_at)} · signed in{" "}
                {formatDate(session.created_at)}
              </p>
            </div>

            {/* No sign-out on the current session: it would log the user out of the
                page they are looking at with no explanation. "Sign out" in the nav
                is the deliberate way to do that. */}
            {!session.is_current && (
              <Button
                variant="outline"
                onClick={() => void revokeOne(session.id)}
                loading={busy === session.id}
                className="shrink-0 !px-3 !py-1.5 text-xs"
              >
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>

      {sessions.length === 1 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          This is your only active session.
        </p>
      )}
    </div>
  );
}
