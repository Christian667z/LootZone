# Asta-Shops

A French-language e-commerce platform for digital products (game credits, gift cards, mobile top-ups). Built with Node.js/Express and Supabase.

## Stack

- **Backend**: Node.js (ESM), Express 5, running on port 5000
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **Frontend**: Static HTML/CSS/JS served from project root and `Dashboard/`

## How to run

The app starts automatically via the **Start application** workflow (`npm run dev` → `node data/server.js`).

## Environment variables

| Key | Where set |
|-----|-----------|
| `SUPABASE_URL` | Replit env var (shared) |
| `SUPABASE_ANON_KEY` | Replit secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Replit secret |

## Key directories

- `data/server.js` — Express entry point
- `data/Routes/` — API route handlers (auth, products, orders, staff, wallet, etc.)
- `data/middleware/` — Express middleware
- `data/schema.sql` — Database schema
- `data/setup.js` — First-run setup script (creates director account)
- `Dashboard/` — Admin dashboard HTML
- `img/` — Product and UI images

## User preferences

- Keep existing project structure and stack
