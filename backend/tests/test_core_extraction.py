"""The core must stay liftable into a second project.

`CORE_EXTRACTION_PLAN.md` exists because the partner directory had grown into
the platform layer in five places, and lifting the core meant hand-editing three
shared literals and hoping nothing was missed. Phase 1 replaced those literals
with a registration seam.

**This file is what stops the seam rotting.** Every assertion below fails the
moment core code names a domain concept again — which is exactly the change
nobody notices in review, because adding one `PARTNER_VIEW` to a core list looks
harmless and reads as tidy.

The strongest test here is `TestTheCoreAssemblesWithNoDomain`: it empties the
registry, re-registers only the core, and asserts a complete, coherent RBAC
vocabulary comes out with no partner vocabulary in it. That is the property a
second project depends on, and nothing else proves it.
"""

from __future__ import annotations

import ast
import pathlib

import pytest

from app.core import nav, registry
from app.core.permissions import (
    PERMISSION_CATALOG,
    ROLE_DESCRIPTIONS,
    ROLE_PERMISSION_MATRIX,
    all_permission_names,
)
from app.core.roles import CORE_ROLE_DESCRIPTIONS, ROLE_STAFF, ROLE_USER

BACKEND = pathlib.Path(__file__).resolve().parents[1]
CORE_DIR = BACKEND / "app" / "core"
DOMAIN_DIR = BACKEND / "app" / "domain"

#: The word that means "this is the partner directory" rather than "this is a
#: platform concept". Matched case-insensitively against IDENTIFIERS only.
#:
#: Deliberately narrow: `organisation` is NOT here, because the core legitimately
#: owns a tenancy concept — it is the *partner* spelling of it that must not leak
#: back in.
DOMAIN_TOKEN = "partner"

# --- What the check looks at, and what it deliberately ignores ---------------
#
# **Identifiers, not text.** Three exclusions, each load-bearing:
#
# 1. **Comments and docstrings.** The core documents its own boundary, which
#    requires saying the word. A rule that banned it from prose would push the
#    reasoning out of the code — the opposite of what this repo optimises for.
# 2. **String literals.** `config.APP_NAME`'s default is "Partner Marketplace":
#    branding, which `DYNAMIC_BRANDING_PLAN.md` already makes configurable, not
#    a structural dependency.
# 3. **Bytes literals — and this one would be a data-loss bug if "fixed".**
#    `encryption._HKDF_INFO` is `b"partner-marketplace/field-encryption/v1"`, a
#    cryptographic domain-separation constant. Changing that string changes the
#    derived key, and **every value already encrypted with it becomes
#    undecryptable** — 2FA secrets and stored API credentials. It must be renamed
#    only alongside a re-encryption migration, never as tidying.
#
# The first version of this check scanned raw text and flagged exactly that
# constant, which is why the AST walk below exists.

#: Identifier-level exceptions. **Empty, and that is the point.**
#:
#: It held one entry between phases 1 and 2 —
#: `core/dependencies.py::_assert_organisation_active` read `user.partner` to
#: enforce the organisation gate on every authenticated request. Phase 2
#: replaced that with `user.organisation` behind `core.tenancy.Organisation`
#: (migration `c9a71f4e2b60`), so the core now names no part of the partner
#: directory anywhere in executable code.
CORE_DOMAIN_IDENTIFIER_EXCEPTIONS: set[str] = set()


def _python_files(root: pathlib.Path) -> list[pathlib.Path]:
    return sorted(p for p in root.rglob("*.py") if "__pycache__" not in p.parts)


#: Modules whose import writes into the registries. Re-importing one of these
#: against a non-empty registry raises "already registered", so they are always
#: evicted and re-imported together with a reset.
_REGISTERING_MODULES = ("app.core.permissions", "app.services.navigation_service")


