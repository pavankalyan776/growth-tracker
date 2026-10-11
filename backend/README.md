# Backend: FastAPI + SQLAlchemy (v4)

Works on **Python 3.9+** (tested on 3.9 and 3.13).

```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # set ADMIN_EMAIL and ADMIN_PASSWORD
uvicorn app.main:app --reload
```

Docs: http://127.0.0.1:8000/docs

## Database

Default is a local SQLite file (`dev.db`). For MySQL set `DATABASE_URL=mysql+pymysql://user:pass@host:3306/growth_tracker`
(create the empty database first). Tables are created on startup, and a v3 database is upgraded in place
(`bootstrap.ensure_columns` adds the new columns, `migrate_theme_keys` maps old colour themes). v1/v2 databases are not
compatible: delete `dev.db` once (the app tells you if it finds an old one).

## Files

```
app/
  main.py          app setup, CORS, security headers
  config.py        environment settings
  security.py      password hashing, JWT
  ratelimit.py     in-memory sliding-window limiter
  deps.py          get_current_user, require_admin, require_onboarded
  bootstrap.py     DB init, legacy-schema guard, admin bootstrap
  make_admin.py    CLI: python -m app.make_admin email
  models.py        tables (star schema, every row user-scoped)
  schemas.py       request validation
  crud.py          database reads/writes, audit log
  game_logic.py    XP, ranks, streaks, coins, milestones, analytics
  dares.py         36 daily dares, picked per user per day (derived, not stored)
  avatars.py       12 avatar keys
  shop.py · seed_data.py   themes, titles, starting plans
  routers/         auth.py · tracker.py · admin.py
tests/             92 pytest tests (auth, isolation, RBAC, privacy, game rules, dares, boss, Hall, upgrade)
Procfile           Railway start command
```

## Endpoints

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `/login`, `/logout-all`, `/change-password`; `GET /api/auth/me` |
| Account | `PATCH /api/me` (name, avatar, public_board; any one at a time), `POST /api/me/delete`, `POST /api/onboarding`, `PUT /api/plan`, `GET /api/templates` |
| Tracker (own data) | `/api/overview`, `/day/{date}`, `/completions/toggle`, `/dares/toggle`, `/board`, `/quests`, `/calendar`, `/heatmap`, `/analytics`, `/milestones`, `/shields`, `/journal`, `/shop`, `/export` |
| Admin only | `/api/admin/overview`, `/users`, `/users/{id}` (GET/PATCH/DELETE), `/users/{id}/force-logout`, `/audit` |

Tracker routes accept `?today=YYYY-MM-DD`; the server only trusts it within one day of UTC.
Admin responses contain account facts and aggregate progress only, never journal text or quest names.

The Hall (`/api/board`) returns only name, avatar, level, rank, streak and this week's points, and only for users who opted in.
