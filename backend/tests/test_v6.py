"""v6: timetables by category, a name you can set during setup, and admins kept out of member numbers."""
import json

from app import bootstrap, models
from app.database import SessionLocal
from tests.conftest import PASSWORD

T = "2026-09-16"
KEYS = ["wellbeing", "student", "professional", "fitness", "skills", "blank"]


def test_every_timetable_is_generic_and_full(raw, signup):
    listed = raw.get("/api/templates").json()
    assert [t["key"] for t in listed] == KEYS
    text = json.dumps(listed).lower()
    for banned in ("udemy", "neetcode", "govt", "ai engineer"):
        assert banned not in text
    for i, key in enumerate(KEYS[:-1]):
        api = signup("t{}@example.com".format(i), "Tester", template=key)
        for day_type in ("weekday", "saturday", "sunday"):
            rows = api.get("/api/quests", params={"day_type": day_type}).json()
            assert len(rows) == 7, (key, day_type)
            assert all(r["time_label"] and r["label"] for r in rows)


def test_old_personal_plans_are_removed_on_startup_and_unedited_builtins_refresh():
    db = SessionLocal()
    try:
        db.add(models.PlanTemplate(key="exam_ai", label="Exam + AI Engineer", desc="old", emoji="🧠", builtin=True,
                                   sort_order=9, quests_json="[]"))
        row = db.query(models.PlanTemplate).filter(models.PlanTemplate.key == "student").one()
        row.label, row.quests_json = "Student life (old wording)", "[]"
        db.commit()
        bootstrap.seed_templates(db)
        keys = [t.key for t in db.query(models.PlanTemplate).order_by(models.PlanTemplate.sort_order).all()]
        assert "exam_ai" not in keys
        fresh = db.query(models.PlanTemplate).filter(models.PlanTemplate.key == "student").one()
        assert fresh.label == "Student" and len(json.loads(fresh.quests_json)) == 21
    finally:
        db.close()


def test_an_admins_edits_to_a_builtin_plan_survive_startup(admin):
    quests = [{"day_type": "weekday", "label": "Only this", "time_label": "9 AM", "stat": "INT"}]
    assert admin.patch("/api/admin/content/templates/student", json={"label": "My student plan", "quests": quests}).status_code == 200
    db = SessionLocal()
    try:
        bootstrap.seed_templates(db)
        row = db.query(models.PlanTemplate).filter(models.PlanTemplate.key == "student").one()
        assert row.label == "My student plan" and len(json.loads(row.quests_json)) == 1
    finally:
        db.close()


def test_name_can_be_set_while_setting_up(signup):
    api = signup("n@example.com", "Admin", onboard=False)
    r = api.post("/api/onboarding", params={"today": T},
                 json={"template": "wellbeing", "plan_start": T, "plan_end": "2026-12-31", "name": "  Pavan   K "})
    assert r.status_code == 200 and r.json()["name"] == "Pavan K"
    assert api.get("/api/overview", params={"today": T}).json()["hunter_name"] == "Pavan K"
    bad = signup("m@example.com", "Mm", onboard=False).post(
        "/api/onboarding", params={"today": T},
        json={"template": "wellbeing", "plan_start": T, "plan_end": "2026-12-31", "name": "<b>"})
    assert bad.status_code == 422


def test_admin_can_rename_themselves(admin):
    assert admin.patch("/api/me", json={"name": "Messi"}).json()["name"] == "Messi"


def test_admins_never_appear_on_the_hall(signup, admin):
    a = signup("a@example.com", "Alpha")
    a.patch("/api/me", json={"public_board": True})
    admin.post("/api/onboarding", params={"today": T}, json={"template": "wellbeing", "plan_start": T, "plan_end": "2026-12-31"})
    admin.patch("/api/me", json={"public_board": True})
    names = [r["name"] for r in a.get("/api/board", params={"today": T}).json()["rows"]]
    assert names == ["Alpha"]


def test_admin_activity_is_not_counted_in_member_numbers(signup, admin):
    admin.post("/api/onboarding", params={"today": T}, json={"template": "wellbeing", "plan_start": T, "plan_end": "2026-12-31"})
    for t in admin.get("/api/day/" + T, params={"today": T}).json()["tasks"]:
        admin.post("/api/completions/toggle", params={"today": T}, json={"quest_id": t["id"], "date": T, "completed": True})
    member = signup("m@example.com", "Mem")
    t = member.get("/api/day/" + T, params={"today": T}).json()["tasks"][0]
    member.post("/api/completions/toggle", params={"today": T}, json={"quest_id": t["id"], "date": T, "completed": True})
    o = admin.get("/api/admin/overview", params={"today": T}).json()
    assert o["totals"]["users"] == 1 and o["totals"]["tasks_done"] == 1 and o["totals"]["onboarded"] == 1
    assert {s["step"]: s["count"] for s in o["funnel"]}["Registered"] == 1
    everyone = admin.get("/api/admin/users", params={"today": T}).json()
    assert [u["email"] for u in everyone["items"]] == ["m@example.com"]
