# Dynamic Branding — Making the Core Reusable Across Projects

> **The question:** the project name, monogram, favicon and tagline are written into the code in 34
> places. Can a Settings module in the sidebar make them configurable, so this core can be the
> foundation for future projects?
>
> **The answer: yes — and the instinct is right.** But "make it dynamic" is three different features
> with three very different costs, and the naive version (one settings table, everything reads from it)
> **converts 15 prerendered routes into server-rendered-on-demand ones** for no benefit on most of them.
> This document splits it by *surface* rather than by *setting*, which makes most of it free.
>
> **Written 2026-08-06** from measurement, not assumption. Every number below has the command that
> produced it.

---

## 1. What is hardcoded today

```bash
grep -rn "Partner Marketplace" frontend/app frontend/components   # 26 across 20 files
grep -rn "Partner Marketplace" backend/app --include="*.py"       #  8
```

**34 sites**, but they fall into four groups that behave completely differently:

| Group | Count | Where | How dynamic it can get |
|---|---:|---|---|
| **A · In-app chrome** | 5 | `Sidebar.tsx` ×3, `Navbar.tsx`, `WelcomeBanner.tsx` | **Free** — already client components fed by an API call |
| **B · Anonymous chrome** | 2 | `(auth)/layout.tsx` — name + tagline, seen **before login** | Free, but needs a **public** endpoint |
| **C · Document metadata** | 17 | 16 × `export const metadata` + `app/favicon.ico` | **Costly** — see § 3.2 |
| **D · Backend-authored text** | 8 | `main.py` FastAPI title, `mail_service` ×5, `TWO_FACTOR_ISSUER`, `MAIL_FROM_NAME` | Trivial — 2 are already settings |

Plus three identity elements that are *not* the name and are easy to miss:

- **The monogram `"P"`** — hardcoded in `Sidebar.tsx` in 3 places (`bg-brand … >P<`).
- **The subtitle `"Admin Panel"`** — 2 places in `Sidebar.tsx`.
- **The tagline** — *"One place to manage partners, catalogue and quotes."* in `(auth)/layout.tsx`.
  This one is **product copy**, not branding; a reused core needs it configurable or it lies.

---

## 2. The decision that shapes everything

> **Who changes the branding, and when?**

This is the fork, and it is worth answering before writing a schema:

| If… | Then the right mechanism is | Cost |
|---|---|---|
| **You** set it once when starting a new project | **Environment variables + seed** | Near zero. Metadata stays static. |
| **The customer's admin** changes it at runtime, no redeploy | **Database + Settings UI** | A table, 4 endpoints, upload storage, and § 3.2's rendering cost |

**Recommendation: both, split by surface — not a compromise, the actually-correct answer.**

- **Env vars are the source of truth at build time.** A new project is a new deployment with a new
  `.env`; `APP_NAME=Acme Portal` is one line, and it is also the **fallback before the database is
  seeded** — which matters, because the sign-in page must render on a fresh install.
- **The database overrides at runtime, for the surfaces that are already dynamic.** Groups A and B are
  rendered by client components that already fetch from the API. Adding branding to that fetch costs
  **one extra field on a response that is already being made.**
- **Group C stays on env vars** unless someone genuinely needs to change the browser tab title without
  a redeploy. That is the expensive one, and deferring it is not a compromise — see § 3.2.

This is what makes the feature cheap. The naive design — "everything reads the settings table" — pays
§ 3.2's cost across all 15 static routes to make a `<title>` editable, which is the least valuable
thing on the list.

---

## 3. The five constraints, with evidence

### 3.1 Branding must be readable by anonymous users

`GET /api/navigation` is the existing server-driven-chrome precedent, and it is gated:

```python
def get_navigation(current_user: User = Depends(get_current_user), ...)
```

**Branding cannot ride on it.** The sign-in page shows the name and tagline, and the favicon is fetched
before any session exists. So branding needs its **own unauthenticated endpoint**.

That is fine, and it needs to be deliberate: `GET /api/settings/branding` returns only what is already
visible on the login page, so it leaks nothing — but it must be **rate-limited** (the `default` tier is
correct; it is not credential-adjacent) and it must **never** grow a field that is not already public.
Write that constraint in the router docstring, because the natural instinct when adding a setting later
is to put it in the endpoint that already exists.

