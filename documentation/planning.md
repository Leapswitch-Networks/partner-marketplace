# Logic/Reasoning Test Platform — Project Plan

## Project Overview

A full-stack web application for conducting online logic and reasoning tests, with user authentication, a test engine, result analytics, and an optional admin panel.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (App Router), TypeScript | 16.2.3 / 6.0 |
| Styling | Tailwind CSS | 4.2.2 |
| State Management | Redux Toolkit + react-redux | 2.11.2 / 9.2.0 |
| Form Handling | React Hook Form + Zod | 7.72.1 / 4.3.6 |
| API Client | Axios | 1.15.0 |
| Auth | JWT (httpOnly cookies) | — |
| Backend | Python + FastAPI | 0.135.3 |
| ORM | SQLAlchemy + Alembic | 2.0.49 / 1.18.4 |
| Database | PostgreSQL | 18.3 |
| Validation | Pydantic v2 + pydantic-settings | 2.13.0 / 2.13.1 |
| Auth Utilities | python-jose + passlib + bcrypt | 3.5.0 / 1.7.4 / 5.0.0 |
| Containerization | Docker + Docker Compose + Nginx | 29 / — / 1.28.3 |

---

## Monorepo Structure

```
logic-test-platform/
├── frontend/               # Next.js 14 application
├── backend/                # Python FastAPI application
├── documentation/
│   ├── architecture.md     # System architecture, data flow, component diagram
│   ├── phases.md           # Project phase breakdown with deliverables
│   └── README.md           # Docs index and how to navigate
├── docker/
│   ├── frontend.Dockerfile
│   ├── backend.Dockerfile
│   └── nginx.conf          # Reverse proxy config (routes /api → backend, / → frontend)
├── docker-compose.yaml     # Orchestrates frontend, backend, postgres, nginx
├── README.md               # Project overview, quickstart, env setup
└── CLAUDE.md               # AI workflow cycle — how Claude works in this repo
```

---

## Frontend Folder Structure (Next.js 14 — App Router)

