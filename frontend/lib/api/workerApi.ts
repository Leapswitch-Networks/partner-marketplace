import axiosInstance from "./axiosInstance";

/**
 * Background jobs (LeapDesk parity Module 16, re-scoped).
 *
 * **Read-only, structurally.** The reference's Queue Monitor has retry, forget
 * and purge — all of which act on a backlog. There is none here: a job is due or
 * it is not, and a failed job runs again on its next interval. Buttons that call
 * nothing would be worse than no buttons.
 */

export interface JobRun {
  id: string;
  job: string;
  status: "succeeded" | "failed";
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  /** What the job reported doing. Its meaning comes from `unit`. */
  count: number;
  unit: string | null;
  /** Type and message only — never a traceback. */
  error: string | null;
}

export type JobHealth = "ok" | "failing" | "overdue" | "never_run" | "disabled";

export interface JobStatus {
  name: string;
  description: string;
  interval_seconds: number;
  enabled: boolean;
  unit: string;
  health: JobHealth;
  last_run: JobRun | null;
}

export interface WorkerSummary {
  jobs: number;
  enabled: number;
  unhealthy: number;
  never_run: number;
  runs_24h: number;
  failed_24h: number;
  last_seen_at: string | null;
  /** The one no per-job state can answer: is the worker process alive at all. */
  worker_seen_recently: boolean;
}

export const workerApi = {
  jobs: () =>
    axiosInstance.get<{ summary: WorkerSummary; jobs: JobStatus[] }>("/worker/jobs"),

  runs: (params: { job?: string; status?: string; limit?: number } = {}) =>
    axiosInstance.get<JobRun[]>("/worker/runs", { params }),
};
