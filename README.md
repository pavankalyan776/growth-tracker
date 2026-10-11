# Growth Tracker (v5)

A daily growth tracker for everyone. Turn your habits into quests (or keep them as plain habits), build streaks,
beat a weekly boss, take a daily dare, and watch your level rise. It started as a Solo Leveling-style game and
now has two looks, so it works just as well for people who don't care for games.

FastAPI + SQLAlchemy (SQLite locally, MySQL in production) and React (Vite). Every reward is virtual.

## What's new in v5

- **Two separate apps in one.** Members get the tracker. Admins get their **own console** (own menu, indigo
  colours, denser tables) at `#/admin`. Admins land there after signing in, and an "Open my tracker" button
  takes them to their own member view if they want one. Members can never open it.
- **A new look: "Sunset".** Orange-to-raspberry gradient on warm peach paper (Day) or deep plum (Night), rounded
  shapes, soft shadows, and two new fonts: **Fredoka** for headings and **Nunito** for text. The eight shop colours
  are now gradients too. Emoji appear throughout the copy (stats 💪📚🎯🌿⚡, streak 🔥, coins 🪙, moods, milestones).
- **A grouped menu.** Six places instead of nine: Today, Plan (Calendar + My tasks), Challenges (Challenges +
  Leaderboard), Progress, Rewards (Shop + Milestones), Profile. A bottom tab bar on phones.
- **Challenges hub.** The daily dare, the weekly boss and **challenges you build yourself** from a form: pick an
  emoji, a name, how many check-ins and how many days. Finish one for +15 coins and +30 XP (up to 2 rewarded a week).
- **Content studio (low-code for admins).** Add daily dares, build starting plans (with their tasks) and publish
  announcements with forms. No deploy, no code. Every change is recorded in the audit log.
- **Faster.** One request per tick (the answer carries the new day and overview, so there is no refetch), optimistic
  taps, per-page code splitting with idle pre-loading, a read cache on the browser, gzip, and a short server cache
  for admin and leaderboard roll-ups. SQLite runs in WAL mode and MySQL uses a connection pool.

## Screens

| Screen | What it does |
|---|---|
| Today | Announcements, greeting and progress ring, weekly boss, daily dare, the day's tasks, daily log; level, your challenges, stats on the side |
| Plan | Calendar (open and fix any past day) and My tasks (full CRUD, max 20 per day type) |
| Challenges | Dare, boss, your own challenges and a builder; the opt-in Leaderboard tab |
| Progress | Heatmap, weekly/monthly completion, stat consistency, weakest tasks, setbacks ledger, JSON backup |
| Rewards | Shop (titles and gradient colours) and 22 milestones |
| Profile | Name, avatar, look, Leaderboard opt-in, plan window, password, sign out everywhere, delete account |
| Admin: Dashboard, Members, Content studio, Audit log, My account | Admin only, in a separate app |

## Rules

- **XP** 10 per quest, +20 for a perfect day, +15 for a daily dare, +50 for a weekly boss, 100 XP per level.
- **Ranks** E, D (L6), C (L16), B (L31), A (L51), S (L76).
- **Streak** counts consecutive perfect days. Today never breaks it until the day is over.
- **Coins** +5 daily login, +10 perfect day, +5 daily dare, +40 weekly boss, +15 per finished challenge, +100 for a month at 80% or better, plus milestone bonuses.
- **Daily dare** is picked for you from the 36 built-in dares plus any your admin added, and never affects streaks or perfect days.
- **Your challenges** need 3 to 90 check-ins within 3 to 90 days, start within 30 days, and end inside your plan. Up to 5 can be live. Finished ones can be archived, not deleted.
- **Weekly boss** runs Monday to Sunday inside your plan; defeat it by clearing 80% of that week's quests. The first and last partial weeks are smaller.
- **Streak Shield** costs 30 coins and repairs a missed past day (no XP, so stats stay honest).

## Security notes

- Passwords: PBKDF2-HMAC-SHA256, 600,000 iterations, per-user salt. Never stored or logged in plain text.
- Login uses signed JWTs. Disabling an account, changing the password, or "sign out everywhere" revokes all of that user's tokens at once.
- Login, registration, password change and delete are rate limited. Unknown email and wrong password give the same message.
- The server checks the role on every admin route, and checks that every row it touches belongs to the caller.
- Security headers on all responses; `Cache-Control: no-store` on the API.
- The rate limiter and the 20-second roll-up cache are in memory, so they reset on restart and are per server. That's right for one free Railway instance; use a shared store if you ever scale out.
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

Sign in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD` to see the admin Overview, or create a normal account.
You can also promote an existing account: `python -m app.make_admin you@example.com`.

### Upgrading

- **From v4**: nothing to delete. Run `pip install -r requirements.txt` and `npm install` (v5 swaps the fonts).
  Your database is upgraded in place on startup: new tables (challenges, dares, announcements, starting plans) are
  created, one column is added, and the old colour themes map to the new Sunset family (your default becomes Sunset).
- **From v3**: nothing to delete. Your database is upgraded in place on startup (two new columns and a dares
  table are added, old colour themes are mapped to the new ones). Run `pip install -r requirements.txt` and
  `npm install` (v4 adds one font package).
- **From v1 or v2**: every table changed in v3, so delete `backend/dev.db` once. The app tells you if it finds an old one.
  Then register and choose **16 Sep 2026** as your plan start to keep the original plan window.

## Tests

```bash
# backend: 121 tests on a temp database (never touches yours)
cd backend && pip install -r requirements-dev.txt && python -m pytest

# frontend: renders the real app against a running throwaway backend
cd backend
RATE_LIMIT=false ADMIN_EMAIL=boss@example.com ADMIN_PASSWORD=BossPass123 \
  DATABASE_URL=sqlite:///./smoke.db uvicorn app.main:app --port 8123      # terminal A
cd frontend && VITE_API_URL=http://127.0.0.1:8123 npm test                 # terminal B
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
- [ ] Friends list and private groups for the Leaderboard
- [ ] Shared (Redis) cache and rate limiter if you ever run more than one server
- [ ] Style, text size and brightness saved to the account (today they are per browser)
