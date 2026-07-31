# Project Coding Instructions & Optimization Guidelines

These instructions apply to every file written in this project — frontend and backend.
Treat them as non-negotiable standards, not suggestions.

---

## 0. Tech Stack & Pinned Versions

Use these exact versions when installing dependencies. Do not upgrade without updating this file.

### Frontend
| Package | Version |
|---|---|
| Next.js | 16.2.3 |
| TypeScript | 6.0 |
| Tailwind CSS | 4.2.2 |
| @reduxjs/toolkit | 2.11.2 |
| react-redux | 9.2.0 |
| react-hook-form | 7.72.1 |
| zod | 4.3.6 |
| @hookform/resolvers | 5.2.2 |
| axios | 1.15.0 |

### Backend
| Package | Version |
|---|---|
| fastapi | 0.135.3 |
| uvicorn[standard] | 0.44.0 |
| sqlalchemy[asyncio] | 2.0.49 |
| asyncpg | 0.31.0 |
| alembic | 1.18.4 |
| pydantic[email] | 2.13.0 |
| pydantic-settings | 2.13.1 |
| python-jose[cryptography] | 3.5.0 |
| passlib[bcrypt] | 1.7.4 |
| bcrypt | 5.0.0 |

### Infrastructure
| Tool | Version |
|---|---|
| PostgreSQL | 18.3 |
| Docker | 29 |
| Nginx | 1.28.3 |

---

## 1. DRY Principle (Don't Repeat Yourself)

- Every piece of logic must exist in exactly one place. If you write the same logic twice, extract it.
- **Frontend:** shared UI patterns go into `components/common/`, shared logic goes into `lib/hooks/` or `lib/utils/`.
- **Backend:** shared business logic goes into `services/`, shared DB queries go into a repository layer inside the service, shared validation goes into `schemas/`.
- Never duplicate API call logic — all fetch calls live in `lib/api/` and are imported wherever needed.
- Never duplicate type definitions — define once in `types/` (frontend) or `schemas/` (backend) and import everywhere.
- If a block of JSX is used more than once, it is a component.
- If a function is used in more than one file, it belongs in `utils/`.

---

## 2. Scalable Code Architecture

### Frontend (Next.js)

- **Feature-based grouping:** components, hooks, and utils that belong to a feature stay together. Do not scatter related files across unrelated folders.
- **Page components are thin:** pages only compose components and call hooks. No inline business logic, no inline API calls, no raw `fetch` in a page file.
- **Component contract:** every component has a clearly typed `props` interface. No `any` types. No prop drilling beyond two levels — use context or Redux for deeper state.
- **Route protection at the edge:** auth guards live in `middleware.ts`, not inside page components. Do not repeat auth checks in individual pages.
- **Dynamic imports:** use `next/dynamic` for heavy components (admin tables, rich text editors, charts) to keep initial page bundle small.
- **Environment config:** all environment-specific values come from `.env.local`. No hardcoded URLs, keys, or timeouts in source code.

### Backend (FastAPI)

- **Layered architecture — always respected:**
  ```
  Router (api/) → Service (services/) → Model (models/) → DB
  ```
  A router never queries the DB directly. A model never contains business logic.
- **One responsibility per service method:** each method in a service does one thing. Score calculation, answer persistence, and session status update are three separate methods — even if called together.
- **Dependency injection:** use FastAPI's `Depends()` for DB sessions, current user, and role checks. Never instantiate these inside a route handler.
- **Schemas are the contract:** request bodies always go through a Pydantic schema. Response bodies always return a Pydantic schema. Never return raw ORM objects from a route.
- **Config via pydantic-settings:** all env vars are typed in `core/config.py`. No `os.getenv()` scattered across the codebase.

---

## 3. Optimization Standards

### Frontend

- **No redundant re-renders:**
  - Wrap expensive child components in `React.memo` when their props change infrequently.
  - Use `useCallback` for functions passed as props.
  - Use `useMemo` for derived values computed from large arrays (e.g. calculating answered/unanswered question counts).
- **API calls:**
  - Never call the same endpoint twice on the same page load. Cache responses in Redux state.
  - Auto-save uses debounce (minimum 800ms delay) — never fire on every keystroke.
  - Axios interceptor handles token refresh once globally — no per-request refresh logic.
