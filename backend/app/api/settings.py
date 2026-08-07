"""Installation-wide settings — the project's identity.

**The GET is deliberately unauthenticated, and that is a decision rather than an
oversight.** The sign-in page renders the application name, monogram and tagline
before any session exists, so a gated endpoint could not serve it. `/api/navigation`
— the other server-driven-chrome endpoint — *is* gated on `get_current_user`, which
is why branding cannot simply ride along on it.

⚠️ **Every field this endpoint returns is world-readable.** It currently returns
exactly what an anonymous visitor already sees painted on the login screen, so it
discloses nothing. **Do not add a field here that is not already public.** The
instinct when adding a new setting later will be to extend the response that already
exists; that instinct is how an unauthenticated endpoint starts leaking configuration.
Anything non-public belongs behind a second, gated endpoint.
"""

from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.core import images
from app.core.dependencies import (
    get_db,
    require_password_confirmation,
    require_super_admin,
)
from app.core.images import MAX_UPLOAD_BYTES
from app.models.user import User
from app.schemas.settings import (
    BrandingResponse,
    ThemePresetsResponse,
    UpdateBrandingRequest,
)
from app.services import settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/branding", response_model=BrandingResponse)
def read_branding(db: Session = Depends(get_db)) -> BrandingResponse:
    """The resolved project identity. Public — see the module docstring.

    Always returns a complete object: the service falls back to the environment for
    anything unset, so a fresh install with an empty table answers correctly.
    """
    return settings_service.get_branding(db)


@router.get("/branding/themes", response_model=ThemePresetsResponse)
def list_themes() -> ThemePresetsResponse:
    """The theme catalog. Public, and it needs no database.

    Public for the same reason as `/branding`: it describes colours already painted
    on the login screen. Served from here rather than hardcoded in the UI so the
    palette has one home, and carrying the measured contrast ratios so they can be
    shown next to the choice rather than living only in a test.
    """
    return settings_service.list_theme_presets()


# ⚠️ ROUTE ORDER MATTERS BELOW THIS LINE.
#
# `/branding/themes` is declared ABOVE `/branding/{asset}` deliberately. FastAPI
# matches in declaration order, so with the wildcard first, `GET /branding/themes`
# would bind `asset="themes"`, fail the Literal, and answer **422 instead of serving
# the catalog** — a broken endpoint that looks like a validation problem.
#
#: The two assets, as a path parameter constraint. A literal union rather than a free
#: string so an unknown name is a 422 from FastAPI, before any handler runs — the
#: alternative is `getattr(row, f"{asset}_bytes")` with an attacker-chosen `asset`.
AssetName = Literal["logo", "favicon"]


@router.get(
    "/branding/{asset}",
    responses={
        304: {"description": "Unchanged since the client's ETag"},
        404: {"description": "No such asset stored"},
    },
)
def read_asset(
    asset: AssetName, request: Request, db: Session = Depends(get_db)
) -> Response:
    """Serve a stored brand image. Public, like the branding it belongs to.

    **Cached hard, and safe to be.** The URL carries `?v=<epoch of last write>`, so a
    replacement is a different URL and a long `max-age` cannot serve a stale logo.
    `immutable` tells the browser not to revalidate at all for that version.

    The `ETag` and the `If-None-Match` handling below cover what the query string does
    not: a client that requests the bare path — which is what a browser does for a
    favicon — gets a 304 instead of the bytes. **Starlette does not do this for you.**
    Returning an `ETag` without checking the request header was the first version of
    this, and it looked correct while every conditional request still transferred the
    whole image.

    `Content-Type` is the **detected** MIME stored at upload, never anything the
    client said, and `X-Content-Type-Options: nosniff` (set globally by
    `SecurityHeadersMiddleware`) stops a browser second-guessing it — which together
    are what keep a stored image from ever being interpreted as something executable.
    """
    stored = settings_service.get_asset(db, asset)
    if stored is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No {asset} is set.")

    data, mime, version = stored
    etag = f'"{asset}-{version}"'
    headers = {
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": etag,
        # Belt and braces with nosniff: even if a browser were coaxed into treating
        # this as a document, it would download rather than render.
        "Content-Disposition": f'inline; filename="{asset}"',
    }

    if mime == images.SVG_MIME:
        # **The second of the two controls that make SVG upload safe.** `images.validate_svg`
        # refuses script, event handlers, external references and DOCTYPEs at upload; this
        # makes a file that somehow got past it inert anyway.
        #
        # It matters because of one asymmetry: an SVG rendered through `<img src>` — how
        # every consumer here uses it — cannot run script, but an SVG *navigated to
        # directly* is a top-level document on our own origin and can. This response is
        # what someone opening the asset URL receives.
        #
        # `default-src 'none'` forbids every fetch and every script. `style-src
        # 'unsafe-inline'` is the one allowance, because presentational CSS inside the
        # document is how SVGs are legitimately styled and cannot itself execute.
        # `sandbox` drops the response into an opaque origin, so even successful script
        # would have no access to ours.
        headers["Content-Security-Policy"] = (
            "default-src 'none'; style-src 'unsafe-inline'; sandbox"
        )

    # `If-None-Match` is a comma-separated list and may carry a `W/` weak prefix, so a
    # bare `== etag` misses legitimate matches. `*` means "any current representation",
    # which one exists, so it matches too.
    if_none_match = request.headers.get("If-None-Match", "")
    candidates = {token.strip().removeprefix("W/") for token in if_none_match.split(",")}
    if etag in candidates or "*" in candidates:
        # No body, and no Content-Type: a 304 must not carry one.
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)

    return Response(content=data, media_type=mime, headers=headers)