```
frontend/
├── app/                        # Next.js App Router pages
│   ├── (auth)/                 # Route group — no shared layout with dashboard
│   │   ├── sign-in/page.tsx
│   │   └── sign-up/page.tsx
│   ├── dashboard/page.tsx
│   ├── test/[testId]/page.tsx  # Test engine
│   ├── result/[sessionId]/page.tsx
│   ├── admin/                  # Admin-only route group
│   │   ├── page.tsx
│   │   └── questions/page.tsx
│   ├── layout.tsx              # Root layout (Providers, fonts)
│   └── not-found.tsx
├── components/                 # Reusable UI grouped by feature
│   ├── common/                 # Button, Input, Modal, Loader, Toast, ProgressBar, Skeleton
│   ├── auth/                   # SignInForm, SignUpForm
│   ├── dashboard/              # TestCard, WelcomeBanner, RulesModal
│   ├── test/                   # QuestionPanel, QuestionNavigator, TestTimer, SubmitModal
│   └── admin/                  # QuestionForm, QuestionTable
├── lib/
│   ├── api/                    # axiosInstance.ts, authApi.ts, testApi.ts, adminApi.ts
│   ├── store/                  # Redux store — authSlice, testSlice, adminSlice
│   ├── hooks/                  # useAuth, useTimer, useAutoSave, useTest
│   └── utils/                  # formatters.ts, constants.ts, storage.ts
├── types/                      # Shared TypeScript interfaces and enums
├── middleware.ts               # Next.js middleware — JWT auth guard on protected routes
├── .env.local
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

---

## Backend Folder Structure (Python + FastAPI)

```
backend/
├── app/
│   ├── api/                    # Route handlers grouped by feature
│   │   ├── auth.py             # /auth/register, /auth/login, /auth/logout
│   │   ├── tests.py            # /tests, /tests/{id}/questions
│   │   ├── sessions.py         # /sessions — start, auto-save, submit
│   │   ├── results.py          # /sessions/{id}/result
│   │   └── admin.py            # /admin/questions, /admin/tests (protected)
│   ├── core/
│   │   ├── config.py           # Settings via pydantic-settings (.env loader)
│   │   ├── security.py         # JWT encode/decode, password hash/verify
│   │   └── dependencies.py     # get_db, get_current_user, require_admin
│   ├── db/
│   │   ├── base.py             # SQLAlchemy declarative base
│   │   ├── session.py          # Async DB session factory
│   │   └── migrations/         # Alembic migration versions
│   ├── models/                 # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── test.py
│   │   ├── question.py
│   │   ├── option.py
│   │   ├── test_session.py
│   │   └── session_answer.py
│   ├── schemas/                # Pydantic v2 request/response schemas
│   │   ├── auth.py
│   │   ├── test.py
│   │   ├── question.py
│   │   ├── session.py
│   │   └── result.py
│   ├── services/               # Business logic layer
│   │   ├── auth_service.py
│   │   ├── test_service.py
│   │   ├── session_service.py  # Auto-save, submit, score calculation
│   │   └── admin_service.py
│   └── main.py                 # FastAPI app init, router registration, CORS
├── alembic.ini
├── requirements.txt
├── .env
└── Dockerfile                  # (referenced from docker/backend.Dockerfile)
```

---

## Database Schema (PostgreSQL via SQLAlchemy)

### users
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | auto-generated |
| name | VARCHAR | required |
| email | VARCHAR | unique, required |
| password_hash | VARCHAR | bcrypt hashed |
| role | ENUM('user','admin') | default: 'user' |
| created_at | TIMESTAMP | auto |
| updated_at | TIMESTAMP | auto |

### tests
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| title | VARCHAR | |
| description | TEXT | |
| duration_minutes | INT | test time limit |
| is_active | BOOLEAN | default: true |
| created_by | UUID (FK → users) | admin who created |
| created_at | TIMESTAMP | auto |
| updated_at | TIMESTAMP | auto |

### questions
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| test_id | UUID (FK → tests) | |
| text | TEXT | question body |
| type | ENUM('mcq','true_false','descriptive') | |
| category | VARCHAR | e.g. Logical, Verbal |
| difficulty | ENUM('easy','medium','hard') | |
| correct_answer | TEXT | for MCQ / True-False |
| explanation | TEXT | optional |
| marks | INT | default: 1 |
| order | INT | display order |

### options (MCQ only)
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| question_id | UUID (FK → questions) | |
| label | CHAR(1) | A, B, C, D |
| text | TEXT | option content |

### test_sessions
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK → users) | |
| test_id | UUID (FK → tests) | |
| started_at | TIMESTAMP | |
| submitted_at | TIMESTAMP | nullable |
| status | ENUM('in_progress','submitted','timed_out') | |
| score | NUMERIC | calculated on submit |
| total_marks | INT | |

### session_answers
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| session_id | UUID (FK → test_sessions) | |
| question_id | UUID (FK → questions) | |
| answer | TEXT | user's response |
| is_correct | BOOLEAN | set on submit |
| answered_at | TIMESTAMP | last auto-save time |

---

## Application Flow

```
Landing Page
    │
    ├── Sign Up ──► Validate ──► Create Account ──► Redirect to Sign In
    │
    └── Sign In ──► Validate ──► JWT Issued ──► Dashboard
                                                    │
                                          ┌─────────┴──────────┐
                                     View Tests            Admin Panel
                                          │
                                   "View Test" clicked
                                          │
                               ┌──────────────────────┐
                               │  Rules & Instructions │
                               │  Modal / Pop-up       │
                               │                       │
                               │  • Test duration      │
                               │  • Total questions    │
                               │  • Marking scheme     │
                               │  • No back navigation │
                               │  • Auto-submit on     │
                               │    time expiry        │
                               │  • Tab-switch warning │
                               │                       │
                               │  [ I Agree & Start ]  │  ◄── must scroll to bottom
                               └──────────┬────────────┘        to enable button
                                          │
                                    "Start Test"
                                          │
                               ┌──────────────────┐
                               │   Test Engine     │
                               │  - Timer starts   │
                               │  - Load questions │
                               │  - Navigate Q's   │
                               │  - Auto-save      │
                               └──────────┬────────┘
                                          │
                               Submit / Time Expires
                                          │
                                   Result Page
                               (Score + Review + Explanations)
