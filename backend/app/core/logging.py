"""Structured logging and request correlation (TECH_DEBT PM-10).

Before this, the backend logged nothing. An unhandled exception became a bare
500 with a traceback on stdout and no way to tie it to the request that caused
it — so in a deployed environment it was effectively invisible, which is what
PM-10 recorded.

Three pieces, and they only work together:

  * ``configure_logging()`` installs one handler on the root logger, formatting
    either for a human (``console``) or for a log aggregator (``json``).
  * ``RequestContextMiddleware`` assigns every request an id, puts it in a
    ``ContextVar``, and echoes it back in a response header.
  * ``RequestIdFilter`` copies that id onto every log record, so a line emitted
    deep inside a service is attributable without threading an id through every
    function signature.

**What is deliberately never logged: request bodies.** Login, registration,
password change and reset all carry a plaintext password in the body. Logging
bodies "for debugging" would undo bcrypt by writing the passwords to disk in
cleartext — the exact defect PM-1 existed to fix. Query strings are logged
because the API takes no secrets there; if that ever changes, this comment is
the reason to revisit.

This is logging, not monitoring. Nothing here alerts anyone. Shipping these
lines somewhere that pages a human is a deployment concern and is still open —
see PM-10 in the register.
"""

from __future__ import annotations

import json
import logging
import re
import sys
import time
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings

#: Correlation id for the request being handled, or "-" outside a request.
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

#: An inbound request id is client-controlled, so it is constrained before use.
#: Without this, a newline in the header would let a caller forge log lines in
#: console format, and an unbounded value would bloat every record.
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

#: Attributes present on every LogRecord. Anything else a caller attaches via
#: `extra=` is emitted as a field, which is how request logs carry status and
#: duration without a bespoke formatter per call site.
_STANDARD_RECORD_KEYS = frozenset(
    {
        "args", "asctime", "created", "exc_info", "exc_text", "filename",
        "funcName", "levelname", "levelno", "lineno", "module", "msecs",
        "message", "msg", "name", "pathname", "process", "processName",
        "relativeCreated", "stack_info", "thread", "threadName", "taskName",
        "request_id",
        # Uvicorn attaches an ANSI-coloured duplicate of its own message. Emitting
        # it appends raw escape codes to every startup line.
        "color_message",
    }
)


class RequestIdFilter(logging.Filter):
    """Attach the current request id to every record.

    A filter rather than a formatter concern: the id must be present whichever
    format is configured, and `logging` offers no other hook that runs for every
    record regardless of handler.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True


class JsonFormatter(logging.Formatter):
    """One JSON object per line, for aggregators that parse rather than grep."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        for key, value in record.__dict__.items():
            if key not in _STANDARD_RECORD_KEYS and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class ConsoleFormatter(logging.Formatter):
    """Human-readable single line, for local development."""

    def __init__(self) -> None:
        super().__init__(
            fmt="%(asctime)s %(levelname)-8s [%(request_id)s] %(name)s: %(message)s",
            datefmt="%H:%M:%S",
        )

    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        extras = {
            key: value
            for key, value in record.__dict__.items()
            if key not in _STANDARD_RECORD_KEYS and not key.startswith("_")
        }
        if extras:
            base += " | " + " ".join(f"{k}={v}" for k, v in extras.items())
        return base


def configure_logging() -> None:
    """Install the single root handler. Idempotent — safe under `--reload`."""
    root = logging.getLogger()
    root.setLevel(settings.LOG_LEVEL.upper())

    for existing in list(root.handlers):
        root.removeHandler(existing)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        JsonFormatter() if settings.LOG_FORMAT.lower() == "json" else ConsoleFormatter()
    )
    handler.addFilter(RequestIdFilter())
    root.addHandler(handler)

    # Uvicorn installs its own handlers, which would duplicate every line and
    # bypass the request-id filter. Let them propagate to root instead.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        logger.handlers.clear()
        logger.propagate = True

    # SQLAlchemy's INFO level is every statement it executes. Useful when
    # deliberately enabled, far too noisy as a side effect of LOG_LEVEL=INFO.
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def _resolve_request_id(request: Request) -> str:
    inbound = request.headers.get(settings.LOG_REQUEST_ID_HEADER)
    if inbound and _SAFE_REQUEST_ID.match(inbound):
        return inbound
    return uuid.uuid4().hex[:16]


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assign a request id, log the outcome, and measure how long it took.

    Registered outermost so its timing covers the other middleware too — a slow
    response caused by gzip or rate limiting should still show up here.
    """

    _logger = logging.getLogger("app.request")

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = _resolve_request_id(request)
        # Never reset. Every request sets its own id as its first act, so a stale
        # value can never be read as a fresh one — and resetting actively loses
        # information: uvicorn writes its access line after this middleware
        # returns, so a reset here strips the id from the one log line that
        # summarises the request. An earlier version of this file reset on the
        # success path and every access log read "[-]".
        request_id_ctx.set(request_id)
        started = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception as exc:
            # Deliberately `error`, not `exception`: no traceback here. The
            # handler in main.py logs the full traceback, and Starlette's
            # ServerErrorMiddleware always re-raises after calling a handler so
            # that uvicorn logs its own copy too — which cannot be suppressed
            # without replacing that middleware. Adding a third traceback for the
            # same failure makes the logs harder to read, not more informative.
            # What this line contributes is the route and the duration, which
            # neither of the other two records.
            self._logger.error(
                "request failed: %s: %s",
                type(exc).__name__,
                exc,
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
            # Starlette's ServerErrorMiddleware sits outside this one and runs the
            # `Exception` handler in the same task context, so the id must still
            # be set when that handler builds the 500 body — otherwise the user is
            # handed "-" and has no id to quote.
            raise

        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        response.headers[settings.LOG_REQUEST_ID_HEADER] = request_id

        # Level by outcome: a 500 is an event, a 401 on a polled endpoint is not.
        # Logging every 2xx at INFO would bury the ones that matter.
        if response.status_code >= 500:
            level = logging.ERROR
        elif response.status_code >= 400:
            level = logging.WARNING
        else:
            level = logging.INFO

        self._logger.log(
            level,
            "%s %s -> %s",
            request.method,
            request.url.path,
            response.status_code,
            extra={"status": response.status_code, "duration_ms": duration_ms},
        )
        return response
