"""The API catalogue, and the guard rail it exists to be.

This is Module 15's real value and it is not documentation. `VERSION_SUMMARY.md`
argues that gating is declarative per route *"so an ungated route is obvious in
review"* — that only holds if someone looks. These tests look, on every run.

**`test_no_route_is_unexpectedly_public` is the one that matters.** It builds the
real application and fails if any route is reachable without authentication and
without a permission, unless it is on the list of routes that are public by
necessity. A new endpoint that forgets its dependency fails here rather than in
production.
"""

import pytest

from app.main import app
from app.services import api_docs_service as svc


@pytest.fixture(scope="module")
def catalogue():
    return svc.build_catalogue(app)


class TestTheCatalogueDescribesTheRealApp:
    def test_it_finds_the_routes(self, catalogue):
        assert len(catalogue) > 100

    def test_every_entry_is_complete(self, catalogue):
        for op in catalogue:
            assert op.method in {"GET", "POST", "PUT", "PATCH", "DELETE"}
            assert op.path.startswith("/")
            assert op.tag

    def test_it_reads_the_permission_off_the_dependency(self, catalogue):
        """The whole mechanism: `require_permission("activity-view")` closes over
        the name, so the catalogue recovers it without a decorator or a registry
        that someone has to remember to update."""
        activity = next(op for op in catalogue if op.path.endswith("/activity") and op.method == "GET")
        assert activity.permissions == ["activity-view"]

    def test_a_route_gated_on_two_permissions_reports_both(self, catalogue):
        """`require_any_permission` closes over a tuple; the walk flattens it."""
        multi = [op for op in catalogue if len(op.permissions) > 1]
        for op in multi:
            assert all("-" in p for p in op.permissions)


class TestTheGuardRail:
    def test_no_route_is_unexpectedly_public(self, catalogue):
        """**The test this module exists for.**

        A route with no authentication dependency and no permission is reachable
        by anyone on the internet. A handful are meant to be — signing in,
        accepting an invitation, the branding the sign-in page renders — and each
        of those is listed in `EXPECTED_PUBLIC_PATHS` with its reason.

        If this fails, either a new endpoint forgot its gate, or a genuinely
        public one needs adding to that list **with a comment saying why**. Do
        not widen the list to make a red test green.
        """
        offenders = [
            f"{op.method} {op.path}"
            for op in catalogue
            if op.is_public and not svc.is_expected_public(op.path)
        ]
        assert offenders == [], (
            "These routes are reachable without authentication: " + ", ".join(offenders)
        )

    def test_the_summary_agrees_with_the_catalogue(self, catalogue):
        summary = svc.summarise(catalogue)
        assert summary["operations"] == len(catalogue)
        assert summary["unexpected_public"] == []
        assert (
            summary["permission_gated"] + summary["auth_only"] + summary["public"]
            == summary["operations"]
        )

    def test_most_of_the_api_is_permission_gated(self, catalogue):
        """A sanity floor rather than a precise number, so it does not need
        editing every time a route is added — but it would catch a change that
        stripped gating wholesale."""
        summary = svc.summarise(catalogue)
        assert summary["permission_gated"] > summary["public"] * 3

    def test_every_expected_public_path_actually_exists(self, catalogue):
        """Stops the allowlist rotting. A path renamed in the router but left
        here would silently excuse nothing — and hide the day it matters."""
        known = {op.path for op in catalogue}
        stale = [p for p in svc.EXPECTED_PUBLIC_PATHS if p not in known]
        assert stale == [], f"No longer real routes: {stale}"


class TestTheReverseIndex:
    def test_it_answers_what_a_permission_opens(self, catalogue):
        """The question an administrator asks before granting one."""
        index = svc.permissions_in_use(catalogue)
        assert "api-token-manage" in index
        assert any("/tokens" in route for route in index["api-token-manage"])

    def test_every_indexed_permission_is_a_real_route(self, catalogue):
        index = svc.permissions_in_use(catalogue)
        for routes in index.values():
            assert routes, "a permission with no routes should not be indexed"

    def test_it_is_ordered_so_the_page_does_not_reshuffle(self, catalogue):
        index = svc.permissions_in_use(catalogue)
        assert list(index) == sorted(index)


# --- The mirror image -------------------------------------------------------
#
# `test_no_route_is_unexpectedly_public` catches a route with no permission. This
# catches a permission with no route: a checkbox on the Roles screen that grants
# nothing, which is just as invisible and rather more embarrassing — someone
# ticks it, believes they have granted something, and has not.
#
# Three permissions are legitimately not route-gated, and each is checked against
# the file that enforces it rather than merely listed. An excuse nobody verifies
# is how a genuinely dead permission hides among live ones.


class TestEveryPermissionIsEnforcedSomewhere:
    def test_no_permission_gates_nothing_at_all(self, catalogue):
        from app.core.permissions import PERMISSION_CATALOG

        declared = {
            name for _, _, _, entries in PERMISSION_CATALOG.values() for name, _ in entries
        }
        on_a_route = set(svc.permissions_in_use(catalogue))
        orphans = declared - on_a_route - set(svc.ENFORCED_ELSEWHERE)

        assert orphans == set(), (
            "These permissions gate no route and are not recorded as enforced "
            f"elsewhere, so they grant nothing: {sorted(orphans)}"
        )

    def test_every_elsewhere_claim_is_true(self):
        """Proves the excuse. If one of these goes False the permission is now
        enforced nowhere, and the entry should be deleted along with it."""
        results = svc.permissions_enforced_elsewhere()
        unproven = [name for name, found in results.items() if not found]
        assert unproven == [], f"No longer enforced where claimed: {unproven}"

    def test_the_elsewhere_list_has_not_gone_stale(self, catalogue):
        """A permission that has since gained a route should be removed from the
        list, or it excuses something that no longer needs excusing."""
        on_a_route = set(svc.permissions_in_use(catalogue))
        redundant = [name for name in svc.ENFORCED_ELSEWHERE if name in on_a_route]
        assert redundant == [], f"Now route-gated, remove from ENFORCED_ELSEWHERE: {redundant}"

    def test_every_declared_permission_is_used_by_the_catalogue_or_named(self, catalogue):
        """The whole rule in one line, stated positively."""
        from app.core.permissions import PERMISSION_CATALOG

        declared = {
            name for _, _, _, entries in PERMISSION_CATALOG.values() for name, _ in entries
        }
        accounted = set(svc.permissions_in_use(catalogue)) | set(svc.ENFORCED_ELSEWHERE)
        assert declared <= accounted
