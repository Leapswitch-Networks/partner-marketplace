"""The purge command's argument handling and cutoff maths.

PM-43 gave two dead purge functions a caller. What is tested here is everything that
decides **whether and how much gets deleted**, without touching a database:

  * the audit trail is never trimmed unless asked — deleting evidence must be an
    instruction, not a default a cron line inherits
  * a mistyped retention is refused rather than read as "everything"
  * the dry-run count and the real delete share one cutoff, so a dry run cannot report
    a different number from the delete it is previewing

The delete itself needs a live database and is exercised by hand against the running
stack; those runs are recorded in DAILY_CHANGES.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.db.maintenance import SESSION_RETENTION_DAYS, _parse_args
from app.services import activity_service, session_service

# --- Defaults ---------------------------------------------------------------


def test_audit_log_is_not_trimmed_by_default():
    """The most important default in this module.

    Sessions expire and clearing them is housekeeping. How long who-did-what is kept is
    policy — so `docker compose run backend python -m app.db.maintenance` in a cron
    line must never quietly start deleting audit history.
    """
    args = _parse_args([])
    assert args.activity is False


def test_session_retention_defaults_to_thirty_days():
    assert _parse_args([]).session_days == SESSION_RETENTION_DAYS == 30


def test_activity_retention_defaults_to_the_configured_policy():
    """Not a literal here: the number belongs to configuration, not to this command."""
    args = _parse_args([])
    assert args.activity_days == settings.ACTIVITY_LOG_RETENTION_DAYS


def test_dry_run_is_off_by_default():
    assert _parse_args([]).dry_run is False


# --- Explicit flags ---------------------------------------------------------


def test_activity_must_be_asked_for():
    assert _parse_args(["--activity"]).activity is True


def test_sessions_only_is_accepted_alongside_activity():
    """Both present means sessions only.

    `--sessions-only` exists so a cron line can state its intent rather than relying on
    the absence of a flag. If the two ever contradicted, the safe reading is the one
    that deletes less — asserted in `run()` as `activity and not sessions_only`.
    """
    args = _parse_args(["--activity", "--sessions-only"])
    assert args.activity and args.sessions_only
    assert not (args.activity and not args.sessions_only)


def test_retentions_are_independently_overridable():
    args = _parse_args(["--session-days", "7", "--activity", "--activity-days", "365"])
    assert args.session_days == 7
    assert args.activity_days == 365


# --- Cutoff maths -----------------------------------------------------------


@pytest.mark.parametrize("days", [1, 7, 30, 365, 730])
def test_session_cutoff_is_that_many_days_ago(days):
    cutoff = session_service._purge_cutoff(days)
    delta = datetime.now(timezone.utc) - cutoff
    assert abs(delta - timedelta(days=days)) < timedelta(seconds=5)


@pytest.mark.parametrize("days", [1, 30, 730])
def test_activity_cutoff_is_that_many_days_ago(days):
    cutoff = activity_service._purge_cutoff(days)
    assert cutoff is not None
    delta = datetime.now(timezone.utc) - cutoff
    assert abs(delta - timedelta(days=days)) < timedelta(seconds=5)


@pytest.mark.parametrize("days", [0, -1, -730])
def test_a_non_positive_audit_retention_is_refused(days):
    """A stray `0` in a config file must not be read as "delete everything".

    This is the guard that stands between a typo and an erased audit trail, so it is
    asserted rather than trusted to the docstring that describes it.
    """
    with pytest.raises(ValueError, match="positive"):
        activity_service._purge_cutoff(days)


def test_an_absurd_retention_returns_no_cutoff_rather_than_crashing():
    """`timedelta` overflows long before `days` stops being a plausible typo.

    "Nothing is that old" is the semantically correct answer, so the count and the
    delete both report 0 instead of raising. Found by passing 999999 while testing the
    guard above.
    """
    assert activity_service._purge_cutoff(999_999) is None


def test_count_and_purge_share_one_cutoff():
    """The property that makes `--dry-run` trustworthy.

    Both functions call `_purge_cutoff`, so a dry run cannot preview a different set of
    rows from the delete that follows it. Asserted by identity of the helper rather
    than by running both, which would need a database.
    """
    import inspect

    for module in (session_service, activity_service):
        count_src = inspect.getsource(module.count_purgeable)
        purge_name = "purge_expired" if module is session_service else "purge_older_than"
        purge_src = inspect.getsource(getattr(module, purge_name))
        assert "_purge_cutoff(" in count_src, f"{module.__name__}.count_purgeable"
        assert "_purge_cutoff(" in purge_src, f"{module.__name__}.{purge_name}"
