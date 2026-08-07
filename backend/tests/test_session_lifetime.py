"""How long a session lives, and whether "keep me signed in" is honoured.

This exists because the checkbox was decorative for months. The form posted
nothing the backend understood, so every session lasted `REFRESH_TOKEN_EXPIRE_DAYS`
whether or not the box was ticked — a feature that appeared to work, produced no
error, and did nothing. Nothing failed, so nothing caught it.

Verified end to end against the running stack on 2026-08-07: ticked → a 30-day
session, unticked → 7, omitted → 7, and a refresh preserves the longer life. These
tests are the durable half of that check. They read no database — the three
functions under test are pure — so they run in the default suite rather than behind
the `db` marker.

The two directions of failure are not symmetric. Too short is the visible one: the
user is signed out early and complains, which is how this was found. Too long is
the dangerous one, and it is silent — an unticked box handing out a 30-day session
means an abandoned browser on a shared machine stays signed in for a month. So the
default matters as much as the feature, and it is asserted here twice: once for
`False`, once for a payload that omits the field entirely.
"""

from datetime import datetime, timedelta, timezone

from jose import jwt

from app.api.auth import _remaining_seconds, _session_lifetime_days
from app.core.config import settings
from app.core.security import create_refresh_token
from app.schemas.auth import LoginRequest, TwoFactorChallengeRequest

SESSION_ID = "11111111-1111-1111-1111-111111111111"
USER_ID = "22222222-2222-2222-2222-222222222222"
JTI = "jti-0001"


def decode(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


# --- The choice reaches the lifetime ----------------------------------------


def test_ticked_box_extends_the_session():
    assert _session_lifetime_days(True) == settings.REMEMBER_ME_DAYS


def test_unticked_box_gets_the_ordinary_lifetime():
    assert _session_lifetime_days(False) == settings.REFRESH_TOKEN_EXPIRE_DAYS


def test_remember_me_is_actually_longer():
    """Guards the config, not the code.

    If someone sets `REMEMBER_ME_DAYS` at or below `REFRESH_TOKEN_EXPIRE_DAYS`, every
    test above still passes while the feature silently does nothing — or shortens the
    session, which is worse than not having it.
    """
    assert settings.REMEMBER_ME_DAYS > settings.REFRESH_TOKEN_EXPIRE_DAYS


# --- The default is the short session ---------------------------------------


def test_login_defaults_to_the_short_session():
    assert LoginRequest(email="a@example.com", password="x").remember_me is False


def test_two_factor_challenge_defaults_to_the_short_session():
    """The 2FA path creates the session two requests after the box was ticked.

    Which makes it the path most likely to lose the choice, and the one where a
    wrong default is least likely to be noticed.
    """
    assert TwoFactorChallengeRequest(challenge_token="t").remember_me is False


def test_both_paths_accept_the_choice():
    assert LoginRequest(email="a@example.com", password="x", remember_me=True).remember_me
    assert TwoFactorChallengeRequest(challenge_token="t", remember_me=True).remember_me


# --- Cookie lifetime tracks the session's remaining life --------------------


def test_no_expiry_falls_back_to_the_configured_default():
    """An older call site that passes nothing must still get a usable cookie."""
    assert _remaining_seconds(None) == settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


def test_remaining_life_is_measured_from_the_session_row():
    expires = datetime.now(timezone.utc) + timedelta(days=30)
    remaining = _remaining_seconds(expires)
    # A couple of seconds of slack for the clock between the two calls.
    assert 30 * 86400 - 5 <= remaining <= 30 * 86400


def test_a_refresh_does_not_slide_the_window_forward():
    """The session's absolute expiry is the authority.

    Refreshing on day 20 of a 30-day session must issue a cookie with 10 days left,
    not a fresh 30. Otherwise a session anyone keeps touching never expires at all.
    """
    twenty_days_in = datetime.now(timezone.utc) + timedelta(days=10)
    assert _remaining_seconds(twenty_days_in) <= 10 * 86400


def test_an_almost_expired_session_never_mints_max_age_zero():
    """`Max-Age=0` means *delete now*.

    A session with two seconds left would sign the user out at the exact moment the
    code was trying to keep them in — so the floor is one minute, and the guard
    itself expires the session a moment later.
    """
    assert _remaining_seconds(datetime.now(timezone.utc) + timedelta(seconds=2)) == 60
    assert _remaining_seconds(datetime.now(timezone.utc) - timedelta(days=1)) == 60


# --- The token agrees with the cookie ---------------------------------------


def test_refresh_token_honours_an_explicit_lifetime():
    """A 30-day session must not hand out a token that dies on day 7.

    That combination is the worst of both: the session is alive, the cookie is
    present, and the token in it is rejected — so the user is signed out while every
    piece of state says they should not be.
    """
    token = create_refresh_token(USER_ID, SESSION_ID, JTI, expires_in=timedelta(days=30))
    claims = decode(token)
    span = claims["exp"] - claims["iat"]
    assert 30 * 86400 - 5 <= span <= 30 * 86400


def test_refresh_token_without_a_lifetime_uses_the_configured_default():
    claims = decode(create_refresh_token(USER_ID, SESSION_ID, JTI))
    span = claims["exp"] - claims["iat"]
    assert span == settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400


def test_an_extended_token_is_still_a_refresh_token_carrying_its_jti():
    """Widening the lifetime must not have cost the claims rotation depends on."""
    claims = decode(
        create_refresh_token(USER_ID, SESSION_ID, JTI, expires_in=timedelta(days=30))
    )
    assert claims["type"] == "refresh"
    assert claims["jti"] == JTI
    assert claims["sid"] == SESSION_ID
