"""Which tables are bounded, and by how much.

`core/retention.py` is the engine and names no table; this is the list. Split
that way for the same reason `scoping.py` and `core/registry.py` are: a second
project keeps the engine and writes its own list.

## The six tables here, and the three that had nothing before today

| Table | Had an age purge? | Had a size cap? |
|---|---|---|
| `activity_log` | yes | **no** — and still does not; see below |
| `api_request_logs` | yes | **no** |
| `worker_job_runs` | yes | **no** |
| `webhook_deliveries` | **no** | **no** |
| `error_occurrences` | **no** | **no** |
| `search_logs` | **no** | **no** |

The bottom three grew forever with nothing to stop them. `webhook_deliveries`
gets a row per attempt and a failing receiver is retried; `error_occurrences`
gets one per raised error, so an incident is a burst; `search_logs` gets one per
search. None of them had a purge function at all — not a disabled one, not an
unwired one. Found while adding the caps, 2026-08-17.

## What is deliberately NOT capped

**`error_groups`** — the triage surface, one row per distinct error rather than
per occurrence, so it is small and losing it would lose the thing you actually
read. Only the occurrences underneath it are trimmed.

**`user_sessions`** — already bounded by expiry, and the worker's
`expired-sessions` job removes them 30 days after they stop working. A row cap
there would delete *live* sessions on a busy day, signing people out.

**`agent_conversation_messages`** — AI assistant threads are user-owned content
that a user can see and delete, not telemetry. Trimming somebody's conversation
under them is a product decision, not housekeeping.
"""

from __future__ import annotations

from app.core.config import settings
from app.core.retention import RetentionPolicy, register_policy
from app.models.activity_log import ActivityLog
from app.models.api_consumer import ApiRequestLog
from app.models.error_group import ErrorOccurrence
from app.models.searchable_entity import SearchLog
from app.models.webhook import WebhookDelivery
from app.models.worker_run import WorkerJobRun

register_policy(
    RetentionPolicy(
        name="api-request-logs",
        model=ApiRequestLog,
        timestamp_column=ApiRequestLog.created_at,
        max_age_days=settings.API_REQUEST_LOG_RETENTION_DAYS,
        max_rows=settings.API_REQUEST_LOG_MAX_ROWS,
        description="Platform API traffic. Grows fastest when an integration is failing.",
    )
)

register_policy(
    RetentionPolicy(
        name="webhook-deliveries",
        model=WebhookDelivery,
        timestamp_column=WebhookDelivery.created_at,
        max_age_days=settings.WEBHOOK_DELIVERY_RETENTION_DAYS,
        max_rows=settings.WEBHOOK_DELIVERY_MAX_ROWS,
        description="One row per delivery attempt. A refusing receiver is retried.",
    )
)

register_policy(
    RetentionPolicy(
        name="error-occurrences",
        model=ErrorOccurrence,
        # `occurred_at`, not `created_at`: when the error HAPPENED, which is what
        # a retention window is about. The two differ when a batch of errors is
        # recorded late, and trimming by write time would keep the wrong ones.
        timestamp_column=ErrorOccurrence.occurred_at,
        max_age_days=settings.ERROR_OCCURRENCE_RETENTION_DAYS,
        max_rows=settings.ERROR_OCCURRENCE_MAX_ROWS,
        description="Individual error events. The GROUPS above them are never trimmed.",
    )
)

register_policy(
    RetentionPolicy(
        name="search-logs",
        model=SearchLog,
        timestamp_column=SearchLog.created_at,
        max_age_days=settings.SEARCH_LOG_RETENTION_DAYS,
        max_rows=settings.SEARCH_LOG_MAX_ROWS,
        description="What people searched for. Useful recent, worthless at 18 months.",
    )
)

register_policy(
    RetentionPolicy(
        name="worker-runs",
        model=WorkerJobRun,
        timestamp_column=WorkerJobRun.created_at,
        max_age_days=settings.WORKER_RUN_RETENTION_DAYS,
        max_rows=settings.WORKER_RUN_MAX_ROWS,
        description="This worker's own history. The monitoring table needs bounding too.",
    )
)

#: **Last, and different.** The audit trail is evidence rather than telemetry, so
#: its row cap ships as `0` — see the comment on `ACTIVITY_LOG_MAX_ROWS`. It is
#: registered anyway so it appears in `--list` and `--status` alongside the
#: others: a table governed by a policy of "keep everything for two years" should
#: be visible as a governed table, not absent from the list as if nobody thought
#: about it.
register_policy(
    RetentionPolicy(
        name="activity-log",
        model=ActivityLog,
        timestamp_column=ActivityLog.created_at,
        max_age_days=settings.ACTIVITY_LOG_RETENTION_DAYS,
        max_rows=settings.ACTIVITY_LOG_MAX_ROWS,
        description="Audit trail. Row cap OFF by default — this is evidence, not telemetry.",
        # Never swept automatically. Trimming it must be an instruction — run
        # `python -m app.db.maintenance --retention activity-log`, or pass
        # `--job retention --include-opt-in` to the worker.
        requires_opt_in=True,
    )
)