def _clear_registering_modules() -> None:
    """Empty both registries and evict every module that populates them.

    `importlib.reload` is deliberately NOT used. Reloading `app.core.permissions`
    re-runs its `import app.domain`, which finds the package already in
    `sys.modules` and runs none of its registration side effects — so the domain
    would silently vanish from a "rebuilt" catalog. Evicting and importing fresh
    is the only thing that actually re-runs both halves.
    """
    import sys

    registry.reset_for_tests()
    nav.reset_for_tests()
    for name in list(sys.modules):
        if name.startswith("app.domain") or name in _REGISTERING_MODULES:
            sys.modules.pop(name, None)


def _rebuild_registries() -> None:
    """Restore the real, fully-assembled world after a test has torn it down."""
    import importlib

    _clear_registering_modules()
    for name in _REGISTERING_MODULES:
        importlib.import_module(name)


def _identifiers(path: pathlib.Path) -> set[str]:
    """Every name the module defines or references.

    Walks the AST rather than the text, so comments, docstrings and string
    literals are excluded by construction rather than by a fragile line filter —
    which is what the first version of this check used, and it flagged a
    cryptographic constant that must never change.
    """
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            names.add(node.id)
        elif isinstance(node, ast.Attribute):
            names.add(node.attr)
        elif isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef):
            names.add(node.name)
        elif isinstance(node, ast.arg) or isinstance(node, ast.keyword) and node.arg:
            names.add(node.arg)
        elif isinstance(node, ast.alias):
            names.add(node.asname or node.name)
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.add(node.module)
    return names


class TestNoDomainVocabularyInCore:
    """`app/core/` must not name the partner directory in executable code."""

    @pytest.mark.parametrize("path", _python_files(CORE_DIR), ids=lambda p: p.name)
    def test_core_module_names_no_domain_identifier(self, path: pathlib.Path):
        hits = sorted(
            name
            for name in _identifiers(path)
            if DOMAIN_TOKEN in name.lower() and name not in CORE_DOMAIN_IDENTIFIER_EXCEPTIONS
        )
        assert not hits, (
            f"{path.name} names the partner domain in executable code: {hits}. "
            "Register it from app/domain/ instead — CORE_EXTRACTION_PLAN.md phase 1."
        )

    def test_the_exception_list_is_empty_and_should_stay_that_way(self):
        """Pinned so adding an exception is a deliberate edit with a reason
        attached, rather than something that happens because a test went green.

        Phase 2 emptied it. If this fails, something in `app/core/` started
        naming a domain concept again — register it from `app/domain/` instead.
        """
        assert set() == CORE_DOMAIN_IDENTIFIER_EXCEPTIONS

    def test_no_domain_named_file_remains_under_core(self):
        """`core/partner_tiers.py` moved to `app/domain/partners/tiers.py` on
        2026-08-17 — it was directory reference data sitting in the platform
        layer, so a project with no partner directory inherited a tier catalogue
        it had no table for.

        A file-name check as well as an identifier check, because a module's own
        name is not an identifier *inside* it and would otherwise be invisible.
        """
        leftovers = [p.name for p in _python_files(CORE_DIR) if DOMAIN_TOKEN in p.name.lower()]
        assert leftovers == [], (
            f"domain-named files under app/core/: {leftovers}. Move them under app/domain/."
        )


class TestDomainNeverImportsCorePermissions:
    """The layering rule that keeps registration acyclic.

    `core/permissions.py` imports `app.domain` to collect registrations, so a
    domain importing it back is a cycle. The failure mode is nasty — a partially
    initialised module, so the symptom is an `AttributeError` on a constant that
    plainly exists.
    """

    @pytest.mark.parametrize(
        "path", _python_files(DOMAIN_DIR), ids=lambda p: p.name
    )
    def test_domain_module_does_not_import_core_permissions(self, path: pathlib.Path):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                assert node.module != "app.core.permissions", (
                    f"{path.name} imports app.core.permissions, which is a cycle. "
                    "Import app.core.roles for role names instead."
                )
            if isinstance(node, ast.Import):
                for alias in node.names:
                    assert alias.name != "app.core.permissions", (
                        f"{path.name} imports app.core.permissions, which is a cycle."
                    )


