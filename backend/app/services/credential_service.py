"""API Credentials — schema-driven, encrypted credential storage (Module 7).

Port of LeapDesk's `ApiCredentialController`, `ApiServiceProviderController` and
`CredentialManager`. Three things here are worth reading before changing
anything.

## 1. Encryption is per FIELD, decided by the schema row

`api_credential_schemas.is_encrypted` is what decides. A provider's region or
`from_address` stays readable; its token does not. The reference does this with
Eloquent mutators on the value model — encrypt on set, decrypt on get.

**We deliberately do not put it on the model.** A model that decrypts on
attribute access makes every incidental `repr()`, every `str()` in a log line and
every debugger watch a disclosure, and there is no way to audit an access that
happens implicitly. Encryption lives here, in functions that are called on
purpose, which is also what makes the audit entry in `reveal` possible at all.

## 2. Nothing returns plaintext except `reveal`

`list`/`get` return **masked** values. `reveal` is a separate call, gated on
`api-credential-view` *and* a recent password confirmation, and it writes an
activity-log row every time. The reference's `edit` endpoint preloads decrypted
values into the form; ours does not, and that divergence is the point of the
module rather than an omission — see `build_form_values`.

## 3. The resolution chain has no cache, on purpose

The reference caches resolutions for an hour and keeps a "known bad" marker in
the same cache. `LEAPDESK_PARITY_PLAN.md` § Module 7 settles the port: **option
(a), no cache layer** — credential reads here are low-frequency, an in-process
dict would be wrong with several workers, and Redis is not in the compose file.

The plan also suggests a `marked_bad_until` column to carry the bad-marker
across restarts. **That column does not exist** — the migration is already
applied and is not ours to change — so `resolve` implements steps 1 and 2 of the
chain (requested environment, then `CREDENTIALS_FALLBACK_ENV`) and the bad-marker
is left out rather than faked in memory, where it would behave differently per
worker. Noted in the handoff.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core import crypto
from app.core.crud import get_or_404
from app.core.query import ListParams, ListSpec, run_list
from app.models.api_credential import (
    ApiCredential,
    ApiCredentialSchema,
    ApiCredentialValue,
    ApiServiceProvider,
)
from app.models.user import User
from app.services import activity_service, setting_service

logger = logging.getLogger("app.credentials")

#: Which environments a credential row may name. The reference validates
#: `in:local,staging,production`.
ENVIRONMENTS = ("local", "staging", "production")

#: Read before writing the reveal audit entry. **Defaults to True**, and the
#: direction matters: if the setting has not been seeded, a reveal is still
#: audited. Defaulting to False would mean a missing row silently switches the
#: audit off, which is the one outcome nobody would notice.
AUDIT_DECRYPT_SETTING = "security.audit.credential_decrypt"

EVENT_PROVIDER_CREATED = "api_provider_created"
EVENT_PROVIDER_UPDATED = "api_provider_updated"
EVENT_PROVIDER_DELETED = "api_provider_deleted"
EVENT_CREDENTIAL_CREATED = "api_credential_created"
EVENT_CREDENTIAL_UPDATED = "api_credential_updated"
EVENT_CREDENTIAL_DELETED = "api_credential_deleted"
EVENT_CREDENTIAL_REVEALED = "api_credential_revealed"

_PROVIDER_SUBJECT = "ApiServiceProvider"
_CREDENTIAL_SUBJECT = "ApiCredential"


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- Providers ---------------------------------------------------------------


_PROVIDER_LIST_SPEC = ListSpec(
    sortable={
        "display_order": ApiServiceProvider.display_order,
        "name": ApiServiceProvider.name,
        "slug": ApiServiceProvider.slug,
        "category": ApiServiceProvider.category,
        "is_active": ApiServiceProvider.is_active,
        "created_at": ApiServiceProvider.created_at,
    },
    default_sort="display_order",
    default_order="asc",
    tiebreak=ApiServiceProvider.id,
    searchable=(
        ApiServiceProvider.name,
        ApiServiceProvider.slug,
        ApiServiceProvider.description,
        ApiServiceProvider.category,
    ),
)


def list_providers(
    db: Session,
    *,
    search: str | None = None,
    category: str | None = None,
    is_active: bool | None = None,
    sort_by: str = "display_order",
    sort_order: str = "asc",
    page: int = 1,
    per_page: int = 25,
) -> tuple[list[ApiServiceProvider], int]:
    stmt: Select = select(ApiServiceProvider).options(
        selectinload(ApiServiceProvider.schemas)
    )
    if category:
        stmt = stmt.where(ApiServiceProvider.category == category)
    if is_active is not None:
        stmt = stmt.where(ApiServiceProvider.is_active.is_(is_active))

    return run_list(
        db,
        stmt,
        _PROVIDER_LIST_SPEC,
        ListParams(
            page=page, per_page=per_page, sort_by=sort_by, sort_order=sort_order, search=search
        ),
    )


def get_provider(db: Session, provider_id: int) -> ApiServiceProvider:
    return get_or_404(db, ApiServiceProvider, provider_id, "API provider")


def active_providers(db: Session) -> list[ApiServiceProvider]:
    """Providers a credential may be created against, with their field schemas.

    Eager-loads `schemas` for the same reason the reference's `create()` does and
    says so in a comment: the credential form generates its fields from them, and
    a lazy load here means the form renders blank.
    """
    return list(
        db.scalars(
            select(ApiServiceProvider)
            .options(selectinload(ApiServiceProvider.schemas))
            .where(ApiServiceProvider.is_active.is_(True))
            .order_by(ApiServiceProvider.display_order.asc(), ApiServiceProvider.name.asc())
        ).unique()
    )


def credential_counts(db: Session) -> dict[int, int]:
    """provider_id -> how many environments have a credential row.

    One grouped query rather than a count per row: the providers index renders
    "configured" for every provider, and a per-row count is the classic N+1 on a
    page that already loads schemas.
    """
    from sqlalchemy import func

    rows = db.execute(
        select(ApiCredential.provider_id, func.count(ApiCredential.id)).group_by(
            ApiCredential.provider_id
        )
    ).all()
    return {provider_id: count for provider_id, count in rows}


def list_categories(db: Session) -> list[str]:
    """Distinct provider categories, for the filter dropdown."""
    return [
        c
        for (c,) in db.execute(
            select(ApiServiceProvider.category)
            .distinct()
            .order_by(ApiServiceProvider.category)
        ).all()
    ]


def _provider_snapshot(provider: ApiServiceProvider) -> dict:
    return {
        "name": provider.name,
        "slug": provider.slug,
        "description": provider.description,
        "category": provider.category,
        "is_active": provider.is_active,
        "display_order": provider.display_order,
    }


def _require_unique_slug(db: Session, slug: str, exclude_id: int | None = None) -> None:
    stmt = select(ApiServiceProvider).where(ApiServiceProvider.slug == slug)
    if exclude_id is not None:
        stmt = stmt.where(ApiServiceProvider.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"A provider with the slug '{slug}' already exists."
        )


def create_provider(db: Session, data: dict, actor: User) -> ApiServiceProvider:
    _require_unique_slug(db, data["slug"])

    schemas = data.pop("schemas", []) or []
    provider = ApiServiceProvider(**data)
    db.add(provider)
    db.flush()

    for order, field in enumerate(schemas):
        db.add(ApiCredentialSchema(provider_id=provider.id, display_order=order, **field))

    db.commit()
    db.refresh(provider)

    activity_service.record(
        db,
        description=f"API provider “{provider.name}” created",
        event=EVENT_PROVIDER_CREATED,
        subject_type=_PROVIDER_SUBJECT,
        subject_id=str(provider.id),
        actor=actor,
        properties={"attributes": _provider_snapshot(provider)},
    )
    return provider


def update_provider(db: Session, provider_id: int, data: dict, actor: User) -> ApiServiceProvider:
    provider = get_provider(db, provider_id)
    before = _provider_snapshot(provider)

    if data.get("slug") and data["slug"] != provider.slug:
        if provider.is_system:
            # A system provider's slug is resolved by code. Renaming it breaks
            # the resolution silently — the lookup simply finds nothing.
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "A system provider's slug cannot be changed — code resolves it by slug.",
            )
        _require_unique_slug(db, data["slug"], exclude_id=provider.id)

    schemas = data.pop("schemas", None)
    for field, value in data.items():
        setattr(provider, field, value)

    if schemas is not None:
        _replace_schemas(db, provider, schemas)

    db.commit()
    db.refresh(provider)

    after = _provider_snapshot(provider)
    if before != after:
        activity_service.record(
            db,
            description=f"API provider “{provider.name}” updated",
            event=EVENT_PROVIDER_UPDATED,
            subject_type=_PROVIDER_SUBJECT,
            subject_id=str(provider.id),
            actor=actor,
            properties={"attributes": after, "old": before},
        )
    return provider


def _replace_schemas(db: Session, provider: ApiServiceProvider, fields: list[dict]) -> None:
    """Replace a provider's field declarations, keeping rows that still exist.

    **Matched on `field_key`, not deleted and recreated.** `api_credential_values`
    references `schema_id` with `ON DELETE CASCADE`, so dropping and re-adding a
    schema row would silently delete every stored value for that field across
    every environment — a credential wipe disguised as a label edit.
    """
    existing = {s.field_key: s for s in provider.schemas}
    seen: set[str] = set()

    for order, field in enumerate(fields):
        key = field["field_key"]
        seen.add(key)
        row = existing.get(key)
        if row is None:
            db.add(ApiCredentialSchema(provider_id=provider.id, display_order=order, **field))
        else:
            for name, value in field.items():
                setattr(row, name, value)
            row.display_order = order

    for key, row in existing.items():
        if key not in seen:
            # Removing a declared field does delete its stored values, by the
            # cascade. That is correct — the field no longer exists — but it is
            # the one destructive path in this function, so it is explicit.
            db.delete(row)


def delete_provider(db: Session, provider_id: int, actor: User) -> None:
    provider = get_provider(db, provider_id)

    if provider.is_system:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "System providers cannot be deleted — code resolves them by slug.",
        )

    snapshot = _provider_snapshot(provider)
    name = provider.name

    # Cascades to schemas, credentials and values. Said out loud in the API's
    # delete copy, because "delete provider" reads much smaller than it is.
    db.delete(provider)
    db.commit()

    activity_service.record(
        db,
        description=f"API provider “{name}” deleted",
        event=EVENT_PROVIDER_DELETED,
        subject_type=_PROVIDER_SUBJECT,
        subject_id=str(provider_id),
        actor=actor,
        properties={"old": snapshot},
    )


# --- Credentials -------------------------------------------------------------


_CREDENTIAL_LIST_SPEC = ListSpec(
    sortable={
        "created_at": ApiCredential.created_at,
        "environment": ApiCredential.environment,
        "name": ApiCredential.name,
        "is_active": ApiCredential.is_active,
        "last_used_at": ApiCredential.last_used_at,
    },
    default_sort="created_at",
    default_order="desc",
    tiebreak=ApiCredential.id,
)


def list_credentials(
    db: Session,
    *,
    search: str | None = None,
    provider_id: int | None = None,
    environment: str | None = None,
    is_active: bool | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    per_page: int = 25,
) -> tuple[list[ApiCredential], int]:
    """Credentials, searchable by their own name or their provider's.

    The search spans a joined table, which `ListSpec.searchable` does not cover —
    `core/query.py` assigns exactly that case to the caller.
    """
    stmt: Select = select(ApiCredential).options(
        selectinload(ApiCredential.provider).selectinload(ApiServiceProvider.schemas),
        selectinload(ApiCredential.values),
    )

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        stmt = stmt.join(ApiServiceProvider, ApiCredential.provider_id == ApiServiceProvider.id).where(
            or_(
                ApiCredential.name.ilike(term),
                ApiServiceProvider.name.ilike(term),
                ApiServiceProvider.slug.ilike(term),
            )
        )

    if provider_id is not None:
        stmt = stmt.where(ApiCredential.provider_id == provider_id)
    if environment:
        stmt = stmt.where(ApiCredential.environment == environment)
    if is_active is not None:
        stmt = stmt.where(ApiCredential.is_active.is_(is_active))

    return run_list(
        db,
        stmt,
        _CREDENTIAL_LIST_SPEC,
        ListParams(page=page, per_page=per_page, sort_by=sort_by, sort_order=sort_order),
    )


def get_credential(db: Session, credential_id: int) -> ApiCredential:
    return get_or_404(db, ApiCredential, credential_id, "API credential")


def _schema_by_key(provider: ApiServiceProvider) -> dict[str, ApiCredentialSchema]:
    return {s.field_key: s for s in provider.schemas}


def _schema_by_id(provider: ApiServiceProvider) -> dict[int, ApiCredentialSchema]:
    return {s.id: s for s in provider.schemas}


def masked_values(credential: ApiCredential) -> list[dict]:
    """Every declared field with its **masked** value.

    Driven by the provider's schemas rather than by the stored value rows, so a
    declared-but-unset field appears with an empty value instead of vanishing —
    the screen has to show "3 of 5 fields configured", and it cannot count what
    it cannot see.
    """
    stored = {v.schema_id: v for v in credential.values}
    out: list[dict] = []

    for schema in sorted(credential.provider.schemas, key=lambda s: (s.display_order, s.id)):
        row = stored.get(schema.id)
        raw = row.value if row else None
        out.append(
            {
                "field_key": schema.field_key,
                "field_label": schema.field_label,
                "field_type": schema.field_type,
                "is_encrypted": schema.is_encrypted,
                "is_required": schema.is_required,
                "is_set": raw is not None and raw != "",
                "masked_value": crypto.mask_stored(
                    raw, field_type=schema.field_type, is_encrypted=schema.is_encrypted
                ),
            }
        )
    return out


def build_form_values(credential: ApiCredential) -> dict[str, str]:
    """Values safe to preload into an edit form.

    **Encrypted fields are returned empty, not decrypted.** The reference's
    `edit()` preloads every decrypted value into the form, which puts every
    secret for that provider into an HTML response — and therefore into the
    browser's memory, its devtools, and any proxy log — on a page load that was
    only meant to change a label.

    Ours returns the plaintext of non-encrypted fields only. An empty encrypted
    field on save means "leave it alone" (see `_apply_field_values`), so an
    operator can edit the region without retyping the token, and revealing a
    secret stays an explicit, audited act.
    """
    stored = {v.schema_id: v for v in credential.values}
    values: dict[str, str] = {}

    for schema in credential.provider.schemas:
        row = stored.get(schema.id)
        if schema.is_encrypted or crypto.should_mask(schema.field_type, schema.is_encrypted):
            values[schema.field_key] = ""
            continue
        values[schema.field_key] = (row.value if row and row.value is not None else schema.default_value) or ""

    return values


def _require_unique_environment(
    db: Session, provider_id: int, environment: str, exclude_id: int | None = None
) -> None:
    stmt = (
        select(ApiCredential)
        .where(ApiCredential.provider_id == provider_id)
        .where(ApiCredential.environment == environment)
    )
    if exclude_id is not None:
        stmt = stmt.where(ApiCredential.id != exclude_id)
    if db.scalar(stmt) is not None:
        # The reference's own message. `UNIQUE(provider_id, environment)` also
        # enforces it, but a 409 with this wording beats a constraint name.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Credentials already exist for this provider and environment.",
        )


def _apply_field_values(
    db: Session,
    credential: ApiCredential,
    provider: ApiServiceProvider,
    field_values: dict[str, Any],
    *,
    creating: bool,
) -> list[str]:
    """Write one value row per declared field, encrypting where the schema says.

    Returns the field keys that were **changed**, for the audit entry. The keys
    are recorded; the values never are.

    ## The blank rule

    On update, a blank encrypted field means **leave the stored value alone**.
    That is what makes `build_form_values` safe: the form cannot show the secret,
    so it cannot send it back, so a save that did not touch it must not wipe it.
    Without this rule, editing a credential's name would clear every token it has.

    A blank *non-encrypted* field is a real value and is written through, because
    there the form did show what was there.
    """
    by_key = _schema_by_key(provider)
    existing = {v.schema_id: v for v in credential.values} if not creating else {}
    changed: list[str] = []

    for key, schema in by_key.items():
        if key not in field_values:
            continue

        submitted = field_values[key]
        submitted = "" if submitted is None else str(submitted)

        row = existing.get(schema.id)

        if submitted == "" and schema.is_encrypted and row is not None:
            continue  # blank means "unchanged" — see the docstring

        if submitted == "" and not schema.is_required:
            # An optional field cleared to empty: store the empty string rather
            # than dropping the row, so "explicitly blank" survives a reload.
            stored_value: str | None = ""
        elif submitted == "" and schema.is_required and creating:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"“{schema.field_label}” is required.",
            )
        elif submitted == "":
            continue
        else:
            stored_value = crypto.encrypt_value(submitted) if schema.is_encrypted else submitted

        if row is None:
            db.add(
                ApiCredentialValue(
                    credential_id=credential.id, schema_id=schema.id, value=stored_value
                )
            )
            changed.append(key)
        elif row.value != stored_value:
            row.value = stored_value
            changed.append(key)

    return changed


def create_credential(db: Session, data: dict, actor: User) -> ApiCredential:
    provider = get_provider(db, data["provider_id"])
    _require_unique_environment(db, provider.id, data["environment"])

    field_values = data.pop("field_values", {}) or {}

    credential = ApiCredential(
        provider_id=provider.id,
        environment=data["environment"],
        name=data.get("name"),
        is_active=data.get("is_active", True),
        notes=data.get("notes"),
        created_by=actor.id,
        updated_by=actor.id,
    )
    db.add(credential)
    db.flush()

    changed = _apply_field_values(db, credential, provider, field_values, creating=True)
    db.commit()
    db.refresh(credential)

    activity_service.record(
        db,
        description=f"API credentials created for {provider.name} ({credential.environment})",
        event=EVENT_CREDENTIAL_CREATED,
        subject_type=_CREDENTIAL_SUBJECT,
        subject_id=str(credential.id),
        actor=actor,
        # **Field keys, never field values.** An audit entry naming which secrets
        # were set is useful; one containing them is a second copy of the secret
        # in a table with different access rules.
        properties={
            "attributes": {
                "provider": provider.slug,
                "environment": credential.environment,
                "fields_set": changed,
            }
        },
    )
    return credential


def update_credential(db: Session, credential_id: int, data: dict, actor: User) -> ApiCredential:
    credential = get_credential(db, credential_id)
    provider = credential.provider

    environment = data.get("environment", credential.environment)
    if environment != credential.environment:
        _require_unique_environment(db, provider.id, environment, exclude_id=credential.id)

    before = {
        "environment": credential.environment,
        "name": credential.name,
        "is_active": credential.is_active,
        "notes": credential.notes,
    }

    field_values = data.pop("field_values", {}) or {}

    credential.environment = environment
    credential.name = data.get("name")
    credential.is_active = data.get("is_active", True)
    credential.notes = data.get("notes")
    credential.updated_by = actor.id

    changed = _apply_field_values(db, credential, provider, field_values, creating=False)
    db.commit()
    db.refresh(credential)

    after = {
        "environment": credential.environment,
        "name": credential.name,
        "is_active": credential.is_active,
        "notes": credential.notes,
    }

    if before != after or changed:
        activity_service.record(
            db,
            description=f"API credentials updated for {provider.name} ({credential.environment})",
            event=EVENT_CREDENTIAL_UPDATED,
            subject_type=_CREDENTIAL_SUBJECT,
            subject_id=str(credential.id),
            actor=actor,
            properties={"attributes": {**after, "fields_changed": changed}, "old": before},
        )
    return credential


def delete_credential(db: Session, credential_id: int, actor: User) -> None:
    credential = get_credential(db, credential_id)
    provider_name = credential.provider.name
    snapshot = {
        "provider": credential.provider.slug,
        "environment": credential.environment,
        "name": credential.name,
    }

    db.delete(credential)
    db.commit()

    activity_service.record(
        db,
        description=f"API credentials deleted for {provider_name} ({snapshot['environment']})",
        event=EVENT_CREDENTIAL_DELETED,
        subject_type=_CREDENTIAL_SUBJECT,
        subject_id=str(credential_id),
        actor=actor,
        properties={"old": snapshot},
    )


# --- Reveal ------------------------------------------------------------------


def reveal_field(
    db: Session, credential_id: int, field_key: str, actor: User, ip: str | None = None
) -> str | None:
    """Decrypt ONE field and return it, writing an audit entry.

    ## Why one field and not all of them

    The reference has no reveal endpoint at all — it decrypts the whole set into
    the edit form. Revealing one named field at a time means the audit entry says
    *which* secret was read, and an operator who needs the SMTP host does not
    also pull the token into their browser.

    ## Why the audit entry is written before the value is returned

    If the write fails the reveal does not happen. An unauditable disclosure is
    the thing this endpoint exists to prevent, so it fails closed —
    `activity_service.record` never raises, so this is belt-and-braces rather
    than the main mechanism, but the ordering is the part that would matter if
    that ever changed.

    The audit is controlled by `security.audit.credential_decrypt`, **defaulting
    to True**: a missing setting must not silently switch the auditing off.
    """
    credential = get_credential(db, credential_id)
    schema = _schema_by_key(credential.provider).get(field_key)
    if schema is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"“{field_key}” is not a field on this provider."
        )

    row = next((v for v in credential.values if v.schema_id == schema.id), None)
    if row is None or row.value is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That field has no stored value.")

    if setting_service.get(db, AUDIT_DECRYPT_SETTING, True):
        activity_service.record(
            db,
            description=(
                f"{actor.email} revealed “{schema.field_label}” for "
                f"{credential.provider.name} ({credential.environment})"
            ),
            event=EVENT_CREDENTIAL_REVEALED,
            subject_type=_CREDENTIAL_SUBJECT,
            subject_id=str(credential.id),
            actor=actor,
            # The field KEY, the provider and the IP. Never the value — an audit
            # trail that records the secret is a second, less-guarded copy of it.
            properties={
                "provider": credential.provider.slug,
                "environment": credential.environment,
                "field_key": field_key,
                "ip": ip,
            },
        )

    if not schema.is_encrypted:
        return row.value

    plaintext = crypto.decrypt_value(row.value)
    if plaintext is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "This value could not be decrypted. It was most likely stored under a "
            "different SECRET_KEY and needs re-entering.",
        )
    return plaintext


# --- Resolution chain --------------------------------------------------------


#: `APP_ENV` and a credential's `environment` are two different vocabularies, and
#: nothing said so until 2026-08-12.
#:
#: ⚠️ **This was a live defect, found by probing the AI assistant.** `resolve`
#: asked for `APP_ENV` verbatim — `"development"` on every developer machine —
#: while `ENVIRONMENTS` offers only `local`, `staging` and `production`, so the
#: UI could not create a row `resolve` would ever look for. Every credential
#: consumer silently found nothing in development, and the symptom was
#: indistinguishable from "no credential configured": the AI assistant reported
#: itself off with a key sitting in the database.
#:
#: Unknown values map to `production` rather than raising: an install with a
#: bespoke `APP_ENV` should read production credentials, which is the
#: conservative reading, and a startup crash over a naming mismatch would be a
#: worse failure than the one being fixed.
_APP_ENV_TO_CREDENTIAL_ENV = {
    "development": "local",
    "dev": "local",
    "local": "local",
    "test": "local",
    "testing": "local",
    "staging": "staging",
    "production": "production",
}


def environment_for_app_env(app_env: str) -> str:
    """Which credential environment an `APP_ENV` reads from."""
    return _APP_ENV_TO_CREDENTIAL_ENV.get((app_env or "").strip().lower(), "production")


def resolve(
    db: Session,
    provider_slug: str,
    environment: str | None = None,
    field_key: str | None = None,
) -> dict[str, str] | str | None:
    """Application-facing credential lookup. **Returns plaintext.**

    This is the function other services call — the AI Assistant checking for an
    Anthropic key, the mailer reading SMTP settings. It is not reachable from any
    route: nothing in `api/api_credentials.py` calls it, and nothing should.

    The chain, per the reference's `CredentialManager::get`:

    1. The requested environment, defaulting to whichever one this `APP_ENV`
       reads from — see `environment_for_app_env`, and note that the two are
       *not* the same vocabulary.
    2. `CREDENTIALS_FALLBACK_ENV`, when the primary yielded nothing. Intended for
       local development where credential rows drift behind production; unset in
       production, where it is a no-op.

    Step 3 of the reference — falling through to config files — is deliberately
    **not** ported. Its purpose there is legacy compatibility with
    `config/services.php`; here it would mean a credential silently resolving
    from `.env` when the operator believes they configured it in the database,
    which is exactly the confusion this module removes.

    Stamps `last_used_at`, so an unused credential is visible as unused.
    """
    from app.core.config import settings

    requested = environment or environment_for_app_env(
        getattr(settings, "APP_ENV", "production")
    )
    values = _resolve_for_env(db, provider_slug, requested)

    if values is None:
        fallback = getattr(settings, "CREDENTIALS_FALLBACK_ENV", None)
        if fallback and fallback != requested:
            logger.info(
                "credentials: falling back to alternate environment",
                extra={"provider": provider_slug, "requested": requested, "fallback": fallback},
            )
            values = _resolve_for_env(db, provider_slug, fallback)

    if values is None:
        return None
    if field_key is not None:
        return values.get(field_key)
    return values


def _resolve_for_env(db: Session, provider_slug: str, environment: str) -> dict[str, str] | None:
    """One environment's values, decrypted, or None if not configured."""
    credential = db.scalar(
        select(ApiCredential)
        .join(ApiServiceProvider, ApiCredential.provider_id == ApiServiceProvider.id)
        .options(
            selectinload(ApiCredential.provider).selectinload(ApiServiceProvider.schemas),
            selectinload(ApiCredential.values),
        )
        .where(ApiServiceProvider.slug == provider_slug)
        .where(ApiServiceProvider.is_active.is_(True))
        .where(ApiCredential.environment == environment)
        .where(ApiCredential.is_active.is_(True))
    )
    if credential is None:
        return None

    by_id = _schema_by_id(credential.provider)
    values: dict[str, str] = {}

    for row in credential.values:
        schema = by_id.get(row.schema_id)
        if schema is None or row.value is None:
            continue
        plaintext = crypto.decrypt_value(row.value) if schema.is_encrypted else row.value
        if plaintext is None:
            # Undecryptable: omit the key rather than pass ciphertext to a caller
            # that would send it upstream as a token.
            logger.warning(
                "credentials: %s/%s field could not be decrypted",
                provider_slug,
                schema.field_key,
            )
            continue
        values[schema.field_key] = plaintext

    if not values:
        return None

    credential.last_used_at = _now()
    db.commit()
    return values
