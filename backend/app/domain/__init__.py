"""Domain packages — everything this platform is *for*, as opposed to what it is.

**Delete this directory and the core still boots.** That is the property
`CORE_EXTRACTION_PLAN.md` exists to create and
`tests/test_core_extraction.py::test_core_assembles_with_no_domain` asserts. A
second project built on this repo removes `app/domain/partners`, adds its own
package, and touches nothing under `app/core`.

## How registration is triggered

`core/permissions.py` imports this package, which imports each domain's
registration modules for their side effects. That is the one call site — there
is no plugin discovery, no entry points, no scanning. An explicit import list is
readable, ordered, and fails loudly when a module is missing, which is worth
more here than the flexibility of discovery.

Each import below must be side-effect-registering only: define constants, call
`core.registry` / `core.nav`, and stop. **A domain module must never import
`app.core.permissions`** — that is the cycle this layout prevents. Import
`app.core.roles` for role names instead.
"""

from __future__ import annotations

# Imported for their registration side effects, not for names. `noqa: F401` is
# the honest annotation: the modules ARE unused as symbols and are the entire
# point as imports.
from app.domain.partners import (
    navigation as _partner_navigation,  # noqa: F401
    permissions as _partner_permissions,  # noqa: F401
)

__all__: list[str] = []
