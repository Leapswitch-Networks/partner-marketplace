# Per-user theming — plan

> **Status: ✅ BUILT — 2026-08-20.** Shipped as specified, with the deviations below recorded
> honestly. Kept as the record of *why* it is shaped this way; `documentation/DAILY_CHANGES.md` has
> the entry.
>
> **Deviations from this plan, all discovered while building:**
>
> 1. **Clearing is the string `"inherit"`, not `null`.** The plan said "accept `null` to clear". That
>    cannot work on a partial update: `null` already means *not supplied* for every other field on
>    `UpdateProfileRequest`, so a reset-to-default control would have silently done nothing.
> 2. **The column is `theme_preference`, not `theme_preset`** — it sits beside
>    `timezone_preference` and `sidebar_preference`, and matching its neighbours matters more than
>    matching `app_settings`.
> 3. **The response carries two fields, not one.** `theme_preference` is the raw choice (null when
>    inheriting) and `resolved_theme` is what should render. A resolved value alone cannot tell
>    "chose pine" from "inherits, and the installation is pine" — and a picker has to show which.
> 4. **`resolved_theme` is null when the installation runs a custom brand colour**, because no
>    preset key can name one. The server-rendered style is already correct there.
>
> Planning docs are intent, not current state.
> The colour values this delivers are specified in
> [`../design/BACKOFFICE_DESIGN.md`](../design/BACKOFFICE_DESIGN.md); this file is only the
> *mechanism* by which a theme becomes **per-user**.

**The ask (owner, 2026-08-20):** the installation has one default theme; each user may override it
for themselves; their choice is stored server-side so it follows their login onto any machine; and it
is cached in the browser so a page load applies the theme without waiting on the database.

**Decided with the owner:** presets only — no per-user custom hex. Every preset in
`core/theme.py::THEME_PRESETS` is already contrast-audited, so a closed set means **no user can
produce an unreadable UI**, and there is no new validation surface.

---

## 1. What exists today, and why this is a new feature rather than an edit

`app_settings` is a **single row** — `SINGLETON_ID = 1`, enforced by
`CheckConstraint("id = 1", name="app_settings_single_row")`. Its docstring draws the line this plan
has to respect:

> *"This table holds what the application **is**, not what a user prefers. Personal preferences live
> on `users` (`timezone_preference`, `sidebar_preference`); this is the project's identity, and
> changing a value here changes what every user sees."*

So per-user theming is **not** a change to the branding module. `PUT /api/v1/settings/branding` is
super-admin, password-confirmed and audited, and it must stay that way — routing a personal
preference through it would let any user rewrite the installation's identity. The branding module
keeps owning the **default**; this plan adds a **personal override** beside it, on the seam the
`users` table already uses for exactly this.

## 2. Precedence

```
user.theme_preset          →  a personal choice, NULL when never set
    ↓ falls back to
app_settings.brand_color   →  the installation's custom hex, if an admin set one
app_settings.theme_preset  →  the installation's chosen preset
    ↓ falls back to
theme.DEFAULT_PRESET       →  the shipped default (becomes `pine`, per BACKOFFICE_DESIGN.md § 11.1)
```

**NULL means inherit, never "no theme"** — the same convention `app_settings` already uses for every
column. Clearing a personal choice returns the user to whatever the installation is currently on,
including future changes to it. That is the behaviour an admin rebrand needs: it must reach every
user who has not deliberately opted out.

## 3. Schema

One nullable column, mirroring `timezone_preference` / `sidebar_preference`:

```
users
  + theme_preset  VARCHAR(40)  NULL   -- key into core.theme.THEME_PRESETS; NULL = inherit
```

Alembic migration, hand-written, additive, no backfill — every existing user starts as NULL and
therefore inherits, which is exactly the current behaviour. **No default at the database level**: a
DB default would make "never chosen" indistinguishable from "deliberately chose the default", and
those must differ, or a rebrand cannot reach the first group.

⚠️ Migration and schema work is the orchestrator's, not a subagent's (`AGENTS.md` § 2). Verify with
`docker compose run --rm backend alembic current` — `run --rm`, never `exec`.

## 4. API — extend, do not add

**Corrected during planning.** The obvious design is a new `/me/preferences` endpoint. That would be
a second way to do something the project already does, which `AGENTS.md` § 5 forbids. The real path:

| Direction | Endpoint | Change |
|---|---|---|
| Read | `GET /api/v1/auth/me` (`auth.py:552`) | Add `theme_preset` to `CurrentUserResponse` |
| Write | `PATCH /api/v1/auth/me` (`auth.py:565`) | Add `theme_preset` to the allowlist in `auth_service.py:264` |

**The read costs nothing.** `/auth/me` is already fetched on every authenticated page load, so the
theme rides along on a request that happens anyway — no second round-trip, which is most of what the
owner asked the cache for.