class TestTheAssembledCatalog:
    """Core plus domain must produce one coherent vocabulary."""

    def test_the_domain_group_is_present_and_in_its_declared_position(self):
        """Registration must not reorder the roles screen.

        `partners` registers at order 75, between `settings` (70) and
        `data-access` (80) — exactly where it sat when the catalog was one
        literal.
        """
        keys = list(PERMISSION_CATALOG)
        assert keys.index("settings") < keys.index("partners") < keys.index("data-access")

    def test_every_granted_permission_exists_in_the_catalog(self):
        """The seeder raises on a missing name; this fails first and says which.

        It is the check that makes the one string literal in
        `domain/partners/permissions.py` — `"dashboard-view"`, which cannot be
        imported without reopening the cycle — safe.
        """
        known = set(all_permission_names())
        for role, grants in ROLE_PERMISSION_MATRIX.items():
            if grants == "*":
                continue
            missing = sorted(set(grants) - known)
            assert not missing, f"Role {role} is granted unknown permissions: {missing}"

    def test_every_role_has_a_description(self):
        assert set(ROLE_PERMISSION_MATRIX) == set(ROLE_DESCRIPTIONS)

    def test_the_domain_extends_staff_rather_than_replacing_its_grants(self):
        """Additive registration is the property that stops a domain silently
        reverting a permission the core later gave Staff."""
        staff = set(ROLE_PERMISSION_MATRIX[ROLE_STAFF])
        assert {"user-view", "invitation-view", "dashboard-view"} <= staff, "core grants lost"
        assert {"partner-view", "partner-tier-view"} <= staff, "domain grants missing"

    def test_the_domain_registered_its_nav_section(self):
        keys = {section.get("key") for _order, section in nav.registered_sections()}
        assert "partner-directory" in keys

    def test_a_collapsible_domain_section_lands_in_the_catalog_automatically(self):
        """A domain cannot add a collapsible section and forget the catalog
        entry — that mismatch would render a toggle the seeder never wrote a
        default for."""
        assert "partner-directory" in nav.collapsible_sections()


class TestTheCoreAssemblesWithNoDomain:
    """**The property that makes this repo liftable.**

    Empties both registries, re-registers only the core, and asserts a complete
    RBAC vocabulary with no partner vocabulary in it. This is what a second
    project gets after deleting `app/domain/`.

    The module reload is why this class stands alone: it mutates global registry
    state, so it restores it in a fixture rather than leaving later tests reading
    a half-built catalog.
    """

    @pytest.fixture(autouse=True)
    def _restore_registries(self):
        yield
        _rebuild_registries()

    def test_core_only_catalog_is_complete_and_domain_free(self):
        import importlib
        import sys

        _clear_registering_modules()

        # Stub `app.domain` so a fresh `import app.core.permissions` finds it
        # already "imported" and runs none of its registration side effects.
        stub = type(sys)("app.domain")
        sys.modules["app.domain"] = stub
        try:
            core_only = importlib.import_module("app.core.permissions")

            catalog = core_only.PERMISSION_CATALOG
            matrix = core_only.ROLE_PERMISSION_MATRIX

            # A working platform, not an empty one.
            assert len(catalog) == 12, f"expected the 12 core groups, got {sorted(catalog)}"
            assert "partners" not in catalog
            assert len(core_only.all_permission_names()) == 45

            # The seven platform roles and nothing else.
            assert set(matrix) == set(CORE_ROLE_DESCRIPTIONS)
            assert "Partner" not in matrix

            # No partner permission survives anywhere in the matrix.
            for role, grants in matrix.items():
                if grants == "*":
                    continue
                assert not [g for g in grants if "partner" in g], f"{role} kept a partner grant"

            # The external-account default falls back to the core's own role, so
            # self-registration still works in a project with no domain.
            assert core_only.DEFAULT_EXTERNAL_ROLE == ROLE_USER
            assert core_only.DEFAULT_INTERNAL_ROLE == ROLE_USER
        finally:
            sys.modules.pop("app.domain", None)