### 3.2 `export const metadata` is static, and making it dynamic costs the whole build

All 16 metadata blocks are `export const metadata` — a **static export**. It cannot read a database or
call an API. Making it dynamic means `export async function generateMetadata()`, and that turns the
route into a dynamic render.

Measured from `npm run build` on the current tree:

```
15 static (○ prerendered)   ·   3 dynamic (ƒ server-rendered on demand)
```

Static today: `/dashboard` and its 5 children, `/settings` and its 3 children, `/sign-in`, `/sign-up`,
`/forgot-password`, `/_not-found`. **Every one flips to dynamic** if its metadata reads from the API —
so each page view gains a server round trip to render a `<title>`.

There are mitigations (`unstable_cache`, `fetch` with `revalidate`, `React.cache` per request) and they
work, but they add a caching layer whose invalidation you now own — and they do not restore
prerendering, only avoid re-fetching.

**So: leave group C on `process.env.NEXT_PUBLIC_APP_NAME`.** It is read at build time, it is free, and
for a reusable core it is *correct*: you rebuild per project anyway. Revisit only if a customer must
rename the product live.

### 3.3 The favicon is a file convention, baked at build

`frontend/app/favicon.ico` exists (25,931 bytes). In the App Router this is a **file convention**: Next
serves it at `/favicon.ico` and injects the `<link>` tag automatically. Nothing about it is runtime.

To make it dynamic you must **delete the file** and set `metadata.icons` to a URL. Verified against the
installed package rather than from memory — note that `node_modules/next/dist/docs/` **does not exist in
`next@14.2.35`**, so `AGENTS.md`'s instruction to read it cannot be followed literally (the same finding
PM-19 recorded):

```
node_modules/next/dist/lib/metadata/types/metadata-interface.d.ts:215
    icons?: null | IconURL | Array<Icon> | Icons;
```

`IconURL` means a route handler can serve it. **Two traps if you go this way:**

1. **Browsers request `/favicon.ico` directly**, regardless of the link tag — and cache it hard. A
   handler at `/api/branding/favicon` will be used by the tag but some contexts (bookmarks, some
   crawlers, browser chrome) still hit `/favicon.ico`. Serve it at that exact path via a rewrite, or
   accept that the old icon persists in places.
2. **It drags the route into § 3.2's cost** if the icon URL is itself dynamic. Point `icons` at a stable
   path and let the *handler* decide the bytes — the URL stays constant, the response varies. That keeps
   metadata static.

### 3.4 There is no upload infrastructure of any kind

Verified: no `StaticFiles` mount in `main.py`, no upload endpoint anywhere, and `users.profile_photo_path`
is a **dead `String(2048)` column that nothing writes and nothing reads** (found during the 2026-08-06
audit — `avatar_url` returns `google_avatar` only). So a logo/favicon upload is not "add a form"; it is
**decide where bytes live**, and that decision is currently blocked:

| Option | Verdict for this project |
|---|---|
| **Postgres `bytea`** | ✅ **Recommended.** A favicon is ~25 KB and a logo ~50 KB, read once per page and cacheable. No new infrastructure, survives redeploys, included in the database backup, and works identically in dev and prod. The usual objection — "don't put files in the database" — is about *user-generated volume*, and this is **two rows that change once a year**. |
| Filesystem volume | Needs a mount that survives redeploy. The dev containers bind-mount source and **the production topology is undecided** (`DEPLOYMENT.md` § 1) — so this cannot be decided yet. |
| Object storage (S3/R2) | Correct at scale, wrong now: a provider decision, credentials, and a signing story for two small files. |

Whichever is chosen, the upload path needs what no code here does yet: **a MIME allowlist checked
against magic bytes** (not the `Content-Type` header, which the client writes), a **hard size cap**
enforced before reading the body into memory, and dimension limits. An image upload is the most common
file-upload vulnerability class; this is the first one in the codebase, so the pattern set here is the
one everything later copies.

### 3.5 The brand colour is compile-time, and a colour picker would break accessibility

`tailwind.config.ts` defines `brand: { DEFAULT: "#24695c", … }` as **literal hex**. `bg-brand` compiles
to `background-color: #24695c` in the built stylesheet. `UI_PATTERNS.md` § Tech Stack Reality Check says
it outright: *"OKLCH colour tokens / CSS variables for theme — **No.** Hex values."* Only two CSS custom
properties exist in `globals.css`, both for the dot texture.

