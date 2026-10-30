<div align="center">

# 🎮 Prompt Market

**A trusted middleman marketplace for Roblox gamepasses.**
Buyers check out in seconds with a QR payment · Sellers subscribe, list gamepasses and get paid monthly.

[Live demo](#live-deployment) · [Features](#features) · [Quick start](#quick-start) · [Architecture](#architecture)

</div>

---

## What is it?

Prompt Market lets Roblox creators sell gamepasses through one storefront while the platform acts as the trusted
middleman: it collects the payment, keeps a transaction log, takes a small commission and settles with sellers monthly.

* **Buyers** (Free) browse game folders, add gamepasses to a cart and pay with a (simulated) PromptPay QR.
* **Sellers** (Pro) subscribe to **Creator Lite** (฿199/mo, 1 listing, 8 % commission) or **Creator Pro**
  (฿499/mo, unlimited listings, 5 % commission) to unlock the seller workspace.
* **Admins** get a business analytics dashboard — MRR / ARR, GMV, platform revenue, sign-ups, Free→Pro conversion — and user management.

The UI is bilingual (**EN / TH**) and uses the original black-and-grey storefront look from the first HTML prototype.

## Features

| Area | What you get |
|---|---|
| Auth | Sign-up / login, bcrypt password hashing, JWT (httpOnly cookie **or** `Authorization: Bearer`), role-based access control `admin / free / pro` |
| Marketplace | Game folders, gamepass cards, search, product detail page, persistent cart |
| Monetisation | Software-enforced tiers: free users can't create listings, Lite is capped at 1 active listing, Pro is unlimited; pricing page + comparison table |
| Checkout | Mock PromptPay QR flow for **both** orders and subscriptions; paying a subscription instantly upgrades `users.role` to `pro`, expiry downgrades it automatically |
| Seller workspace | Create / edit / hide / delete listings (full CRUD), sales & net-earnings summary |
| Admin analytics | KPI cards + interactive charts (MRR trend, revenue, GMV, sign-ups, users by tier, plan mix), top sellers/passes, user management, transaction log |
| Quality | Pydantic validation, toast notifications, inline form validation on blur, responsive layout, 10 API tests |

## Tech stack

* **Backend** — Python 3.12 · **FastAPI** · SQLAlchemy 2 · Pydantic v2 · PyJWT · bcrypt
* **Database** — **PostgreSQL 16** (8 tables, see [`db/schema.sql`](db/schema.sql))
* **Frontend** — **Next.js 16** (App Router) · Tailwind CSS v4 · **shadcn/ui** components · Recharts · lucide-react

## Quick start

### Option A — Docker (recommended)

```bash
cp .env.example .env            # then edit POSTGRES_PASSWORD and JWT_SECRET
docker compose up --build
```

Open <http://localhost:3000> (API docs: <http://localhost:8000/docs>).

### Option B — run the three parts yourself

```bash
# 1) PostgreSQL (any 14+ instance)
createdb promptmarket            # or use Docker: docker run -e POSTGRES_PASSWORD=promptmarket -e POSTGRES_USER=promptmarket -e POSTGRES_DB=promptmarket -p 5432:5432 postgres:16-alpine

# 2) Backend
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # edit DATABASE_URL / JWT_SECRET
uvicorn app.main:app --reload --port 8000              # creates tables + demo data on first start

# 3) Frontend (new terminal)
cd frontend
npm install
npm run dev                                            # http://localhost:3000
```

### Demo accounts (seeded when `SEED_DEMO_DATA=true`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@promptmarket.dev` | `Admin123!` |
| Pro seller (Creator Pro) | `seller@promptmarket.dev` | `Seller123!` |
| Pro seller (Creator Lite) | `lite@promptmarket.dev` | `Seller123!` |
| Free buyer | `buyer@promptmarket.dev` | `Buyer123!` |

> Demo data only. Set `SEED_DEMO_DATA=false` in production — no default accounts are created.

### Tests

```bash
cd backend
pytest -q                                   # SQLite by default
TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost/testdb pytest -q   # against PostgreSQL
```

## Architecture

```mermaid
flowchart LR
    B[Browser] -->|HTTPS| N[Next.js + shadcn/ui<br/>:3000]
    N -->|/api/* rewrite<br/>same-origin cookie| F[FastAPI<br/>:8000]
    F -->|SQLAlchemy| P[(PostgreSQL)]
    F -. simulated webhook .-> Q[Mock PromptPay QR]
```

```
app/
├─ backend/app/        main.py · config.py · database.py · models.py · schemas.py · security.py · deps.py · seed.py
│  └─ routers/         auth · catalog · billing · dashboard
├─ frontend/src/
│  ├─ app/             9 routes (landing, login, market, market/[id], cart, workspace, pricing, profile, admin)
│  ├─ components/      ui/ (shadcn), providers, header/footer, payment dialog, cart, charts
│  └─ lib/             api client · i18n (EN/TH) · formatters · types
└─ db/schema.sql       PostgreSQL schema snapshot
```

### Key API endpoints (`/api`)

| Method & path | Who | Purpose |
|---|---|---|
| `POST /auth/register` · `/auth/login` · `/auth/logout` · `GET /auth/me` | public / user | authentication |
| `GET /games` · `GET /gamepasses` · `GET /gamepasses/{id}` | public | catalogue |
| `POST/PATCH/DELETE /gamepasses` · `GET /gamepasses/mine` | pro, admin | seller CRUD (listing limit enforced by plan) |
| `GET /plans` · `POST /subscriptions/checkout` | user | pricing & upgrade |
| `POST /orders/checkout` · `GET /orders/me` | user | cart checkout (prices re-read server-side) |
| `POST /payments/{ref}/confirm` · `/cancel` | owner | simulated bank webhook |
| `GET /seller/summary` | pro, admin | seller KPIs |
| `GET /admin/analytics` · `/admin/users` · `PATCH /admin/users/{id}` · `/admin/transactions` | admin | business analytics & user management |

Interactive docs at `/docs` (Swagger UI).

## Security notes

* Passwords are hashed with bcrypt (cost 12); login errors never reveal whether an email exists.
* JWT in an `httpOnly`, `SameSite=Lax` cookie (`Secure` when `COOKIE_SECURE=true`); the API also accepts a Bearer header.
* Authorization is enforced **server-side** with dependency guards (`require_roles`) — hiding buttons in the UI is never the only protection.
* Prices and totals are always recomputed on the server; clients can't set their own price.
* No secrets in Git: `.env` is git-ignored, only `.env.example` is committed.


## Team

| Name | Student ID | Role |
| Punnavich Uengjutiwong | 68011434 | Backend / DB |
| Nutthanarun Subseanudom | 68011420 | Frontend |
| Phuwit Thongjuntra | 68011469 | Design / Docs |

---

_KMITL Computer Programming mini-project 2026 — payments are simulated, no real money is processed._
