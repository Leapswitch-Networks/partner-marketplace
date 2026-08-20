# ADR-0004 — Pin Next.js to 14.2.35 and React to 18.3.1

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-07-31 |
| **Recorded** | 2026-08-18 |
| **Deciders** | project owner |
| **Area** | Frontend |

## Context

The scaffold arrived on Next.js 14 with the App Router. Shortly after the rename, `npm ci` began
failing outright: **React 19 does not satisfy Next 14's peer range** (`TECH_DEBT.md` PM-25). The
choice was to pin down to a coherent 14/18 pair, or to move up to Next 15/16 and React 19.

The complicating factor is not the upgrade itself — it is that **the ecosystem's documentation, and
every model's training data, has moved on.** Next 16 idioms (`cacheComponents`, `use cache`, async
`params`/`searchParams`) do not compile here. They are written confidently and constantly.

## Decision

Pin **Next.js 14.2.35** (App Router) and **React 18.3.1** — exact, not floating. Verify the installed
version from the tree before writing Next.js code, never from memory:

```bash
node -e "console.log(require('./frontend/node_modules/next/package.json').version)"
```

The root `AGENTS.md` opens with this warning, above the operating contract, because it is the single
most frequently violated fact about this repo.

## Alternatives rejected

**Upgrade to Next 15 or 16 with React 19.** The genuinely tempting option — it would align the code
with the documentation everyone reads. Rejected for now: the App Router surface in use here works,
the upgrade touches every page, and the project's actual bottleneck is the unbuilt marketplace
domain, not the framework version. This is a *deferral*, not a permanent refusal.

**Float the versions (`^14`).** `package.json` does carry carets, but the lockfile pins. Letting
minors float reintroduces exactly the peer-range break PM-25 recorded.

## Consequences

- **Good:** `npm ci` is reproducible again and the build is stable.
- **Cost:** **a permanent documentation-drift tax.** Two separate files carry a correction about
  this, and one of them is a correction *of a correction*: the instruction to read
  `node_modules/next/dist/docs/` was wrong, because Next only ships bundled agent docs from 16.x.
  That directory does not exist here — corrected in root `AGENTS.md` on 2026-08-11, and in
  `INDEX.md` on 2026-08-17 after the first fix failed to reach the copy.
- **Cost:** a real inconsistency remains. `eslint-config-next` is pinned at **16.2.3** against Next
  14 — the mismatch behind PM-30's react-hooks rule noise. PM-30 is closed (the error count is 0),
  but the version pairing is still odd and worth revisiting on the next upgrade.
- **Follow-on:** if this project ever moves to a Next that ships `dist/docs/`, the original
  instruction should be restored. `AGENTS.md` says so explicitly.

## Where this is enforced

| Kind | Path | What it does |
|------|------|--------------|
| Contract | root `AGENTS.md` § *This is NOT the Next.js you know* | the warning, above everything else |
| Lockfile | `frontend/package-lock.json` | pins the resolved tree |
| Doc | `documentation/planning/TECH_DEBT.md` PM-25, PM-30 | the peer-range break and the lint fallout |
| Doc | `documentation/INDEX.md` § For AI Agents item 7 | repeats it for agents |

Verified 2026-08-18: the running container reports **14.2.35**.
