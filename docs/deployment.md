# Deployment Notes

## Frontend: Vercel

- Root directory: `apps/web`
- Build command: `npm run build`
- Output: Next.js default

## Backend: Render

- Root directory: `apps/api`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## Required Services

- Supabase project with PostgreSQL and Auth enabled
- OpenRouteService API key for routing
- OpenStreetMap-compatible tile source for map display