@router.post(
    "/branding/{asset}",
    response_model=BrandingResponse,
    dependencies=[Depends(require_password_confirmation)],
)
async def upload_asset(
    asset: AssetName,
    file: UploadFile = File(...),
    actor: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> BrandingResponse:
    """Replace a brand image. Super-admin, password-confirmed, audited.

    **The body is read with a cap, not read then checked.** `MAX_UPLOAD_BYTES + 1` is
    the most this will ever hold in memory: if the extra byte arrives, the upload is
    over the limit and is refused without allocating the rest. Reading first and
    measuring afterwards lets the caller decide how much memory the process uses.

    The file's type is decided by `images.validate` from its magic bytes. The
    `Content-Type` header and the filename are both written by the client and are
    used for nothing here.
    """
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"That file is larger than {MAX_UPLOAD_BYTES // 1024} KB.",
        )

    try:
        image = images.validate(data, asset=asset)
    except images.ImageValidationError as exc:
        # 422, not 400: the request is well-formed and the *content* is unacceptable.
        # The message is written to be shown to a user — it names the limit or the
        # allowed formats rather than saying "invalid".
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    settings_service.set_asset(db, asset, image, actor)
    return settings_service.get_branding(db)


@router.delete(
    "/branding/{asset}",
    response_model=BrandingResponse,
    dependencies=[Depends(require_password_confirmation)],
)
def delete_asset(
    asset: AssetName,
    actor: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> BrandingResponse:
    """Remove a brand image, reverting to the monogram or the bundled favicon.

    `404` when there was nothing to remove rather than a silent success, so a UI that
    thinks an asset exists finds out it does not.
    """
    if not settings_service.clear_asset(db, asset, actor):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"No {asset} is set."
        )
    return settings_service.get_branding(db)


@router.put(
    "/branding",
    response_model=BrandingResponse,
    dependencies=[Depends(require_password_confirmation)],
)
def update_branding(
    payload: UpdateBrandingRequest,
    actor: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> BrandingResponse:
    """Change the project identity. Super-admin, with a recent password confirmation.

    **Two guards, deliberately.**

    `require_super_admin` rather than `require_permission(SETTINGS_MANAGE)` because
    `ROLE_PERMISSION_MATRIX` grants `ROLE_ADMIN` the `"*"` wildcard — so putting
    `settings-manage` in the catalog hands it to every Admin on the next seed, the
    same consequence PM-32 hit with `activity-view`. The permission exists so the
    capability is visible on the role permissions page; this guard is the control.

    `require_password_confirmation` because repainting the application is a
    convincing setup for a phishing screen served from the real domain. Someone
    holding a hijacked admin session should not be able to do it — the same reasoning
    that guards enabling and disabling 2FA.

    A partial update: omitting a field leaves it alone, sending `null` clears the
    override and falls back to the environment.
    """
    return settings_service.update_branding(db, payload, actor)
