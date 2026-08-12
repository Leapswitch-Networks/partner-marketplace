"""Machine consumers, their tokens, and the gate a token opens.

LeapDesk parity Module 10 Part I. The reference gets its token machinery free
from Sanctum; we have none of it, and our only token code is JWT — which is the
wrong shape entirely, because a JWT is stateless and therefore cannot be revoked,
and revocation is the whole point of this screen.

So four decisions Sanctum otherwise makes for you are made here, and each is
argued where it is implemented:

1. **SHA-256, not bcrypt** (`_hash`).
2. **A greppable prefix** (`TOKEN_PREFIX`).
3. **Abilities validated against a catalogue at write time** (`ABILITIES`).
4. **`last_used_at` written on every authenticated call** (`authenticate`).
"""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import Select, delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.crud import get_or_404
from app.core.principal import MachinePrincipal
from app.core.query import ListParams, ListSpec, run_list
from app.core.security import generate_token
from app.models.api_consumer import ApiConsumer, ApiConsumerToken, ApiRequestLog
from app.models.user import User
from app.services import activity_service

logger = logging.getLogger("app.platform_api")

#: Every issued token starts with this. A fixed prefix is what makes a leaked
#: token greppable and what lets secret scanners recognise one — an argument that
#: is stronger here than at the reference, because **this repository is public**.
TOKEN_PREFIX = "pmp_"

#: Characters of the plaintext kept in the clear, so a screen that can never
#: re-read a token can still say which one it is showing.
PREFIX_LENGTH = 12

SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SLUG_MESSAGE = "lowercase words separated by hyphens, e.g. riaas, or riaas-reporting."

#: How long API traffic is kept. **A retention policy on day one**, because this
#: table grows fastest exactly when something is wrong — a burst of rejected
#: calls is how a leaked token shows up. The reference has none and its own
#: tracker does not list one as planned.
REQUEST_LOG_RETENTION_DAYS = 90

EVENT_CONSUMER_CREATED = "api_consumer_created"
EVENT_CONSUMER_UPDATED = "api_consumer_updated"
EVENT_CONSUMER_DELETED = "api_consumer_deleted"
EVENT_TOKEN_ISSUED = "api_token_issued"
EVENT_TOKEN_REVOKED = "api_token_revoked"
SUBJECT = "ApiConsumer"


# --- The ability catalogue ---------------------------------------------------


@dataclass(frozen=True)
class Ability:
    """One grantable ability.

    **The description is authored for the person granting it, not for the
    developer.** A token is standing, unattended access, and the grant screen is
    the only moment anyone reads what it opens up.
    """

    name: str
    label: str
    group: str
    sensitivity: str  # low | medium | high
    description: str


#: ⚠️ **Deliberately almost empty, and that is the finding rather than an
#: omission.** The marketplace domain is greenfield — there is no domain data to
#: expose and no consumer asking for it — so inventing a taxonomy now would mean
#: minting tokens whose abilities nothing honours. That failure mode reads as
#: "granted" on this screen and arrives as a 403 at the consumer, which is the
#: exact confusion the write-time validation below exists to prevent.
#:
#: `platform.ping` is real: it is the ability the health probe below checks, so
#: the catalogue is exercised rather than hypothetical. Add the second entry when
#: the first consumer exists.
ABILITIES: tuple[Ability, ...] = (
    Ability(
        name="platform.ping",
        label="Confirm the token works",
        group="Platform",
        sensitivity="low",
        description=(
            "Lets the system check that its token is valid and its access is switched on. "
            "Returns nothing about your data — only whether the credential works."
        ),
    ),
)

ABILITY_NAMES = frozenset(ability.name for ability in ABILITIES)


def list_abilities() -> list[Ability]:
    return list(ABILITIES)


# --- Consumers ---------------------------------------------------------------

_LIST_SPEC = ListSpec(
    sortable={
        "name": ApiConsumer.name,
        "slug": ApiConsumer.slug,
        "created_at": ApiConsumer.created_at,
        "active": ApiConsumer.active,
    },
    default_sort="created_at",
    tiebreak=ApiConsumer.id,
    searchable=(
        ApiConsumer.name,
        ApiConsumer.slug,
        ApiConsumer.owner_email,
        ApiConsumer.description,
    ),
    default_per_page=15,
)


def get_consumer(db: Session, consumer_id: str) -> ApiConsumer:
    return get_or_404(db, ApiConsumer, consumer_id, "That system is not registered.")


def _validate_slug(db: Session, slug: str, exclude_id: str | None = None) -> str:
    slug = (slug or "").strip().lower()
    if not SLUG_PATTERN.match(slug):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Slug must be {SLUG_MESSAGE}")

    stmt = select(ApiConsumer).where(func.lower(ApiConsumer.slug) == slug)
    if exclude_id:
        stmt = stmt.where(ApiConsumer.id != exclude_id)
    if db.scalar(stmt):
        raise HTTPException(status.HTTP_409_CONFLICT, "A system with this slug already exists.")
    return slug


