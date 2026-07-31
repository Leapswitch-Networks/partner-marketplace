# System Architecture

## Overview

Logic Test Platform is a full-stack monorepo application. All traffic enters through a single Nginx reverse proxy. The frontend (Next.js) and backend (FastAPI) run as separate Docker containers and communicate exclusively through the proxy — the frontend never talks to the backend directly in production.

```
Browser
   │
   ▼
Nginx (port 80)
   ├── /api/*  ──►  FastAPI (port 8000)
   │                    │
   │                    ▼
   │               PostgreSQL (port 5432)
   │
   └── /*      ──►  Next.js (port 3000)
```

---

## Monorepo Structure

```
logic-test-platform/
├── frontend/               # Next.js 16 application
├── backend/                # Python FastAPI application
├── documentation/
│   ├── architecture.md     # This file
│   ├── phases.md           # Step-by-step build phases
│   └── README.md           # Docs index
├── docker/
│   ├── frontend.Dockerfile
│   ├── backend.Dockerfile
│   └── nginx.conf
├── docker-compose.yaml
├── README.md
└── CLAUDE.md
```

---

## Frontend Architecture (Next.js 16 — App Router)

### Folder Structure

```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/page.tsx
│   │   └── sign-up/page.tsx
│   ├── dashboard/page.tsx
│   ├── test/[testId]/page.tsx
│   ├── result/[sessionId]/page.tsx
│   ├── admin/
│   │   ├── page.tsx
│   │   └── questions/page.tsx
│   ├── layout.tsx
│   └── not-found.tsx
├── components/
│   ├── common/             # Button, Input, Modal, Loader, Toast, ProgressBar, Skeleton
│   ├── auth/               # SignInForm, SignUpForm
│   ├── dashboard/          # TestCard, WelcomeBanner, RulesModal
│   ├── test/               # QuestionPanel, QuestionNavigator, TestTimer, SubmitModal
│   └── admin/              # QuestionForm, QuestionTable
├── lib/
│   ├── api/                # axiosInstance, authApi, testApi, adminApi
│   ├── store/              # Redux store — authSlice, testSlice, adminSlice
│   ├── hooks/              # useAuth, useTimer, useAutoSave, useTest
│   └── utils/              # formatters, constants, storage
├── types/                  # Shared TypeScript interfaces and enums
├── middleware.ts            # JWT auth guard — runs at the edge
├── .env.local
└── next.config.ts
```

### State Management

Redux Toolkit manages all global state. No answer state, timer state, or auth state lives in local component state.

```
auth slice    — user identity, isAuthenticated, loading, error
test slice    — questions, answers, timer, flags, current index, status
admin slice   — question/test lists, pagination, loading
```

### Data Flow (Page Load)

```
Page mounts
  └── useEffect dispatches async thunk
        └── thunk calls lib/api/*.ts
              └── axiosInstance → /api/...
                    └── response stored in Redux slice
                          └── component reads from useSelector
```

### Auth Flow

```
Sign In → POST /api/auth/login → JWT stored in httpOnly cookie
  └── middleware.ts reads cookie on every request
        ├── protected route + no cookie → redirect /sign-in
        └── auth route + valid cookie   → redirect /dashboard
```

---

## Backend Architecture (FastAPI)

### Folder Structure

```
backend/app/
├── api/                    # Route handlers (thin — delegate to services)
│   ├── auth.py
│   ├── tests.py
│   ├── sessions.py
│   ├── results.py
│   └── admin.py
├── core/
│   ├── config.py           # pydantic-settings — all env vars typed here
│   ├── security.py         # JWT encode/decode, bcrypt hash/verify
│   └── dependencies.py     # get_db, get_current_user, require_admin
├── db/
│   ├── base.py             # SQLAlchemy declarative base
│   ├── session.py          # AsyncSession factory
│   └── migrations/         # Alembic versions
├── models/                 # SQLAlchemy ORM models (no business logic)
├── schemas/                # Pydantic v2 request/response schemas (the API contract)
├── services/               # All business logic lives here
└── main.py                 # App init, CORS, router registration
```

### Layered Architecture

Every request follows this strict path — no shortcuts:

```
HTTP Request
  └── Router (api/)
        └── Service (services/)
              └── Model (models/)
                    └── AsyncSession → PostgreSQL
```

- Routers are thin: validate input via schema, call one service method, return schema response.
- Services own all business logic: score calculation, session state transitions, answer persistence.
- Models are pure ORM definitions: no methods, no logic.