```

### Rules & Instructions Modal — Detail

**Triggered by:** clicking "Start Test" on the Dashboard  
**Blocked by:** modal cannot be dismissed by clicking outside or pressing Escape  
**Button state:** "I Agree & Start Test" is disabled until the user scrolls to the bottom of the instructions

**Content sections:**
1. **Test Overview** — title, total questions, time limit, total marks
2. **Attempt Rules**
   - Each question must be attempted before moving on (or can be skipped and flagged)
   - You can navigate back to any question using the question panel
   - Only one answer allowed per MCQ/True-False question
3. **Time & Submission**
   - Timer begins immediately after clicking "I Agree & Start Test"
   - Test auto-submits when the timer reaches zero
   - You may submit early at any time using the Submit button
4. **Integrity Guidelines**
   - Do not switch tabs or minimize the window — a warning will appear; repeated violations may auto-submit
   - Do not refresh the page; your progress is auto-saved
5. **Scoring**
   - MCQ / True-False: marks awarded as configured per question
   - Descriptive: manually reviewed (if applicable)
   - No negative marking (unless stated otherwise)

---

## Module Breakdown

### 1. Authentication Module

**Pages:** `sign-in`, `sign-up`

**Key behaviors:**
- `SignUpForm`: name, email, password, confirm password with Zod validation
- `SignInForm`: email + password, remember me toggle
- On success: JWT stored in httpOnly cookie; user profile saved to Redux `authSlice`
- `middleware.ts`: Next.js edge middleware redirects unauthenticated users to `/sign-in`
- Access token refresh via Axios response interceptor (401 → refresh → retry)

---

### 2. Dashboard Module

**Page:** `dashboard`

**Key behaviors:**
- Greet user by name
- List available tests (fetched from `GET /api/tests`)
- Each `TestCard` shows: title, duration, question count, category, attempt status
- Clicking a `TestCard` opens the `RulesModal` overlay
- `RulesModal` fetches test details via `GET /api/tests/{id}` and displays rules
- "I Agree & Start Test" inside the modal (enabled after scrolling) creates a session and navigates to `/test/[testId]`

---

### 3. Test Engine Module

**Page:** `test/[testId]`

**Key behaviors:**

| Feature | Implementation |
|---|---|
| Question loading | Fetch on page mount, stored in `testSlice` |
| Timer | `useTimer` hook with `useRef`; dispatches `timeExpired` on zero |
| Question rendering | `QuestionPanel` switches on `question.type` |
| Navigation | `QuestionNavigator` — color-coded answered / unanswered / flagged |
| Auto-save | `useAutoSave` debounces → `PATCH /api/sessions/:id/answer` |
| Submit | Confirm modal → `POST /api/sessions/:id/submit` → redirect to result |
| Time expiry | Auto-submits when timer hits 0 |

**Question Types:**
```
MCQQuestion         — Radio buttons, single selection
TrueFalseQuestion   — Two-button toggle (True / False)
DescriptiveQuestion — Textarea with character/word count
```

---

### 4. Result Module

**Page:** `result/[sessionId]`

**Displays:**
- Total score and percentage, pass/fail badge
- Per-question breakdown: your answer vs correct answer + explanation
- Category-wise performance chart
- "Back to Dashboard" CTA

---

### 5. Admin Module

**Pages:** `admin`, `admin/questions`

**Key behaviors:**
- Protected by `require_admin` FastAPI dependency (server-side) + `AdminRoute` guard (client-side)
- Paginated question table with create / edit / delete actions
- `QuestionForm`: type selector, dynamic options for MCQ, category, difficulty, explanation

---

## API Contract (Frontend ↔ Backend)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, sets JWT cookie |
| POST | `/api/auth/logout` | Clear session cookie |
| GET | `/api/auth/me` | Get current user profile |
| GET | `/api/tests` | List active tests |
| GET | `/api/tests/{id}` | Get test detail (used by RulesModal) |
| GET | `/api/tests/{id}/questions` | Load questions for a test |
| POST | `/api/sessions` | Start a new test session |
| PATCH | `/api/sessions/{id}/answer` | Auto-save a single answer |
| POST | `/api/sessions/{id}/submit` | Submit test |
| GET | `/api/sessions/{id}/result` | Fetch result with breakdown |
| GET | `/api/admin/tests` | Admin: paginated test list |
| POST | `/api/admin/tests` | Admin: create test |
| PUT | `/api/admin/tests/{id}` | Admin: update test |
| DELETE | `/api/admin/tests/{id}` | Admin: delete test |
| GET | `/api/admin/questions` | Admin: paginated question list |
| POST | `/api/admin/questions` | Admin: create question |
| PUT | `/api/admin/questions/{id}` | Admin: update question |
| DELETE | `/api/admin/questions/{id}` | Admin: delete question |

---

## State Shape (Redux)

```ts
{
  auth: {
    user: { id: string; name: string; email: string; role: 'user' | 'admin' } | null,
    isAuthenticated: boolean,
    loading: boolean,
    error: string | null
  },
  test: {
    testInfo: { id: string; title: string; duration: number; totalQuestions: number } | null,
    questions: Question[],
    currentIndex: number,
    answers: Record<string, string>,
    flagged: string[],
    timeRemaining: number,        // seconds
    status: 'idle' | 'in-progress' | 'submitted'
  },
  admin: {
    questions: Question[],
    pagination: { page: number; limit: number; total: number },
    loading: boolean
  }
}
```

---

## UX Considerations for Test Mode

- Full-screen prompt (Fullscreen API, optional)
- Warn on tab switch / window blur (focus-lost detection)
- Prevent back-navigation mid-test (`next/navigation` `useRouter` + `beforeunload`)
- Progress bar: answered / total at the top
- Minimal chrome during test — hide nav, footer, and non-essential UI

---

## Phased Delivery Plan

| Phase | Scope |
|---|---|
| **Phase 1** | Repo scaffold, `documentation/` + `CLAUDE.md` setup, Docker config, DB schema + Alembic migrations, auth endpoints + frontend auth pages |
| **Phase 2** | Dashboard, test listing, `RulesModal` with scroll-to-enable button, session creation, basic test flow (frontend + backend) |
| **Phase 3** | Timer, auto-save, question navigator, all three question types |
| **Phase 4** | Submission, server-side score calculation, result page |
| **Phase 5** | Admin panel — question & test CRUD, category management |
| **Phase 6** | Polish — responsive design, accessibility, error boundaries, loading states, Nginx prod config |

---

## Scalability & Security Notes

### Frontend
- Next.js `middleware.ts` enforces auth at the edge — no client-side-only guards
- All API base URLs via `.env.local` — never hardcoded
- Redux `testSlice` is self-contained and extendable for multi-section tests
- Dynamic imports (`next/dynamic`) for admin pages to keep initial bundle small

### Backend
- Pydantic v2 schemas validate all request bodies before reaching service layer
- `require_admin` FastAPI dependency enforces role checks server-side on every admin route
- Alembic migrations manage all schema changes — no manual DDL in production
- UUIDs as PKs prevent enumeration attacks
- Score calculation is server-side only — clients cannot tamper with results
- `pydantic-settings` loads env config with type safety; secrets never in source code
- Async SQLAlchemy sessions for non-blocking DB I/O under concurrent test submissions

### Infrastructure
- Nginx reverse proxy: all traffic enters on one port; `/api/*` routes to FastAPI, `/*` to Next.js
- Services are isolated in Docker containers; only Nginx is exposed externally
- `docker-compose.yaml` defines named volumes for PostgreSQL data persistence
- Health checks on all services in Compose to ensure startup order