def list_consumers(
    db: Session,
    *,
    search: str | None = None,
    active: bool | None = None,
    has_tokens: bool | None = None,
    sort_by: str | None = None,
    sort_order: str = "desc",
    page: int = 1,
    per_page: int = 15,
) -> tuple[list[ApiConsumer], int]:
    stmt: Select = select(ApiConsumer).options(selectinload(ApiConsumer.tokens))

    if active is not None:
        stmt = stmt.where(ApiConsumer.active.is_(active))
    if has_tokens is not None:
        # **"Registered but holding no token" is its own state**, and the
        # reference's index makes it a filter for good reason: it is neither
        # active nor disabled, and it is the difference between access *granted*
        # and access *working*. Without it, a consumer that cannot call anything
        # looks identical to one that can.
        live = (
            select(ApiConsumerToken.consumer_id)
            .where(ApiConsumerToken.revoked_at.is_(None))
            .distinct()
        )
        stmt = stmt.where(
            ApiConsumer.id.in_(live) if has_tokens else ApiConsumer.id.not_in(live)
        )

    return run_list(
        db,
        stmt,
        _LIST_SPEC,
        ListParams(
            page=page,
            per_page=per_page,
            search=search,
            sort_by=sort_by,
            sort_order="asc" if sort_order == "asc" else "desc",
        ),
    )


def create_consumer(db: Session, data: dict, actor: User) -> ApiConsumer:
    slug = _validate_slug(db, data.get("slug", ""))
    consumer = ApiConsumer(
        name=(data.get("name") or "").strip(),
        slug=slug,
        description=(data.get("description") or "").strip() or None,
        owner_name=(data.get("owner_name") or "").strip() or None,
        owner_email=(data.get("owner_email") or "").strip() or None,
        active=bool(data.get("active", True)),
        created_by=actor.id,
        updated_by=actor.id,
    )
    db.add(consumer)
    db.commit()
    db.refresh(consumer)

    activity_service.record(
        db,
        description=f"{actor.full_name} registered the '{consumer.slug}' system for API access",
        event=EVENT_CONSUMER_CREATED,
        subject_type=SUBJECT,
        subject_id=consumer.id,
        actor=actor,
        properties={"slug": consumer.slug, "owner_email": consumer.owner_email},
    )
    return consumer


def update_consumer(db: Session, consumer_id: str, data: dict, actor: User) -> ApiConsumer:
    consumer = get_consumer(db, consumer_id)
    before = {"slug": consumer.slug, "active": consumer.active, "name": consumer.name}

    if "slug" in data and data["slug"]:
        consumer.slug = _validate_slug(db, data["slug"], exclude_id=consumer.id)
    if "name" in data and data["name"]:
        consumer.name = data["name"].strip()
    if "description" in data:
        consumer.description = (data["description"] or "").strip() or None
    if "owner_name" in data:
        consumer.owner_name = (data["owner_name"] or "").strip() or None
    if "owner_email" in data and data["owner_email"]:
        consumer.owner_email = data["owner_email"].strip()
    if "active" in data:
        consumer.active = bool(data["active"])

    consumer.updated_by = actor.id
    db.commit()
    db.refresh(consumer)

    after = {"slug": consumer.slug, "active": consumer.active, "name": consumer.name}
    if before != after:
        activity_service.record(
            db,
            description=f"{actor.full_name} updated the '{consumer.slug}' API system",
            event=EVENT_CONSUMER_UPDATED,
            subject_type=SUBJECT,
            subject_id=consumer.id,
            actor=actor,
            properties={"attributes": after, "old": before},
        )
    return consumer


def set_active(db: Session, consumer_id: str, active: bool, actor: User) -> ApiConsumer:
    """The kill switch. Takes effect on the next call, without touching a token.

    Separated from `update_consumer` because it is the thing someone reaches for
    at 2am, and it should not require sending a whole record to do it.
    """
    return update_consumer(db, consumer_id, {"active": active}, actor)


def delete_consumer(db: Session, consumer_id: str, actor: User) -> None:
    consumer = get_consumer(db, consumer_id)
    slug, token_count = consumer.slug, len(consumer.tokens)

    db.delete(consumer)  # tokens CASCADE; request logs deliberately do not
    db.commit()

    activity_service.record(
        db,
        description=f"{actor.full_name} removed the '{slug}' API system and {token_count} token(s)",
        event=EVENT_CONSUMER_DELETED,
        subject_type=SUBJECT,
        subject_id=consumer_id,
        actor=actor,
        properties={"slug": slug, "tokens_destroyed": token_count},
    )


