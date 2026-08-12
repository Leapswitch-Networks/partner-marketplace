"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import { Card, CardContent } from "@/components/common/Card";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import Toast, { useToast } from "@/components/common/Toast";
import { navIcon } from "@/components/dashboard/navIcons";
import { aiApi, type AssistantSettings } from "@/lib/api/aiApi";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * The AI Assistant settings screen.
 *
 * **One switch, and everything a person needs to decide whether to flip it.**
 * The reference's screen is the switch alone; this adds the three facts that
 * determine what the switch actually turns on — which model will answer, which
 * tools the assistant holds, and which read-only control is protecting the
 * database. All three are read from the running system, not described.
 *
 * Not a `ResourceIndex`: there is no list here. The shared index shell is the
 * contract for tables of records, and forcing a single toggle into it would mean
 * a table with one row and no columns.
 */

/** Read off the API rather than hardcoded, so a renamed tool cannot go stale. */
const TOOL_COPY: Record<string, { label: string; detail: string }> = {
  describe_schema: {
    label: "Discover the schema",
    detail: "List readable tables and their columns. Secret tables are invisible.",
  },
  database_query: {
    label: "Read the database",
    detail: "Filtered, capped, read-only queries. Secret columns come back redacted.",
  },
  locate_data: {
    label: "Locate a record",
    detail: "Runs Global Search, so results carry its permission and row scoping.",
  },
};

