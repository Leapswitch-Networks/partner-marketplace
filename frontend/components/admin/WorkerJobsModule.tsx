"use client";

import { useCallback, useEffect, useState } from "react";

import PageHeading from "@/components/common/PageHeading";
import Badge, { type BadgeTone } from "@/components/common/Badge";
import Button from "@/components/common/Button";
import { Card, CardContent } from "@/components/common/Card";
import StatTiles from "@/components/common/StatTiles";
import { navIcon } from "@/components/dashboard/navIcons";
import {
  workerApi,
  type JobHealth,
  type JobRun,
  type JobStatus,
  type WorkerSummary,
} from "@/lib/api/workerApi";
import { extractApiError } from "@/lib/utils/apiError";
import { formatDateTime } from "@/lib/utils/format";

/**
 * Background jobs — the re-scoped Module 16.
 *
 * **The banner is the screen.** Per-job health cannot answer the question that
 * actually matters, because every job reads `ok` on a stale last run if the
 * worker process died five minutes ago and nothing is due yet. "Is the worker
 * running at all" gets its own line at the top, in red when the answer is no.
 *
 * **There are no buttons.** The reference's Queue Monitor has retry, forget and
 * purge; all three act on a backlog, and there is none here — a due job runs, a
 * failed job runs again on its next interval, and nothing is queued to forget.
 * Controls wired to nothing would be worse than their absence.
 */

const HEALTH: Record<JobHealth, { label: string; tone: BadgeTone; hint: string }> = {
  ok: { label: "Healthy", tone: "success", hint: "Ran recently and succeeded." },
  failing: { label: "Failing", tone: "danger", hint: "Its last run raised." },
  overdue: {
    label: "Overdue",
    tone: "warning",
    hint: "Has not run in several times its own interval — usually the worker is not running.",
  },
  never_run: {
    label: "Never run",
    tone: "warning",
    hint: "No record of this job ever running. Has the worker been started?",
  },
  disabled: {
    label: "Disabled",
    tone: "neutral",
    hint: "Switched off deliberately. Run it by name when you want it.",
  },
};