# --- Tokens ------------------------------------------------------------------


def _hash(plaintext: str) -> str:
    """SHA-256 hex. **Not `hash_password`, and the difference matters.**

    `core/security.py` offers bcrypt and it is the wrong tool here three times
    over: it is deliberately slow, which is right for a low-entropy human
    password and pointless against 512 bits of `secrets.token_urlsafe`; it salts
    every hash, so an arriving bearer token could not be looked up at all and
    every request would have to load and check every row; and it truncates its
    input at 72 bytes. The token's entropy is the security property here, not the
    hash's cost factor — which is exactly what Sanctum concluded.
    """
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def _validate_abilities(abilities: list[str]) -> list[str]:
    """Every ability must be in the catalogue.

    A typo would otherwise mint a token carrying an ability nothing honours,
    which reads as "granted" on this screen and fails as a 403 at the consumer —
    the worst kind of failure, because both sides believe the other is wrong.
    """
    cleaned = [a.strip() for a in abilities or [] if a and a.strip()]
    unknown = [a for a in cleaned if a not in ABILITY_NAMES]
    if unknown:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Unknown abilit{'y' if len(unknown) == 1 else 'ies'}: {', '.join(unknown)}.",
        )
    if not cleaned:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A token with no abilities can do nothing. Grant at least one.",
        )
    return sorted(set(cleaned))


def issue_token(
    db: Session,
    consumer_id: str,
    *,
    name: str,
    abilities: list[str],
    expires_in_days: int | None,
    actor: User,
) -> tuple[ApiConsumerToken, str]:
    """Mint a token. Returns `(row, plaintext)` — **the only time the plaintext exists.**

    The caller must return it once and never store it. It is not written to the
    database in any form other than its hash, and it is not logged.
    """
    consumer = get_consumer(db, consumer_id)
    validated = _validate_abilities(abilities)

    plaintext = f"{TOKEN_PREFIX}{generate_token(48)}"
    expires_at = (
        datetime.now(timezone.utc) + timedelta(days=expires_in_days)
        if expires_in_days
        else None
    )

    token = ApiConsumerToken(
        consumer_id=consumer.id,
        name=(name or "").strip() or "Token",
        token_hash=_hash(plaintext),
        prefix=plaintext[:PREFIX_LENGTH],
        abilities=validated,
        expires_at=expires_at,
        created_by=actor.id,
    )
    db.add(token)
    db.commit()
    db.refresh(token)

    activity_service.record(
        db,
        description=(
            f"{actor.full_name} issued an API token to '{consumer.slug}' "
            f"({', '.join(validated)})"
        ),
        event=EVENT_TOKEN_ISSUED,
        subject_type=SUBJECT,
        subject_id=consumer.id,
        actor=actor,
        # The prefix and the abilities, never the token. The prefix is what ties
        # this row to a later "which token was that?" question.
        properties={
            "token_prefix": token.prefix,
            "abilities": validated,
            "expires_at": expires_at.isoformat() if expires_at else None,
        },
    )
    return token, plaintext


def revoke_token(db: Session, consumer_id: str, token_id: str, actor: User) -> None:
    """Revoke, do not delete.

    A deleted token leaves its request-log rows pointing at nothing, and "which
    credential made these calls, and when did we stop it" is the question the
    whole table exists to answer. `revoked_at` is checked at the gate, so a
    revoked token is refused immediately either way.
    """
    consumer = get_consumer(db, consumer_id)
    token = db.get(ApiConsumerToken, token_id)
    if token is None or token.consumer_id != consumer.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That token does not exist.")
    if token.revoked_at is not None:
        return

    token.revoked_at = datetime.now(timezone.utc)
    db.commit()

    activity_service.record(
        db,
        description=f"{actor.full_name} revoked an API token for '{consumer.slug}'",
        event=EVENT_TOKEN_REVOKED,
        subject_type=SUBJECT,
        subject_id=consumer.id,
        actor=actor,
        properties={"token_prefix": token.prefix, "token_name": token.name},
    )


# --- The gate ----------------------------------------------------------------

OUTCOME_NO_TOKEN = "no_token"
OUTCOME_UNKNOWN = "unknown_token"
OUTCOME_EXPIRED = "expired"
OUTCOME_REVOKED = "revoked"
OUTCOME_INACTIVE = "consumer_inactive"
OUTCOME_MISSING_ABILITY = "missing_ability"


class TokenRejected(Exception):
    """Why a token was refused. Carries the outcome for the request log.

    **The reason is for our log, never for the caller.** Telling a caller that a
    token is "expired" rather than "unknown" confirms it once existed, which is
    information a probe would pay for. The router turns every one of these into
    the same 401.
    """

    def __init__(self, outcome: str) -> None:
        super().__init__(outcome)
        self.outcome = outcome


