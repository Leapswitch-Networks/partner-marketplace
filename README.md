# Logic Test Platform

A full-stack web application for conducting online logic and reasoning tests. Built with Next.js and FastAPI, containerized with Docker.

---

## What It Does

- Users register, browse available tests, and take them in a timed, proctored environment
- The test engine supports MCQ, True/False, and Descriptive question types with auto-save
- Results are calculated server-side immediately on submission with a per-question breakdown
- Admins manage questions and tests through a protected admin panel

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (App Router), TypeScript | 16.2.3 / 6.0 |
| Styling | Tailwind CSS | 4.2.2 |
| State | Redux Toolkit + react-redux | 2.11.2 / 9.2.0 |
| Forms | React Hook Form + Zod | 7.72.1 / 4.3.6 |
| HTTP | Axios | 1.15.0 |
| Backend | FastAPI | 0.135.3 |
| ORM | SQLAlchemy + Alembic | 2.0.49 / 1.18.4 |
| Validation | Pydantic v2 + pydantic-settings | 2.13.0 / 2.13.1 |
| Database | PostgreSQL | 18.3 |
| Proxy | Nginx | 1.28.3 |
| Containers | Docker | 29 |

---

## Project Structure

```
logic-test-platform/
├── frontend/               # Next.js application
├── backend/                # FastAPI application
├── docs/
│   ├── architecture.md     # System design, data flow, API contract
│   ├── phases.md           # Step-by-step build plan
│   └── README.md           # Docs index
├── docker/
│   ├── frontend.Dockerfile
│   ├── backend.Dockerfile
│   └── nginx.conf
├── docker-compose.yaml
├── instruction.md          # Coding standards and rules
├── planning.md             # Full project plan and module breakdown
└── README.md               # This file
```

---

## Quick Start

### Prerequisites

- Docker 29+
- Docker Compose

### 1. Clone the repo

```bash
git clone <repo-url>
cd logic-test-platform
```

### 2. Set environment variables

Copy the example env files and fill in the values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

**`backend/.env`**
```
DATABASE_URL=postgresql+asyncpg://postgres:password@postgres:5432/testplatform
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

**`frontend/.env.local`**
```
NEXT_PUBLIC_API_URL=http://localhost/api
```

### 3. Start all services

```bash
docker-compose up --build
```

This starts Nginx, Next.js, FastAPI, and PostgreSQL. The backend runs `alembic upgrade head` automatically on startup.

### 4. Open the app

```
http://localhost
```

### 5. Seed sample data (optional)

```bash
docker-compose exec backend python seed.py
```

This creates 1 admin user, 2–3 sample tests, and 10–15 questions per test.

**Default admin credentials after seeding:**
```
Email:    admin@example.com
Password: admin123
```

---

## Development (without Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start a local PostgreSQL instance, then:
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`, backend at `http://localhost:8000`.

---

## Application Flow

```
Register / Sign In
  └── Dashboard — browse active tests
        └── Click test → Rules & Instructions modal
              └── Scroll to bottom → I Agree & Start Test
                    └── Test Engine
                          ├── Countdown timer
                          ├── MCQ / True-False / Descriptive questions
                          ├── Question navigator (answered / flagged / unanswered)
                          └── Auto-save every 800ms on change
                                └── Submit → score calculated server-side
                                      └── Result page
                                            ├── Score + percentage + pass/fail
                                            ├── Per-question breakdown + explanations
                                            └── Category-wise performance
```

---

## User Roles

| Role | Access |
|---|---|
| `user` | Dashboard, test engine, result pages |
| `admin` | Everything above + admin panel (question & test CRUD) |

Role is set at registration and enforced server-side on every admin endpoint.

---

## Responsive Support

The platform is built mobile-first and tested at:

| Breakpoint | Width | Devices |
|---|---|---|
| Mobile | 375px | iPhone SE, small Android |
| Tablet | 768px | iPad portrait, Android tablet |
| Desktop | 1280px+ | Laptops, monitors |

The test engine adapts per device — question navigator collapses into a bottom drawer on mobile, appears as a sidebar on tablet and desktop.

---

source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000
