"""The role hierarchy, pinned so it cannot drift.

**Two tiers exist in code, and only two** — which is worth stating because the
hierarchy is usually described in four ("Root, then SuperAdmin and
BackendDeveloper, then Admin, then everyone else"). That description is a
*convention*; what the code enforces is:

| Tier | Set | What it means |
|---|---|---|
| Bypass | `SUPER_ADMIN_ROLES` | every permission check returns True |
| All data | `ADMIN_ACCESS_ROLES` | sees every record, permissions still apply |

`RootUser` and `SuperAdmin` are **identical to the code**. Nothing distinguishes
them, here or in the reference — the seniority between them is organisational,
and if it should be enforced it needs a rule that does not exist yet in either
system. Recorded here rather than left as a surprise to whoever assumes it.

Verified against LeapDesk source 2026-08-12: `AppServiceProvider::Gate::before`
and `AdminAccess::$superAdminRoles` are both `['RootUser', 'BackendDeveloper']`;
`helpers.php::admin_roles()` is `['RootUser', 'SuperAdmin', 'Admin',
'BackendDeveloper']`.
"""

import pytest

from app.core.permissions import (
    ADMIN_ACCESS_ROLES,
    PROTECTED_ROLES,
    ROLE_ADMIN,
    ROLE_BACKEND_DEVELOPER,
    ROLE_DESCRIPTIONS,
    ROLE_PARTNER,
    ROLE_PERMISSION_MATRIX,
    ROLE_ROOT,
    ROLE_SALES,
    ROLE_STAFF,
    ROLE_SUPER_ADMIN,
    ROLE_USER,
    SUPER_ADMIN_ROLES,
)


class TestTheBypassTier:
    def test_root_and_backend_developer_bypass_every_check(self):
        """The reference's exact pair — the two roles that must never see a 403
        from a permission that has not been seeded into their assignments."""
        assert ROLE_ROOT in SUPER_ADMIN_ROLES
        assert ROLE_BACKEND_DEVELOPER in SUPER_ADMIN_ROLES

    def test_super_admin_also_bypasses_here_and_that_is_a_divergence(self):
        """Ours keeps SuperAdmin in the bypass; the reference does not.

        Deliberate: SuperAdmin is documented as emergency access and has held
        this since the RBAC rebuild, so removing it would be a privilege
        reduction to a live role decided by a comparison rather than by anyone.
        """
        assert ROLE_SUPER_ADMIN in SUPER_ADMIN_ROLES

    @pytest.mark.parametrize(
        "role", [ROLE_ADMIN, ROLE_SALES, ROLE_STAFF, ROLE_PARTNER, ROLE_USER]
    )
    def test_nobody_else_bypasses(self, role):
        """**Admin does not bypass**, and the distinction is easy to lose: Admin
        holds `"*"` in the matrix, so it has every permission — but it acquires
        them as grants, which means a permission added since the last seed stops
        it, and shows up on the Roles screen as something it holds."""
        assert role not in SUPER_ADMIN_ROLES


class TestTheDataTier:
    def test_it_matches_the_references_admin_roles_exactly(self):
        assert {
            ROLE_ROOT,
            ROLE_SUPER_ADMIN,
            ROLE_ADMIN,
            ROLE_BACKEND_DEVELOPER,
        } == ADMIN_ACCESS_ROLES

    def test_every_bypassing_role_also_sees_all_data(self):
        """A role that can do anything but sees only its own rows would be an
        incoherent set — and the kind that produces an empty screen nobody can
        explain."""
        assert SUPER_ADMIN_ROLES <= ADMIN_ACCESS_ROLES

    @pytest.mark.parametrize("role", [ROLE_SALES, ROLE_STAFF, ROLE_PARTNER, ROLE_USER])
    def test_the_scoped_roles_are_scoped(self, role):
        assert role not in ADMIN_ACCESS_ROLES


class TestBackendDeveloper:
    def test_it_holds_every_permission_explicitly_as_well(self):
        """Belt and braces on purpose: the grant is what the Roles screen shows a
        reader, the bypass is what survives a new permission."""
        assert ROLE_PERMISSION_MATRIX[ROLE_BACKEND_DEVELOPER] == "*"

    def test_it_cannot_be_renamed_or_deleted(self):
        """**Its name is hardcoded in the bypass set.** A rename would silently
        detach the rule — the role keeps its label and loses its power, or a new
        role created under the old name inherits it."""
        assert ROLE_BACKEND_DEVELOPER in PROTECTED_ROLES

    def test_every_hardcoded_bypass_name_is_protected(self):
        """The general form of the rule above: if a role name is a security
        rule, that name must not be editable."""
        assert SUPER_ADMIN_ROLES <= PROTECTED_ROLES

    def test_it_describes_itself_as_privileged_not_as_a_job_title(self):
        description = ROLE_DESCRIPTIONS[ROLE_BACKEND_DEVELOPER].lower()
        assert "bypass" in description


class TestRootAndSuperAdminAreIndistinguishable:
    def test_no_rule_separates_them(self):
        """The hierarchy is usually described with Root above SuperAdmin. **No
        code anywhere enforces that**, in this project or the reference. Stated
        as a test so the assumption fails loudly here rather than quietly in a
        review."""
        for group in (SUPER_ADMIN_ROLES, ADMIN_ACCESS_ROLES, PROTECTED_ROLES):
            assert (ROLE_ROOT in group) == (ROLE_SUPER_ADMIN in group)
        assert ROLE_PERMISSION_MATRIX[ROLE_ROOT] == ROLE_PERMISSION_MATRIX[ROLE_SUPER_ADMIN]


class TestSales:
    def test_it_holds_the_references_four_grants_and_no_more(self):
        """Ported name for name. **Narrow on purpose**: no `user-view`, so a
        salesperson cannot read the staff directory, and no
        `ai-assistant-query-database`, so the assistant converses with them but
        does not read records for them. Both omissions are the reference's."""
        assert set(ROLE_PERMISSION_MATRIX[ROLE_SALES]) == {
            "dashboard-view",
            "settings-view",
            "settings-update",
            "ai-assistant-use",
        }

    def test_it_is_not_a_synonym_for_staff(self):
        """Staff is ours and reads across the admin modules; Sales is the
        reference's and reads nobody else's records. Merging them would quietly
        widen one of the two."""
        assert ROLE_PERMISSION_MATRIX[ROLE_SALES] != ROLE_PERMISSION_MATRIX[ROLE_STAFF]


class TestEveryRoleIsAccountedFor:
    def test_the_matrix_covers_every_declared_role(self):
        declared = {
            ROLE_ROOT, ROLE_SUPER_ADMIN, ROLE_BACKEND_DEVELOPER,
            ROLE_ADMIN, ROLE_SALES, ROLE_STAFF, ROLE_PARTNER, ROLE_USER,
        }
        assert set(ROLE_PERMISSION_MATRIX) == declared
        assert set(ROLE_DESCRIPTIONS) == declared