def authenticate(db: Session, bearer: str | None) -> tuple[MachinePrincipal, ApiConsumerToken]:
    """Resolve a bearer token to a machine principal, or raise `TokenRejected`.

    **The order of the checks is deliberate.** `active` is tested after the token
    is found but before anything else about the token, because it is the kill
    switch and it must outrank a perfectly valid credential — that is the whole
    reason the flag lives on the consumer.
    """
    if not bearer or not bearer.startswith(TOKEN_PREFIX):
        raise TokenRejected(OUTCOME_NO_TOKEN)

    # One indexed lookup on a unique column — the property bcrypt would have cost
    # us. See `_hash`.
    token = db.scalar(
        select(ApiConsumerToken)
        .options(selectinload(ApiConsumerToken.consumer))
        .where(ApiConsumerToken.token_hash == _hash(bearer))
    )
    if token is None:
        raise TokenRejected(OUTCOME_UNKNOWN)
    if not token.consumer.active:
        raise TokenRejected(OUTCOME_INACTIVE)
    if token.revoked_at is not None:
        raise TokenRejected(OUTCOME_REVOKED)
    if token.expires_at is not None and token.expires_at <= datetime.now(timezone.utc):
        raise TokenRejected(OUTCOME_EXPIRED)

    # One UPDATE per authenticated call. The reference does the same thing inline
    # in its middleware; it is worth knowing it is there before the volume is.
    token.last_used_at = datetime.now(timezone.utc)
    db.commit()

    return (
        MachinePrincipal(
            consumer_id=token.consumer_id,
            consumer_slug=token.consumer.slug,
            token_id=token.id,
            token_prefix=token.prefix,
            abilities=frozenset(token.abilities or []),
        ),
        token,
    )


def require_ability(principal: MachinePrincipal, ability: str) -> None:
    if not principal.has_ability(ability):
        raise TokenRejected(OUTCOME_MISSING_ABILITY)


# --- The request log ---------------------------------------------------------


def log_request(
    db: Session,
    *,
    method: str,
    path: str,
    status_code: int,
    consumer_id: str | None = None,
    token_id: str | None = None,
    token_prefix: str | None = None,
    outcome: str | None = None,
    ip: str | None = None,
    duration_ms: int | None = None,
) -> None:
    """Record one API call. **Never raises**, for the same reason
    `activity_service.record` never raises: a failure to log must not fail the
    request it was logging."""
    try:
        db.add(
            ApiRequestLog(
                consumer_id=consumer_id,
                token_id=token_id,
                token_prefix=token_prefix,
                method=method,
                path=path[:500],
                status_code=status_code,
                outcome=outcome,
                ip=ip,
                duration_ms=duration_ms,
            )
        )
        db.commit()
    except Exception as exc:  # noqa: BLE001 - logging must not break the request
        logger.error("failed to write api request log: %s: %s", type(exc).__name__, exc)
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass


def recent_requests(db: Session, consumer_id: str, limit: int = 25) -> list[ApiRequestLog]:
    return list(
        db.scalars(
            select(ApiRequestLog)
            .where(ApiRequestLog.consumer_id == consumer_id)
            .order_by(ApiRequestLog.id.desc())
            .limit(limit)
        )
    )


def usage_summary(db: Session, consumer_id: str) -> dict:
    """Counts for the detail screen: total, rejected, and when it last called."""
    total = db.scalar(
        select(func.count()).select_from(ApiRequestLog).where(
            ApiRequestLog.consumer_id == consumer_id
        )
    ) or 0
    rejected = db.scalar(
        select(func.count()).select_from(ApiRequestLog).where(
            ApiRequestLog.consumer_id == consumer_id,
            ApiRequestLog.outcome.is_not(None),
        )
    ) or 0
    last = db.scalar(
        select(func.max(ApiRequestLog.created_at)).where(
            ApiRequestLog.consumer_id == consumer_id
        )
    )
    return {"total": total, "rejected": rejected, "last_called_at": last}


def purge_request_logs(db: Session, days: int = REQUEST_LOG_RETENTION_DAYS) -> int:
    """Delete API traffic older than `days`. Returns how many rows went.

    Not scheduled, because there is no scheduler — the same honest position
    `activity_service.purge_older_than` takes. It exists so the retention policy
    is a function someone can run rather than a paragraph someone wrote.
    """
    if days <= 0:
        raise ValueError("Retention must be a positive number of days.")
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = db.execute(delete(ApiRequestLog).where(ApiRequestLog.created_at < cutoff))
    db.commit()
    return result.rowcount or 0
