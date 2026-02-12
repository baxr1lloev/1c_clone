# 1C Clone ERP

`1C Clone` is a multi-tenant ERP/accounting platform inspired by 1C workflows.  
This repository contains a Django REST backend and a Next.js frontend with localization (`en`, `ru`, `uz`).

## Tech Stack

- Backend: Django 5.2, Django REST Framework, SimpleJWT, django-filter, CORS headers
- Frontend: Next.js 16, React 19, TypeScript, TanStack Query, next-intl, Tailwind CSS
- Database (default): SQLite (`db.sqlite3`)

## Key Functional Areas

- Directories: counterparties, contracts, currencies, warehouses, items
- Documents: sales, purchases, payments, transfers, inventory, cash/bank operations
- Registers: stock and settlement movements/balances
- Accounting: chart of accounts, journal logic, trial balance, period operations
- Reports: accounting and operational reports
- SaaS features: tenants, subscriptions, billing, audit log

## Repository Structure

```text
project_1c/
├── config/        # Django settings and URL config
├── accounts/      # Users and auth domain logic
├── directories/   # Master data
├── documents/     # Business documents
├── registers/     # Movement and balance registers
├── accounting/    # Accounting services and APIs
├── reports/       # Reporting APIs/services
├── frontend/      # Next.js app (App Router, i18n)
├── locale/        # Django translations
└── manage.py
```

## Quick Start

### 1) Backend (Django API)

```bash
cd project_1c
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser  # optional
python manage.py runserver 127.0.0.1:8000
```

Backend base URL:
- `http://127.0.0.1:8000`
- API v1 root prefix: `http://127.0.0.1:8000/api/v1/`

### 2) Frontend (Next.js)

```bash
cd project_1c/frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1" > .env.local
npm run dev
```

Frontend URL:
- `http://localhost:3000` (middleware routes to locale paths)
- Locale examples: `/en`, `/ru`, `/uz`

## Authentication API (JWT)

- `POST /api/v1/auth/token/` - get `access` + `refresh`
- `POST /api/v1/auth/token/refresh/` - refresh access token
- `GET /api/v1/auth/me/` - current user

The frontend stores tokens in `localStorage` and uses an Axios interceptor for automatic refresh.

## Useful Development Commands

Backend:

```bash
python manage.py check
python manage.py makemigrations
python manage.py migrate
```

Frontend:

```bash
npm run dev
npm run lint
npm run build
```

## Internationalization

- Frontend locales are configured in `frontend/src/i18n/routing.ts`
- Frontend messages: `frontend/src/messages/{en,ru,uz}.json`
- Django locale files: `locale/`

## Additional Documentation

- Full technical documentation: `COMPLETE_TECHNICAL_DOCUMENTATION.md`

