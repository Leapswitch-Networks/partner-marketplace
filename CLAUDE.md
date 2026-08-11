# Partner Marketplace — agent entry point

@AGENTS.md

<!--
  Everything above the fold is that one import. Claude Code reads CLAUDE.md, not AGENTS.md, so the
  import is what makes the root AGENTS.md load at all — and it is the ONLY thing that loads
  automatically. Keep the operating contract in AGENTS.md; do not copy rules here, or the two will
  drift and you will not know which one is current.

  Deliberately NOT imported: documentation/AGENTS.md (the full workflow, ~300 lines) and
  documentation/INDEX.md. Imports load eagerly into every session's context, so importing them
  would tax every turn to carry process detail that matters a few times per task. AGENTS.md § 6
  points at them; read them when you start real work.

  Subdirectory AGENTS.md files are never auto-discovered — only CLAUDE.md files are. That is why
  documentation/AGENTS.md sat unreachable by this chain until 2026-08-11.

  Imports are recursive to 4 hops, and a relative path resolves against the file containing the
  import — not the project root.
-->
