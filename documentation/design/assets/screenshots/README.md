# Viho Theme — Reference Screenshots

Reference screenshots of the **Viho** theme (Pixelstrap) — the visual direction chosen on
2026-08-03. Design notes and all extracted colour values live in
[`../../VIHO_THEME_REFERENCE.md`](../../VIHO_THEME_REFERENCE.md).

## Current contents — 36 screenshots

**Don't browse this folder to find something.** The reference doc has a
**[*"When you're building… → open this"* lookup table](../../VIHO_THEME_REFERENCE.md#-screenshot-catalogue--34-references)**
that maps the component you're about to write to the screenshot that shows it, plus a per-file
"what to notice" index. Start there.

Groups, by filename prefix:

| Prefix | Count | Covers |
|--------|------:|--------|
| `login.png`, `register.png` | 2 | **The split-screen auth pages the app implements** — owner-supplied 2026-08-05. Do not confuse with `auth-login-*`, which is Viho's *centred* variant |
| `auth-login-*` | 1 | Sign-in screen, centred variant |
| `dashboard-default-*` | 3 | Default dashboard — light top/bottom + dark |
| `widgets-general-dark-*` | 4 | Widget vocabulary, top→bottom, dark |
| `widgets-chart-dark-*` | 3 | Every chart type, dark |
| `tables-*` | 2 | Index tables + full DataTable with pagination |
| `project-create-new-*`, `users-edit-*`, `form-validation-*` | 3 | Forms |
| `todo-*`, `kanban-board-*` | 4 | Badges (soft + solid), boards |
| `support-ticket-*` | 2 | All 6 semantic tones, table with search |
| `users-profile-*`, `users-cards-*` | 4 | Profile and card grids |
| `email-app-*`, `file-manager-*`, `bookmark-app-*`, `calendar-*`, `search-website-*` | 6 | App layouts |
| `pricing-*` | 2 | Plan/tier cards |

**All 36 have been mined** — every value in the reference doc is cross-checked against them, including
pixel-sampled surfaces, corner-radius measurements and badge/progress fills. New screenshots are only
useful for the four gaps listed under *Still needed* in the reference doc.

The first 34 were renamed from their original `Screenshot From <timestamp>.png` names to the convention
below. **`login.png` and `register.png` do not follow it** — they were added by the owner on 2026-08-05
and kept under the names supplied, because both are referenced from the reference doc and the auth
components by those names. Rename them only together with those references.

---

## ⚠️ This Repository Is PUBLIC

`https://github.com/Leapswitch-Networks/partner-marketplace` — anything committed here is
world-readable the moment it is pushed, and may stay cached or indexed even if deleted later
(`documentation/AGENTS.md` § Repository Visibility).

Before adding an image:

- **UI framing only.** Layout, spacing, colour, component shape.
- **No customer data, no partner names, no internal URLs, no real email addresses.** The demo is
  populated with fake data — check each shot anyway, especially profile and email screens.
- **Do not bulk-mirror the demo.** Viho is a **paid, licensed** theme. A handful of reference shots
  for internal design discussion is reasonable; a complete copy of its screens is redistribution.
- **Never commit the theme's own asset files** — its images, SVGs or icon fonts (Themify, IcoFont,
  FontAwesome). Screenshots of rendered pages only.

---

## Naming

```
<area>-<screen>-<variant>.png
```

Lowercase, hyphen-separated, no spaces — spaces break Markdown image links.

| Example | Means |
|---------|-------|
| `auth-login-light.png` | The login screen shared by the owner, light mode |
| `auth-login-dark.png` | Same screen, `body.dark-only` |
| `dashboard-default-light.png` | Default dashboard |
| `users-profile-light.png` | User profile page |
| `form-wizard-step2.png` | Multi-step form, second step |
| `table-datatable-light.png` | Data table styling |
| `component-card-variants.png` | A component detail crop |

Add `-mobile` or `-tablet` for a narrower viewport: `auth-login-light-mobile.png`.

## Format

- **PNG** for UI (crisp text). JPEG only for photographic content.
- **Full-page or full-viewport** shots beat cropped ones — margins and background wash matter as much
  as the component.
- Capture at **1× or 2× DPR**, but stay consistent so shots are comparable.
- Keep files reasonable (**under ~500 KB**). These go in git history permanently and cannot be pruned
  without a rewrite.

## Retirement — these are temporary by decision

**Owner's decision, 2026-08-03:** this folder exists to get the UI/UX components built. Once the
component set is complete and the patterns live in `system-design/UI_PATTERNS.md`, the screenshots are
to be **deleted** — they are scaffolding for a build, not a permanent project asset. That also settles
the licensing question the § above raises: 34 shots of a paid theme is acceptable as working reference
during the build, and is not meant to stay in a public repo afterwards.

**Trigger:** the UI/UX component build-out is finished and `UI_PATTERNS.md` documents the patterns
these images were used to derive. At that point delete `assets/screenshots/`, strip the § Screenshot
Catalogue table from `VIHO_THEME_REFERENCE.md`, and keep the doc — the extracted **values** are the
lasting output, the images are not.

**Know this before relying on that plan:** `git rm` removes the files from the working tree, **not from
history**. After deletion the ~14 MB still ships with every clone, and the images stay reachable at
their old commits on a public remote — so deleting them does not un-publish them. Actually reclaiming
the space and removing them from the public record needs a history rewrite (`git filter-repo` or BFG)
plus a force-push, which rewrites every commit hash and must be coordinated with anyone who has cloned.
Worth deciding **before** this branch merges, because rewriting one unmerged feature branch is cheap and
rewriting `main` later is not.

1. Add a row to the **§ Screenshots** table in
   [`../../VIHO_THEME_REFERENCE.md`](../../VIHO_THEME_REFERENCE.md) — filename, which screen, and
   *what to notice* in it. A screenshot nobody annotated is a screenshot nobody uses.
2. If it reveals a value not already recorded (a colour, a spacing, a state), add it to the relevant
   section of that doc. Prefer values read from the theme's CSS over values eyedropped from an
   image — the doc's § How These Values Were Obtained explains how, and eyedropping picks up
   antialiasing and compression artefacts.
