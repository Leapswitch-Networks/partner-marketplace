"""The three tools the assistant may call, and the five controls on them.

Ported from the reference's `DescribeSchema`, `DatabaseQuery` and `LocateData`.
Its other five tools are QMAS pricing tools with no equivalent here and are not
ported — a tool that cannot answer is worse than no tool, because the model will
try it before saying it does not know.

**`database_query` is the most sensitive code in the parity scope.** Its safety
is structural rather than pattern-matching on SQL, and every control below is one
the reference names:

1. **A connection that physically cannot write** — `app/db/readonly.py`. Postgres
   refuses `INSERT`/`UPDATE`/`DELETE`/`DDL` on it whatever SQL arrives. This is
   the control that holds if everything else here is wrong.
2. **A table denylist**, applied to reads *and* to schema discovery, so a denied
   table is not merely unreadable but invisible.
3. **Column redaction** before any row leaves this module.
4. **An operator allowlist**, with every value bound as a parameter. No filter
   value is ever concatenated into SQL.
5. **Output caps** — rows and characters — so one query cannot fill the model's
   context or the reply.

**A sixth is ours:** identifiers are resolved against the live catalogue and used
only as SQLAlchemy `Column` objects. A table or column name the model invents
never reaches SQL as text, so there is no injection surface to reason about — the
same rule Global Search adopted in Module 8, for the same reason.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from sqlalchemy import MetaData, Table, inspect, select
from sqlalchemy.orm import Session

from app.db.readonly import readonly_session
from app.models.user import User
from app.services.search_service import is_sensitive_column

logger = logging.getLogger("app.ai.tools")

MAX_LIMIT = 50
DEFAULT_LIMIT = 25
MAX_OUTPUT_CHARS = 12_000

#: The reference's operator set exactly. `like` wraps the value in `%…%`; `in`
#: splits a comma-separated string, because a JSON schema array of mixed types is
#: harder for a model to get right than a string it already knows how to write.
OPERATORS = ("=", "!=", "<>", "<", "<=", ">", ">=", "like", "in")

#: Tables the assistant may never read. The reference's pattern, plus four
#: additions of ours:
#:
#: * `alembic_version` — infrastructure, and the reference's `migrations` entry
#:   is the same idea under MySQL's name for it.
#: * `agent_conversation`, `ai_message_feedback` — **the assistant's own memory.**
#:   The reference leaves these readable, which means anyone who can use the
#:   assistant can ask it to read back what *other people* asked it. That is a
#:   privacy hole rather than a feature, and it is not ported.
#: * `otp` — our password-reset one-time codes live in columns and could live in
#:   a table later; the reference has no equivalent to have named.
#:
#: Matched as a **substring**, deliberately: a new table called
#: `partner_api_credentials` is denied without anyone remembering to add it.
DENIED_TABLE_PATTERN = re.compile(
    r"credential|token|password|otp|session|cache|^jobs$|job_batches|failed_jobs"
    r"|migrations|alembic_version|personal_access|telescope|websockets|oauth_"
    r"|agent_conversation|ai_message_feedback",
    re.IGNORECASE,
)

#: Column redaction. The reference lists four suffixes and four names; ours
#: delegates to `search_service.is_sensitive_column`, which is the same rule
#: Global Search enforces and already covers all eight plus `hash`, `salt`,
#: `signature` and `recovery_code`. One definition, two consumers — the
#: alternative is two lists that drift and only one of them being updated when a
#: new secret column appears.
REDACTED = "[redacted]"


def is_queryable(table: str) -> bool:
    """Whether a table may be read at all."""
    name = (table or "").strip().lower()
    return bool(name) and not DENIED_TABLE_PATTERN.search(name)


def queryable_tables(session: Session) -> list[str]:
    """Readable tables, from the live database rather than from the models.

    Reflection rather than `Base.metadata`: a table that exists but has no model
    is still data someone may legitimately ask about, and a model that exists but
    has not been migrated yet is a table that would 500 on read.

    **The denylist is applied here, not only at read time.** A denied table is
    invisible to discovery, so the model never learns the name to ask for — which
    is the difference between a refusal and a hint.
    """
    inspector = inspect(session.get_bind())
    return sorted(name for name in inspector.get_table_names() if is_queryable(name))


def _columns_of(session: Session, table: str) -> list[str]:
    inspector = inspect(session.get_bind())
    return [column["name"] for column in inspector.get_columns(table)]


def _redact_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        key: (REDACTED if is_sensitive_column(key) else value) for key, value in row.items()
    }


def _dump(payload: dict[str, Any]) -> str:
    """Serialise a tool result, capped.

    Truncates **rows**, never characters: cutting a JSON document mid-string
    hands the model malformed JSON, and a model given malformed JSON does not
    report a parse error — it guesses at what was cut off, which is the one
    failure mode this whole module is built to avoid.
    """
    text = json.dumps(payload, default=str, ensure_ascii=False)
    rows = payload.get("rows")
    if len(text) <= MAX_OUTPUT_CHARS or not rows:
        return text

    per_row = max(1, len(json.dumps(rows[0], default=str, ensure_ascii=False)))
    fits = max(1, (MAX_OUTPUT_CHARS // per_row) - 1)
    payload = {
        **payload,
        "rows": rows[:fits],
        "truncated": True,
        "note": "Output truncated to fit. Add a more specific filter or lower the limit.",
    }
    return json.dumps(payload, default=str, ensure_ascii=False)


def _error(message: str) -> str:
    """A tool failure the model can read and act on.

    Returned as a result, not raised: a raised exception ends the run and the
    user sees "the assistant could not respond", where a returned error lets the
    model correct its own call — which for a wrong column name it reliably does.
    """
    return json.dumps({"error": message})


# --- describe_schema --------------------------------------------------------


def describe_schema(table: str | None = None) -> str:
    """List readable tables, or one table's columns."""
    with readonly_session() as session:
        name = (table or "").strip().lower()
        if not name:
            tables = queryable_tables(session)
            return _dump(
                {
                    "table_count": len(tables),
                    "tables": tables,
                    "hint": (
                        "Call describe_schema with a table name to see its columns, "
                        "then read it with database_query."
                    ),
                }
            )

        if not is_queryable(name):
            return _error(f"Table '{name}' is not accessible.")
        if name not in queryable_tables(session):
            return _error(f"Table '{name}' was not found.")

        # Sensitive columns are listed but marked, rather than hidden. Hiding
        # them makes the model retry with a name it half-remembers; naming them
        # as redacted tells it not to bother, once.
        columns = [
            {"name": column, "redacted": True} if is_sensitive_column(column) else column
            for column in _columns_of(session, name)
        ]
        return _dump({"table": name, "columns": columns})


