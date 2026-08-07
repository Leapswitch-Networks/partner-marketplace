# Next.js 14 + React 18 + Redux Toolkit Standards

> **Page and feature composition.** For design atoms (colours, Button, dark mode) read
> `UI_PATTERNS.md`. For backend conventions read `FASTAPI_STANDARDS.md`.

> ⚠️ **This is not the Next.js you know.** Per the root `AGENTS.md`, this version may differ from
> your training data. **Read `node_modules/next/dist/docs/` before writing Next.js code** and heed
> deprecation notices. Verify APIs rather than recalling them.
>
> Checked 2026-07-31: `node_modules/next/dist/docs/` **does not exist** in next 14.2.35 — that
> directory ships with later releases. Until the version changes, verify against the installed
> package itself (`npx next <command> --help`, the type definitions in `node_modules/next/types/`)
> rather than from memory. The instruction's intent still stands; only the path is unavailable.

---

## 📖 Scope of This File (Read First)

| This file | Not this file |
|-----------|---------------|
| App Router structure, route groups, layouts | Colours, Button/Input internals (`UI_PATTERNS.md`) |
| Server vs client component split | API endpoint design (`FASTAPI_STANDARDS.md`) |
| Redux slices and typed hooks | Auth semantics (`../core/AUTHENTICATION.md`) |
| The `lib/api` layer and error handling | Deployment (`DEPLOYMENT.md`) |
| Forms with React Hook Form + Zod | |

**Verified stack:** Next.js 14.2.35 · React 18.3.1 · TypeScript 5 · Tailwind 3.4.19 ·
Redux Toolkit 2.11.2 · react-redux 9.2.0 · React Hook Form 7.72.1 · `@hookform/resolvers` 5.2.2 ·
Zod 4.3.6 · Axios 1.15.0.

> **React is 18.3.1, and that is now a supported pairing** — inside `next@14.2.35`'s declared
> `peer react@^18.2.0`, so the tree resolves with no `--legacy-peer-deps`.
>
> It was React 19.2.4 until **2026-08-07**, which this document called "verified" while npm rejected the
> pairing outright. The correction is worth reading rather than skipping, because the entry below it said
> the combination "works at runtime": **it stopped.** An unsupported React took down the App Router's
> client runtime — `Cannot read properties of undefined (reading 'call')` from a `<Lazy>` inside Next's
> own `layout-router` — and with it the entire dashboard. See **PM-25** in `../planning/TECH_DEBT.md`.
>
> So: **do not reach for a React 19-only API** (`useActionState`, `useFormStatus`, `useOptimistic`,
> `use()`). None is available, and none was in use — which is why the downgrade needed no code changes.
> Moving to React 19 means moving to Next 15 first, as its own piece of work.

---

## Table of Contents