function humaniseInterval(seconds: number): string {
  if (seconds < 60) return `every ${seconds}s`;
  if (seconds < 3600) return `every ${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `every ${Math.round(seconds / 3600)} h`;
  return `every ${Math.round(seconds / 86400)} day(s)`;
}

export default function WorkerJobsModule() {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [summary, setSummary] = useState<WorkerSummary | null>(null);
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Nothing is set synchronously in an effect body — `react-hooks/set-state-in-effect`
   * objects to that, and it is right: the fetch resolves later, so the state it
   * sets belongs in the callback rather than in the call.
   */
  const loadRuns = useCallback(
    (job: string | null, onlyFailures: boolean, live: () => boolean) =>
      workerApi
        .runs({
          ...(job ? { job } : {}),
          ...(onlyFailures ? { status: "failed" } : {}),
          limit: 50,
        })
        .then((res) => {
          if (live()) setRuns(res.data);
        })
        .catch(() => {
          // The job table above is the important half; a failed history fetch
          // must not blank the page.
        }),
    []
  );

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await workerApi.jobs();
        if (live) {
          setJobs(res.data.jobs);
          setSummary(res.data.summary);
        }
      } catch (err) {
        if (live) setError(extractApiError(err, "Could not load the background jobs."));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void loadRuns(selected, failuresOnly, () => alive);
    return () => {
      alive = false;
    };
  }, [selected, failuresOnly, loadRuns]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <PageHeading
          icon={navIcon("worker")}
          title="Background Jobs"
          description="What runs on a timer, when it last ran, and whether it worked"
        />
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
        >
          {error}
        </div>
      )}

      {summary && !summary.worker_seen_recently && (
        <div
          role="alert"
          className="rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
        >
          <p className="font-semibold">The worker does not appear to be running.</p>
          <p className="mt-0.5">
            {summary.last_seen_at
              ? `Nothing has run since ${formatDateTime(summary.last_seen_at)}.`
              : "No job has ever run."}{" "}
            Webhook retries and every retention sweep are stopped until it is started —
            see the README, <span className="font-mono">python -m app.worker</span>.
          </p>
        </div>
      )}

      {/* Tones track the actual state rather than the label: a page whose banner
          says the worker is down should not print `Unhealthy 4` in the same ink
          as `Jobs 5`. Zero is not a problem, so each tone is conditional — a
          permanently red tile is a badge that can never clear, which this
          codebase has already decided is worse than no badge. */}
      {summary && (
        <StatTiles
          items={[
            { label: "Jobs", value: summary.jobs, hint: `${summary.enabled} enabled` },
            {
              label: "Unhealthy",
              value: summary.unhealthy,
              tone: summary.unhealthy > 0 ? "danger" : "success",
              hint: "failing or overdue",
            },
            { label: "Runs, 24h", value: summary.runs_24h, hint: "across every job" },
            {
              label: "Failures, 24h",
              value: summary.failed_24h,
              tone: summary.failed_24h > 0 ? "warning" : "success",
              hint: "runs that raised",
            },
            {
              label: "Last activity",
              value: summary.last_seen_at ? formatDateTime(summary.last_seen_at) : "—",
              tone: summary.worker_seen_recently ? "success" : "danger",
              hint: summary.worker_seen_recently ? "worker is alive" : "worker looks stopped",
              // A timestamp, not a figure — at display size it sets the row's
              // column width on its own and still wraps.
              textual: true,
            },
          ]}
        />
      )}

      <Card>
        <CardContent>
          <h2 className="pt-1 text-sm font-semibold text-ink dark:text-gray-100">The schedule</h2>
          {loading ? (
            <p className="py-4 text-center text-xs text-ink-label dark:text-night-muted">
              Loading…
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5 py-2">
              {jobs.map((job) => {
                const health = HEALTH[job.health];
                return (
                  <li
                    key={job.name}
                    className={`cursor-pointer rounded-[5px] px-2.5 py-2 transition-colors hover:bg-brand/10 ${
                      selected === job.name ? "bg-brand/10" : "bg-surface-tile dark:bg-night-body"
                    }`}
                    onClick={() => setSelected(selected === job.name ? null : job.name)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Badge tone={health.tone}>{health.label}</Badge>
                        <span className="font-mono text-xs text-ink dark:text-gray-200">
                          {job.name}
                        </span>
                        <span className="text-[11px] text-ink-label dark:text-night-muted">
                          {humaniseInterval(job.interval_seconds)}
                        </span>
                      </span>
                      <span className="text-[11px] text-ink-label dark:text-night-muted">
                        {job.last_run
                          ? `${formatDateTime(job.last_run.started_at)} · ${job.last_run.count} ${job.unit} · ${job.last_run.duration_ms ?? "—"} ms`
                          : "never run"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-label dark:text-night-muted">
                      {job.description}
                    </p>
                    {job.health !== "ok" && (
                      <p className="mt-0.5 text-[11px] font-medium text-ink dark:text-gray-300">
                        {health.hint}
                      </p>
                    )}
                    {job.last_run?.error && (
                      <pre className="mt-1 overflow-auto rounded-[4px] bg-white/60 p-2 font-mono text-[10px] text-tone-danger dark:bg-black/20">
                        {job.last_run.error}
                      </pre>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <h2 className="text-sm font-semibold text-ink dark:text-gray-100">
              Recent runs
              {selected && (
                <span className="font-normal text-ink-label dark:text-night-muted">
                  {" "}
                  — {selected}
                </span>
              )}
            </h2>
            <span className="flex items-center gap-2">
              {selected && (
                <Button variant="outline" onClick={() => setSelected(null)}>
                  All jobs
                </Button>
              )}
              <label className="flex items-center gap-1.5 text-xs text-ink dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={failuresOnly}
                  onChange={(event) => setFailuresOnly(event.target.checked)}
                  className="h-3.5 w-3.5 accent-brand"
                />
                Failures only
              </label>
            </span>
          </div>

          {runs.length === 0 ? (
            <p className="py-4 text-center text-xs text-ink-label dark:text-night-muted">
              {failuresOnly ? "No failures recorded." : "No runs recorded yet."}
            </p>
          ) : (
            <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto py-2">
              {runs.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap items-baseline gap-2 rounded-[5px] px-1.5 py-1 text-xs hover:bg-brand/10"
                >
                  <Badge tone={run.status === "succeeded" ? "success" : "danger"}>
                    {run.status}
                  </Badge>
                  <span className="font-mono text-ink dark:text-gray-200">{run.job}</span>
                  <span className="text-ink-label dark:text-night-muted">
                    {formatDateTime(run.started_at)} · {run.count} {run.unit ?? ""} ·{" "}
                    {run.duration_ms ?? "—"} ms
                  </span>
                  {run.error && (
                    <span className="w-full font-mono text-[10px] text-tone-danger">
                      {run.error}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-ink-label dark:text-night-muted">
        There is nothing to retry or purge here, and that is deliberate: this is a worker, not a
        queue. A job that is due runs; a job that failed runs again on its next interval. The
        reference&apos;s retry and purge controls all act on a backlog that does not exist.
      </p>
    </div>
  );
}
