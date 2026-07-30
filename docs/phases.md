# Project Phases — Step-by-Step Execution Plan

Each phase builds on the previous. Complete all steps in a phase before moving to the next.
Order within each phase: **Frontend first → Backend second → Docker last.**

---

## Phase 1 — Scaffold & Auth

### Step 1.1 — Monorepo Setup
- Create root folder `logic-test-platform/`
- Initialize git repo
- Create `README.md`, `CLAUDE.md`, and `docs/` folder
- Copy `planning.md` and `instruction.md` into `docs/`

### Step 1.2 — Frontend Scaffold
- Bootstrap Next.js 14 app in `frontend/` with TypeScript and App Router:
  ```
  npx create-next-app@latest frontend --typescript --tailwind --app
  ```
- Install dependencies:
  - `axios`, `react-hook-form`, `zod`, `@hookform/resolvers`, `@reduxjs/toolkit`, `react-redux`
- Set up absolute imports in `tsconfig.json` (`@/*` → `./`)
- Create `frontend/.env.local` — `NEXT_PUBLIC_API_URL`

### Step 1.3 — Frontend Structure
Create the full folder scaffold (empty files with placeholder exports):
- `app/(auth)/sign-in/page.tsx`, `app/(auth)/sign-up/page.tsx`
- `app/dashboard/page.tsx`, `app/test/[testId]/page.tsx`
- `app/result/[sessionId]/page.tsx`, `app/admin/page.tsx`
- `components/common/` — `Button`, `Input`, `Modal`, `Loader`, `Toast`, `ProgressBar`, `Skeleton`
- `lib/api/axiosInstance.ts`, `lib/api/authApi.ts`
- `lib/store/` — store config, `authSlice`
- `types/index.ts`

### Step 1.4 — Redux Store & Auth Slice
- Configure Redux store in `lib/store/store.ts`
- Wrap root layout with `<Providers>` in `app/layout.tsx`
- Define `authSlice` — state shape: `user`, `isAuthenticated`, `loading`, `error`
- Define async thunks: `loginThunk`, `registerThunk`, `logoutThunk`, `fetchMeThunk`

### Step 1.5 — Axios Instance
- Create `lib/api/axiosInstance.ts` — base URL from env, `withCredentials: true`
- Add response interceptor: on 401 → call `/auth/refresh` → retry original request

### Step 1.6 — Auth API & Pages
- Create `lib/api/authApi.ts` — `register`, `login`, `logout`, `getMe`
- Build `SignInForm` component — email + password + Zod validation
- Build `SignUpForm` component — name + email + password + confirm password + Zod validation
- Wire forms to Redux thunks
- On login success: redirect to `/dashboard`
- On sign-up success: redirect to `/sign-in`

### Step 1.7 — Route Protection (Middleware)
- Create `middleware.ts` at the `frontend/` root
- Protect `/dashboard`, `/test/*`, `/result/*`, `/admin/*` — redirect to `/sign-in` if no valid cookie
- Redirect `/sign-in` and `/sign-up` to `/dashboard` if already authenticated

### Step 1.8 — Backend Scaffold
- Create `backend/` with the full folder structure from planning
- Init Python virtual environment + `requirements.txt`:
  - `fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`
  - `pydantic[email]`, `pydantic-settings`, `python-jose[cryptography]`, `passlib[bcrypt]`
- Create `app/main.py` — FastAPI init, CORS middleware, router registration placeholder
- Create `app/core/config.py` — `Settings` class via `pydantic-settings` (DB URL, JWT secret, etc.)
- Create `app/core/security.py` — `hash_password`, `verify_password`, `create_access_token`, `decode_token`
- Create `app/core/dependencies.py` — `get_db`, `get_current_user`, `require_admin`
- Create `app/db/base.py` — SQLAlchemy declarative base
- Create `app/db/session.py` — async session factory
- Create `backend/.env` with all required env vars

