"""API Credentials endpoints — providers, credentials, and the audited reveal.

## Route ordering

`/providers` and `/credentials` are literal segments under the same prefix, and
neither shares a level with a path parameter, so there is no first-match hazard
here. `/credentials/{id}/reveal` is declared after `/credentials/{id}` for
readability only.

## The startup check

`crypto.assert_encryption_available()` runs when this module is imported, which
is when `main.py` includes the router. **A credential store that silently writes
plaintext because the key was unusable is worse than no credential store** — the
operator believes the secrets are encrypted, so nothing prompts a rotation. If
the cipher cannot round-trip a probe value, importing this module raises and the
application does not start.

## What is not here

**No `verify` endpoint.** The task offers it as optional, "skip if a provider has
no reachable test endpoint" — and none of the four seeded providers has one that
can be called safely from here. `google` and `anthropic` would need a real
outbound request to a third party using the stored key, which turns an admin
screen into an egress path and bills the customer's account to satisfy a UI
button; `mail` would need an SMTP connection; `slack`'s webhook test posts a
visible message into someone's channel. `verification_status` and
`last_verified_at` are on the model and returned, so the column is ready for
whoever adds a per-provider verifier that knows what a safe probe looks like.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.core import crypto
from app.core.dependencies import (
    get_client_ip,
    get_db,
    require_password_confirmation,
    require_permission,
)
from app.core.permissions import (
    API_CREDENTIAL_CREATE,
    API_CREDENTIAL_DELETE,
    API_CREDENTIAL_UPDATE,
    API_CREDENTIAL_VIEW,
    API_PROVIDER_CREATE,
    API_PROVIDER_DELETE,
    API_PROVIDER_UPDATE,
    API_PROVIDER_VIEW,
)
from app.core.query import page_count
from app.models.api_credential import ApiCredential, ApiServiceProvider
from app.models.user import User
from app.schemas.api_credential import (
    CredentialPage,
    CredentialResponse,
    CredentialWriteRequest,
    ProviderPage,
    ProviderResponse,
    ProviderWriteRequest,
    RevealRequest,
    RevealResponse,
)
from app.schemas.auth import MessageResponse
from app.services import credential_service

# Fail loud at import rather than on the first write. See the module docstring.
crypto.assert_encryption_available()

router = APIRouter(prefix="/settings/api-credentials", tags=["api-credentials"])


def _provider_response(provider: ApiServiceProvider, credential_count: int = 0) -> ProviderResponse:
    return ProviderResponse(
        id=provider.id,
        name=provider.name,
        slug=provider.slug,
        description=provider.description,
        icon=provider.icon,
        documentation_url=provider.documentation_url,
        setup_steps=provider.setup_steps,
        category=provider.category,
        is_system=provider.is_system,
        is_active=provider.is_active,
        display_order=provider.display_order,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
        schemas=sorted(provider.schemas, key=lambda s: (s.display_order, s.id)),
        credential_count=credential_count,
    )


def _credential_response(credential: ApiCredential) -> CredentialResponse:
    values = credential_service.masked_values(credential)
    return CredentialResponse(
        id=credential.id,
        provider=credential.provider,
        environment=credential.environment,
        name=credential.name,
        is_active=credential.is_active,
        last_used_at=credential.last_used_at,
        last_verified_at=credential.last_verified_at,
        verification_status=credential.verification_status,
        notes=credential.notes,
        created_at=credential.created_at,
        updated_at=credential.updated_at,
        values=values,
        configured_fields=sum(1 for v in values if v["is_set"]),
        total_fields=len(values),
    )


# --- Providers ---------------------------------------------------------------


@router.get("/providers", response_model=ProviderPage)
def list_providers(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    sort_by: str = Query(default="display_order"),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_PROVIDER_VIEW)),
) -> ProviderPage:
    providers, total = credential_service.list_providers(
        db,
        search=search,
        category=category,
        is_active=is_active,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )
    counts = credential_service.credential_counts(db)
    return ProviderPage(
        items=[_provider_response(p, counts.get(p.id, 0)) for p in providers],
        total=total,
        page=page,
        per_page=per_page,
        pages=page_count(total, per_page),
        can_manage=actor.has_permission(API_PROVIDER_UPDATE),
        categories=credential_service.list_categories(db),
    )


@router.post(
    "/providers", response_model=ProviderResponse, status_code=status.HTTP_201_CREATED
)
def create_provider(
    payload: ProviderWriteRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_PROVIDER_CREATE)),
) -> ProviderResponse:
    data = payload.model_dump()
    data["schemas"] = [s for s in (data.get("schemas") or [])]
    provider = credential_service.create_provider(db, data, actor)
    return _provider_response(provider)


@router.get("/providers/{provider_id}", response_model=ProviderResponse)
def get_provider(
    provider_id: int,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(API_PROVIDER_VIEW)),
) -> ProviderResponse:
    return _provider_response(credential_service.get_provider(db, provider_id))


@router.put("/providers/{provider_id}", response_model=ProviderResponse)
def update_provider(
    provider_id: int,
    payload: ProviderWriteRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_PROVIDER_UPDATE)),
) -> ProviderResponse:
    data = payload.model_dump()
    if data.get("schemas") is None:
        data.pop("schemas", None)
    provider = credential_service.update_provider(db, provider_id, data, actor)
    return _provider_response(provider)


@router.delete("/providers/{provider_id}", response_model=MessageResponse)
def delete_provider(
    provider_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_PROVIDER_DELETE)),
) -> MessageResponse:
    """Delete a provider **and every credential stored against it.**

    The cascade is the reason the UI's confirm names it: `api_credentials` and
    `api_credential_values` both cascade from here, so this removes live secrets
    for every environment, not just a catalogue entry.
    """
    credential_service.delete_provider(db, provider_id, actor)
    return MessageResponse(message="Provider and its stored credentials deleted.")


# --- Credentials -------------------------------------------------------------


@router.get("/credentials", response_model=CredentialPage)
def list_credentials(
    search: str | None = Query(default=None, description="Matches credential or provider name"),
    provider_id: int | None = Query(default=None),
    environment: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_CREDENTIAL_VIEW)),
) -> CredentialPage:
    """Credentials with every value **masked**. Never plaintext — see `/reveal`."""
    credentials, total = credential_service.list_credentials(
        db,
        search=search,
        provider_id=provider_id,
        environment=environment,
        is_active=is_active,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )
    return CredentialPage(
        items=[_credential_response(c) for c in credentials],
        total=total,
        page=page,
        per_page=per_page,
        pages=page_count(total, per_page),
        can_manage=actor.has_permission(API_CREDENTIAL_UPDATE),
        # Reveal additionally requires a password confirmation, which this flag
        # cannot know about — it gates whether the button is offered, not whether
        # the call succeeds.
        can_reveal=actor.has_permission(API_CREDENTIAL_VIEW),
        environments=list(credential_service.ENVIRONMENTS),
    )


@router.post(
    "/credentials", response_model=CredentialResponse, status_code=status.HTTP_201_CREATED
)
def create_credential(
    payload: CredentialWriteRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_CREDENTIAL_CREATE)),
) -> CredentialResponse:
    credential = credential_service.create_credential(db, payload.model_dump(), actor)
    return _credential_response(credential)


@router.get("/credentials/{credential_id}", response_model=CredentialResponse)
def get_credential(
    credential_id: int,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(API_CREDENTIAL_VIEW)),
) -> CredentialResponse:
    """One credential, masked."""
    return _credential_response(credential_service.get_credential(db, credential_id))


@router.get("/credentials/{credential_id}/form-values", response_model=dict[str, str])
def credential_form_values(
    credential_id: int,
    db: Session = Depends(get_db),
    _actor: User = Depends(require_permission(API_CREDENTIAL_UPDATE)),
) -> dict[str, str]:
    """Values safe to preload into the edit form.

    **Encrypted fields come back empty**, not decrypted — the divergence from the
    reference that the module exists for. Saving a blank encrypted field leaves
    the stored value alone, so an operator can change a region without retyping a
    token, and reading a secret stays an explicit, audited act.
    """
    credential = credential_service.get_credential(db, credential_id)
    return credential_service.build_form_values(credential)


@router.put("/credentials/{credential_id}", response_model=CredentialResponse)
def update_credential(
    credential_id: int,
    payload: CredentialWriteRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_CREDENTIAL_UPDATE)),
) -> CredentialResponse:
    credential = credential_service.update_credential(db, credential_id, payload.model_dump(), actor)
    return _credential_response(credential)


@router.delete("/credentials/{credential_id}", response_model=MessageResponse)
def delete_credential(
    credential_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_CREDENTIAL_DELETE)),
) -> MessageResponse:
    credential_service.delete_credential(db, credential_id, actor)
    return MessageResponse(message="Credentials deleted.")


# --- Reveal ------------------------------------------------------------------


@router.post("/credentials/{credential_id}/reveal", response_model=RevealResponse)
def reveal_credential_field(
    credential_id: int,
    payload: RevealRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission(API_CREDENTIAL_VIEW)),
    _session=Depends(require_password_confirmation),
) -> RevealResponse:
    """Decrypt and return ONE field. Audited every time.

    **Two gates, not one.** `api-credential-view` says the caller may work with
    credentials at all; `require_password_confirmation` says this particular
    person is at the keyboard right now. A stolen session passes the first and
    fails the second, which is the whole reason the second exists — the same
    reasoning that guards turning 2FA off.

    A `403` with "Please confirm your password to continue." is the
    re-authentication prompt, not a permission failure; the client must not treat
    it as a sign-out.

    The IP comes from `get_client_ip`, so `X-Forwarded-For` is honoured only
    behind a configured proxy. Reading that header directly would let a caller
    write any address they liked into the audit trail of a secret disclosure —
    the one entry where the address most needs to be true.
    """
    value = credential_service.reveal_field(
        db, credential_id, payload.field_key, actor, ip=get_client_ip(request)
    )
    return RevealResponse(field_key=payload.field_key, value=value)
