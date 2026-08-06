"""PM-31: what a presented refresh-token `jti` is judged to be.

`classify_refresh_jti` is the security-critical branch of the whole rotation
scheme, and it was deliberately separated from the endpoint so it could be tested
on its own. It reads no database and mutates nothing, so these tests need neither.

The four outcomes each have a consequence that is wrong in a different direction:

    CURRENT  → rotate. Getting this wrong signs out every legitimate user.
    GRACE    → honour without rotating. Getting this wrong signs out anyone with
               two browser tabs, or any page firing parallel requests.
    REUSED   → revoke the entire session. Getting this wrong either leaves a
               stolen token working, or destroys sessions at random.
    UNKNOWN  → refuse. Getting this wrong grandfathers pre-rotation tokens back in.
"""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.services.session_service import RefreshOutcome, classify_refresh_jti

CURRENT_JTI = "current-jti-0001"
PREVIOUS_JTI = "previous-jti-0002"


def session(
    *,
    current: str | None = CURRENT_JTI,
    previous: str | None = None,
    rotated_seconds_ago: float = 0,
):
    """A stand-in for a `UserSession` row.

    `classify_refresh_jti` reads three attributes and nothing else, so a namespace
    is a complete substitute. Using the real model would drag in `Base`, the
    engine, and a database URL to test a pure function — and would make these tests
    fail for reasons that have nothing to do with rotation.
    """
    return SimpleNamespace(
        refresh_token_jti=current,
        previous_refresh_jti=previous,
        refresh_rotated_at=datetime.now(timezone.utc) - timedelta(seconds=rotated_seconds_ago),
    )


def test_current_token_is_current():
    assert classify_refresh_jti(session(), CURRENT_JTI) is RefreshOutcome.CURRENT


def test_previous_token_inside_the_grace_window_is_grace():
    """Why the grace window exists, and it is not a nicety.

    Strict rotation plus reuse detection has a well-known failure mode: two tabs
    refreshing at the same instant. The second presents a token that was valid
    microseconds earlier, is judged a replay, and the session dies — signing out a
    legitimate user for having two tabs open.
    """
    subject = session(previous=PREVIOUS_JTI, rotated_seconds_ago=1)
    assert classify_refresh_jti(subject, PREVIOUS_JTI) is RefreshOutcome.GRACE


def test_previous_token_after_the_grace_window_is_reuse():
    subject = session(
        previous=PREVIOUS_JTI,
        rotated_seconds_ago=settings.REFRESH_ROTATION_GRACE_SECONDS + 5,
    )
    assert classify_refresh_jti(subject, PREVIOUS_JTI) is RefreshOutcome.REUSED


def test_grace_window_boundary_is_inclusive():
    """Asserted because the comparison is `<=` and a flip to `<` is invisible.

    An off-by-one here does not break anything visibly — it just makes the window
    one instant shorter, and the symptom would be rare unexplained sign-outs.
    """
    at_edge = session(
        previous=PREVIOUS_JTI,
        rotated_seconds_ago=settings.REFRESH_ROTATION_GRACE_SECONDS - 0.5,
    )
    assert classify_refresh_jti(at_edge, PREVIOUS_JTI) is RefreshOutcome.GRACE


def test_unrecognised_token_is_reuse():
    """The consequence is severe on purpose: the whole session is revoked.

    If a superseded token is being presented, either the client replayed it or
    somebody else holds it. Letting the *current* token carry on would leave an
    attacker one rotation behind rather than locked out.
    """
    subject = session(previous=PREVIOUS_JTI, rotated_seconds_ago=1)
    assert classify_refresh_jti(subject, "never-issued-this") is RefreshOutcome.REUSED


def test_previous_token_is_reuse_when_no_previous_was_recorded():
    assert classify_refresh_jti(session(previous=None), PREVIOUS_JTI) is RefreshOutcome.REUSED


@pytest.mark.parametrize("presented", [None, ""])
def test_token_without_a_jti_is_unknown(presented):
    """Pre-rotation tokens fail closed rather than being grandfathered.

    Accepting one "until the first rotation" would leave a window in which a
    pre-rotation stolen token still works — exactly the hole rotation closes. The
    cost is that those users sign in again once.
    """
    assert classify_refresh_jti(session(), presented) is RefreshOutcome.UNKNOWN


def test_session_without_a_jti_is_unknown():
    assert classify_refresh_jti(session(current=None), CURRENT_JTI) is RefreshOutcome.UNKNOWN


def test_unknown_is_distinct_from_reused():
    """These must not collapse into one outcome.

    UNKNOWN refuses the request; REUSED destroys the session. Treating a
    pre-rotation token as evidence of theft would revoke the sessions of every user
    who happened to be signed in across the upgrade.
    """
    assert RefreshOutcome.UNKNOWN is not RefreshOutcome.REUSED
    assert classify_refresh_jti(session(current=None), "anything") is RefreshOutcome.UNKNOWN
    assert classify_refresh_jti(session(), "anything") is RefreshOutcome.REUSED


def test_classification_never_mutates_the_session():
    """It decides; the caller acts. Asserted so the two cannot merge later."""
    subject = session(previous=PREVIOUS_JTI, rotated_seconds_ago=1)
    before = (subject.refresh_token_jti, subject.previous_refresh_jti, subject.refresh_rotated_at)
    for presented in (CURRENT_JTI, PREVIOUS_JTI, "junk", None):
        classify_refresh_jti(subject, presented)
    assert (
        subject.refresh_token_jti,
        subject.previous_refresh_jti,
        subject.refresh_rotated_at,
    ) == before