### Step 1.9 — Database Models
Create all ORM models in `app/models/`:
- `user.py` — `id`, `name`, `email`, `password_hash`, `role`, `created_at`, `updated_at`
- `test.py` — `id`, `title`, `description`, `duration_minutes`, `is_active`, `created_by`, `created_at`, `updated_at`
- `question.py` — `id`, `test_id`, `text`, `type`, `category`, `difficulty`, `correct_answer`, `explanation`, `marks`, `order`
- `option.py` — `id`, `question_id`, `label`, `text`
- `test_session.py` — `id`, `user_id`, `test_id`, `started_at`, `submitted_at`, `status`, `score`, `total_marks`
- `session_answer.py` — `id`, `session_id`, `question_id`, `answer`, `is_correct`, `answered_at`

### Step 1.10 — Alembic Migrations
- Run `alembic init app/db/migrations`
- Configure `alembic.ini` and `env.py` to use async SQLAlchemy + `config.py`
- Generate initial migration: `alembic revision --autogenerate -m "initial_schema"`
- Test `alembic upgrade head` locally

### Step 1.11 — Pydantic Schemas (Auth)
Create `app/schemas/auth.py`:
- `RegisterRequest` — name, email, password, confirm_password
- `LoginRequest` — email, password
- `UserResponse` — id, name, email, role
- `TokenResponse` — access_token, token_type

