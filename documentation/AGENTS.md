# AGENTS.md — moved

> **This is no longer the agent contract. It is a pointer.**
>
> ## → [`/AGENTS.md`](../AGENTS.md) at the repository root
>
> Everything that used to live here — the startup banner, the phases, the commit convention, the
> protected-files table, the checklists — is in that one file now.

**Merged on 2026-08-18.** This repository used to carry two agent contracts, and they had already
started disagreeing: the copy in this file still described the plaintext-password design as accepted
debt, months after the root file struck that claim through as stale and forbade repeating it.
Passwords have been bcrypt-hashed since 2026-07-31.

The reasoning, the three measurements behind it and the alternatives considered are recorded in
[**ADR-0016 — One agent contract, at the repository root**](adr/0016-one-agent-contract.md).

## Do not put rules back in this file

Two contracts drift. That is not a risk, it is what happened. If you are adding or changing a rule
for agents, it goes in the **root `AGENTS.md`** — the file `CLAUDE.md` imports, and the file Codex
and OpenCode read directly. A subdirectory `AGENTS.md` is never auto-discovered by Claude Code, which
is why this copy sat unreachable by that chain until 2026-08-11 in the first place.

This file is kept, rather than deleted, so existing links and bookmarks still land somewhere useful —
the same convention this project applies to superseded records everywhere else.
