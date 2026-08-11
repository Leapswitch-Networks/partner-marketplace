"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

import Badge, { type BadgeTone } from "@/components/common/Badge";
import Button from "@/components/common/Button";
import { Card, CardContent, CardHeader } from "@/components/common/Card";
import ErrorState from "@/components/common/ErrorState";
import Skeleton from "@/components/common/Skeleton";
import { buttonClasses } from "@/components/common/Button";
import { navIcon } from "@/components/dashboard/navIcons";
import healthApi, { type SystemHealth } from "@/lib/api/healthApi";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * System Health (LeapDesk parity, Module 18).
 *
 * **Deliberately small.** The reference's own docblock sets the discipline —
 * *"queue and error detail live in their own modules, and this page links across
 * rather than restating them"* — and it is the rule that keeps this from becoming
 * a worse copy of Error Tracking. Every panel is a summary and, where there is
 * more to see, a link.
 *
 * Not a table, and not `ResourceIndex`: there are no rows to compare. This is the
 * dashboard shape, which `UI_PATTERNS.md` § The module CRUD contract allows
 * explicitly — *parity means the same vocabulary, not the same feature list.*
 *
 * ## Two panels report "not configured", and that is the feature
 *
 * A queue panel showing **0 pending / 0 failed** is indistinguishable from a
 * healthy queue and would be read as one. We run no worker at all, so it says so.
 * The same for provider reachability, which needs Module 7's credential chain: an
 * unchecked green tick is worse than an honest blank.
 */
export default function HealthModule() {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData((await healthApi.overview()).data);
    } catch (err) {
      setError(extractApiError(err, "Could not load system health."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Card bordered={false}>
        <CardHeader
          icon={navIcon("settings")}
          title="System Health"
          description="What the running system can say about itself. Detail lives in the module it belongs to."
          actions={
            <Button variant="outline" size="sm" onClick={load} loading={loading}>
              Refresh
            </Button>
          }
        />

        <CardContent>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            {loading && !data && (
              <div className="grid gap-3 md:grid-cols-2">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            )}

            {error && (
              <ErrorState
                error={new Error(error)}
                reset={load}
                title="Could not load system health"
                compact
              />
            )}

            {data && (
              <div className="grid items-start gap-3 md:grid-cols-2">
                <Panel
                  title="Database"
                  tone={data.database.reachable ? "success" : "danger"}
                  status={data.database.reachable ? "Reachable" : "Unreachable"}
                >
                  {data.database.reachable ? (
                    <>
                      <Row label="Version" value={`PostgreSQL ${data.database.version ?? "—"}`} />
                      <Row label="Size" value={data.database.size ?? "—"} />
                      {data.database.tables.length > 0 && (
                        <div className="mt-2 border-t border-brand/20 pt-2 dark:border-night-border">
                          <p className="mb-1 text-xs font-semibold text-ink dark:text-gray-200">
                            Largest watched tables
                          </p>
                          {data.database.tables.map((t) => (
                            <div
                              key={t.name}
                              className="flex items-baseline justify-between gap-2 py-0.5 text-xs"
                            >
                              <span className="truncate font-mono text-ink-label dark:text-night-muted">
                                {t.name}
                              </span>
                              <span className="shrink-0 tabular-nums text-ink dark:text-gray-200">
                                {t.size}
                                <span className="ml-1 opacity-60">~{t.rows.toLocaleString()}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-tone-danger">{data.database.error}</p>
                  )}
                </Panel>

                <Panel
                  title="Errors"
                  tone={data.errors.open > 0 ? "danger" : "success"}
                  status={data.errors.open > 0 ? `${data.errors.open} open` : "None open"}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(data.errors.counts).map(([status, n]) => (
                      <Badge key={status} tone="neutral">
                        {status}: {n}
                      </Badge>
                    ))}
                    {Object.keys(data.errors.counts).length === 0 && (
                      <p className="text-xs text-ink-label dark:text-night-muted">
                        Nothing recorded yet.
                      </p>
                    )}
                  </div>
                  {data.errors.latest && (
                    <p className="mt-2 truncate font-mono text-xs text-ink-label dark:text-night-muted">
                      Latest: {data.errors.latest.exception_class}
                    </p>
                  )}
                  {/* The link, not the list — see the docblock. */}
                  <Link
                    href="/dashboard/errors"
                    className={`${buttonClasses("outline")} mt-3 inline-flex`}
                  >
                    Open Error Tracking
                  </Link>
                </Panel>

                <Panel
                  title="Storage"
                  tone="info"
                  status={`${(data.storage.assets_bytes / 1024).toFixed(1)} KB`}
                >
                  {/* Said plainly rather than left to be inferred from a number
                      that does not match what a disk-usage panel would show. */}
                  <p className="mb-2 text-xs text-ink-label dark:text-night-muted">
                    Binary assets live in the database, not on a disk — there is no upload
                    directory to measure.
                  </p>
                  {data.storage.detail.map((d) => (
                    <Row key={d.name} label={d.name} value={`${(d.bytes / 1024).toFixed(1)} KB`} />
                  ))}
                </Panel>

                <Panel
                  title="Background work"
                  tone="warning"
                  status={data.queue.configured ? "Configured" : "Not configured"}
                >
                  <p className="text-xs text-ink-label dark:text-night-muted">
                    {data.queue.reason}
                  </p>
                </Panel>

                <Panel
                  title="Third-party providers"
                  tone="info"
                  status={`${data.providers.active} active`}
                >
                  <Row label="Configured" value={String(data.providers.total)} />
                  <Row label="Active" value={String(data.providers.active)} />
                  {!data.providers.probing_available && (
                    <p className="mt-2 text-xs text-ink-label dark:text-night-muted">
                      {data.providers.reason}
                    </p>
                  )}
                </Panel>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Panel({
  title,
  status,
  tone,
  children,
}: {
  title: string;
  status: string;
  tone: BadgeTone;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[5px] border border-brand/20 bg-white p-4 dark:border-night-border dark:bg-night-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink dark:text-white">{title}</h3>
        <Badge tone={tone}>{status}</Badge>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5 text-xs">
      <span className="text-ink-label dark:text-night-muted">{label}</span>
      <span className="tabular-nums text-ink dark:text-gray-200">{value}</span>
    </div>
  );
}