Validation: reject any key not in `THEME_PRESETS`; accept `null` to clear. The closed set is the
guard — the same reason `theme.py` is documented as *"the only place a new one may be added"*.

## 5. Applying it without a flash — the part that is not optional

**A per-user theme cannot use the mechanism the installation theme uses.** The root layout resolves
branding on the **server** (`layout.tsx:45`, `await getBranding()`) and writes a `<style>` block into
`<head>`. That works only because branding is *public* data. Per `AGENTS.md` § 5, authenticated data
**cannot** be fetched server-side — the `httpOnly` cookie cannot be forwarded — so the server has no
way to know who is asking. Getting this backwards fails silently.

So the personal theme has to be applied client-side, before first paint. **The project already does
exactly this for dark mode** (`layout.tsx:34`): a blocking inline script reads `localStorage` and
sets the class before the browser paints. The personal theme extends that same script.

```
<head>
  1. <style> installation default        ← server-rendered. The floor. No JS, no auth, no flash
  2. <script> blocking, inline           ← reads localStorage, overrides the vars for THIS user
  3. hydration → /auth/me                ← reconciles; writes the cache back if it changed
```

Layered this way, every failure degrades to *the installation default*, never to an unstyled page:
JS off, cache empty, first login on a new machine, or a failed `/auth/me` all render step 1.

### Cache the resolved variables, not the preset key

`core/theme.py::css_variables` owns the derivation maths — wash is brand at 10% over white,
night-border at 20% over the dark card, success darkened 27%. **The browser must never reimplement
that.** Cache the *output* — the resolved custom-property block — so the inline script only assigns
values it was given. A second implementation of that maths in JavaScript would drift from the Python
one, and the symptom would be tints that are subtly wrong under some themes only.

### 🔴 Clear the cache on logout

`localStorage` is per-origin, not per-user. Without an explicit clear, user A logs out, user B logs
in on the same browser, and B sees A's theme until hydration finishes. Not a data leak — the preset
key is not sensitive — but it looks exactly like the bug where a page shows the wrong account's
state, and it will be reported as one. **The logout path must clear the theme cache**, alongside
whatever else it clears.

Use `localStorage`, not `sessionStorage`, matching the existing dark-mode key: a preference that
survives closing the tab is the point, and `sessionStorage` would re-flash on every new tab.

## 6. Where the user changes it

A personal control, not the admin branding screen. Natural home: **Settings → Profile**
(`/settings/profile`), beside the timezone and sidebar preferences it mirrors. The admin branding
screen keeps owning the installation default and gains a line saying a personal choice overrides it.

## 7. Order

| # | Step | Risk |
|---|---|---|
| 1 | Migration: `users.theme_preset` | ⚠️ Orchestrator only |
| 2 | Model + `CurrentUserResponse` + `PATCH /auth/me` allowlist + validation | Low |
| 3 | Resolve precedence server-side; return resolved vars with the user | Medium — the contract |
| 4 | Extend the inline script; cache write-back; **clear on logout** | Medium |
| 5 | Profile control | Low |
| 6 | Tests: precedence at all three levels, unknown key rejected, clear-on-logout | — |

## 8. Verification

```bash
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose run --rm --no-deps backend sh -c "pip install -q pytest ruff && python -m pytest -q && ruff check ."
docker compose run --rm backend alembic current
```

Plus, in a browser, the four cases that the layering exists for: JS disabled · empty cache · a user
with NULL · logout-then-login-as-someone-else. **Never `npm run build` in the dev container**
([ADR-0013](../adr/0013-compose-is-development-only.md)).

## 9. Open questions

1. **Should a personal theme be a permission?** This plan says no — it is self-service on `/auth/me`,
   like a timezone. If some deployment wants to lock the palette down, that is a future
   `require_permission` on the write, not a schema change.
2. **Should the sign-in screen honour it?** It cannot — nobody is authenticated yet, so it renders
   the installation default. Worth stating in the UI so it does not read as a bug.
3. **Does a personal theme reach the public directory?** **No.** `public.css` opts the public surface
   out of runtime theming entirely, and that firewall is deliberate.

## Related

- [`../design/BACKOFFICE_DESIGN.md`](../design/BACKOFFICE_DESIGN.md) — the palette this ships
- [`DYNAMIC_BRANDING_PLAN.md`](DYNAMIC_BRANDING_PLAN.md) — the installation-wide engine underneath
- [`../core/AUTHENTICATION.md`](../core/AUTHENTICATION.md) — the cookie model § 5 depends on
- [`../system-design/DATABASE_MIGRATIONS.md`](../system-design/DATABASE_MIGRATIONS.md) — the § 3 runbook