**So brand colour cannot be runtime-configurable as things stand.** The fix is well-understood — define
the token as `rgb(var(--brand) / <alpha-value>)` and inject `--brand` in the root layout — and **the
2026-08-05 token migration is what makes it cheap**: all 242 call sites already say `bg-brand` rather
than `#24695c`, so they keep working untouched. That migration paid for this in advance.

Two things stop it being a free win:

1. **`tailwind.config.ts` is a protected file** (`documentation/AGENTS.md` § Protected Files) and needs
   explicit sign-off before editing.
2. **A free-form colour picker silently breaks contrast.** `UI_PATTERNS.md` records `brand-on-dark` as a
   🔴 **mandatory** rule with measured ratios: `#24695c` on the dark card is **2.83:1 — fails AA**, and
   `#5ec8b4` is **9.03:1**. That is why two tokens exist. **A picker that sets `--brand` and not
   `--brand-on-dark` reproduces exactly the bug that shipped and was fixed on 2026-08-05** — unreadable
   dark-mode links. So the picker must either derive the on-dark variant (lighten until ≥4.5:1 against
   `#111727`) and **validate**, or offer a curated set of pre-checked themes.

**Recommendation: curated presets, not a colour wheel.** 5–8 named themes, each with both tokens
measured and stored. It gives the reusability the goal actually needs, and it makes it impossible to
ship an inaccessible build. A wheel can come later with a contrast validator in front of it.

---

## 4. The design

### 4.1 One table, one row

```
app_settings
  id                  smallint PK, CHECK (id = 1)   -- single row, enforced by the schema
  app_name            varchar(120)  NOT NULL
  app_short_name      varchar(40)   NOT NULL        -- collapsed sidebar, tight spaces
  monogram            varchar(2)    NOT NULL        -- the "P"
  chrome_subtitle     varchar(60)                   -- "Admin Panel"
  tagline             varchar(200)                  -- the auth-screen line
  theme_preset        varchar(40)   NOT NULL        -- see § 3.5; not a raw hex
  logo_mime           varchar(60)
  logo_bytes          bytea
  logo_updated_at     timestamptz                   -- drives ETag / cache busting
  favicon_mime        varchar(60)
  favicon_bytes       bytea
  favicon_updated_at  timestamptz
  updated_by          varchar(36) FK users(id) ON DELETE SET NULL
  updated_at          timestamptz
```

`CHECK (id = 1)` rather than a convention: *"there is one row"* enforced by a comment is how you get two
rows. A settings table with two rows has no defined behaviour and the bug appears as branding that
flickers between values depending on query order.

**Every text column falls back to its env var when NULL or when the row does not exist yet.** That is
what makes a fresh install render before it is seeded, and what keeps env vars authoritative for a new
project.

### 4.2 Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/settings/branding` | **public** | Text + theme + asset URLs with `?v=<updated_at>`. Never any non-public field (§ 3.1). `default` rate-limit tier. |
| GET | `/api/settings/branding/logo` | public | Streams bytes. **`ETag` + `Cache-Control`** off `logo_updated_at`, or every page load re-downloads it. |
| GET | `/api/settings/branding/favicon` | public | Same. Consider a `/favicon.ico` rewrite (§ 3.3). |
| PUT | `/api/settings/branding` | `settings-manage` **+ `require_password_confirmation`** | Audited. |
| POST | `/api/settings/branding/logo` \| `/favicon` | `settings-manage` + password confirmation | Magic-byte MIME check, size cap, dimension cap (§ 3.4). |
| DELETE | `/api/settings/branding/logo` \| `/favicon` | `settings-manage` | Revert to the bundled default. |

**Why password confirmation:** changing the product's identity is exactly the class of action
`require_password_confirmation` exists for — it already guards enabling and disabling 2FA. Someone
holding a hijacked admin session should not be able to repaint the application, which is a convincing
setup for a phishing screen served from the real domain.

**New permission `settings-manage`** — and there is a trap here, verified in the code rather than assumed:

```python
# core/permissions.py:143
ROLE_PERMISSION_MATRIX = { ROLE_ROOT: "*", ROLE_SUPER_ADMIN: "*", ROLE_ADMIN: "*", … }
```

