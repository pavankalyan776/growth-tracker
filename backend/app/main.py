from datetime import date
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import models, schemas, crud, game_logic
from .database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Growth Tracker API")

# In production, replace "*" with your actual Vercel frontend URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    db = next(get_db())
    crud.seed_quests_if_empty(db)


@app.get("/")
def root():
    return {"status": "ok", "service": "growth-tracker-api"}


# ---------- Quests: full CRUD ----------

@app.get("/api/quests", response_model=list[schemas.QuestOut])
def list_quests(day_type: str | None = None, db: Session = Depends(get_db)):
    return crud.get_quests(db, day_type)


@app.post("/api/quests", response_model=schemas.QuestOut)
def create_quest(quest: schemas.QuestCreate, db: Session = Depends(get_db)):
    return crud.create_quest(db, quest)


@app.put("/api/quests/{quest_id}", response_model=schemas.QuestOut)
def update_quest(quest_id: int, patch: schemas.QuestUpdate, db: Session = Depends(get_db)):
    updated = crud.update_quest(db, quest_id, patch)
    if not updated:
        raise HTTPException(status_code=404, detail="Quest not found")
    return updated


@app.delete("/api/quests/{quest_id}")
def delete_quest(quest_id: int, db: Session = Depends(get_db)):
    ok = crud.delete_quest(db, quest_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Quest not found")
    return {"deleted": True}


# ---------- Completions ----------

@app.get("/api/completions")
def get_completions(start: date, end: date, db: Session = Depends(get_db)):
    return crud.get_completions_in_range(db, start, end)


@app.post("/api/completions/toggle")
def toggle_completion(payload: schemas.CompletionToggle, db: Session = Depends(get_db)):
    crud.toggle_completion(db, payload.quest_id, payload.date, payload.completed)
    game_logic.check_perfect_bonus(db, payload.date)
    game_logic.check_milestones(db, date.today())
    return {"ok": True}


# ---------- Day detail (tasks + completion state for one date) ----------

@app.get("/api/day/{the_date}")
def get_day(the_date: date, db: Session = Depends(get_db)):
    tasks = game_logic.get_tasks_for_date(db, the_date)
    done_ids = game_logic.get_completed_quest_ids(db, the_date)
    score = game_logic.day_score(db, the_date)
    return {
        "date": the_date.isoformat(),
        "tasks": [
            {"id": t.id, "label": t.label, "time_label": t.time_label, "stat": t.stat,
             "completed": t.id in done_ids}
            for t in tasks
        ],
        "score": score,
        "shielded": game_logic.is_shielded(db, the_date),
    }


# ---------- Stats / gamification ----------

@app.get("/api/stats", response_model=schemas.GlobalStats)
def get_stats(db: Session = Depends(get_db)):
    today = date.today()
    game_logic.run_daily_login_bonus(db, today)
    stats = game_logic.check_milestones(db, today) and game_logic.compute_global_stats(db, today) \
        or game_logic.compute_global_stats(db, today)
    return schemas.GlobalStats(
        total_xp=stats["total_xp"], level=stats["level"], rank=stats["rank"],
        coins=stats["coins"], current_streak=stats["current_streak"],
        longest_streak=stats["longest_streak"], total_completed=stats["total_completed"],
        stat_totals=stats["stat_totals"],
    )


@app.get("/api/milestones", response_model=list[schemas.MilestoneOut])
def get_milestones(db: Session = Depends(get_db)):
    achieved = {m.milestone_key: m.achieved_at for m in db.query(models.MilestoneAchieved).all()}
    return [
        schemas.MilestoneOut(
            id=m["id"], title=m["title"], desc=m["desc"], reward=m["reward"],
            achieved=m["id"] in achieved, achieved_at=achieved.get(m["id"]),
        )
        for m in game_logic.MILESTONE_DEFS
    ]


# ---------- Shields ----------

@app.post("/api/shields")
def use_shield(payload: schemas.ShieldRequest, db: Session = Depends(get_db)):
    stats = game_logic.compute_global_stats(db, date.today())
    if stats["coins"] < game_logic.SHIELD_COST:
        raise HTTPException(status_code=400, detail="Not enough coins")
    if not crud.add_shield(db, payload.date):
        raise HTTPException(status_code=400, detail="Already shielded")
    game_logic.add_coins(db, date.today(), -game_logic.SHIELD_COST, f"Streak Shield on {payload.date}")
    return {"ok": True}


@app.get("/api/shields")
def list_shields(db: Session = Depends(get_db)):
    return list(crud.get_shielded_dates(db))


# ---------- Settings (hunter name, etc.) ----------

@app.get("/api/settings/{key}")
def get_setting(key: str, db: Session = Depends(get_db)):
    return {"key": key, "value": crud.get_setting(db, key, "Player")}


@app.post("/api/settings")
def set_setting(payload: schemas.SettingUpdate, db: Session = Depends(get_db)):
    crud.set_setting(db, payload.key, payload.value)
    return {"ok": True}