# --- database_query ---------------------------------------------------------


def database_query(
    table: str,
    columns: list[str] | None = None,
    where: list[dict[str, Any]] | None = None,
    order_by: str | None = None,
    direction: str | None = None,
    limit: int | None = None,
) -> str:
    """Read rows from one table, filtered and capped."""
    name = (table or "").strip().lower()

    if not is_queryable(name):
        return _error(f"Table '{name}' is not accessible.")

    with readonly_session() as session:
        if name not in queryable_tables(session):
            return _error(f"Table '{name}' was not found.")

        # Reflected once and reused: the `Table` object is what turns every
        # identifier below into a bound `Column` rather than a string.
        reflected = Table(name, MetaData(), autoload_with=session.get_bind())
        all_columns = [c.name for c in reflected.columns]

        requested = [c for c in (columns or []) if c in all_columns]
        selected = requested or all_columns
        stmt = select(*[reflected.c[c] for c in selected])

        for filter_ in where or []:
            column = str(filter_.get("column", ""))
            operator = str(filter_.get("operator", "=")).lower()
            value = filter_.get("value")

            if column not in all_columns:
                return _error(f"Unknown column '{column}' for this table.")
            if operator not in OPERATORS:
                return _error(f"Operator '{operator}' is not allowed.")

            target = reflected.c[column]
            if operator == "in":
                stmt = stmt.where(target.in_([v.strip() for v in str(value).split(",")]))
            elif operator == "like":
                stmt = stmt.where(target.ilike(f"%{value}%"))
            elif operator in ("!=", "<>"):
                stmt = stmt.where(target != value)
            elif operator == "<":
                stmt = stmt.where(target < value)
            elif operator == "<=":
                stmt = stmt.where(target <= value)
            elif operator == ">":
                stmt = stmt.where(target > value)
            elif operator == ">=":
                stmt = stmt.where(target >= value)
            else:
                stmt = stmt.where(target == value)

        if order_by:
            if order_by not in all_columns:
                return _error(f"Unknown order_by column '{order_by}' for this table.")
            column = reflected.c[order_by]
            stmt = stmt.order_by(
                column.asc() if str(direction).lower() == "asc" else column.desc()
            )

        capped = max(1, min(int(limit or DEFAULT_LIMIT), MAX_LIMIT))
        try:
            rows = [_redact_row(dict(row._mapping)) for row in session.execute(stmt.limit(capped))]
        except Exception as exc:  # noqa: BLE001 - a bad query must not end the run
            logger.warning("ai database_query failed on %s: %s", name, exc)
            return _error("That query could not be run. Try different filters.")

        return _dump(
            {"table": name, "columns": selected, "count": len(rows), "rows": rows}
        )