### Step 1.12 — Auth Service & Routes
- Create `app/services/auth_service.py` — `register_user`, `authenticate_user`
- Create `app/api/auth.py` — `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- Register auth router in `main.py`
- Test all four endpoints with a REST client

### Step 1.13 — Docker: Auth Services
- Create `docker/frontend.Dockerfile`
- Create `docker/backend.Dockerfile`
- Create `docker/nginx.conf` — route `/api/*` → FastAPI, `/*` → Next.js
- Create `docker-compose.yaml` — services: `frontend`, `backend`, `postgres`, `nginx`
  - Add named volume for PostgreSQL data
  - Add health checks for startup order

**Phase 1 Done Checkpoint:**
- [ ] Frontend sign-up and sign-in pages render and submit correctly
- [ ] Unauthenticated visit to `/dashboard` redirects to `/sign-in`
- [ ] `alembic upgrade head` runs without errors
- [ ] `POST /api/auth/register` creates a user in DB
- [ ] `POST /api/auth/login` returns a JWT cookie
- [ ] `GET /api/auth/me` returns user profile
- [ ] `docker-compose up` starts all four services

---

## Phase 2 — Dashboard, Test Listing & Session Creation

### Step 2.1 — Frontend: Types & Test API
- Define TypeScript types in `types/index.ts`: `Test`, `Question`, `Option`, `TestSession`
- Create `lib/api/testApi.ts` — `getTests`, `getTestDetail`, `getTestQuestions`, `startSession`

### Step 2.2 — Frontend: Dashboard Page
- Build `components/dashboard/WelcomeBanner.tsx` — greet by name from Redux `authSlice`
- Build `components/dashboard/TestCard.tsx` — title, duration, question count, category, attempt status
- Build `dashboard/page.tsx` — fetch tests on mount, render `WelcomeBanner` + grid of `TestCards`
- Handle loading state with `Skeleton` component, error state with inline error message, empty state with placeholder

### Step 2.3 — Frontend: Rules Modal
- Build `components/dashboard/RulesModal.tsx`
  - Fetch test details via `getTestDetail` when opened
  - Render 5 content sections (Test Overview, Attempt Rules, Time & Submission, Integrity, Scoring)
  - "I Agree & Start Test" button disabled until scroll reaches bottom
  - Cannot be dismissed by clicking outside or pressing Escape
- Wire `TestCard` click → open `RulesModal` with selected `testId`
- On "I Agree & Start Test": call `startSession` → navigate to `/test/[testId]?session=[sessionId]`

### Step 2.4 — Backend: Pydantic Schemas (Tests & Sessions)
- Create `app/schemas/test.py` — `TestResponse`, `TestDetailResponse`, `QuestionResponse`, `OptionResponse`
- Create `app/schemas/session.py` — `StartSessionRequest`, `SessionResponse`

### Step 2.5 — Backend: Test Service & Routes
- Create `app/services/test_service.py` — `list_active_tests`, `get_test_detail`, `get_test_questions`
- Create `app/api/tests.py` — `GET /tests`, `GET /tests/{id}`, `GET /tests/{id}/questions`
- Register tests router in `main.py`

### Step 2.6 — Backend: Session Service & Routes (Start Only)
- Create `app/services/session_service.py` — `start_session` (creates `test_session` row, returns session id)
- Create `app/api/sessions.py` — `POST /sessions`
- Register sessions router in `main.py`

### Step 2.7 — Backend: Seed Data
- Create `backend/seed.py` — script to insert:
  - 1 admin user
  - 2–3 sample tests
  - 10–15 sample questions per test (mix of MCQ, True/False)
- Run seed script against local DB

### Step 2.8 — Docker: Verify Phase 2 Routes
- Rebuild containers: `docker-compose up --build`
- Confirm `/api/tests` and `/api/sessions` are reachable through Nginx

**Phase 2 Done Checkpoint:**
- [ ] Dashboard loads and lists tests with correct data
- [ ] Clicking a test card opens the rules modal
- [ ] Scroll-to-enable works — button activates only at bottom
- [ ] Clicking "I Agree & Start Test" creates a session in DB and navigates to test page

---

## Phase 3 — Test Engine (Timer, Navigation, Auto-Save)

### Step 3.1 — Frontend: Redux Test Slice
- Define `testSlice` in `lib/store/testSlice.ts` — full state shape from planning
- Actions: `setTestInfo`, `setQuestions`, `setAnswer`, `toggleFlag`, `setCurrentIndex`, `tickTimer`, `timeExpired`, `setStatus`
- No answer state in local component state — only in Redux

### Step 3.2 — Frontend: Hooks
- Create `lib/hooks/useTimer.ts`
  - Uses `useRef` for interval — does NOT use component state for ticking
  - Dispatches `tickTimer` to Redux every second
  - Dispatches `timeExpired` when `timeRemaining` reaches 0
  - Cleans up interval on unmount
- Create `lib/hooks/useAutoSave.ts`
  - Watches `answers` in Redux
  - Debounces writes by 800ms minimum
  - Calls `autoSaveAnswer` per changed answer
  - Cancels pending debounce on unmount
- Create `lib/hooks/useTest.ts`
  - Fetches questions on mount, dispatches to `testSlice`
  - Exposes: `currentQuestion`, `goToQuestion`, `goNext`, `goPrev`

### Step 3.3 — Frontend: Question Components
Build in `components/test/`:
- `MCQQuestion.tsx` — radio buttons, single selection, dispatch `setAnswer` on change
- `TrueFalseQuestion.tsx` — two-button toggle (True / False), dispatch `setAnswer`
- `DescriptiveQuestion.tsx` — `<textarea>` with live character/word count, dispatch `setAnswer`
- `QuestionPanel.tsx` — switch on `question.type`, renders correct question component

### Step 3.4 — Frontend: Navigator & Timer Components
- Build `components/test/QuestionNavigator.tsx`
  - Grid of numbered buttons — color-coded: answered (green), unanswered (grey), flagged (yellow), current (blue border)
  - Clicking a number dispatches `setCurrentIndex`
- Build `components/test/TestTimer.tsx`
  - Reads `timeRemaining` from Redux
  - Shows `MM:SS` format
  - Turns red when under 60 seconds

### Step 3.5 — Frontend: Test Engine Page
- Build `app/test/[testId]/page.tsx`
  - On mount: load questions, initialize `testSlice`, mount `useTimer`, mount `useAutoSave`
  - Layout: minimal chrome (hide nav/footer), progress bar at top
  - Render `TestTimer`, `QuestionPanel`, `QuestionNavigator`
  - Tab-switch warning: `window.addEventListener('blur', ...)` — increment violation counter, warn on first, auto-submit on 3rd (configurable)
  - Prevent back navigation: `beforeunload` listener
- Add `autoSaveAnswer` to `lib/api/testApi.ts` — `PATCH /sessions/:id/answer`

### Step 3.6 — Backend: Auto-Save Endpoint
- Add `auto_save_answer` method to `session_service.py` — upsert `session_answer` row
- Add `PATCH /sessions/{id}/answer` route to `app/api/sessions.py`
- Schema: `AnswerSaveRequest` — `question_id`, `answer`

### Step 3.7 — Docker: Verify Auto-Save Route
- Rebuild and confirm `PATCH /api/sessions/{id}/answer` is accessible through Nginx

**Phase 3 Done Checkpoint:**
- [ ] Test page loads questions and displays first question
- [ ] Timer counts down accurately in MM:SS
- [ ] Answering questions updates the navigator color
- [ ] Flagging a question turns it yellow in the navigator
- [ ] Auto-save fires 800ms after an answer changes (verify in network tab)
- [ ] Tab-switch shows warning alert

---

## Phase 4 — Submission, Score Calculation & Result Page

### Step 4.1 — Frontend: Submit Flow
- Build `components/test/SubmitModal.tsx` — confirmation dialog: "Are you sure?"
- In test page: "Submit" button opens `SubmitModal`
- On confirm: cancel pending auto-save → call `POST /sessions/:id/submit` → redirect to `/result/[sessionId]`
- On `timeExpired` Redux action: same flow without confirmation modal
- Add `submitSession` to `lib/api/testApi.ts`

### Step 4.2 — Frontend: Result Page
- Add `getResult` to `lib/api/testApi.ts`
- Build `app/result/[sessionId]/page.tsx`
  - Fetch result on mount
  - Show: score, percentage, pass/fail badge
  - Per-question breakdown table: question text, your answer, correct answer, explanation, marks earned
  - Category-wise performance — group by `question.category`, show score per category
  - "Back to Dashboard" button

### Step 4.3 — Backend: Submit & Score
- Add `submit_session` method to `session_service.py`:
  1. Check current status — raise `400` if already submitted
  2. Set `test_session.status = 'submitted'`, `submitted_at = now()`
  3. Fetch all `session_answers` for the session
  4. For each answer, compare to `question.correct_answer` — set `is_correct`
  5. Calculate `score = sum(marks where is_correct)`, set `total_marks`
  6. All in one DB transaction
- Add `POST /sessions/{id}/submit` route

### Step 4.4 — Backend: Result Endpoint
- Create `app/schemas/result.py` — `ResultResponse` with score, percentage, per-question breakdown
- Add `get_result` method to `session_service.py` — eager-load questions + answers in one query
- Add `GET /sessions/{id}/result` route in `app/api/results.py`

### Step 4.5 — Backend: Duplicate Submission Guard
- In test page `useEffect` on mount: call `GET /sessions/:id` — if `status === 'submitted'`, immediately redirect to `/result/[sessionId]`
- Backend `submit_session` already raises `400` if already submitted (Step 4.3)

### Step 4.6 — Docker: Verify Submit & Result Routes
- Rebuild and confirm `POST /api/sessions/{id}/submit` and `GET /api/sessions/{id}/result` work through Nginx

**Phase 4 Done Checkpoint:**
- [ ] Clicking Submit opens confirmation modal
- [ ] After confirmation, score is calculated server-side and stored
- [ ] Result page shows correct score, per-question breakdown, and category chart
- [ ] Timer reaching zero auto-submits without confirmation
- [ ] Refreshing the test page mid-test does NOT create a duplicate session
- [ ] Refreshing the test page after submission redirects to result page

---

## Phase 5 — Admin Panel

### Step 5.1 — Frontend: Redux Admin Slice & API
- Create `lib/store/adminSlice.ts` — state: `questions`, `tests`, `pagination`, `loading`
- Async thunks for all CRUD operations
- Create `lib/api/adminApi.ts` — all admin API calls

### Step 5.2 — Frontend: Admin Route Guard
- Create `components/admin/AdminRoute.tsx` — checks `user.role === 'admin'` from Redux; redirects to `/dashboard` if not
- Wrap admin pages with `AdminRoute`

### Step 5.3 — Frontend: Question Table & Form
- Build `components/admin/QuestionTable.tsx` — paginated table with edit/delete actions
- Build `components/admin/QuestionForm.tsx`:
  - Type selector (MCQ / True-False / Descriptive)
  - Dynamic options section (only for MCQ — add up to 4 options, mark correct)
  - Fields: category, difficulty, marks, explanation
  - React Hook Form + Zod validation
- Build `app/admin/questions/page.tsx` — list + create/edit modal

### Step 5.4 — Frontend: Test Management Page
- Build `app/admin/page.tsx` — paginated test list with create/edit/delete
- `TestForm` component — title, description, duration, is_active toggle, assign questions

### Step 5.5 — Backend: Admin Schemas
- Add to `app/schemas/test.py`: `CreateTestRequest`, `UpdateTestRequest`
- Add to `app/schemas/question.py`: `CreateQuestionRequest`, `UpdateQuestionRequest`, `QuestionDetailResponse`

### Step 5.6 — Backend: Admin Service & Routes
- Create `app/services/admin_service.py`:
  - `list_questions` (paginated), `create_question`, `update_question`, `delete_question`
  - `list_tests` (paginated), `create_test`, `update_test`, `delete_test`
- Create `app/api/admin.py` — all routes protected by `require_admin` dependency
- Register admin router in `main.py`

### Step 5.7 — Docker: Verify Admin Routes
- Rebuild and confirm all `/api/admin/*` routes are accessible through Nginx with proper auth

**Phase 5 Done Checkpoint:**
- [ ] Admin can log in and see admin pages; regular user cannot
- [ ] Admin can create, edit, and delete questions with all types
- [ ] Admin can create and activate a test
- [ ] Created test appears in user's dashboard

---

## Phase 6 — Polish, Responsiveness & Production Config

### Step 6.1 — Frontend: Responsive Design Audit
- Go through every page: sign-in, sign-up, dashboard, test engine, result, admin
- Verify layout at 375px, 768px, 1280px
- Replace any fixed pixel widths on containers with Tailwind responsive classes

### Step 6.2 — Frontend: Loading & Error States
- Ensure every data-fetching page has a `Skeleton` loader (not spinner)
- Ensure every page has an error boundary or inline error message
- Ensure every list has an empty state component

### Step 6.3 — Frontend: Accessibility & SEO
- All form inputs have `<label htmlFor>`
- All icon-only buttons have `aria-label`
- Color is never the sole indicator — pair with icon or text
- Run `axe` or Lighthouse accessibility audit
- Add `export const metadata` to all public-facing pages — set `title` and `description`

### Step 6.4 — Frontend: Bundle Optimization
- Add `next/dynamic` imports for admin pages and the chart component on the result page
- Run `next build` and check output — no route should exceed 150kB first-load JS
- Remove any `console.log` statements

### Step 6.5 — Frontend: Error Handling Hardening
- Verify Axios errors are caught in `lib/api/` layer and rethrown as typed errors
- Add a global toast notification for API errors (use `Toast` component from `components/common/`)

### Step 6.6 — Backend: Error Handling Hardening
- Verify all service methods raise typed `HTTPException` — no silent failures
- Add a global exception handler in `main.py` for unhandled errors

### Step 6.7 — Docker: Production Nginx Config
- Finalize `docker/nginx.conf`:
  - Gzip compression for text/html, text/css, application/javascript
  - Cache-control headers for static assets
  - `proxy_pass` rules for `/api/` → backend, `/` → frontend
  - Health check endpoint

### Step 6.8 — Docker: Production Compose
- Add `NODE_ENV=production` and `ENVIRONMENT=production` to Compose env
- Verify `alembic upgrade head` runs as part of backend container startup (entrypoint script)
- Test full `docker-compose up --build` from scratch — verify all services start healthy

### Step 6.9 — Final End-to-End Test
Walk through the full user journey manually:
1. Register a new user
2. Log in
3. View dashboard — tests listed
4. Open rules modal — scroll to enable button
5. Start test — timer begins
6. Answer all questions — auto-save fires
7. Submit — result page shows correct score
8. Log out
9. Log in as admin — manage questions and tests

**Phase 6 Done Checkpoint:**
- [ ] All pages render correctly on mobile, tablet, desktop
- [ ] No raw `<img>` tags — all use `next/image`
- [ ] Lighthouse accessibility score ≥ 90 on dashboard and test pages
- [ ] `docker-compose up --build` starts all services and full user journey works end-to-end
- [ ] No console errors or warnings in production build
