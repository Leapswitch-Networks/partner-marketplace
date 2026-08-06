"""PM-13: the `type` assertion is the only thing separating the token kinds.

This is the single most important property in the auth layer, and the register is
explicit about why: the assertion is *all* that stops a seven-day refresh token
being replayed as an hour-long access token, or a 2FA challenge token — which
means "passed the password, not yet authenticated" — being used as a session.

It was previously re-implemented at five call sites and is now centralised in
`decode_typed_token`. That refactor removed the duplication; these tests are what
stop it being quietly undone. A regression here does not raise, does not log, and
does not fail any other test: everything keeps working, and one kind of token
becomes interchangeable with another.

The register records this being verified by hand on 2026-08-03 — a refresh token
used as an access token returned 401, and vice versa. That verification was a
shell session that happened once. This is the same check, repeatable.
"""

from datetime import timedelta

import pytest

from app.core import security
from app.core.security import TokenError

USER_ID = "11111111-2222-3333-4444-555555555555"
SESSION_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

#: Every token kind the codebase mints, with a factory and the type it must claim.
TOKEN_KINDS = {
    "access": lambda: security.create_access_token(USER_ID, SESSION_ID),
    "refresh": lambda: security.create_refresh_token(USER_ID, SESSION_ID, "jti-1"),
    "two_factor": lambda: security.create_two_factor_challenge_token(USER_ID),
    "email_verification": lambda: security.create_email_verification_token(
        USER_ID, "person@example.com"
    ),
}


@pytest.mark.parametrize("kind", sorted(TOKEN_KINDS))
def test_token_decodes_as_its_own_type(kind):
    payload = security.decode_typed_token(TOKEN_KINDS[kind](), kind)
    assert payload["type"] == kind
    assert payload["sub"] == USER_ID


@pytest.mark.parametrize("issued", sorted(TOKEN_KINDS))
@pytest.mark.parametrize("presented_as", sorted(TOKEN_KINDS))
def test_no_token_is_accepted_as_another_type(issued, presented_as):
    """The full 4×4 matrix, minus the diagonal. 12 rejections.

    Enumerated rather than spot-checked because the failure this guards against is
    a *new* token type added without the assertion. A matrix generated from
    `TOKEN_KINDS` grows automatically when the fifth kind is added; a hand-written
    list of pairs would not, and the new kind would be untested by default.
    """
    if issued == presented_as:
        pytest.skip("the diagonal is the positive case, covered above")

    with pytest.raises(TokenError):
        security.decode_typed_token(TOKEN_KINDS[issued](), presented_as)


def test_access_token_carries_the_session_id():
    """`sid` is what makes revocation possible at all.

    A JWT cannot be un-issued, so the guard checks the named session is still live.
    Without `sid`, logout could do nothing but clear a cookie — the browser would
    forget the token while the token stayed valid for its full hour.
    """
    payload = security.decode_typed_token(
        security.create_access_token(USER_ID, SESSION_ID), "access", require=("sub", "sid")
    )
    assert payload["sid"] == SESSION_ID


def test_two_factor_token_has_no_session_id():
    """Deliberate: there is no session until the second factor is supplied.

    A caller stuck at the challenge must hold nothing that `get_current_user` will
    accept. Asserting the absence proves the intermediate token cannot be upgraded
    by a guard that only checked `sid` was present.
    """
    payload = security.decode_typed_token(
        security.create_two_factor_challenge_token(USER_ID), "two_factor"
    )
    assert "sid" not in payload

    with pytest.raises(TokenError):
        security.decode_typed_token(
            security.create_two_factor_challenge_token(USER_ID),
            "two_factor",
            require=("sid",),
        )


def test_missing_required_claim_is_rejected():
    """A pre-sessions token must fail closed, not be grandfathered in.

    `_decode_access_token` requires `sid` rather than treating its absence as
    "fine". Accepting one would let any token minted before sessions existed bypass
    revocation entirely — which is the exact hole sessions were added to close.
    """
    token = security.create_two_factor_challenge_token(USER_ID)  # has sub, no sid
    with pytest.raises(TokenError):
        security.decode_typed_token(token, "two_factor", require=("sub", "sid"))


def test_refresh_token_carries_its_jti():
    """PM-31: the `jti` is what makes rotation real rather than nominal.

    Without it, "rotation" means only issuing a new token while the previous one
    keeps working for its full seven days.
    """
    payload = security.decode_typed_token(
        security.create_refresh_token(USER_ID, SESSION_ID, "jti-abc"),
        "refresh",
        require=("sub", "sid", "jti"),
    )
    assert payload["jti"] == "jti-abc"


def test_tampered_signature_is_rejected():
    token = security.create_access_token(USER_ID, SESSION_ID)
    header, payload, signature = token.split(".")
    forged = f"{header}.{payload}.{signature[:-4]}AAAA"
    with pytest.raises(TokenError):
        security.decode_typed_token(forged, "access")


def test_expired_token_is_rejected(monkeypatch):
    """An access token past `exp` must not decode, however well-formed."""
    monkeypatch.setattr(
        security, "_create_token", _expired_token_factory(security._create_token)
    )
    with pytest.raises(TokenError):
        security.decode_typed_token(
            security.create_access_token(USER_ID, SESSION_ID), "access"
        )


def _expired_token_factory(original):
    """Wrap `_create_token` so it mints tokens that expired an hour ago.

    Patching the factory rather than freezing the clock keeps this test free of a
    time-mocking dependency, and it exercises the real `jwt.decode` expiry check
    rather than a simulation of it.
    """

    def create(subject, expire_delta, token_type, session_id):
        return original(subject, timedelta(hours=-1), token_type, session_id)

    return create


@pytest.mark.parametrize("token", [None, "", "not-a-jwt", "a.b.c"])
def test_absent_or_malformed_tokens_are_rejected(token):
    with pytest.raises(TokenError):
        security.decode_typed_token(token, "access")


def test_token_error_does_not_leak_which_check_failed_to_the_client():
    """One exception type for every failure mode, deliberately.

    Telling a client "expired" versus "wrong type" versus "bad signature" tells an
    attacker which part of a forgery attempt to change next. The distinction is
    useful to nobody but the forger, so callers get `TokenError` and turn it into a
    flat 401.
    """
    failures = [
        lambda: security.decode_typed_token(None, "access"),
        lambda: security.decode_typed_token("garbage", "access"),
        lambda: security.decode_typed_token(
            security.create_refresh_token(USER_ID, SESSION_ID, "j"), "access"
        ),
    ]
    for failure in failures:
        with pytest.raises(TokenError):
            failure()