# --- locate_data ------------------------------------------------------------


def locate_data(db: Session, actor: User, query: str, limit: int | None = None) -> str:
    """Where does this live? Runs Global Search and returns each match with a URL.

    Takes the **writable** session and the actor, unlike the two above: Global
    Search applies its own three permission layers and its per-type row scoping,
    and those need the real session and the real user. Nothing here writes; the
    session is passed because `search_service` owns that decision, not this tool.
    """
    from app.services import search_service

    term = (query or "").strip()
    if len(term) < 2:
        return _error("Provide at least 2 characters to locate.")

    per_entity = max(1, min(int(limit or 5), 10))
    groups = search_service.search(db, actor, term, per_entity)

    locations = [
        {
            "module": group["label"],
            "matches": [{"title": item["title"], "url": item["url"]} for item in group["items"]],
        }
        for group in groups
    ]
    return _dump(
        {"query": term, "found_in_modules": len(locations), "locations": locations}
    )


# --- Anthropic tool definitions ---------------------------------------------

DESCRIBE_SCHEMA_SCHEMA = {
    "type": "object",
    "properties": {
        "table": {
            "type": "string",
            "description": "Optional: a table name to inspect its columns. Omit to list all tables.",
        }
    },
}

DATABASE_QUERY_SCHEMA = {
    "type": "object",
    "properties": {
        "table": {
            "type": "string",
            "description": "The table to read (e.g. users, partners, invitations).",
        },
        "columns": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Optional columns to select. Omit to return all non-secret columns.",
        },
        "where": {
            "type": "array",
            "description": (
                "Optional filters; each is {column, operator, value}. "
                "For 'in' pass a comma-separated value."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "column": {"type": "string"},
                    "operator": {"type": "string", "enum": list(OPERATORS)},
                    "value": {"type": "string"},
                },
                "required": ["column", "operator", "value"],
            },
        },
        "order_by": {
            "type": "string",
            "description": "Optional column to sort by — use for 'most/highest/latest' questions.",
        },
        "direction": {
            "type": "string",
            "enum": ["asc", "desc"],
            "description": "Sort direction; desc for highest/latest first.",
        },
        "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": MAX_LIMIT,
            "description": "Maximum rows to return (1-50). Use 1 with order_by for the single top row.",
        },
    },
    "required": ["table"],
}

LOCATE_DATA_SCHEMA = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": "The name or term to locate (e.g. a person, a partner, a role).",
        },
        "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10,
            "description": "Max matches per module (1-10).",
        },
    },
    "required": ["query"],
}

DESCRIBE_SCHEMA_DESCRIPTION = (
    "Discover the Partner Marketplace database. With no arguments, lists every readable "
    "table. With a table name, lists that table's columns. Use this FIRST when you are "
    "unsure which table or columns hold the data, then read with database_query."
)

DATABASE_QUERY_DESCRIPTION = (
    "Read-only structured query over any business table — users, roles, partners, "
    "invitations, activity, settings and more. Provide a table, optional columns, "
    "filters, order_by + direction (for 'most/highest/latest'), and a limit. If you do "
    "not know the exact table or columns, call describe_schema FIRST. Auth and secret "
    "tables are blocked and secret columns come back redacted. Sensitive action — "
    "confirm with the user before broad reads."
)

LOCATE_DATA_DESCRIPTION = (
    "Find WHERE something lives in the app and the page URL to manage it. Searches every "
    "configured module and returns each match with its module label and a link. Use for "
    "'where is X', 'which page has Y', 'where can I edit Z'."
)