- **Images and assets:** use `next/image` for all images. Never use raw `<img>` tags.
- **Bundle size:** run `next build` and check bundle analyzer before adding any new third-party library. Prefer smaller alternatives.
- **Avoid layout shifts:** use skeleton loaders (not spinners) for content that loads after the page renders.

### Backend

- **Async everywhere:** all route handlers and service methods that touch the DB must be `async`. Use `AsyncSession` from SQLAlchemy.
- **Query efficiency:**
  - Use `.options(selectinload(...))` or `.options(joinedload(...))` to eager-load relations in a single query. Never trigger N+1 queries.
  - Paginate all list endpoints — never return unbounded query results.
  - Use indexed columns in `WHERE` clauses. UUIDs, emails, and foreign keys must be indexed.
- **Score calculation runs once:** calculated server-side at submission time and stored. Never recalculated on every result fetch.
- **No blocking calls in async routes:** do not use `time.sleep`, synchronous file I/O, or synchronous HTTP calls inside an async route.

---

## 4. Adding New Features

- **Read before writing:** before adding a feature, read the existing code in the relevant module. Understand what already exists.
- **Extend, don't duplicate:** if a hook, service, or component almost does what you need, extend it — don't create a parallel version.
- **Backward compatibility:** adding a feature must not break existing routes, components, or DB schema. New DB columns must have defaults or be nullable. New API fields must be optional in response schemas.
- **One migration per change:** every DB schema change gets its own Alembic migration. Never edit a previously applied migration file.
- **Feature flags are not used** in this project. If a feature is merged, it is live. Keep incomplete features on a branch until they are ready.

---

## 5. Every Page Must Be Scalable

