"""The invariant that keeps `can_edit` safe — TECH_DEBT PM-46.

`partner_service.can_edit()` is **permission-only**:

    def can_edit(actor: User, partner: Partner) -> bool:
        return actor.has_permission(PARTNER_UPDATE)

No tenancy narrowing, and deliberately so — `partner-update` means "staff may
edit **any** partner", which is why `api/partners.py` keeps it off the
`/partners/me` routes. Its three siblings are not like this: `can_delete`,
`can_change_status` and `can_verify` each refuse when
`actor.organisation_id == partner.id`, but note what that check is *for* — it
stops an actor acting on **their own** organisation (self-approval, lifting your
own suspension). None of them stops an actor acting on **someone else's**.

So the safety of the whole id-taking partner write surface rests on one fact:
**no role whose members sit inside an organisation may hold `partner-update`.**
Measured 2026-08-20 — it is granted only through the four wildcard roles
(Admin, BackendDeveloper, RootUser, SuperAdmin), and no account holding any of
them has an `organisation_id`. That fact is currently an accident of
configuration rather than anything enforced, and it is exactly the kind of thing
a future role change breaks silently: the read path
(`get_partner_for` → `scoping.assert_can_read`) would refuse a row that the
write path would happily update.

This file makes the fact enforced. It is a registry test, not a database one, so
it fails in CI on the code alone without needing a seeded install.

**If this test fails, do not add the grant and delete the assertion.** Either the
permission is genuinely wanted on a partner-facing role — in which case
`can_edit` needs the tenancy check first, and that is a deliberate authorization
change for the owner to approve (see PM-46) — or the grant is a mistake.
"""

from __future__ import annotations

from app.core.permissions import ROLE_PERMISSION_MATRIX, all_permission_names
from app.domain.partners.permissions import (
    PARTNER_APPROVE,
    PARTNER_DELETE,
    PARTNER_UPDATE,
    PARTNER_VERIFY,
    ROLE_PARTNER,
)

#: The id-taking partner writes whose guard is permission-only or
#: own-organisation-only. Every one of them edits a row belonging to a tenant,
#: and none of them narrows to the actor's tenant.
_UNSCOPED_PARTNER_WRITES = [PARTNER_UPDATE, PARTNER_DELETE, PARTNER_APPROVE, PARTNER_VERIFY]


def _explicitly_granted_roles(permission: str) -> list[str]:
    """Roles carrying `permission` by name, ignoring the wildcard roles.

    A wildcard (`"*"`) role is an admin role by definition — it holds every
    permission that exists, including ones added after it was written — and those
    are the roles this permission is *meant* for. What matters is an **explicit**
    grant, because that is what someone types when extending a named role.
    """
    return sorted(
        role
        for role, grants in ROLE_PERMISSION_MATRIX.items()
        if grants != "*" and permission in grants
    )


def test_the_partner_role_holds_no_unscoped_partner_write():
    """The role a real partner account actually gets.

    `ROLE_PARTNER` is the one whose members always have an `organisation_id`, so
    it is the role where an unscoped write permission turns directly into "one
    partner can edit a competitor".
    """
    grants = ROLE_PERMISSION_MATRIX.get(ROLE_PARTNER, [])
    assert grants != "*", (
        f"{ROLE_PARTNER} has become a wildcard role, which would give every "
        "partner account every permission in the application"
    )

    held = sorted(p for p in _UNSCOPED_PARTNER_WRITES if p in grants)
    assert held == [], (
        f"{ROLE_PARTNER} now holds {held}. These writes take a partner id and "
        "apply no tenancy narrowing, so a partner account holding one can act on "
        "another organisation's row — while the read path refuses it. Read this "
        "file's docstring before changing the assertion."
    )


def test_no_explicitly_granted_role_holds_an_unscoped_partner_write():
    """Nothing outside the wildcard roles may hold these.

    Broader than the test above on purpose. The risk is not only `ROLE_PARTNER`:
    any named role could later be handed to accounts inside an organisation, and
    a grant added to one of those is the same hole by a different route.
    """
    offenders = {
        permission: roles
        for permission in _UNSCOPED_PARTNER_WRITES
        if (roles := _explicitly_granted_roles(permission))
    }
    assert offenders == {}, (
        f"unscoped partner writes are explicitly granted to named roles: "
        f"{offenders}. Each of these permissions edits a row belonging to a "
        "tenant without narrowing to the actor's tenant, so it is safe only "
        "while it stays confined to the wildcard admin roles. If one of these "
        "roles is meant to have it, `partner_service.can_edit` (and the sibling "
        "predicates) need the tenancy check first — see PM-46."
    )


def test_the_permissions_these_tests_name_still_exist():
    """Guards the guard.

    Both assertions above pass **trivially** if one of these permissions is
    renamed or removed: the membership checks would simply find nothing and
    report no offenders, so the suite would go green while the protection
    disappeared. Pinning the names against the catalog is what stops a rename
    turning these tests silent.
    """
    catalog = set(all_permission_names())
    missing = sorted(p for p in _UNSCOPED_PARTNER_WRITES if p not in catalog)
    assert missing == [], (
        f"{missing} are named by this suite but are not in the permission "
        "catalog. If one was renamed, update `_UNSCOPED_PARTNER_WRITES` — the "
        "tests above are meaningless without it."
    )

    assert ROLE_PARTNER in ROLE_PERMISSION_MATRIX, (
        f"{ROLE_PARTNER!r} is not a registered role, so the first test is "
        "asserting against an empty grant list"
    )

    # And at least one role must actually be able to administer partners, or the
    # application has no route to approving one.
    assert any(g == "*" for g in ROLE_PERMISSION_MATRIX.values()), (
        "no wildcard role exists, so nothing can administer partners"
    )
