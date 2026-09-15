# Growth Tracker — The System

A gamified daily growth tracker — XP, ranks, streaks and coins — built to
keep govt exam prep, AI engineering study, coding practice, and health
habits on track through Dec 2026.

Full-stack: FastAPI + SQLAlchemy + MySQL backend, React (Vite) frontend.

## Structure

```
backend/    FastAPI + SQLAlchemy + MySQL API — see backend/README.md
frontend/   React + Vite app — see frontend/README.md
```

## Running it locally (two terminals)

**Terminal 1 — backend:**
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the frontend talks to the backend automatically.

## Deploying (next step, once this is running locally and pushed to GitHub)

- **Backend + MySQL** → Railway (free tier, one click adds a MySQL database)
- **Frontend** → Vercel, with the project root set to `frontend/` and a
  `VITE_API_URL` environment variable pointing at your live Railway backend URL

## Roadmap

- [ ] Deploy backend + MySQL to Railway
- [ ] Deploy frontend to Vercel, wired to the live backend
- [ ] Add authentication (so this could support more than one hunter)
- [ ] Alembic migrations instead of `create_all` on startup
