# Growth Tracker: The System (v3)

A Solo Leveling-style daily growth tracker. You are a hunter, your habits are quests, and your wins,
failures, pain and consistency are all recorded. v3 adds **real accounts**, **role-based access (hunter and
admin)** and a full visual redesign.

FastAPI + SQLAlchemy (SQLite locally, MySQL in production) and React (Vite). Every reward is virtual.

## What's new in v3

- **Accounts.** Register and sign in. Every hunter has their own quests, history, journal, coins and shop items.
- **RBAC.** Two roles, enforced on the server (never just hidden in the UI).
  - *Hunter*: sees only their own data.
  - *Admin*: opens the **Console** to see how the product is used: sign-ups, active users, funnel, rank
    distribution, and per-hunter account facts and progress numbers. Admins can disable, sign out, promote or
    delete accounts. **Admins never see journal text, quest names or passwords**, and every admin action is
    written to an append-only **audit log**.
- **Onboarding.** Pick a quest template (Exam + AI Engineer, Deep focus, Blank) and your own plan window.
- **New design.** A dark "Void" look with a violet accent, a live **Gate** ring that fills as you clear quests,
  rank emblems, a "Gate cleared" celebration, light "Daylight" mode, a command palette (Ctrl/Cmd+K),
  mobile tab bar, and five unlockable accent themes in the Shop.

## Screens

| Screen | What it does |
|---|---|
| Today | The day's quests with time blocks, the Gate ring, next-up card, streak-at-risk warning, daily log |
| Calendar | Month grid coloured by completion; open and fix any past day |
| Progress | Heatmap, weekly/monthly completion, stat consistency, weakest quests, setbacks ledger, JSON backup |
| Quests | Full CRUD on your quests (max 20 per day type) |
| Shop | Spend coins on titles and accent themes |
| Trophies | 13 milestones that pay coins |
| Profile | Name, theme mode, plan window, change password, sign out everywhere, delete account |
| Console, Hunters, Audit | Admin only |

## Rules

- **XP** 10 per quest, +20 for a perfect day, 100 XP per level.
- **Ranks** E, D (L6), C (L16), B (L31), A (L51), S (L76).
- **Streak** counts consecutive perfect days. Today never breaks it until the day is over.
- **Coins** +5 daily login, +10 perfect day, +100 for a month at 80% or better, plus milestone bonuses.
- **Streak Shield** costs 30 coins and repairs a missed past day (no XP, so stats stay honest).

## Security notes

- Passwords: PBKDF2-HMAC-SHA256, 600,000 iterations, per-user salt. Never stored or logged in plain text.
- Login uses signed JWTs. Disabling an account, changing the password, or "sign out everywhere" revokes all of that user's tokens at once.
- Login, registration, password change and delete are rate limited. Unknown email and wrong password give the same message.
- The server checks the role on every admin route, and checks that every row it touches belongs to the caller.
- Security headers on all responses; `Cache-Control: no-store` on the API.
- The rate limiter is in memory, so it resets on restart and is per server. That's right for one free Railway instance; use a shared store if you ever scale out.
- The token lives in `localStorage`. That is fine for a personal project; a bigger product would use httpOnly cookies.

## Run it locally (two terminals)

**Terminal 1: backend**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then edit ADMIN_EMAIL and ADMIN_PASSWORD
uvicorn app.main:app --reload
```
API docs: http://127.0.0.1:8000/docs

**Terminal 2: frontend**
```bash
cd frontend
npm install
npm run dev
```
App: http://localhost:5173

Sign in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD` to see the Console, or create a normal hunter account.
You can also promote an existing account: `python -m app.make_admin you@example.com`.

### Upgrading from v1 or v2

v3 changes every table (each row now belongs to a user), so the old local database can't be reused.
Stop the backend, delete `backend/dev.db`, reinstall (`pip install -r requirements.txt`), and start again.
The app refuses to start on an old database and tells you this. Then register and choose **16 Sep 2026**
as your plan start to keep the original plan window.

## Tests

```bash
# backend: 70 tests on a temp database (never touches yours)
cd backend && pip install -r requirements-dev.txt && python -m pytest

# frontend: renders the real app against a running throwaway backend
cd backend
RATE_LIMIT=false ADMIN_EMAIL=boss@example.com ADMIN_PASSWORD=BossPass123 \
  DATABASE_URL=sqlite:///./smoke.db uvicorn app.main:app --port 8000      # terminal A
cd frontend && npm test                                                    # terminal B
```
Delete `backend/smoke.db` afterwards.

## Deploy (free tiers)

1. **Backend + MySQL on Railway**: New Project, Deploy from GitHub, set *Root Directory* to `backend`, add a
   **MySQL** database. In the backend Variables set `DATABASE_URL` (the MySQL URL; `mysql://` is fine),
   `CORS_ORIGINS` (your Vercel URL), `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Railway uses the `Procfile`.
2. **Frontend on Vercel**: Import the repo, *Root Directory* `frontend`, set `VITE_API_URL` to your Railway URL
   (no trailing slash).
3. Every `git push` to `main` redeploys both.

## Roadmap

- [ ] Alembic migrations
- [ ] httpOnly-cookie sessions and email-based password reset
- [ ] Import a JSON backup
- [ ] Weekly boss quests
