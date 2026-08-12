"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Badge from "@/components/common/Badge";
import { Card, CardContent, CardHeader } from "@/components/common/Card";
import ErrorState from "@/components/common/ErrorState";
import Skeleton from "@/components/common/Skeleton";
import Toast, { useToast } from "@/components/common/Toast";
import SettingRowEditor from "@/components/admin/SettingRowEditor";
import { navIcon } from "@/components/dashboard/navIcons";
import securityApi, { type SecurityAuditRow } from "@/lib/api/securityApi";
import type { Setting } from "@/lib/api/configurationApi";
import { extractApiError } from "@/lib/utils/apiError";
import { formatDateTime } from "@/lib/utils/format";

/**
 * Security — the hardening controls (LeapDesk parity, Module 12).
 *
 * A tab per setting group, plus a **Recent activity** tab showing the `auth` and
 * `settings` log channels — who signed in, and who changed how signing in works.
 *
 * The row editor is `SettingRowEditor`, shared with Configuration: the two
 * screens edit the same table through two endpoints, so the editor is the same
 * editor. Only the `save` differs, and it differs because the endpoints enforce
 * different namespaces.
 *
 * ## The reference has a bug here, and it is not copied
 *
 * LeapDesk builds its tab list as `[...groupNames, 'Audit']` — and one of its
 * groups **is** called `Audit`. So the list contains "Audit" twice with the same
 * React key, and the render branches on `tab === 'Audit'` to the activity panel.
 * **Its two `security.audit.*` settings are unreachable**: there is no tab that
 * shows them.
 *
 * Our activity tab is called **Recent activity**, which cannot collide with a
 * group name, so the Audit group stays reachable. Registered as a divergence in
 * `LEAPDESK_PARITY_PLAN.md`'s "where LeapDesk's behaviour is a defect" category.
 */

/** Not "Audit" — see the docblock. The one name that must not be a group name. */
const ACTIVITY_TAB = "Recent activity";

export default function SecurityModule() {
  const { toasts, show, dismiss } = useToast();

  const [items, setItems] = useState<Setting[]>([]);
  const [audit, setAudit] = useState<SecurityAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await securityApi.overview();
      setItems(res.data.items);
      setAudit(res.data.audit);
    } catch (err) {
      setError(extractApiError(err, "Could not load security settings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Handed to a callback rather than called in the body. `load` sets state,
    // and calling it directly here runs those updates inside the effect's own
    // synchronous phase — a second render pass for values React could have had
    // in the first, which is what `react-hooks/set-state-in-effect` is for. One
    // microtask's remove makes them ordinary updates, and nothing else changes:
    // the fetch still starts on mount and the retry path still calls `load`.
    void Promise.resolve().then(load);
  }, [load]);

  const patch = useCallback((next: Setting) => {
    setItems((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    // The audit panel is a snapshot taken with the controls, so a change made on
    // this screen is not in it. Refetching the whole overview after every toggle
    // would fight the row editor's own optimistic update; instead the panel is
    // honest about being a point-in-time read — see its footnote.
  }, []);

  /** Groups in the server's order — `group → label` is already sorted. */
  const groups = useMemo(() => {
    const out = new Map<string, Setting[]>();
    for (const row of items) {
      const bucket = out.get(row.group);
      if (bucket) bucket.push(row);
      else out.set(row.group, [row]);
    }
    return out;
  }, [items]);

  const tabs = useMemo(() => [...groups.keys(), ACTIVITY_TAB], [groups]);
  const active = tab && tabs.includes(tab) ? tab : tabs[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Card bordered={false}>
        <CardHeader
          icon={navIcon("settings")}
          title="Security"
          description="Every control ships at today's behaviour. Tightening one is a deliberate change — read the note under each before switching it on."
        />

        <CardContent>
          {loading && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {!loading && error && (
            <ErrorState
              error={new Error(error)}
              reset={load}
              title="Could not load security settings"
              compact
            />
          )}

          {!loading && !error && (
            <>
              <div className="flex shrink-0 flex-wrap gap-1 border-b border-brand/20 dark:border-night-border">
                {tabs.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setTab(name)}
                    className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40
                      ${
                        active === name
                          ? "border-brand text-ink dark:border-brand-on-dark dark:text-white"
                          : "border-transparent text-ink-label hover:border-brand/30 hover:text-brand dark:text-night-muted dark:hover:text-brand-on-dark"
                      }`}
                  >
                    {name}
                    {name === ACTIVITY_TAB && audit.length > 0 && (
                      <span className="ml-1.5 tabular-nums opacity-60">{audit.length}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pt-4">
                {active === ACTIVITY_TAB ? (
                  <AuditPanel rows={audit} />
                ) : (
                  <div className="flex flex-col gap-3">
                    {(groups.get(active ?? "") ?? []).map((setting) => (
                      <SettingRowEditor
                        key={setting.id}
                        setting={setting}
                        save={async (id, value) => (await securityApi.update(id, value)).data}
                        onSaved={patch}
                        onError={(message) => show(message, "error")}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

/**
 * Recent security-relevant activity.
 *
 * A fixed window, not a paged list. This answers "what has happened lately"; the
 * Activity Log answers "what happened", has filters and a date range, and is
 * where anyone needing to go further back belongs. Saying so in the footnote is
 * cheaper than growing a second Activity Log here.
 */
function AuditPanel({ rows }: { rows: SecurityAuditRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-ink-label dark:text-night-muted">
        Nothing recorded yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-baseline justify-between gap-2 rounded-[5px] border border-brand/20 px-3 py-2 dark:border-night-border"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink dark:text-gray-200">{row.description}</p>
            <p className="mt-0.5 text-xs text-ink-label dark:text-night-muted">
              {/* "system" and "deleted user" are values the API sends rather than
                  blanks, because "no human did this" and "the human is gone" are
                  different facts and an empty cell states neither. */}
              {row.causer}
              {row.event && ` · ${row.event}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={row.log_name === "auth" ? "info" : "neutral"}>{row.log_name}</Badge>
            <span className="whitespace-nowrap tabular-nums text-xs text-ink-label dark:text-night-muted">
              {formatDateTime(row.created_at)}
            </span>
          </div>
        </div>
      ))}

      <p className="mt-2 text-center text-xs text-ink-label dark:text-night-muted">
        The {rows.length} most recent entries, as of page load. The full trail is in the Activity Log.
      </p>
    </div>
  );
}