**`ROLE_ADMIN` is `"*"`, so simply adding `settings-manage` to the catalog grants it to every Admin on
the next seed.** PM-32 hit this exact consequence when adding `activity-view`. Two ways to keep branding
super-admin-only, and they are not equivalent:

| Option | Effect |
|---|---|
| **Gate the route on `require_super_admin`** ✅ | One line, visible in OpenAPI, and it is the pattern PM-3 was resolved with. The permission still exists in the catalog for clarity but the guard is the control. |
| Change `ROLE_ADMIN` from `"*"` to an explicit list | Correct in principle and a much larger change — it makes every *future* permission opt-in for Admin, which is arguably right but should be its own decision, not a side effect of adding a branding screen. |

Take the first. Note the second is the better long-term shape and worth raising separately: `"*"` means
every permission added from now on silently widens what an Admin can do.

Writes go through `activity_service` with a before/after diff, and the diff must **exclude the byte
columns** — the existing rule strips secrets from diffs; 25 KB of binary in a JSONB `properties` column
is the same mistake in a different direction.

### 4.3 Frontend wiring

| Surface | Source | Cost |
|---|---|---|
| Sidebar, Navbar, WelcomeBanner (group A) | Fetched with the existing chrome data | **Free** — one more field |
| Auth layout name + tagline (group B) | `GET /api/settings/branding`, public | One fetch on the auth layout |
| `<title>` on 16 pages (group C) | `process.env.NEXT_PUBLIC_APP_NAME` | **Free** — build-time, stays static |
| Favicon | Bundled default, or the rewrite in § 3.3 | Free / deferred |
| Theme preset | `data-brand-preset` on `<html>`, CSS custom properties | Needs § 3.5 sign-off |

**Group C is the important line.** Replacing 16 literals with a build-time env constant is a
find-and-replace that keeps all 15 routes prerendered. Replacing them with `generateMetadata()` is a
find-and-replace that makes all 15 dynamic. **Same effort, very different result.**

### 4.4 Settings module

The area already exists — `app/settings/` with `profile`, `password`, `appearance`, and a `SettingsNav`.
Add `app/settings/branding/`, gated on `settings-manage` via `usePermissions()`, and a sidebar entry
served by `navigation_service` like every other item.

**Do not put it under `/settings`'s personal-preferences grouping without a visual separation.**
`/settings/profile` and `/settings/appearance` are *"my account"*; branding is *"this installation"*.
Same URL space, different blast radius — one changes a row about you, the other changes what every user
sees.

---

## 5. Sequencing, and what I would defer

| # | Phase | Delivers | Blocked on |
|---|---|---|---|
| 1 | ✅ **Text identity** — table, public GET, `settings-manage`, PUT, groups A + B + D, env fallbacks | The name, monogram, subtitle and tagline are configurable. **Shipped 2026-08-06.** | — |
| 2 | ✅ **Group C → env constants** | 16 literals became one constant; a new project sets `NEXT_PUBLIC_APP_NAME` and rebuilds. **Shipped 2026-08-06.** | — |
| 3 | ✅ **Theme presets** — CSS custom properties + curated set | Colour is configurable, accessibly. **Shipped 2026-08-06.** | — |
| 4 | ✅ **Logo + favicon upload** | Full visual identity, `bytea` storage. **Shipped 2026-08-06.** | — |
| 5 | *(deferred)* Runtime-dynamic `<title>` | Rename without a redeploy | Accepting § 3.2's cost. **Only if a customer asks.** The favicon no longer needs this — see § 7. |

**Phases 1 and 2 need no decisions and no protected files.** They are the ones to build.