- **Loading state:** every page that fetches data must handle a loading state with a skeleton UI.
- **Error state:** every page must handle API errors gracefully — show a user-friendly message, never crash.
- **Empty state:** every list or data view must handle the case where there is no data (e.g. no tests available, no questions created).
- **Responsive layout:** every page must work on mobile (375px), tablet (768px), and desktop (1280px+). Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`). No fixed pixel widths on layout containers.
- **Accessibility:** interactive elements must have accessible labels. Forms must use `<label>` with `htmlFor`. Color alone must not convey meaning (pair with icon or text).
- **SEO (where applicable):** public-facing pages must export `metadata` from the Next.js page file (`title`, `description`).

---

## 5a. Responsive Design & Cross-Device Compatibility

Every UI component and page must be designed mobile-first and verified across all three breakpoints before being considered complete.

### Breakpoints

| Name | Min Width | Target Devices |
|---|---|---|
| mobile | 375px | iPhone SE, Android small |
| sm | 640px | large phones, small phones landscape |
| md | 768px | tablets portrait (iPad, Android tablet) |
| lg | 1024px | tablets landscape, small laptops |
| xl | 1280px | desktop, large laptops |
| 2xl | 1536px | wide monitors |

### Layout Rules

- **Mobile-first always:** write the base style for mobile, then layer `sm:`, `md:`, `lg:`, `xl:` overrides. Never write desktop-first styles and override downward.
- **No fixed pixel widths on containers.** Use `w-full`, `max-w-screen-lg`, `max-w-prose`, or percentage widths. Fixed widths are only acceptable for icons, avatars, and fixed-size UI elements (e.g. `w-10 h-10`).
- **Flex and Grid for all layouts.** Do not use absolute positioning for flow layout. Use `flex-col` on mobile → `flex-row` or `grid` on `md:` and above.
- **Touch targets:** all interactive elements (buttons, links, inputs) must be at minimum `44px × 44px` on mobile. Use `min-h-[44px] min-w-[44px]` or sufficient padding.
- **Scrollable containers:** any container that may overflow on mobile must use `overflow-x-auto` or `overflow-y-auto` explicitly — never let content clip silently.

### Typography

- Use Tailwind's fluid type scale. Never hardcode `text-[14px]` — use `text-sm`, `text-base`, `text-lg`, etc.
- Line lengths must be readable: prose containers use `max-w-prose` or `max-w-2xl`. Do not let text span the full width of a large screen.
- Minimum body font size: `text-sm` (14px) on mobile, `text-base` (16px) on `md:` and above.

### Navigation

- **Mobile:** primary navigation collapses into a hamburger menu or bottom tab bar. No horizontal nav bar visible on screens below `md:`.
- **Tablet:** sidebar or top nav with icon + label.
- **Desktop:** full sidebar or top nav with all labels visible.
- The test engine page is an exception — it hides all navigation during an active test on every device.

### Forms

- Inputs must be full width (`w-full`) on mobile.
- Labels appear above inputs on all screen sizes — never inline on mobile.
- Error messages appear below the input they belong to, not in a toast, on form validation failure.
- Submit buttons are full width on mobile (`w-full`), auto width on `md:` and above.

### Tables & Data Grids (Admin Panel)

- On mobile and tablet, data tables must either:
  - Collapse into a card-per-row layout, or
  - Become horizontally scrollable with `overflow-x-auto` wrapping the table
- Never clip table columns on small screens.
- Pagination controls must be usable on mobile — use large tap targets and a compact page indicator.

### Modals & Overlays

- Modals must be full-screen on mobile (`inset-0`), centered floating panel on `md:` and above.
- Modal content must be scrollable (`overflow-y-auto`) if content exceeds viewport height on any device.
- The `RulesModal` scroll-to-enable behavior must work correctly on touch devices (use `onScroll` on the scrollable div, not `window.onscroll`).

### Test Engine — Device-Specific Rules

- **Mobile layout:** timer at top → question text → answer options → nav buttons (Prev / Next / Flag). Question navigator collapses into a toggleable drawer at the bottom.
- **Tablet layout:** two-column — question panel on the left, navigator on the right side as a sidebar.
- **Desktop layout:** same as tablet with more padding and larger question text.
- The submit button must always be accessible without scrolling on all devices — pin it to a sticky footer bar on mobile.
- Timer must always be visible (sticky header or fixed position) during the test regardless of scroll position.

### Images & Media

- All images use `next/image` with explicit `width` and `height` or `fill` + a sized parent. Never use raw `<img>`.
- Use `sizes` prop on `next/image` for responsive images: e.g. `sizes="(max-width: 768px) 100vw, 50vw"`.
- Do not serve unnecessarily large images on mobile — let `next/image` handle format and size optimization.

### Testing Checklist (per page, before marking done)

- [ ] Renders correctly at 375px width (no horizontal scroll on body, no clipped content)
- [ ] Renders correctly at 768px width (tablet portrait)
- [ ] Renders correctly at 1280px width (desktop)
- [ ] All tap targets are ≥ 44px on mobile
- [ ] No text is unreadably small on any breakpoint
- [ ] Modals are full-screen on mobile, floating on desktop
- [ ] Tables/lists are scrollable or card-stacked on mobile

---

## 6. Code Quality Rules

- **TypeScript strict mode is on** — no `any`, no `as unknown as X` casts, no `@ts-ignore`.
- **No commented-out code** in committed files. Use git branches for work in progress.
- **No console.log in production code.** Use a logger utility on the backend; remove debug logs from frontend before committing.
- **Consistent naming:**
  - Frontend: `PascalCase` for components, `camelCase` for hooks/utils, `kebab-case` for files.
  - Backend: `snake_case` for everything (files, functions, variables, DB columns).
- **Error handling:**
  - Backend: all service methods raise typed HTTP exceptions (`HTTPException`) that propagate to the global error handler. No silent failures.
  - Frontend: Axios errors are caught in the API layer and rethrown as typed error objects. Pages and hooks handle them without crashing.
- **Imports:** use absolute imports everywhere. No `../../../../` relative paths beyond one level.

---

## 7. Test Module Specific Rules

- The test engine (`test/[testId]`) is the most critical page — it must be bulletproof.
- Timer logic lives exclusively in `useTimer`. Nothing else manipulates `timeRemaining`.
- Answer state lives exclusively in Redux `testSlice`. No local component state for answers.
- Auto-save and submit are the only two actions that write to the backend during a test. They must not race — submit cancels any pending auto-save before firing.
- The instructions modal (`RulesModal`) is a standalone component. Its visibility is controlled by the parent page, not by internal state.
- On test submission (manual or auto), the session status is set to `submitted` server-side. The frontend checks this status on page load and redirects to the result page if already submitted — preventing duplicate submissions on refresh.