class TestTheDomainImportIsOptionalButNotForgiving:
    """`core/permissions.py` tolerates a MISSING domain and not a BROKEN one.

    Both halves were verified by hand on 2026-08-17 — deleting
    `backend/app/domain/` entirely (the core booted with 12 groups, 45
    permissions and no partner vocabulary) and then replacing it with a package
    whose `__init__` imports something that does not exist (still raised).

    Neither can be reproduced from inside the test process: the first needs the
    directory gone before `app.core.permissions` is first imported, and the
    second needs a genuinely broken module on disk.
    `TestTheCoreAssemblesWithNoDomain` covers the *behaviour* by stubbing
    `sys.modules` — which is exactly why it did NOT catch that the real import
    was unconditional.

    So this asserts on the source. A source assertion is weak evidence in
    general and the right tool here: what must not regress is one line of
    exception handling, and the dangerous edit — widening it to a bare
    `except ImportError` — is invisible to every behavioural test in this file.
    """

    def _permissions_source(self) -> str:
        return (BACKEND / "app" / "core" / "permissions.py").read_text(encoding="utf-8")

    def test_the_domain_import_is_guarded(self):
        source = self._permissions_source()
        assert "import app.domain" in source
        assert "except ModuleNotFoundError" in source

    def test_the_guard_re_raises_anything_that_is_not_the_domain_package(self):
        """**The line that stops a typo silently deleting the whole domain.**

        Without the `exc.name` check, a bad import inside any domain module would
        be swallowed: the catalog would come up missing nine permissions and a
        role, nothing would error, and the only symptom would be a Partner
        Directory that had quietly stopped existing.
        """
        source = self._permissions_source()
        assert 'if exc.name != "app.domain":' in source
        assert "raise" in source.split('if exc.name != "app.domain":', 1)[1][:80]

    def test_it_is_not_a_bare_except(self):
        """Parsed, not grepped.

        The first version of this assertion searched the raw text for
        `except ImportError` — and failed, because the comment directly above the
        handler explains why a bare `except ImportError` would be *worse* than
        the hard import. A check that a comment can break is a check that will be
        deleted rather than fixed.
        """
        tree = ast.parse(self._permissions_source())
        handlers = [
            handler
            for node in ast.walk(tree)
            if isinstance(node, ast.Try)
            for handler in node.handlers
        ]
        assert handlers, "the domain import is no longer guarded at all"
        for handler in handlers:
            assert handler.type is not None, "a bare `except:` would swallow anything"
            assert isinstance(handler.type, ast.Name), "the handler should name one exception"
            assert handler.type.id == "ModuleNotFoundError", (
                f"caught {handler.type.id}; only ModuleNotFoundError distinguishes "
                "'no domain package' from 'the domain package is broken'."
            )


class TestRegistryRefusesAmbiguity:
    """Registration failures must be loud. A silently-dropped permission group
    is the failure a registry exists to prevent."""

    def test_duplicate_permission_group_raises(self):
        with pytest.raises(ValueError, match="already registered"):
            registry.register_permission_group("users", "Duplicate", 999, "core", [])

    def test_duplicate_role_raises(self):
        with pytest.raises(ValueError, match="already registered"):
            registry.register_role(ROLE_STAFF, "duplicate", [])

    def test_duplicate_nav_section_raises(self):
        with pytest.raises(ValueError, match="already registered"):
            nav.register_nav_section({"key": "partner-directory", "label": "x"}, order=1)

    def test_a_nav_section_without_a_key_raises(self):
        with pytest.raises(ValueError, match="key"):
            nav.register_nav_section({"label": "No key"}, order=1)

    def test_granting_to_a_wildcard_role_is_a_no_op(self):
        """Admin holds `"*"`. Turning that into a concrete list would freeze it at
        today's catalog, so the registry leaves it alone."""
        registry.register_role_grants("Admin", ["user-view"])
        assert registry.role_grants()["Admin"] == "*"