export default function AiAssistantModule() {
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const { toasts, show, dismiss } = useToast();

  /**
   * Nothing is set synchronously in the effect body — `setLoading(true)` used to
   * be the first line and that is exactly what `react-hooks/set-state-in-effect`
   * objects to. `loading` starts true instead, which is also what it means.
   */
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await aiApi.settings();
        if (live) setSettings(res.data);
      } catch (err) {
        if (live) setError(extractApiError(err, "Could not load the assistant settings."));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  /**
   * Returns the promise rather than catching it. `ConfirmDialog` owns the busy
   * state and keeps itself open on a rejection, showing the reason — and the
   * reason here is the one that matters: "add an Anthropic API key first".
   * Swallowing it would leave the dialog closing on a change that never happened.
   */
  const toggle = async () => {
    if (!settings) return;
    const res = await aiApi.setEnabled(!settings.enabled);
    setSettings(res.data);
    show(
      res.data.enabled
        ? "The assistant is on. It appears for everyone who holds ai-assistant-use."
        : "The assistant is off and the widget is hidden.",
      "success"
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 text-brand dark:text-brand-on-dark">{navIcon("ai")}</span>
        <div>
          <h1 className="text-lg font-semibold text-ink dark:text-gray-100">AI Assistant</h1>
          <p className="text-xs text-ink-label dark:text-night-muted">
            An internal assistant that answers from this application&apos;s own data
          </p>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
        >
          {error}
        </div>
      )}

      {loading && !settings ? (
        <Card>
          <CardContent>
            <p className="py-6 text-center text-xs text-ink-label dark:text-night-muted">
              Loading…
            </p>
          </CardContent>
        </Card>
      ) : settings ? (
        <>
          <Card>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-3 py-1">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-gray-100">
                    {settings.available ? "The assistant is on" : "The assistant is off"}
                    <Badge tone={settings.available ? "success" : "neutral"}>
                      {settings.available ? "Live" : "Disabled"}
                    </Badge>
                  </p>
                  <p className="mt-1 text-xs text-ink-label dark:text-night-muted">
                    {settings.has_api_key ? (
                      <>
                        Answering with <span className="font-mono">{settings.model}</span>. Change
                        the model on the Anthropic credential — no deploy needed.
                      </>
                    ) : (
                      <>
                        No Anthropic API key is stored, so this cannot be switched on yet.{" "}
                        <Link
                          href="/dashboard/api-credentials"
                          className="font-semibold text-brand hover:underline dark:text-brand-on-dark"
                        >
                          Add one in API Credentials
                        </Link>
                        .
                      </>
                    )}
                  </p>
                </div>
                <Button
                  variant={settings.enabled ? "outline" : "primary"}
                  onClick={() => setConfirming(true)}
                  disabled={!settings.has_api_key && !settings.enabled}
                >
                  {settings.enabled ? "Turn off" : "Turn on"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h2 className="pt-1 text-sm font-semibold text-ink dark:text-gray-100">
                What it can do for you
              </h2>
              <p className="mb-2 mt-0.5 text-xs text-ink-label dark:text-night-muted">
                Tools are granted per role. A tool your role does not hold is never described to
                the model, so it cannot be asked for or talked around.
              </p>
              <ul className="flex flex-col gap-1.5 pb-2">
                {settings.tools.map((tool) => {
                  const copy = TOOL_COPY[tool];
                  return (
                    <li
                      key={tool}
                      className="rounded-[5px] bg-surface-tile px-3 py-2 dark:bg-night-body"
                    >
                      <p className="text-xs font-semibold text-ink dark:text-gray-200">
                        {copy?.label ?? tool}
                      </p>
                      <p className="text-[11px] text-ink-label dark:text-night-muted">
                        {copy?.detail ?? "No description registered for this tool."}
                      </p>
                    </li>
                  );
                })}
                {settings.tools.length === 0 && (
                  <li className="text-xs text-ink-label dark:text-night-muted">
                    Your role holds none of the assistant&apos;s tools.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h2 className="pt-1 text-sm font-semibold text-ink dark:text-gray-100">
                How the database is protected
              </h2>
              <dl className="flex flex-col gap-2 py-2 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <dt className="font-semibold text-ink dark:text-gray-200">
                      Writes are refused by the database
                    </dt>
                    <dd className="text-[11px] text-ink-label dark:text-night-muted">
                      Checked on this request by attempting one — not asserted.
                    </dd>
                  </div>
                  <Badge tone={settings.readonly_guard_holds ? "success" : "danger"}>
                    {settings.readonly_guard_holds ? "Holding" : "NOT HOLDING"}
                  </Badge>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <dt className="font-semibold text-ink dark:text-gray-200">
                      Dedicated read-only database role
                    </dt>
                    <dd className="text-[11px] text-ink-label dark:text-night-muted">
                      {settings.readonly_dedicated_role
                        ? "A SELECT-only role is configured — the strongest form of this control."
                        : "Not configured. The connection is read-only for the session, which the database enforces, but it uses the application's own role. A separate SELECT-only role needs an environment change."}
                    </dd>
                  </div>
                  <Badge tone={settings.readonly_dedicated_role ? "success" : "warning"}>
                    {settings.readonly_dedicated_role ? "Configured" : "Session guard only"}
                  </Badge>
                </div>
              </dl>
              <p className="pb-1 text-[11px] text-ink-label dark:text-night-muted">
                Credential, session and password tables are invisible to the assistant, secret
                columns are redacted before any row leaves the database, and every reply is passed
                through a final check for anything shaped like a key.
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}

      {confirming && settings && (
        <ConfirmDialog
          title={settings.enabled ? "Turn the assistant off" : "Turn the assistant on"}
          confirmLabel={settings.enabled ? "Turn off" : "Turn on"}
          busyLabel={settings.enabled ? "Turning off…" : "Turning on…"}
          tone={settings.enabled ? "danger" : "primary"}
          errorFallback="Could not change the setting."
          onConfirm={toggle}
          onConfirmed={() => setConfirming(false)}
          onClose={() => setConfirming(false)}
        >
          {settings.enabled ? (
            <p>
              The widget disappears for everyone and no new questions are accepted. Saved
              conversations are kept.
            </p>
          ) : (
            <p>
              Everyone holding <span className="font-mono">ai-assistant-use</span> will see the
              widget. Each question is a paid request to Anthropic, and only roles holding{" "}
              <span className="font-mono">ai-assistant-query-database</span> can have it read
              records.
            </p>
          )}
        </ConfirmDialog>
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
