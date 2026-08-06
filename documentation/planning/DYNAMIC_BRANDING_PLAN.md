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
| 1 | **Text identity** — table, public GET, `settings-manage`, PUT, groups A + B + D, env fallbacks | The name, monogram, subtitle and tagline become configurable. **This is ~80% of the felt benefit.** | Nothing |
| 2 | **Group C → env constants** | 16 literals become one constant; a new project sets `APP_NAME` and rebuilds | Nothing |
| 3 | **Theme presets** — CSS custom properties + curated set | Colour becomes configurable, accessibly | **Sign-off on `tailwind.config.ts`** (protected) |
| 4 | **Logo + favicon upload** | Full visual identity | The § 3.4 storage decision. `bytea` unblocks it immediately if accepted |
| 5 | *(deferred)* Runtime-dynamic `<title>`/favicon | Rename without a redeploy | Accepting § 3.2's cost. **Only if a customer asks.** |

**Phases 1 and 2 need no decisions and no protected files.** They are the ones to build.

**What I would explicitly not build:** a tenant dimension. "Reuse the core for future projects" means a
separate deployment with a separate database per project, so **one row is right**. Per-tenant branding —
several brands served from one deployment — is a much larger feature (a tenant on every query, host-based
resolution, PM-5's scoping as a prerequisite). Building the settings table with a `tenant_id` "just in
case" costs complexity now and still would not be enough later. Decide it deliberately if it ever comes
up; do not hedge.

---

## 6. Related

- [`CORE_HARDENING_PLAN.md`](./CORE_HARDENING_PLAN.md) — PM-37…44; **PM-41's data layer changes how phase 1 is wired**, so prefer doing that first if both are in scope
- [`../system-design/UI_PATTERNS.md`](../system-design/UI_PATTERNS.md) § Colour System — the `brand-on-dark` rule § 3.5 must not break
- [`../system-design/NEXTJS_STANDARDS.md`](../system-design/NEXTJS_STANDARDS.md) § 2 — the server-shell/client-body pattern group C depends on
- [`../system-design/DEPLOYMENT.md`](../system-design/DEPLOYMENT.md) § 1 — the storage decision blocking phase 4
- [`../core/AUTHORIZATION.md`](../core/AUTHORIZATION.md) — `settings-manage` and the `"*"` wildcard consequence