**What I would explicitly not build:** a tenant dimension. "Reuse the core for future projects" means a
separate deployment with a separate database per project, so **one row is right**. Per-tenant branding —
several brands served from one deployment — is a much larger feature (a tenant on every query, host-based
resolution, PM-5's scoping as a prerequisite). Building the settings table with a `tenant_id` "just in
case" costs complexity now and still would not be enough later. Decide it deliberately if it ever comes
up; do not hedge.

---

## 6. What shipped, 2026-08-06 (phases 1 and 2)

**35 hardcoded sites cleared** — one more than the 34 this document predicted. The extra was
`AuthInitializer.tsx`, still rendering a **`"T"` monogram**: a "Test Platform" leftover that PM-21
believed it had removed. It only appears on the loading screen during the session check, which is why
three brand audits missed it.

### How to rebrand a project built on this core

```bash
# backend/.env
APP_NAME="Acme Cloud Portal"
APP_MONOGRAM="AC"
APP_CHROME_SUBTITLE="Operations"
APP_TAGLINE="Provision and bill customer infrastructure."

# frontend/.env.local  (build-time: page titles and the pre-fetch initial render)
NEXT_PUBLIC_APP_NAME="Acme Cloud Portal"
NEXT_PUBLIC_APP_TAGLINE="Provision and bill customer infrastructure."
```

No migration, no database write. Everything else follows: `TWO_FACTOR_ISSUER` and `MAIL_FROM_NAME`
default to `APP_NAME` (both were hardcoded literals — an authenticator app showing the wrong product
name is baked into already-enrolled devices and cannot be corrected without re-enrolment), the FastAPI
title becomes `{APP_NAME} API`, and all five `mail_service` messages follow.

Then `/settings/branding` overrides any of it at runtime, without a redeploy.

### The constraint held

| Check | Result |
|---|---|
| Static/dynamic route split | **16 static / 3 dynamic** — was 15/3; the one addition is the new page, and **nothing flipped to dynamic** |
| New react-hooks lint errors | **0.** Still 18, the PM-30 baseline. Branding is resolved server-side and passed as a prop, so no component gained a fetch-on-mount |
| `pytest` | 87 passed (was 74) |
| `ruff`, `tsc --noEmit` | Clean |
| `GET /api/settings/branding` unauthenticated | `200`, resolved from the environment with an empty table |
| `PUT` unauthenticated | `401` |
| `CHECK (id = 1)` | A second row is refused: `violates check constraint "app_settings_single_row"` |
| Per-field fallback | Override `app_name` + `monogram`, NULL the rest → stored values served, others fall back |
| End to end | Row set to "Acme Cloud Portal" → the rendered `/sign-in` `<h2>` and tagline changed; `<title>` stayed on the build-time value, exactly as § 3.2 intends |

### The bug this shipped with, and how it was caught

**Server-side fetching needs a different API address than the browser, and getting it wrong fails
silently.**

`NEXT_PUBLIC_API_URL` is `http://localhost:8002` — correct for the browser, and *inside the frontend
container `localhost:8002` is the frontend itself*. So the root layout's fetch got `ECONNREFUSED`,
`getBranding`'s catch-all returned `FALLBACK_BRANDING`, and the page rendered the build-time defaults.
**Everything looked like it worked**: the API saved correctly, the endpoint returned the new value, and
the UI never changed.

It was found by curling the rendered HTML rather than trusting the endpoint — a check worth repeating for
anything server-rendered.

Fixed with `INTERNAL_API_URL` (no `NEXT_PUBLIC_` prefix, so it never reaches the browser), defaulting to
the public URL — correct whenever the two are the same address, which includes a same-origin deployment
behind one proxy. In Compose it is `http://backend:8002`; note the backend listens on **8002 inside the
container too**, not 8000.

⚠️ **`docker-compose.yml` was edited** (a protected file) to add it. Its existing comment claimed *"there
is no server-side fetching"*, which this change made false — that comment is now corrected, because it is
exactly what would send the next person looking in the wrong place.

### Deliberately not done

- **`Navbar.tsx` renders a hardcoded `"Super Admin"` subtitle** where the sidebar renders
  `chrome_subtitle`. That is a *role* label, shown to every user regardless of role — a pre-existing bug
  rather than branding, so it was left rather than guessed at. Decide whether it should be the user's
  actual role or the branding subtitle.
- **A settings-row cache invalidation hook.** `getBranding` revalidates every 300s and the form calls
  `router.refresh()`, so the editor sees the change at once and other users within five minutes. Making it
  instant everywhere is `revalidateTag("branding")` from the settings route — the tag is already set on
  the fetch, so it is a few lines when someone wants it.

---

## 7. What shipped, 2026-08-06 (phases 3 and 4)

### Phase 3 — theme presets

`tailwind.config.ts`'s `brand`/`accent` literals became
`rgb(var(--brand) / <alpha-value>)`, with the **complete default theme in
`globals.css` `:root`** — byte-for-byte Viho's teal, so nothing changed visually and
all 261 `brand` call sites kept working untouched. Keeping a full default in CSS is
load-bearing: the app is styled with no JavaScript and no API call, so a failed
branding fetch degrades to the default theme rather than an unstyled page, and
`next build` prerenders without a reachable backend.

**Channels are space-separated RGB (`36 105 92`), never a hex.** That is what makes
`<alpha-value>` work, and **12 distinct opacity variants are in use** —
`bg-brand/[.04]` through `bg-brand/70`. A hex in the variable makes every one of them
silently render fully opaque. Verified in the compiled CSS:

```css
.bg-brand      { background-color: rgb(var(--brand)/var(--tw-bg-opacity,1)) }
.bg-brand\/10  { background-color: rgb(var(--brand)/.1) }
.bg-brand\/\[\.05\] { background-color: rgb(var(--brand)/.05) }
```

**Eight presets, and the colour space is closed.** `core/theme.py` is the only place a
theme may be defined, because § 3.5's `brand-on-dark` rule is a 🔴 mandatory
accessibility constraint that a colour picker cannot honour. Every preset ships both
halves and `tests/test_theme_presets.py` (67 tests) enforces AA on both axes:

| Preset | brand | on-dark | white-on-brand | on-dark-on-card |
|---|---|---|---:|---:|
| Teal *(default)* | `#24695c` | `#5ec8b4` | 6.46 | 8.84 |
| Indigo | `#4d54b6` | `#9a9ed8` | 6.44 | 7.02 |
| Azure | `#29638e` | `#6aa9d7` | 6.42 | 7.03 |
| Plum | `#89448b` | `#c98fca` | 6.44 | 7.03 |
| Crimson | `#a93540` | `#dd8c93` | 6.42 | 7.01 |
| Forest | `#296b33` | `#43b955` | 6.47 | 7.07 |
| Bronze | `#815531` | `#cb986e` | 6.41 | 7.02 |
| Graphite | `#575f6b` | `#9ba3af` | 6.45 | 7.02 |

Note the implementation computes **2.76 / 8.84** for the teal where `UI_PATTERNS.md`
quotes 2.83 / 9.03. The small gap is a rounding or measurement difference; the
conclusions — fails AA / passes AA, by a wide margin either way — agree exactly, and
that is what the rule depends on. A test asserts the *failure* as a property rather
than quoting the doc.

`accent` is deliberately left fixed: it is a companion colour at 22 call sites, and
theming it would turn every preset into a two-colour design decision.

### Phase 4 — logo and favicon

Stored as `bytea`, per § 3.4. `core/images.py` is the first upload validation in the
codebase, so it is written as the pattern everything later copies — **and tested as a
security boundary** (32 tests):

- **The type comes from magic bytes**, never `Content-Type` or the filename. A PHP
  payload named `logo.png` is refused.
- **SVG was rejected** at this point despite being the obvious logo format. **Reversed
  the same day — see § 8**: accepted now, behind an upload check that refuses script,
  event handlers, external references and DOCTYPEs, plus a `Content-Security-Policy` on
  the serve response.
- **Size is capped at 512 KB before the body is fully read** — the route reads
  `MAX_UPLOAD_BYTES + 1` and stops, so a caller cannot choose the process's memory use.
- **Dimensions are capped at 2048 independently of size**, by parsing PNG `IHDR` and
  walking JPEG segments. A 30,000 × 30,000 PNG is under 1 KB and passes any byte check.
  WebP and ICO report `None` dimensions — a documented gap, bounded by the size cap.

Serving is version-keyed: URLs carry `?v=<epoch>`, `Cache-Control` is a year with
`immutable`, and `If-None-Match` is handled — including comma-separated lists, the
`W/` weak prefix and `*`.

### Four bugs found by verifying rather than assuming

1. **`ETag` without `If-None-Match` handling.** Starlette does not do conditional
   requests for you. The first version returned a correct `ETag` and answered every
   conditional request with a full 200 — which looks right until you measure it.
2. **`app/favicon.ico/route.ts` fails the build.** Next 14 treats that name as the
   metadata convention even as a *directory*:
   `Module not found: Can't resolve '.../app/favicon.ico?__next_metadata__'`. The
   handler moved to `/brand/favicon`, with `public/favicon.ico` still answering the
   bare path. A `next.config.mjs` rewrite cannot express "uploaded, else default"
   either — `beforeFiles` returns the API's 404, `afterFiles` never reaches the API.
3. **`NextResponse.redirect(new URL(..., request.url))` emitted
   `http://0.0.0.0:3001`** — the container's bind address, which curl follows and a
   browser cannot reach. Now a **relative** `Location`, resolved by the client against
   the host it actually used, which is also correct behind a proxy.
4. **Route order.** `/branding/{asset}` declared before `/branding/themes` made the
   catalog answer **422** — FastAPI bound `asset="themes"`, which failed the `Literal`.

### The 500-instead-of-422 bug this feature exposed

Adding a `field_validator` that raises `ValueError` surfaced a **pre-existing defect in
`main.py`'s 422 handler**. Pydantic v2 puts the exception *object* in the error entry's
`ctx`, and `json.dumps` cannot serialise it — so the handler raised inside the error
path and the caller got a **500 with a generic message instead of the 422 explaining
what was wrong**. Every schema with a custom validator was affected;
`tests/test_validation_error_serialisation.py` now covers three of them.

### Verified end to end

| Check | Result |
|---|---|
| Page static/dynamic split | **16 static / 3 dynamic** — unchanged. The two new route handlers are 0 B and are not pages |
| New react-hooks lint errors | **0.** Still 18 errors, 0 warnings — the PM-30 baseline |
| Backend suite | **197 passed** (was 74 before this work) |
| `ruff`, `tsc --noEmit`, `next build` | Clean |
| Theme switch, live | `theme_preset='indigo'` + revalidate → `--brand:77 84 182` in the rendered `<head>`, **no restart** |
| Asset serve | Bytes byte-identical to the upload; correct `Content-Type`, `ETag`, `nosniff` |
| Conditional requests | matching / `W/` / list / `*` → **304**; stale / absent → **200** |
| Favicon with none uploaded | `307 → /favicon.ico` → 200, the bundled default |
| Write path, by a real administrator | The audit trail records `Root User updated the application branding` with a full before/after diff including `theme_preset: crimson → teal` — password confirmation and super-admin gating exercised with a real login |

### The cache defect worth knowing about

`getBranding` caches for 300 s, which is what keeps 16 routes prerendered — and it
meant **a save landed in the database and the audit log while the page visibly did not
change**, for up to five minutes. `router.refresh()` does not help: it re-renders
server components and reuses the cached fetch. Fixed with
`POST /api/revalidate-branding`, which calls `revalidateTag("branding")`; both server
fetches carry that tag. Remove the tags and the route silently does nothing.

### Still open

- **`Navbar.tsx` renders a hardcoded `"Super Admin"`** where the sidebar renders
  `chrome_subtitle`. A *role* label shown to every user regardless of role — a
  pre-existing bug, left rather than guessed at. Decide: the user's actual role, or the
  branding subtitle.
- **Clients requesting `/favicon.ico` directly** — some bookmark and crawler behaviour —
  get the bundled default rather than the uploaded icon, because the dynamic handler
  cannot live at that path. Tabs read the `<link>` tag and are correct. Closing it needs
  a proxy rule, which belongs with the deployment topology.
- **No test drives an upload through HTTP.** `images.validate` is covered thoroughly as
  a pure function; the route's own 413/422 mapping and the `set_asset` write are not,
  because both need an authenticated super-admin session (PM-11).

---

## 8. SVG support, and reversing the decision that rejected it (2026-08-06)

**§ 3.4 and phase 4 rejected SVG outright. The owner asked for it, and it is now
accepted — safely, rather than by widening the allowlist.**

The original reasoning was sound and is worth keeping in view: an SVG is a *document*,
not a bitmap. It can carry `<script>`, event handlers and external references, and
served from our own origin a malicious one is stored XSS in the single asset shown on
every page including the login screen.

**What the first pass missed is an asymmetry:**

| How the SVG is loaded | Can it run script? |
|---|---|
| `<img src="…">` — how every consumer here renders it | **No**, in any current browser |
| Navigated to directly, as a top-level document | **Yes** |

So the exposure is someone opening the asset URL, not the application rendering it.
Two independent controls close it, and both are applied because either alone is one
mistake from failing:

**1 — Refused on upload, not sanitised** (`core/images.py::validate_svg`). Rejecting
beats stripping: silently rewriting somebody's logo hands back a file they did not
upload, and a half-stripped SVG fails in ways nobody can debug from the rendered
result. Refused: `<script>`, `<foreignObject>`, `<iframe>`, `<embed>`, `<object>`,
`<set>`/`<animate>` (SMIL can fire on load and set `href`), `<handler>`, `<!DOCTYPE>`
and `<!ENTITY>` (XXE, billion laughs), `javascript:` and `data:text/html` URLs,
`@import`, **any** `on…=` attribute, and any `href`/`src` that is not a `#fragment`.

**2 — Served under a hard CSP** (`api/settings.py`), so a file that somehow got past
control 1 executes nothing:

```
Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox
```

`default-src 'none'` forbids every script and every fetch. `style-src 'unsafe-inline'`
is the one allowance, because presentational CSS is how SVGs are legitimately styled
and cannot itself execute. `sandbox` drops the response into an opaque origin, so even
successful script would have no access to ours.

**Detection is structural, not a magic-byte check** — SVG is XML. `<svg` must be the
**root** element, behind at most a BOM, an XML declaration or comments. An HTML page
containing an inline SVG is therefore *not* an SVG, which matters because that is a
navigable document.

### Verified — 11 attack payloads, all refused

`inline script` · `onload` on the root · `onmouseover` on a child · `foreignObject` ·
`javascript:` href · external `<use>` · external `<image>` beacon · billion-laughs
entity expansion · SMIL `<animate>` rewriting `href` · CSS `@import` · an HTML page
disguising an inline SVG.

Each is a named test case in `tests/test_image_validation.py`, so a failure says which
attack got through. The suite also asserts **the project's own logo is accepted** — a
guard against tightening these rules until they reject our own artwork.

### The owner's artwork is now the bundled default

`logo/` supplied `logo-master.svg`, `logo-1024.png`, `favicon-32.png` and `favicon.ico`.
Installed:

| Source | Destination | Role |
|---|---|---|
| `logo/logo-master.svg` | `frontend/public/logo.svg` | Default logo (445 bytes) |
| `logo/favicon.ico` | `frontend/public/favicon.ico` | Default favicon, replacing the 25 KB inherited one |
| `logo/favicon-32.png` | `frontend/public/icon-32.png` | PNG icon variant |

`logo-candidates.png` (215 KB contact sheet) is deliberately not shipped.

`BrandMark` now falls back in **three** steps — uploaded logo → `NEXT_PUBLIC_APP_LOGO`
(defaulting to `/logo.svg`) → monogram. Every step is a complete answer: a project
reusing this core sets `NEXT_PUBLIC_APP_LOGO=""` and gets the letter badge back rather
than a broken image.

The static default needs none of the upload validation — nobody can replace
`public/logo.svg` without a deploy.

### ⚠️ The logo's teal is not the brand token, and should not become it

| Colour | White-on-it |
|---|---:|
| Logo `#2f8a78` | **4.18:1** |
| Brand token `#24695c` | 6.46:1 |

`#2f8a78` is **fine for the logo** — WCAG's non-text threshold is 3.0:1 and it clears
that comfortably. It would **fail** as `--brand`, where white button labels need 4.5:1.
So the two teals differing is correct, not a mismatch to "fix" by adopting the logo's
shade. If a preset matching the logo is ever wanted, darken it until white-on-it clears
4.5 and add it through `core/theme.py`, where the test suite will check it.

---

## 9. Related

- [`CORE_HARDENING_PLAN.md`](./CORE_HARDENING_PLAN.md) — PM-37…44; **PM-41's data layer changes how phase 1 is wired**, so prefer doing that first if both are in scope
- [`../system-design/UI_PATTERNS.md`](../system-design/UI_PATTERNS.md) § Colour System — the `brand-on-dark` rule § 3.5 must not break
- [`../system-design/NEXTJS_STANDARDS.md`](../system-design/NEXTJS_STANDARDS.md) § 2 — the server-shell/client-body pattern group C depends on
- [`../system-design/DEPLOYMENT.md`](../system-design/DEPLOYMENT.md) § 1 — the storage decision blocking phase 4
- [`../core/AUTHORIZATION.md`](../core/AUTHORIZATION.md) — `settings-manage` and the `"*"` wildcard consequence
