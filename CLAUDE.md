# Partner Marketplace — agent entry point

@AGENTS.md

<!--
  Everything above the fold is that one import. Claude Code reads CLAUDE.md, not AGENTS.md, so the
  import is what makes the root AGENTS.md load at all — and it is the ONLY thing that loads
  automatically. Keep the operating contract in AGENTS.md; do not copy rules here, or the two will
  drift and you will not know which one is current.

  There is now exactly ONE agent contract: the root AGENTS.md. Until 2026-08-18 a second one lived
  at documentation/AGENTS.md, deliberately not imported so its ~300 lines would not load every turn.
  That arrangement was retired because it never paid off and had already gone wrong:

    * AGENTS.md § 0 told every session to read documentation/AGENTS.md for the startup banner, so
      all 302 lines were opened on turn one regardless — the import was skipped, the read was not.
    * The two copies had drifted on a security claim. The documentation copy still called the
      plaintext-password design accepted debt, which the root file had struck through as stale and
      explicitly forbidden repeating.
    * About fifteen rules were being maintained in both files.

  The merged root AGENTS.md is 226 lines — less than a session used to open across the two. See
  documentation/adr/0016-one-agent-contract.md for the full reasoning, and documentation/ADR.md for
  the register it belongs to. documentation/AGENTS.md is now a pointer; do not put rules back in it.

  Still deliberately NOT imported: documentation/INDEX.md. Imports load eagerly into every session,
  and the doc map matters a few times per task rather than every turn. AGENTS.md § 7 points at it.

  Subdirectory AGENTS.md files are never auto-discovered — only CLAUDE.md files are. That is why
  documentation/AGENTS.md sat unreachable by this chain until 2026-08-11, and part of why the
  contract now lives in one place.

  Imports are recursive to 4 hops, and a relative path resolves against the file containing the
  import — not the project root.
-->
