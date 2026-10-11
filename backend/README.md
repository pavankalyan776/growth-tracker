# Backend: FastAPI + SQLAlchemy (v3)

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
(create the empty database first). Tables are created on startup. v3 is not compatible with v1/v2 databases:
delete `dev.db` once when upgrading (the app tells you if it finds an old one).

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
  shop.py · seed_data.py
  routers/         auth.py · tracker.py · admin.py
tests/             70 pytest tests (auth, isolation, RBAC, privacy, game rules)
Procfile           Railway start command
```

## Endpoints

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `/login`, `/logout-all`, `/change-password`; `GET /api/auth/me` |
| Account | `PATCH /api/me`, `POST /api/me/delete`, `POST /api/onboarding`, `PUT /api/plan`, `GET /api/templates` |
| Tracker (own data) | `/api/overview`, `/day/{date}`, `/completions/toggle`, `/quests`, `/calendar`, `/heatmap`, `/analytics`, `/milestones`, `/shields`, `/journal`, `/shop`, `/export` |
| Admin only | `/api/admin/overview`, `/users`, `/users/{id}` (GET/PATCH/DELETE), `/users/{id}/force-logout`, `/audit` |

Tracker routes accept `?today=YYYY-MM-DD`; the server only trusts it within one day of UTC.
Admin responses contain account facts and aggregate progress only, never journal text or quest names.
