# ADR-0016 — One agent contract, at the repository root

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | Process |
| **Supersedes** | the two-file arrangement described in `CLAUDE.md`'s comment block, 2026-08-11 to 2026-08-18 |

## Context

Until 2026-08-18 this repository carried **two** agent contracts:

- **root `AGENTS.md`** (~120 lines) — the operating contract, imported by `CLAUDE.md` and therefore
  always in context.
- **`documentation/AGENTS.md`** (302 lines) — the full workflow: startup banner, phases, commit
  convention, checklists.

The stated reason for the split, written into `CLAUDE.md`, was that imports load eagerly and *"300
lines of process is not worth that on every turn."* The reasoning is sound in general. **It did not
hold here**, for three measured reasons.

**1. The saving was never realised.** Root `AGENTS.md` § 0 instructed every session to *"display the
banner in `documentation/AGENTS.md` § Startup Announcement"*. The banner lives only in that file, so
**every session read all 302 lines on turn one anyway** — as a manual `cat` instead of an import. The
split moved the cost, it did not remove it. Combined, a session opened ~420 lines across two files.

**2. It had already produced a contradiction, in the most dangerous possible place.** Root
`AGENTS.md` struck through the "plaintext passwords are accepted debt" claim on 2026-08-17, marked it
stale, and explicitly instructed agents **not to repeat it as current state** — passwords have been
bcrypt-hashed since 2026-07-31. `documentation/AGENTS.md` line 247 **still said it**, in the present
tense, as accepted debt the user had chosen to publish. An agent following § 0's own instruction was
handed both versions and no way to tell which was current.

**3. Roughly fifteen rules were maintained twice** — commit approval, AI attribution, the
`/opt/lampp/htdocs` warning and its rationale, branch deletion, read-before-write, destructive
operations, public-repo handling including the same `grep` command, the gitignore list,
`DAILY_CHANGES` timing, honest reporting, the protected-files table, stack verification, and the
Next.js warning. A rule maintained in two places is a rule that will disagree with itself; drift was
not a risk, it was already present. A third error was found in the same pass: the Next-docs
correction was attributed to "PM-19", which is *"No error boundaries or route suspense"*.

## Decision

**One contract: root `AGENTS.md`.** It absorbs the banner, the working rhythm (before/during/after),
branch naming, the commit convention and the agent-entry-point table, and drops every duplicated
rule. The merged file is **226 lines** — smaller than the 302-line half it absorbed, and roughly half
the ~420 a session previously opened.

`documentation/AGENTS.md` becomes a **pointer** to the root file. It is not deleted: `README.md`,
`INDEX.md` and external links reference that path, and this project's convention is to mark
superseded documents rather than remove them.

Root is the home because that is where the loading actually happens: `CLAUDE.md`'s import is the only
automatic chain, Codex and OpenCode read root `AGENTS.md` by convention, and `INDEX.md`'s own rule
sanctions exactly three root Markdown files — `README.md`, `CLAUDE.md`, `AGENTS.md`.

## Alternatives rejected

**Keep both, delete only the duplication.** The obvious minimal fix, and it preserves the
lazy-loading intent. Rejected because the intent was already defeated by § 0's banner instruction —
the second file is read every session regardless — so the split would keep all of its costs and none
of its benefit. It also leaves two files that *can* drift again.

**Move everything into `documentation/AGENTS.md` and leave a stub at root.** Symmetrical, and wrong
in this repo: subdirectory `AGENTS.md` files are never auto-discovered. That is precisely why the
documentation copy sat unreachable by the `CLAUDE.md` chain until 2026-08-11.

**Merge everything into `CLAUDE.md`.** `CLAUDE.md`'s own comment block forbids it — copying rules
there guarantees two drifting sources — and it would break the tools that read `AGENTS.md` directly.

**Split by audience instead (a human file and an agent file).** An attractive framing that fails on
inspection: the rules are identical for both. The parts a human needs and the parts an agent needs
are the same parts.

## Consequences

- **Good:** one file to read, one file to change, and no possibility of the two disagreeing.
- **Good:** the stale plaintext-password claim died with the merge — it existed in exactly one place
  and that place is gone.
- **Cost:** the file is now always in context at 226 lines rather than ~120. That is the real price,
  and it is smaller than what a session actually loaded before.
- **Cost:** `documentation/AGENTS.md` remains as a pointer rather than disappearing, so the path
  still exists and could in principle be filled with content again. The pointer says plainly that it
  must not be.
- **Follow-on:** `CLAUDE.md`'s comment block described the two-file arrangement and had to be
  rewritten, since it would otherwise document a structure that no longer exists.

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Contract | `AGENTS.md` (root) | the single contract; § 8 names each agent's entry point |
| Pointer | `documentation/AGENTS.md` | redirects, and states it is not the contract |
| Chain | `CLAUDE.md` | the `@AGENTS.md` import — the only automatic load |
| Doc | `documentation/INDEX.md`, `README.md` | route readers to the root file |

**Nothing automated prevents a second contract reappearing.** A CI check asserting that
`documentation/AGENTS.md` stays under a few dozen lines would make this self-enforcing, and does not
exist today.
