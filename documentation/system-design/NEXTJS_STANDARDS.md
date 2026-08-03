# Next.js 14 + React 19 + Redux Toolkit Standards

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

**Verified stack:** Next.js 14.2.35 · React 19.2.4 · TypeScript 5 · Tailwind 3.4.19 ·
Redux Toolkit 2.11.2 · react-redux 9.2.0 · React Hook Form 7.72.1 · `@hookform/resolvers` 5.2.2 ·
Zod 4.3.6 · Axios 1.15.0.

> ⚠️ **React 19 on Next 14 is an unsupported pairing, not a verified one.** `next@14.2.35` declares
> `peer react@^18.2.0`; React 19 support landed in Next 15. It works at runtime and the production
> build passes, but `npm ci` and `npm install` both **fail** without `--legacy-peer-deps`. Tracked as
> **PM-25** in `../planning/TECH_DEBT.md`, which lists the three ways out. Bear it in mind when
> reaching for a React 19-only API — this project is on a Next version that does not officially
> support the runtime it is pinned to.

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
│       └── candidates/page.tsx
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
| `loading.tsx` | Suspense fallback — **not currently used anywhere** |
| `error.tsx` | Error boundary — **not currently used anywhere** |
| `not-found.tsx` | 404 UI — **not currently used anywhere** |

Adding `loading.tsx` and `error.tsx` per segment is a real improvement opportunity; today loading and
errors are handled ad hoc inside client components.

### Root layout

```tsx
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-full flex flex-col font-sans bg-white dark:bg-gray-950 …">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

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
  baseURL: API_BASE_URL,
  timeout: 5000,          // fail fast when the backend is unreachable
  withCredentials: true,  // send httpOnly cookies on every request
});
```

`withCredentials: true` is **mandatory** — without it no cookie is sent and every request 401s.

### The refresh interceptor

```
request → 401
   ├─ url is /api/auth/refresh or /api/auth/logout → reject (prevents recursion)
   ├─ original._retry already true                 → reject (one attempt only)
   └─ else POST /api/auth/refresh (3s timeout)
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
| `authApi.ts` | register, login, adminLogin, logout, refresh, whoami, me |
| `adminApi.ts` | admin user CRUD |
| `categoryApi.ts` | categories |
| `candidateApi.ts` | candidates (inherited) |
| `testApi.ts` | tests (inherited) |

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

`AuthInitializer.tsx` hydrates identity on mount by calling `whoami`, so a page refresh restores the
session from the cookie instead of losing it.

⚠️ `testSlice` is inherited test-platform state and a removal candidate — see
`../planning/SCAFFOLD_CLEANUP_PLAN.md`.

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
      const res = await authApi.adminLogin(data);
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

⚠️ Note `SignInForm` calls `authApi.adminLogin`, so the main sign-in page authenticates against
`admin_users`. If partner/end-user login is added, this needs an explicit account-type choice rather
than an implicit default.

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

Skeletons exist: `components/common/Skeleton.tsx`, `components/dashboard/TestCardSkeleton.tsx`.

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

The permission list arrives already resolved from `GET /api/auth/me`, with the super-admin bypass
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

| Issue | Detail |
|-------|--------|
| ~~`metadata.title` says "Test Platform"~~ | ✅ Fixed 2026-07-30 across `layout.tsx`, all 7 route `page.tsx` files, and the sidebar/navbar brand text |
| `@tailwindcss/postcss ^4` is an unused dependency | `postcss.config.mjs` uses the Tailwind **v3** plugin (`tailwindcss: {}`) and `tailwindcss ^3.4.19` is installed, so the build is consistent. The v4 package is dead weight — removing it is safe; installing v4 is not. |
| No `error.tsx` / `loading.tsx` / `not-found.tsx` anywhere | No error boundaries and no route-level suspense. Errors surface as ad-hoc component state. |
| `testSlice` is inherited state | Test-platform leftover; removal candidate |
| Main sign-in uses `adminLogin` | `/sign-in` authenticates against `admin_users`; end users have no working entry point |
| Hardcoded hex in components | `#F97316` appears inline in `Button.tsx` and `Input.tsx` despite `brand` existing in `tailwind.config.ts`. Prefer the token — see `UI_PATTERNS.md`. |
| `app/page.tsx` is unreachable | Middleware redirects `/` unconditionally |

---

## Related Documentation

- [`UI_PATTERNS.md`](./UI_PATTERNS.md) — colours, components, dark mode
- [`FASTAPI_STANDARDS.md`](./FASTAPI_STANDARDS.md) — the API being consumed
- [`../core/ARCHITECTURE.md`](../core/ARCHITECTURE.md) — how the tiers fit together
- [`../core/AUTHENTICATION.md`](../core/AUTHENTICATION.md) — cookies and the refresh contract