### Dependency Injection

```python
# Every protected route uses Depends — never instantiated inline
@router.get("/me")
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
```

---

## Database Schema

```
users ──────────────────────────────────────────┐
  id (UUID PK)                                  │
  name, email (unique), password_hash           │
  role: ENUM(user, admin)                       │
  created_at, updated_at                        │
                                                │
tests ──────────────────────────────────────────┤
  id (UUID PK)                                  │
  title, description, duration_minutes          │
  is_active (BOOLEAN)                           │
  created_by (FK → users)  ◄────────────────────┘
  created_at, updated_at

questions
  id (UUID PK)
  test_id (FK → tests)
  text, type: ENUM(mcq, true_false, descriptive)
  category, difficulty: ENUM(easy, medium, hard)
  correct_answer, explanation, marks, order

options  [MCQ only]
  id (UUID PK)
  question_id (FK → questions)
  label: CHAR(1)  [A/B/C/D]
  text

test_sessions
  id (UUID PK)
  user_id (FK → users)
  test_id (FK → tests)
  started_at, submitted_at
  status: ENUM(in_progress, submitted, timed_out)
  score, total_marks

session_answers
  id (UUID PK)
  session_id (FK → test_sessions)
  question_id (FK → questions)
  answer, is_correct (BOOLEAN)
  answered_at
```

---

## API Contract

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login, set JWT cookie |
| POST | `/api/auth/logout` | User | Clear session cookie |
| GET | `/api/auth/me` | User | Get current user profile |
| GET | `/api/tests` | User | List active tests |
| GET | `/api/tests/{id}` | User | Get test detail |
| GET | `/api/tests/{id}/questions` | User | Load questions for a test |
| POST | `/api/sessions` | User | Start a new test session |
| PATCH | `/api/sessions/{id}/answer` | User | Auto-save a single answer |
| POST | `/api/sessions/{id}/submit` | User | Submit test |
| GET | `/api/sessions/{id}/result` | User | Fetch result with breakdown |
| GET | `/api/admin/tests` | Admin | Paginated test list |
| POST | `/api/admin/tests` | Admin | Create test |
| PUT | `/api/admin/tests/{id}` | Admin | Update test |
| DELETE | `/api/admin/tests/{id}` | Admin | Delete test |
| GET | `/api/admin/questions` | Admin | Paginated question list |
| POST | `/api/admin/questions` | Admin | Create question |
| PUT | `/api/admin/questions/{id}` | Admin | Update question |
| DELETE | `/api/admin/questions/{id}` | Admin | Delete question |

---

## Application Flow

```
Sign Up / Sign In
  └── Dashboard (list of active tests)
        └── Click test → RulesModal
              └── Scroll to bottom → enable "I Agree & Start Test"
                    └── POST /sessions → create session
                          └── Test Engine (/test/[testId])
                                ├── Timer (useTimer → Redux)
                                ├── Auto-save (useAutoSave → PATCH /answer)
                                ├── Navigate questions (QuestionNavigator)
                                └── Submit / Time expires
                                      └── POST /submit → score calculated server-side
                                            └── Result Page (/result/[sessionId])
                                                  └── Score, breakdown, category chart
```

---

## Infrastructure

### Docker Compose Services

| Service | Image | Port (internal) | Role |
|---|---|---|---|
| nginx | nginx:1.28.3 | 80 | Reverse proxy, single entry point |
| frontend | node (custom) | 3000 | Next.js app |
| backend | python (custom) | 8000 | FastAPI app |
| postgres | postgres:18.3 | 5432 | Primary database |

### Nginx Routing

```nginx
location /api/ {
    proxy_pass http://backend:8000;
}
location / {
    proxy_pass http://frontend:3000;
}
```

### Startup Order

Postgres → Backend (runs `alembic upgrade head` on start) → Frontend → Nginx

All services have health checks defined in `docker-compose.yaml` to enforce this order.

---

## Security Model

| Concern | Implementation |
|---|---|
| Passwords | bcrypt hashed via passlib — never stored plain |
| Auth tokens | JWT in httpOnly cookie — not accessible to JavaScript |
| Route protection | `middleware.ts` at Next.js edge — not client-side only |
| Admin routes | `require_admin` FastAPI dependency on every admin endpoint |
| Input validation | Pydantic schemas on all request bodies before service layer |
| Score integrity | Calculated server-side only — clients cannot send a score |
| PK enumeration | UUID primary keys on all tables |
| Secrets | All via environment variables — never in source code |
