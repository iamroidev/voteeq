# Voteeq

Voting and event ticketing platform.

## Stack

| Layer | Host | Tech |
|-------|------|------|
| Frontend | Vercel | React + Vite |
| API | Render | Express + WebSocket |
| Database | Turso | libSQL |

## Local development

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your Turso credentials (optional — falls back to local SQLite)
npm install
npm run dev
```

API runs at `http://localhost:5000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`. API URL defaults to `http://localhost:5000`.

## Production environment variables

### Render (`voteeq-api`)

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | Yes | `production` |
| `JWT_SECRET` | Yes | Auto-generated in `render.yaml` |
| `ADMIN_USERNAME` | Yes | Admin login username |
| `ADMIN_PASSWORD` | Yes | Admin login password |
| `TURSO_DATABASE_URL` | Yes | `libsql://...` from Turso dashboard |
| `TURSO_AUTH_TOKEN` | Yes | Turso auth token |
| `CORS_ORIGIN` | Yes | Vercel URL (comma-separated for previews) |
| `FRONTEND_URL` | Yes | Vercel URL for Paystack callbacks |
| `PAYSTACK_SECRET_KEY` | When live | Enables real payments |

### Vercel

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://voteeq-api.onrender.com` |
| `VITE_WS_URL` | `wss://voteeq-api.onrender.com` |

## Health check

`GET /health` — returns `{ status: "ok" }` when the API and database are reachable.

## Security notes

- Mock payment endpoints and USSD auto-complete are **disabled in production**.
- Demo seed data (sample nominees/events) is **development only**.
- Payment status lookups require a `token` query param returned at checkout.
- Ticket lookup requires a ticket code (`TIX-...`) or payment reference + buyer email.
