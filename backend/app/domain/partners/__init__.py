"""The partner directory domain — this platform's first tenant of the core.

Holds only what a *different* project would not want: the nine `PARTNER_*`
permissions, the `Partner` role, and the Partner Directory sidebar section. The
models, services, schemas and routers still live in their conventional
`app/models` · `app/services` · `app/api` homes; moving those as well was
considered and rejected in `CORE_EXTRACTION_PLAN.md` phase 1 — it would be a
large, purely mechanical diff over files that are already domain-named and
already trivial to delete, and it would put two competing layouts in one repo.

What is here is the part that could **not** simply be deleted before, because it
was interleaved with core vocabulary inside shared literals.
"""
