# Growth Tracker (v4)

A daily growth tracker for everyone. Turn your habits into quests (or keep them as plain habits), build streaks,
beat a weekly boss, take a daily dare, and watch your level rise. It started as a Solo Leveling-style game and
now has two looks, so it works just as well for people who don't care for games.

FastAPI + SQLAlchemy (SQLite locally, MySQL in production) and React (Vite). Every reward is virtual.

## What's new in v4

- **A fresh look.** The navy theme is gone. The default is "Daylight": soft warm white with a green accent,
  and a warm charcoal "Night" mode. Seven unlockable colour themes (Sprout, Ocean, Coral, Plum, Blossom,
  Marigold, Ink), all contrast-checked.
- **Two styles, one app.** *Adventure* keeps the game feel (quests, ranks, bosses, shadow soldiers).
  *Calm* uses plain words (habits, tiers, goals), softer shapes and a friendlier typeface. Switch any time from the
  top bar, Profile, or the sign-in screen. Everything underneath (points, streaks, coins) is the same.
- **Easy to read for any age.** Larger base text, three text sizes (Standard, Large, Extra large), strong
  contrast, big tap targets, and a clear focus ring for keyboard users.
- **Real challenge.**
  - **Daily Dare**: one small real-life challenge per day (36 of them, from "eat one meal without your
    phone" to "write a thank-you note"). +15 XP and +5 coins. Optional, never breaks a streak.
  - **Weekly Boss**: clear 80% of the week's habits to defeat it. +50 XP and +40 coins, once per week.
    In Calm style it is a "Weekly goal" with a plain progress bar.
  - **19 milestones** (6 new: first dare, 10 and 30 dares, first and fourth boss, 10 perfect days, a fortnight streak).
- **The Hall.** An optional weekly leaderboard for friends. It is **off by default**. Joining shares only your
  name, avatar, level, streak and this week's points. Quests, journal and coins stay private, and you can leave any time.
- **Avatars.** Twelve icons to pick from, shown next to your name.
- **More starting plans.** Wellbeing (default), Student, Exam + AI Engineer, Deep focus, Blank.
- **Accounts, RBAC and the admin overview** from v3 are unchanged. Admins still see only account facts and totals.

## Screens

| Screen | What it does |
|---|---|
| Today | Greeting, the Gate ring, Weekly Boss, Daily Dare, the day's tasks with time blocks, next-up card, daily log |
| Calendar | Month grid coloured by completion; open and fix any past day |
| Progress | Heatmap, weekly/monthly completion, stat consistency, weakest quests, setbacks ledger, JSON backup |
| Quests | Full CRUD on your quests (max 20 per day type) |
| Shop | Spend coins on titles and colour themes |
| Trophies / Milestones | 19 milestones that pay coins |
| The Hall / Leaderboard | Optional weekly board for friends (opt-in) |
| Profile | Name, avatar, look (style, brightness, text size), Hall opt-in, plan window, change password, sign out everywhere, delete account |
| Overview, Members, Audit | Admin only |

## Rules

- **XP** 10 per quest, +20 for a perfect day, +15 for a daily dare, +50 for a weekly boss, 100 XP per level.
- **Ranks** E, D (L6), C (L16), B (L31), A (L51), S (L76).
- **Streak** counts consecutive perfect days. Today never breaks it until the day is over.
- **Coins** +5 daily login, +10 perfect day, +5 daily dare, +40 weekly boss, +100 for a month at 80% or better, plus milestone bonuses.
- **Daily dare** is picked for you from a list of 36 and never affects streaks or perfect days.
- **Weekly boss** runs Monday to Sunday inside your plan; defeat it by clearing 80% of that week's quests. The first and last partial weeks are smaller.
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

Sign in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD` to see the admin Overview, or create a normal account.
You can also promote an existing account: `python -m app.make_admin you@example.com`.

### Upgrading

- **From v3**: nothing to delete. Your database is upgraded in place on startup (two new columns and a dares
  table are added, old colour themes are mapped to the new ones). Run `pip install -r requirements.txt` and
  `npm install` (v4 adds one font package).
- **From v1 or v2**: every table changed in v3, so delete `backend/dev.db` once. The app tells you if it finds an old one.
  Then register and choose **16 Sep 2026** as your plan start to keep the original plan window.

## Tests

```bash
# backend: 92 tests on a temp database (never touches yours)
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
- [ ] Friends list and private groups for the Hall
- [ ] Style, text size and brightness saved to the account (today they are per browser)
