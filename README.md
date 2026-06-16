# UniGo Web

UniGo is being rebuilt as a responsive web app for daily commute groups, ride creation, matching, women-only ride discovery, route previews, and live rider updates.


## Stack

- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Leaflet
- Backend: FastAPI, WebSockets
- Database: Supabase PostgreSQL
- Maps: OpenStreetMap tiles, OpenRouteService routing
- Deployment: Vercel for `apps/web`, Render for `apps/api`

## Project Structure

```txt
unigo/
  apps/
    web/              Next.js responsive web app
    api/              FastAPI backend and WebSocket server
  packages/
    shared/           Shared TypeScript contracts
  database/
    migrations/       Supabase SQL migrations
    seed/             Optional seed data
  docs/               Product flow and deployment notes
```

## First Setup Later

```bash
npm install
npm run dev:web
```

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Copy `.env.example` files before running either app.

