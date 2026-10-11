"""Starting timetables a new member can choose from during onboarding, one per kind of person.

They are plain defaults. Every task, time and stat can be edited, added or deleted afterwards from "My timetable",
and an admin can edit these plans in the Content studio.
Stats: STR fitness, INT learning, PER focus, VIT wellbeing, AGI skills.
"""


# Compact helper: (label, time_label, stat)
def _q(day_type, rows):
    return [
        {"day_type": day_type, "label": l, "time_label": t, "stat": s, "sort_order": i + 1}
        for i, (l, t, s) in enumerate(rows)
    ]


def _plan(weekday, saturday, sunday):
    return _q("weekday", weekday) + _q("saturday", saturday) + _q("sunday", sunday)


# ---------------------------------------------------------------------------
# 🌿 Everyday wellbeing: for anyone
# ---------------------------------------------------------------------------
_WELL_WEEKDAY = [
    ("Morning stretch or walk", "6:30 – 7:00 AM", "STR"),
    ("Healthy breakfast", "7:30 – 8:00 AM", "VIT"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("A proper lunch away from screens", "1:00 – 1:30 PM", "VIT"),
    ("Read or learn for 20 minutes", "8:00 – 8:20 PM", "INT"),
    ("Tidy up for 10 minutes", "8:30 – 8:40 PM", "PER"),
    ("Screens off, wind down, sleep by 10:30", "10:00 – 10:30 PM", "VIT"),
]
_WELL_SAT = [
    ("Longer walk or workout", "7:30 – 8:30 AM", "STR"),
    ("Healthy breakfast", "9:00 – 9:30 AM", "VIT"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("Do something you enjoy", "3:00 – 5:00 PM", "AGI"),
    ("Call or meet someone you like", "5:00 – 6:00 PM", "PER"),
    ("Read or learn for 20 minutes", "8:00 – 8:20 PM", "INT"),
    ("Screens off, wind down, sleep by 11", "10:30 – 11:00 PM", "VIT"),
]
_WELL_SUN = [
    ("Gentle walk or yoga", "7:30 – 8:15 AM", "STR"),
    ("Healthy breakfast", "9:00 – 9:30 AM", "VIT"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("Tidy and reset your space", "11:00 – 11:30 AM", "PER"),
    ("Plan the week ahead", "6:00 – 6:20 PM", "PER"),
    ("Read or learn for 20 minutes", "8:00 – 8:20 PM", "INT"),
    ("Screens off, early night", "10:00 – 10:30 PM", "VIT"),
]

# ---------------------------------------------------------------------------
# 🎒 Student
# ---------------------------------------------------------------------------
_STUDENT_WEEKDAY = [
    ("Morning revision", "6:30 – 7:30 AM", "INT"),
    ("Classes or lectures", "9:00 AM – 3:00 PM", "VIT"),
    ("Homework and assignments", "4:30 – 6:00 PM", "PER"),
    ("Exercise or sport", "6:00 – 7:00 PM", "STR"),
    ("Practice problems", "8:00 – 9:00 PM", "AGI"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("Sleep, 7–8 hrs", "10:30 PM – 6:00 AM", "VIT"),
]
_STUDENT_SAT = [
    ("Deep study block", "9:00 – 11:00 AM", "INT"),
    ("Mock test or past paper", "11:30 AM – 1:30 PM", "PER"),
    ("Hobby or time with friends", "3:00 – 5:00 PM", "AGI"),
    ("Exercise or sport", "5:00 – 6:00 PM", "STR"),
    ("Review the week's mistakes", "7:00 – 7:45 PM", "INT"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("Sleep, 7–8 hrs", "10:30 PM – 7:00 AM", "VIT"),
]
_STUDENT_SUN = [
    ("Light revision", "9:00 – 10:30 AM", "INT"),
    ("Finish pending assignments", "11:00 AM – 1:00 PM", "PER"),
    ("Family time or rest", "3:00 – 5:00 PM", "VIT"),
    ("Exercise or sport", "5:00 – 6:00 PM", "STR"),
    ("Plan next week", "7:00 – 7:30 PM", "PER"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("Sleep, 7–8 hrs", "10:30 PM – 7:00 AM", "VIT"),
]

# ---------------------------------------------------------------------------
# 💼 Working professional
# ---------------------------------------------------------------------------
_PRO_WEEKDAY = [
    ("Exercise or walk", "6:30 – 7:15 AM", "STR"),
    ("Plan the day's top 3 priorities", "9:30 – 9:45 AM", "PER"),
    ("Deep work block", "10:00 AM – 12:00 PM", "INT"),
    ("Lunch break away from your desk", "1:00 – 1:45 PM", "VIT"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("Learn a skill for 30 minutes", "8:00 – 8:30 PM", "AGI"),
    ("Screens off, sleep by 10:30", "10:00 – 10:30 PM", "VIT"),
]
_PRO_SAT = [
    ("Workout", "7:30 – 8:30 AM", "STR"),
    ("Side project or skill practice", "10:00 AM – 12:00 PM", "AGI"),
    ("Errands and chores", "12:30 – 2:00 PM", "PER"),
    ("Something fun or social", "4:00 – 6:00 PM", "VIT"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("Read for 20 minutes", "8:30 – 8:50 PM", "INT"),
    ("Sleep, 7–8 hrs", "10:30 PM – 7:00 AM", "VIT"),
]
_PRO_SUN = [
    ("Easy walk or stretch", "7:30 – 8:15 AM", "STR"),
    ("Weekly review: what worked, what didn't", "10:00 – 10:30 AM", "PER"),
    ("Learn a skill for 45 minutes", "11:00 – 11:45 AM", "AGI"),
    ("Meal prep or tidy the home", "12:30 – 2:00 PM", "PER"),
    ("Rest and recharge", "3:00 – 6:00 PM", "VIT"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("Early night before the work week", "9:30 – 10:00 PM", "VIT"),
]

# ---------------------------------------------------------------------------
# 💪 Fitness and health
# ---------------------------------------------------------------------------
_FIT_WEEKDAY = [
    ("Warm-up and mobility", "6:00 – 6:15 AM", "STR"),
    ("Main workout", "6:15 – 7:00 AM", "STR"),
    ("High-protein breakfast", "7:30 – 8:00 AM", "VIT"),
    ("Water: 3 litres", "All day", "VIT"),
    ("10,000 steps", "All day", "STR"),
    ("Balanced dinner, finished by 8 PM", "7:30 – 8:00 PM", "VIT"),
    ("Sleep, 7–8 hrs", "10:00 PM – 6:00 AM", "VIT"),
]
_FIT_SAT = [
    ("Long workout or sport", "7:00 – 8:30 AM", "STR"),
    ("High-protein breakfast", "9:00 – 9:30 AM", "VIT"),
    ("Water: 3 litres", "All day", "VIT"),
    ("10,000 steps", "All day", "STR"),
    ("Meal prep for the week", "4:00 – 5:30 PM", "PER"),
    ("Stretch and foam roll", "8:00 – 8:20 PM", "STR"),
    ("Sleep, 7–8 hrs", "10:30 PM – 7:00 AM", "VIT"),
]
_FIT_SUN = [
    ("Active recovery: walk, yoga or swim", "7:30 – 8:30 AM", "STR"),
    ("High-protein breakfast", "9:00 – 9:30 AM", "VIT"),
    ("Water: 3 litres", "All day", "VIT"),
    ("Log your weight and measurements", "9:30 – 9:40 AM", "PER"),
    ("Plan next week's workouts", "6:00 – 6:20 PM", "PER"),
    ("Stretch and foam roll", "8:00 – 8:20 PM", "STR"),
    ("Sleep, 7–8 hrs", "10:00 PM – 6:30 AM", "VIT"),
]

# ---------------------------------------------------------------------------
# 🚀 Skill builder: learning or practising one skill
# ---------------------------------------------------------------------------
_SKILL_WEEKDAY = [
    ("Move your body", "6:30 – 7:00 AM", "STR"),
    ("Focused learning session", "7:15 – 8:15 AM", "INT"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("Practice what you learned", "7:00 – 8:00 PM", "AGI"),
    ("Review notes for 15 minutes", "8:15 – 8:30 PM", "PER"),
    ("Read for 20 minutes", "9:00 – 9:20 PM", "INT"),
    ("Sleep, 7–8 hrs", "10:30 PM – 6:00 AM", "VIT"),
]
_SKILL_SAT = [
    ("Workout or long walk", "7:30 – 8:30 AM", "STR"),
    ("Deep learning block", "9:30 AM – 11:30 AM", "INT"),
    ("Build a mini project", "12:00 – 2:00 PM", "AGI"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("Rest, no guilt", "4:00 – 6:00 PM", "VIT"),
    ("Review notes for 15 minutes", "8:00 – 8:15 PM", "PER"),
    ("Sleep, 7–8 hrs", "10:30 PM – 7:00 AM", "VIT"),
]
_SKILL_SUN = [
    ("Easy walk or stretch", "7:30 – 8:15 AM", "STR"),
    ("Practice session", "10:00 AM – 12:00 PM", "AGI"),
    ("Weekly review: what did I learn?", "5:00 – 5:30 PM", "PER"),
    ("Plan next week's learning goals", "5:30 – 6:00 PM", "PER"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("Read for 20 minutes", "9:00 – 9:20 PM", "INT"),
    ("Sleep, 7–8 hrs", "10:30 PM – 7:00 AM", "VIT"),
]

TEMPLATES = {
    "wellbeing": {
        "emoji": "🌿",
        "label": "Everyday wellbeing",
        "desc": "For anyone: movement, meals, water, a little learning, tidying and good sleep. 7 tasks a day.",
        "quests": _plan(_WELL_WEEKDAY, _WELL_SAT, _WELL_SUN),
    },
    "student": {
        "emoji": "🎒",
        "label": "Student",
        "desc": "Revision, classes, homework, sport, practice and rest. 7 tasks a day.",
        "quests": _plan(_STUDENT_WEEKDAY, _STUDENT_SAT, _STUDENT_SUN),
    },
    "professional": {
        "emoji": "💼",
        "label": "Working professional",
        "desc": "Exercise, a planned workday, deep work, a real lunch break and a skill on the side. 7 tasks a day.",
        "quests": _plan(_PRO_WEEKDAY, _PRO_SAT, _PRO_SUN),
    },
    "fitness": {
        "emoji": "💪",
        "label": "Fitness and health",
        "desc": "Workouts, steps, protein, water, recovery and sleep. 7 tasks a day.",
        "quests": _plan(_FIT_WEEKDAY, _FIT_SAT, _FIT_SUN),
    },
    "skills": {
        "emoji": "🚀",
        "label": "Skill builder",
        "desc": "Learn, practise and review one skill every day, with movement and rest around it. 7 tasks a day.",
        "quests": _plan(_SKILL_WEEKDAY, _SKILL_SAT, _SKILL_SUN),
    },
    "blank": {
        "emoji": "✨",
        "label": "Blank slate",
        "desc": "Start empty and build your own timetable.",
        "quests": [],
    },
}

# Plans that shipped in earlier versions and were removed. They are deleted from the database on start-up
# (members who already picked one keep their own copy of the tasks).
RETIRED_TEMPLATES = ("exam_ai", "focus")

# Backwards-compatible name used by older tests.
DEFAULT_QUESTS = TEMPLATES["wellbeing"]["quests"]