1. [Folder Structure](#1-folder-structure)
2. [Server vs Client Components](#2-server-vs-client-components)
3. [Routing & Route Groups](#3-routing--route-groups)
4. [Middleware](#4-middleware)
5. [The API Layer](#5-the-api-layer)
6. [State — Redux Toolkit](#6-state--redux-toolkit)
7. [Forms — RHF + Zod](#7-forms--rhf--zod)
8. [Error Handling](#8-error-handling)
9. [Loading States](#9-loading-states)
10. [TypeScript Conventions](#10-typescript-conventions)
11. [Performance](#11-performance)
12. [Adding a New Page](#12-adding-a-new-page)
13. [Known Issues](#13-known-issues)

---

## 1. Folder Structure

```
frontend/
├── middleware.ts              # edge route protection
├── next.config.mjs            # headers, compression, package-import optimisation
├── tailwind.config.ts         # brand palette, keyframes, darkMode: "class"
├── app/
│   ├── layout.tsx             # root layout: font, theme script, Providers
│   ├── globals.css            # Tailwind directives + custom utilities
│   ├── page.tsx               # never reached — middleware redirects /
│   ├── (auth)/                # route group — no URL segment
│   │   ├── layout.tsx
│   │   ├── sign-in/page.tsx
│   │   └── sign-up/page.tsx
│   └── dashboard/
│       ├── layout.tsx
│       ├── page.tsx           # server shell
│       ├── DashboardClient.tsx
│       ├── profile/page.tsx
│       ├── all-users/page.tsx
│       ├── add-user/page.tsx
│       ├── roles/page.tsx
│       └── activity/page.tsx
│   ├── settings/             # profile, password, appearance, branding
│   └── brand/favicon/route.ts  # dynamic favicon — see the note in the file
├── components/
│   ├── common/                # cross-feature primitives
│   ├── auth/                  # sign-in/up specific
│   ├── dashboard/             # dashboard specific
│   └── admin/                 # admin forms
├── lib/
│   ├── api/                   # axiosInstance + one module per resource
│   ├── store/                 # store + slices
│   ├── hooks/                 # typed dispatch/selector, useTheme, usePermissions,
│   │                          #   useAutoPerPage, useDebouncedValue
│   └── utils/                 # constants, user helpers
└── types/index.ts             # shared types
```

### Placement rules

| Put it in | When |
|-----------|------|
| `components/common/` | Used by two or more features, no domain knowledge |
| `components/<feature>/` | Belongs to one feature |
| Colocated next to the page | Used by exactly one page and unlikely to move (e.g. `DashboardClient.tsx`) |
| `lib/utils/` | Pure function, no React |
| `lib/hooks/` | Reusable hook |
| `types/index.ts` | A type crossing a module boundary |

⚠️ `tailwind.config.ts` only scans `./app/**` and `./components/**`. **Classes written in `lib/` or
any new top-level folder will be purged.** Add the path to `content` if you introduce one.

---

## 2. Server vs Client Components

App Router components are **server components by default**. Add `"use client"` only when needed.

### `"use client"` is required for

- `useState`, `useEffect`, `useCallback`, any hook
- Event handlers (`onClick`, `onSubmit`)
- Redux (`useAppSelector`, `useAppDispatch`)
- Browser APIs (`localStorage`, `window`, `matchMedia`)
- React Hook Form

### The established pattern: server shell → client body

```
app/dashboard/page.tsx        ← server component: metadata, static structure
  └── DashboardClient.tsx     ← "use client": data fetching, interactivity
```

**Why:** data must be fetched from the browser so the `httpOnly` auth cookie is sent automatically.
A server component fetching from the API would have to forward cookies manually.

### Rules

1. **Push `"use client"` as deep as possible.** A client boundary makes the whole subtree client-side.
2. **Never put `"use client"` in `app/layout.tsx`.** It would opt the entire app out of server
   rendering. The root layout stays a server component; `Providers.tsx` carries the directive.
3. **A component with only props and markup should not be a client component.**
4. **Don't fetch API data in a server component.** No cookie-forwarding pattern exists here.

---

## 3. Routing & Route Groups

### Route groups

`(auth)` is a route group — parenthesised folders organise files **without adding a URL segment**.
`app/(auth)/sign-in/page.tsx` serves `/sign-in`, not `/auth/sign-in`. It exists so sign-in and
sign-up can share a layout that the dashboard doesn't.

### File conventions

| File | Purpose |
|------|---------|
| `page.tsx` | The route's UI (required to make a route public) |
| `layout.tsx` | Wraps children; persists across navigation within the segment |
| `loading.tsx` | Suspense fallback |
| `error.tsx` | Error boundary |
| `not-found.tsx` | 404 UI |
| `global-error.tsx` | Catches a failure in the **root layout itself** |
| `route.ts` | A route handler rather than a page — e.g. `app/brand/favicon/route.ts` |

**All present since 2026-08-03 (PM-19)** — eight files: `app/global-error.tsx`, `app/error.tsx`,
`app/dashboard/error.tsx`, `app/(auth)/error.tsx`, `app/not-found.tsx`, `app/loading.tsx`,
`app/dashboard/loading.tsx`, plus the shared `components/common/ErrorState.tsx` body.

Three things that are easy to get wrong:

1. **`global-error.tsx` renders its own `<html>` and `<body>`, and uses inline styles.** It *replaces*
   the root layout rather than nesting inside it, so it cannot assume `Providers`, the Redux store, the
   theme class, or that `globals.css` even loaded.
2. **`error.digest`, not `error.message`, is what users see.** Next replaces a server-thrown message
   with an opaque digest before it reaches the browser, deliberately.
3. **A folder starting with `_` is private and not routable** — a verification attempt using
   `app/(auth)/__boom/` returned 404 because the route never existed, not because the boundary failed.

### Root layout

```tsx
// `async`, because branding is resolved server-side once for every route.
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const branding = await getBranding();
  const themeRule = themeStyleRule(branding);

  return (
    <html lang="en" className={`${montserrat.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {themeRule && <style dangerouslySetInnerHTML={{ __html: themeRule }} />}
      </head>
      <body className="min-h-full flex flex-col font-sans text-sm bg-white dark:bg-night-body …">
        <BrandingProvider branding={branding}>
          <Providers>{children}</Providers>
        </BrandingProvider>
      </body>
    </html>
  );
}
```

⚠️ **`getBranding` uses `fetch` with `next.revalidate`, and that choice is load-bearing.** It is
compatible with static generation, so the 16 prerendered routes stay prerendered. `cache: "no-store"`
here — or reading `cookies()`/`headers()` — would flip **all of them** to server-rendered-on-demand.

Three things here are deliberate — don't remove them:

- **`suppressHydrationWarning`** on `<html>` — the theme script mutates `class` before hydration, so
  server and client markup legitimately differ
- **The inline theme script** — runs before React paints, eliminating the dark-mode flash. It must
  stay synchronous and in `<head>`
- **`Inter` via `next/font/google`** exposed as `--font-inter`, consumed by `tailwind.config.ts`

`metadata.title` is `"Partner Marketplace"`. Each route sets its own
`"<Page> — Partner Marketplace"` title in its `page.tsx`; keep that suffix consistent when adding
routes.

---

## 4. Middleware

`frontend/middleware.ts`:

```ts
const PROTECTED = ["/test", "/result", "/admin", "/dashboard"];
```

| Path | Behaviour |
|------|-----------|
| `/` | unconditional redirect to `/sign-in` |
| starts with a `PROTECTED` prefix and no `access_token` cookie | redirect to `/sign-in` |
| everything else | `NextResponse.next()` |

### Rules

1. **This is UX, not security.** It checks cookie *presence* only — no signature, no expiry, no role.
   Real enforcement is the backend's dependency guards.
2. **Keep the `matcher` in sync with `PROTECTED`.** Both lists must be updated together or protection
   silently stops applying.
3. **Never add `/sign-in` to `PROTECTED`** — infinite redirect loop.
4. **Don't call the API from middleware.** It runs on the edge on every matched request.

---

## 5. The API Layer

### One shared instance

`lib/api/axiosInstance.ts`:

```ts
const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}${API_PREFIX}`,  // the version lives here, once
  timeout: DEFAULT_TIMEOUT_MS,              // 5s — fail fast when the backend is down
  withCredentials: true,                    // send httpOnly cookies on every request
});
```

`LONG_TIMEOUT_MS` (120s) is exported for the endpoints the 5s default would kill — the streamed
activity-log export, and asset uploads. Pass it per request; do not raise the default.

`withCredentials: true` is **mandatory** — without it no cookie is sent and every request 401s.

### The refresh interceptor

```
request → 401
   ├─ url is /api/v1/auth/refresh or /api/v1/auth/logout → reject (prevents recursion)
   ├─ original._retry already true                 → reject (one attempt only)
   └─ else POST /api/v1/auth/refresh (3s timeout)
        ├─ ok   → replay the original request
        └─ fail → reject with the ORIGINAL error
```

Two invariants to preserve if you touch this:

1. **Reject with the original error, not the refresh error** — callers must see the real status and
   `detail` from the request they actually made.
2. **The `_retry` flag** is what stops an infinite 401 → refresh → 401 loop.

### One module per resource

| Module | Covers |
|--------|--------|
| `authApi.ts` | register, login, logout, refresh, me, profile, change/reset password, 2FA, sessions, invitations, email verification, Google URL |
| `adminApi.ts` | user administration — CRUD, approve, toggle status, unlock, bulk, reset 2FA |
| `rbacApi.ts` | roles, the permission catalog, nav preferences, invitations |
| `navigationApi.ts` | the server-driven sidebar |
| `settingsApi.ts` | installation branding — text, theme presets, logo/favicon upload |

⚠️ **Paths are written relative to the version**, because `axiosInstance`'s `baseURL` is
`${API_BASE_URL}${API_PREFIX}` (PM-40). Write `"/auth/login"`, **not** `"/api/v1/auth/login"` — the
latter would resolve to `/api/v1/api/v1/auth/login`. A v2 is then one constant instead of 57 edits.

**The exception:** `/api/revalidate-branding` is a **Next route handler** served by this application,
not by the backend. It is called with a bare `fetch` on a relative path and must not be prefixed.

### Rules

1. **Never call `axios` or `fetch` directly from a component.** Always go through a `lib/api` module.
2. **Every module imports the shared `axiosInstance`** — never `axios` itself, or you lose credentials
   and the refresh interceptor.
3. **Return the axios response**, let the caller read `.data`. That's the existing convention
   (`res.data.user`).
4. **`API_BASE_URL` comes from `lib/utils/constants.ts`**, which falls back to
   `http://localhost:8000`. Never hardcode a URL.
5. **Paths include `/api`** — `baseURL` is the host only.

---

## 6. State — Redux Toolkit

### Store

```ts
export const store = configureStore({
  reducer: { auth: authReducer, test: testReducer },
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### Always use the typed hooks

```ts
import useAppDispatch from "@/lib/hooks/useAppDispatch";
import useAppSelector from "@/lib/hooks/useAppSelector";
```

❌ Never import `useDispatch` / `useSelector` from `react-redux` directly — you lose all typing.

### What belongs in Redux

| Put in Redux | Keep in `useState` |
|--------------|--------------------|
| Current identity / auth status | Form field values (RHF owns these) |
| State two unrelated routes both need | Modal open/closed |
| Long-lived cross-page state | Server error for one form |
| | Anything one component owns |

**Default to `useState`.** Only promote to Redux when a second consumer actually exists.

`AuthInitializer.tsx` hydrates identity on mount via `fetchCurrentUser` (`GET /api/v1/auth/me`), so a
page refresh restores the session from the cookie instead of losing it. `whoami` was removed in the
account merge — there is one identity endpoint.

`authSlice` is the only slice. `testSlice` was deleted with the inherited domain on 2026-08-06.

Branding is **not** in Redux: it is resolved server-side and passed down through
`BrandingProvider`'s context, which is what keeps it off PM-30's fetch-on-mount ledger.

---

## 7. Forms — RHF + Zod

The established pattern, from `components/auth/SignInForm.tsx`:

```tsx
"use client";

const schema = z.object({
  email: z.email({ message: "Enter a valid email address" }),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export default function SignInForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      const res = await authApi.login(data);
      dispatch(setUser(res.data.user));
      router.push("/dashboard");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setServerError(detail ?? "Invalid email or password.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {serverError && <div role="alert" className="…">{serverError}</div>}
      <Input label="Email address" error={errors.email?.message} {...register("email")} />
      <Button type="submit" loading={isSubmitting} fullWidth>Sign in</Button>
    </form>
  );
}
```

### Rules

1. **Zod schema above the component**, `type FormValues = z.infer<typeof schema>` — never hand-write
   the form type.
2. **`zodResolver(schema)`** — no manual validation.
3. **`noValidate`** on the `<form>` so browser validation doesn't compete with Zod.
4. **Field errors** → `error={errors.x?.message}` on `Input`. **Server errors** → separate
   `serverError` state rendered in a `role="alert"` banner. Keep the two distinct.
5. **`loading={isSubmitting}`** on the submit `Button` — never a second boolean.
6. **Type the catch as `unknown`** and narrow, as above.
7. ⚠️ **Zod 4 syntax.** Top-level string formats are their own functions: `z.email()`, not
   `z.string().email()` (deprecated in v4). Check `node_modules/zod` if unsure.
8. **Mirror backend constraints** in the schema, but never rely on them — the server validates too.
9. ⚠️ **If the schema coerces (`z.coerce.*`), its input and output types differ** and
   `useForm<z.infer<…>>` will not type-check — `z.infer` gives the *output* type while the resolver
   needs the *input* type. Use the three-generic form:
   ```ts
   type FormInput  = z.input<typeof schema>;   // resolver side
   type FormValues = z.output<typeof schema>;  // onSubmit side
   useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), … })
   ```
   This exact mistake broke the production build (`../planning/TECH_DEBT.md` PM-24).

⚠️ **`SignInForm` may need to handle a two-factor challenge.** `authApi.login` can resolve to
`TwoFactorRequiredResponse` instead of a session — use the `isTwoFactorRequired` type guard the module
exports rather than assuming `res.data.user` exists.

(This paragraph previously warned that sign-in authenticated against `admin_users` and that end users
had no entry point. Both stopped being true with migration `e7b41c9a2d10`: there is one account table,
one login endpoint, and roles decide capability.)

---

## 8. Error Handling

Backend errors always arrive as `error.response.data.detail` (a string). That is the FastAPI
convention — see `FASTAPI_STANDARDS.md` § 8.

```ts
const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
setServerError(detail ?? "Something went wrong.");
```

### Rules

1. **Always provide a fallback message** — `detail` is absent for network errors and timeouts.
2. **Show `detail` verbatim.** It is written to be user-facing.
3. **Never render a raw error object or stack.**
4. **Don't handle 401 manually** — the interceptor already tried refresh. A 401 reaching your
   `catch` means the session is genuinely gone.
5. **A 5s timeout surfaces as a network error, not an HTTP status.** Handle the no-response case.

---

## 9. Loading States

One skeleton exists: `components/common/Skeleton.tsx`. It is generic — most pages have no matching
shape, which is worth pairing with PM-41 rather than doing alone.

| State | Pattern |
|-------|---------|
| Initial page data | Skeleton matching the final layout |
| Form submitting | `loading` prop on `Button` (renders a spinner, disables itself) |
| Background refresh | Leave existing content; don't flash a skeleton |

**Never** show a bare "Loading…" string, and never collapse layout height while loading — it causes
layout shift.

---

## 10. TypeScript Conventions

| Rule | Detail |
|------|--------|
| Path alias | `@/` → project root. Never write `../../..` |
| Shared types | `types/index.ts` |
| Component props | `interface XProps`, colocated above the component |
| Extending DOM props | `interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>` |
| Forwarding refs | `forwardRef<HTMLInputElement, InputProps>` + set `.displayName` |
| Catch clauses | `catch (err: unknown)`, then narrow |
| `any` | Don't. Use `unknown` and narrow. |
| Form types | Always `z.infer<typeof schema>` |
| Defaults | Destructure with defaults: `{ variant = "primary" }` |

---

## 10b. Hooks

| Hook | Purpose |
|------|---------|
| `useAppDispatch` / `useAppSelector` | Typed Redux accessors — **never** import the untyped ones |
| `usePermissions` | `can` / `canAny` / `canAll` / `hasRole` / `hasAdminAccess` / `isSuperAdmin` |
| `useAutoPerPage` | Viewport-sized rows per page for index tables |
| `useDebouncedValue` | 500ms debounce, for search inputs |
| `useTheme` | Light/dark toggle backed by `localStorage` |

### Gating UI on permissions

```tsx
const { can } = usePermissions();
{can("user-create") && <Button onClick={openCreate}>Add user</Button>}
```

The permission list arrives already resolved from `GET /api/v1/auth/me`, with the super-admin bypass
expanded server-side — so there is no client-side special case for super admins.

**Three rules:**

1. **Gate the nav item, not just the page.** Offering a link that 403s on click is worse than not
   offering it. `Sidebar` and `DashboardOverview` both filter on permissions.
2. **Use the row's `can_*` flags for row actions.** The API computes them against the requesting
   actor, so the UI and API cannot disagree about what is allowed.
3. **This is rendering only.** The API re-checks every request and is the authority. A hidden button
   is not a security control — verified by driving a partner session at a protected URL directly and
   confirming it shows the API's 403 rather than data.

---

## 11. Performance

Already configured in `next.config.mjs` — don't undo these:

| Setting | Effect |
|---------|--------|
| `compress: true` | gzip responses |
| `poweredByHeader: false` | Drops `X-Powered-By` |
| `reactStrictMode: true` | Double-invokes effects in dev to surface bugs |
| `optimizePackageImports` | Tree-shakes `@/components/{admin,dashboard,common}` barrel imports |
| `/api/:path*` → `no-store` | API responses never cached |
| Static assets → `max-age=31536000, immutable` | Hashed assets cached for a year |

Additional rules:

- **`next/font`** for fonts (already used for Inter) — never a `<link>` to Google Fonts
- **`next/image`** for images, so sizing and format negotiation are handled
- **Don't add a heavy dependency** for something Tailwind or a small helper can do

---

## 12. Adding a New Page

Checklist for `/dashboard/listings`:

- [ ] `app/dashboard/listings/page.tsx` — server shell (metadata, static frame)
- [ ] `app/dashboard/listings/ListingsClient.tsx` — `"use client"`, data + interactivity
- [ ] `lib/api/listingApi.ts` — API module using the shared `axiosInstance`
- [ ] `types/index.ts` — types matching the backend response schema
- [ ] Skeleton for the initial load
- [ ] If protected, confirm the prefix is covered by **both** `PROTECTED` and `matcher` in `middleware.ts`
- [ ] Sidebar entry (`components/dashboard/Sidebar.tsx`)
- [ ] Verify dark mode (`UI_PATTERNS.md`)
- [ ] Entry in `../DAILY_CHANGES.md`

---

## 13. Known Issues

**Rewritten 2026-08-06** — five of the seven rows described code that no longer existed. Resolved rows
are recorded in [`../planning/TECH_DEBT.md`](../planning/TECH_DEBT.md) rather than carried here as
struck-through text, which is how a "known issues" list becomes unreadable.

| Issue | Detail |
|-------|--------|
| **18 react-hooks errors** (PM-30) | `npm run lint` reports them, and CI runs the lint step with `continue-on-error` because of it. **They are not a lint problem**: every one is fetch-on-mount, which is what a codebase does when it has no data layer — so the count grows with each new client component. PM-41 removes the cause. PM-25 was thought to gate this too, but settling it changed nothing here: the rules come from `eslint-config-next@16` judging a Next 14 codebase, and the React version was never what made them fire. **Do not blanket-disable them** — the same rule set caught a real defect, `memo()` components declared inside `Sidebar`'s render |
| **No data layer** (PM-41) | 44 of 76 components are `"use client"`; all 24 server components under `app/` are shells that fetch nothing. Every screen is a two-round-trip waterfall, nothing is cached or deduplicated or cancelled, and `loading.tsx` almost never renders because the segment resolves instantly |
| ~~**`npm ci` fails**~~ (PM-25) | **Resolved 2026-08-07** — React is on 18.3.1, inside Next 14's peer range, and the tree resolves with no flag. It was not a build-only annoyance in the end: the unsupported pairing broke the App Router client runtime and sign-in with it |
| ~~Types are hand-copied~~ (PM-42) | ✅ **Resolved 2026-08-06.** `types/api.d.ts` is generated from `backend/openapi.json`; `types/api-contract.ts` asserts the hand-written types still match it in both directions. **Add a line there for every new response type** — a schema with no assertion is a schema that can drift. Regenerate with `npm run codegen:api` |
| `@tailwindcss/postcss ^4` is unused (PM-22) | `postcss.config.mjs` uses the v3 plugin form and `tailwindcss ^3.4.19` is installed, so the build is consistent. Dead weight — safe to remove, **not** safe to activate |
| `app/page.tsx` is unreachable | `middleware.ts` redirects `/` unconditionally. Either delete it or note that it exists only to satisfy the route tree |
| `Skeleton` has no per-page shapes | Worth pairing with PM-41 rather than doing alone — until pages fetch server-side, a shaped skeleton has almost nowhere to appear |

---

## Related Documentation

- [`UI_PATTERNS.md`](./UI_PATTERNS.md) — colours, components, dark mode
- [`FASTAPI_STANDARDS.md`](./FASTAPI_STANDARDS.md) — the API being consumed
- [`../core/ARCHITECTURE.md`](../core/ARCHITECTURE.md) — how the tiers fit together
- [`../core/AUTHENTICATION.md`](../core/AUTHENTICATION.md) — cookies and the refresh contract

---

## Pending

> **Frontend convention work still outstanding.** Last audited **2026-08-06**. The largest item here is
> architectural rather than a defect: **there is no data-fetching layer**, and § 13 *Known Issues* is
> stale in five of its seven rows.

### 🔴 The missing layer, and why the lint count keeps climbing

- [ ] **PM-41 — introduce one data-fetching layer.** Measured: 76 `.tsx` files, **44 with
      `"use client"`**, 22 using `useEffect`, and **all 24 server components under `app/` are shells** —
      each sets `metadata` and renders one client component. Not one fetches anything or reads a cookie
      server-side. Four consequences:
  - [ ] **Every screen is a waterfall.** HTML → JS → mount → `useEffect` → `/api/v1/auth/me` → the screen's
        own data. Two sequential round trips a server component could collapse into zero.
  - [ ] **Nothing is cached, deduplicated or cancelled.** Two components needing the same list fetch it
        twice; navigating away leaves the response to arrive at an unmounted tree.
  - [ ] **`loading.tsx` almost never renders.** § 9 already notes the fallback is "not doing much work
        today" — the reason is that the segment resolves instantly because it fetches nothing.
  - [ ] **This is PM-30's cause.** All 20 react-hooks errors are fetch-on-mount. The register recorded
        the count going 17 → 18 → 19 → 20, one per new component, and recorded that an honest attempt to
        satisfy the rule with a cancellation flag **did not clear the error**. The rule is not wrong and
        the code is not wrong — the architecture is what it objects to. RTK Query is the natural fit; the
        store is already Redux Toolkit. **This retires PM-30 by construction rather than by suppression.**
- [ ] **PM-42 — generate types from OpenAPI.** `types/index.ts` is 161 lines hand-mirroring
      `backend/app/schemas/`, connected to it by nothing. A renamed or newly-optional backend field
      produces a `tsc --noEmit`-clean frontend that reads `undefined` at runtime — types that agree by
      convention give the *appearance* of an enforced contract, which is worse than none because it stops
      anyone checking. Use `openapi-typescript` against `/openapi.json`, commit the output, and have CI
      fail if regenerating produces a diff. **Depends on PM-40** — generate against the versioned paths.
- [ ] **PM-40 — 38 hardcoded `"/api/…"` literals across five `lib/api/` modules.** Add an `API` prefix
      constant to `lib/utils/constants.ts` and template the paths, so the next version bump is one edit.
      § 5 *Rules* should require it.

### 🟠 Decisions that gate the above

- [x] ~~**PM-25 — settle React/Next.**~~ **Settled 2026-08-07: React downgraded to 18.3.1.** Not chosen
      so much as forced — React 19 broke the App Router's client runtime and took sign-in with it. § 1 is
      corrected. Needed no code changes: no React 19-only API was in use.
- [ ] **Delete the `--legacy-peer-deps` flag** from `frontend/Dockerfile.dev` and
      `.github/workflows/ci.yml`. It is no longer doing anything — the tree resolves strictly since
      PM-25 — so this is housekeeping, and worth doing so the next real `ERESOLVE` is not silenced.
- [ ] **`continue-on-error` on the lint step** stays until PM-30 is dealt with, which is PM-41's job.
      PM-25 no longer gates it: those rules come from `eslint-config-next@16` judging a Next 14
      codebase, and that mismatch is unchanged by the React version.

### 🟡 Conventions worth writing down

- [ ] **No convention for a long-running request.** `lib/api/axiosInstance.ts` now exports
      `LONG_TIMEOUT_MS` for `GET /api/v1/activity/export` — the one read with no upper bound, which the 5s
      default was silently killing. § 5 does not mention it, so the next streaming or bulk endpoint will
      hit the same wall.
- [ ] **The refresh interceptor is now single-flight — § 5's description predates that.** It used to fire
      N concurrent refreshes for N parallel 401s, surviving only because the backend's 30-second rotation
      grace window absorbed the losers. Document that one shared promise is required, and *why*: without
      it a client-side correctness property rests on a backend tolerance added for a different reason
      (concurrent tabs), and narrowing that window would start revoking sessions under load.
- [ ] **No `cn()` helper.** Class strings are template literals throughout; conditional classes get
      unwieldy. Also tracked in [`UI_PATTERNS.md`](./UI_PATTERNS.md).
- [ ] **`app/page.tsx` is unreachable** — middleware redirects `/` unconditionally. Either delete it or
      note in the file that it exists only to satisfy the route tree.
- [ ] **PM-22 — remove `@tailwindcss/postcss ^4`.** Dead weight: `postcss.config.mjs` uses the v3 plugin
      form and `tailwindcss ^3.4.19` is installed. Safe to remove; **not** safe to activate.
- [ ] **No frontend tests at all.** CI runs `tsc --noEmit`, `npm run lint` and `npm run build` — none of
      which checks behaviour. `middleware.ts` is the highest-value target: it is the edge route guard, its
      two path lists **must be edited together** (the 2026-08-06 deletion notes that editing one silently
      changes protection), and nothing verifies they agree.

### Documentation accuracy — § 13 is stale in five of seven rows
> **✅ The *Documentation accuracy* items below were cleared on 2026-08-06.** The API-path sweep
> (`/api/…` → `/api/v1/…`, 110 references across 13 current-state docs) and every stale section named
> here have been corrected. They are kept, struck through, as the record of what had drifted and why —
> deleting them would lose the more useful lesson, which is that all of it accumulated in under two
> weeks while the code was being actively improved.
>
> Historical documents were deliberately **not** rewritten: `DAILY_CHANGES.md` and `TECH_DEBT.md`'s
> dated entries still say `/api/…` because that is what was true when they were written, and both now
> carry a note saying so. The four inherited test-platform docs were left alone too — `INDEX.md`
> already marks them untrustworthy.

- [ ] **"No `error.tsx` / `loading.tsx` / `not-found.tsx` anywhere"** — wrong since 2026-08-03. Eight
      files exist and are confirmed registered in `.next/app-build-manifest.json` (PM-19). Note the
      caveat worth keeping: **`next/dist/docs/` does not exist in `next@14.2.35`**, so `AGENTS.md`'s
      instruction to read it cannot be followed literally — the conventions were read from the shipped
      types instead.
- [ ] **"`testSlice` is inherited state"** — deleted 2026-08-06, along with its store registration.
- [ ] **"Main sign-in uses `adminLogin` / authenticates against `admin_users`"** — the `admin_users`
      table has not existed since migration `e7b41c9a2d10`. There is one login path and one account table.
- [ ] **"Hardcoded brand colour — 242 occurrences across 37 files"** — resolved 2026-08-05, all migrated
      to tokens (PM-20). Keep the regression guard:
      `grep -rn 'F97316\|EA6C0A\|orange-[0-9]' app components` must stay empty.
- [ ] **The `metadata.title` row is already marked ✅** and can be dropped rather than carried.
- [ ] **§ 5 is wrong in three ways.** The `axiosInstance` snippet predates `LONG_TIMEOUT_MS`; the
      interceptor diagram predates single-flight and so omits the shared-promise step; and the
      *One module per resource* table lists **`categoryApi.ts`, `candidateApi.ts` and `testApi.ts`, all
      deleted**, credits `authApi.ts` with `adminLogin` and `whoami` which **no longer exist**, and omits
      **`rbacApi.ts` and `navigationApi.ts`, which do**. Five of the six rows are wrong. Also correct the
      fallback port while in `constants.ts`: it defaulted to `:8000` and **the API runs on `:8002`**.
