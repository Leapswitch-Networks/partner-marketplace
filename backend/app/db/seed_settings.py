"""Declare the core settings registry (LeapDesk parity, Module 11).

Port of `SettingRegistrySeeder`. **Idempotent**: `setting_service.register`
refreshes a row's metadata but never resets a value an administrator has
configured, so this is safe to run on every deploy — and must be, or a new
setting only appears for people who reset their database.

## What belongs here, and what does not

LeapDesk's seeder makes the point explicitly, and it is the rule worth keeping:
it *"deliberately seeds real, load-bearing settings rather than placeholders"*,
because the thresholds it moves here **were hardcoded constants** in the modules
that read them. Moving them is *"the first proof that the registry replaces code
changes with admin actions."*

A setting that nothing reads is worse than no setting: it implies a control that
does not exist. So every key below is either read by code today, or is read by
the module it names as soon as that module lands.

## The two groups

**`operations.*`** — LeapDesk's six, verbatim. Four of them belong to modules we
have not built (Queue Monitor, Error Tracking, System Health, Recycle Bin), and
they are seeded now on purpose: their *values* are the thing an operator tunes,
and having the registry already carrying them is what lets those modules read a
setting on day one rather than shipping another constant.

**`security.*`** — Module 12 reads this namespace and nothing else. Two of these
keys are **constants in our code right now**, named in the comments below, and
those are the ones that prove the point.
"""

from sqlalchemy.orm import Session

from app.services import setting_service


def seed_settings(db: Session) -> int:
    """Register every core setting. Returns how many exist afterwards."""

    # ── Operations ────────────────────────────────────────────────────────
    # LeapDesk's `SettingRegistrySeeder`, key for key. Their defaults are kept
    # rather than re-chosen: they are the values a comparable system has been
    # running with, which is better evidence than our guess.

    setting_service.register(
        db,
        key="operations.queue.stall_threshold_minutes",
        setting_type="int",
        module="operations",
        group="Queue Monitor",
        label="Stalled queue threshold (minutes)",
        default=10,
        description="Pending work older than this marks a queue as stalled.",
    )
    setting_service.register(
        db,
        key="operations.queue.retention_completed_days",
        setting_type="int",
        module="operations",
        group="Queue Monitor",
        label="Keep completed job history (days)",
        default=14,
        description="Completed runs older than this are pruned nightly.",
    )
    setting_service.register(
        db,
        key="operations.queue.retention_failed_days",
        setting_type="int",
        module="operations",
        group="Queue Monitor",
        label="Keep failed job history (days)",
        default=90,
        description="Failed runs older than this are pruned nightly.",
    )
    setting_service.register(
        db,
        key="operations.errors.record_outside_production",
        setting_type="bool",
        module="operations",
        group="Error Tracking",
        label="Record errors outside production",
        default=True,
        description="Capture errors from local and staging environments too.",
    )
    setting_service.register(
        db,
        key="operations.health.log_warn_mb",
        setting_type="int",
        module="operations",
        group="System Health",
        label="Warn when logs exceed (MB)",
        default=50,
        description="System Health reports a warning above this log size.",
    )
    setting_service.register(
        db,
        key="operations.recycle_bin.retention_days",
        setting_type="int",
        module="operations",
        group="Recycle Bin",
        label="Keep deleted records for (days)",
        default=90,
        description="Soft-deleted records are purged permanently after this.",
    )

    # ── Security ──────────────────────────────────────────────────────────
    # Module 12's namespace. **Every default reproduces today's behaviour**, so
    # this screen changes nothing until someone deliberately tightens something.
    # That property is what makes a security-settings page safe to ship, and it
    # is a rule rather than a coincidence — a default that hardened something on
    # deploy would lock people out of a system they had not been asked about.

    setting_service.register(
        db,
        key="security.invitations.expiry_days",
        setting_type="int",
        module="core",
        group="Invitations",
        label="Invitation expires after (days)",
        # Mirrors `invitation_service.INVITATION_TTL_DAYS`, which is 7 and is
        # read in two places. **The constant is still what the code uses** — this
        # row records the value so Module 12 can switch the reads over without
        # also having to invent the setting. Changing it here changes nothing
        # until that happens, and the description says so.
        default=7,
        description=(
            "Not yet enforced — the code still reads a constant. "
            "Wired up with Module 12."
        ),
    )
    setting_service.register(
        db,
        key="security.invitations.max_resends",
        setting_type="int",
        module="core",
        group="Invitations",
        label="Maximum resends per invitation",
        # LeapDesk enforces a cap; we count resends (`invitations.resent_count`)
        # and do not yet limit them. Seeded at their value.
        default=5,
        description=(
            "Not yet enforced — resends are counted but uncapped. "
            "Wired up with Module 12."
        ),
    )
    setting_service.register(
        db,
        key="security.reauth.window_minutes",
        setting_type="int",
        module="core",
        group="Reauth Gates",
        label="Password confirmation valid for (minutes)",
        # This one IS live behaviour today, as
        # `settings.PASSWORD_CONFIRMATION_TIMEOUT_MINUTES` = 180, read by
        # `require_password_confirmation`. Seeded at the same number so the row
        # tells the truth about the running system on the day it appears.
        default=180,
        description=(
            "How long after confirming a password that confirmation is accepted. "
            "Currently read from configuration, not from here."
        ),
    )
    setting_service.register(
        db,
        key="security.audit.permission_changes",
        setting_type="bool",
        module="core",
        group="Audit",
        label="Log role and permission changes",
        # Already true of our behaviour: `rbac_service` records every grant
        # change to the activity log. Default `True` therefore describes what
        # already happens.
        default=True,
        description="Write an activity-log entry whenever a role's grants change.",
    )

    db.commit()
    return len(setting_service.list_settings(db))


if __name__ == "__main__":  # pragma: no cover - operational entry point
    from app.db.session import SessionLocal

    with SessionLocal() as session:
        total = seed_settings(session)
        print(f"[settings] registry reconciled: {total} settings")
