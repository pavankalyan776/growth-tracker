"""Quest templates a new hunter can start from (chosen during onboarding)."""

# Compact helper: (label, time_label, stat)
def _q(day_type, rows):
    return [
        {"day_type": day_type, "label": l, "time_label": t, "stat": s, "sort_order": i + 1}
        for i, (l, t, s) in enumerate(rows)
    ]


_WEEKDAY_EXAM = [
    ("Exercise", "6:15 – 7:00 AM", "STR"),
    ("Govt Exam Prep (rotate: Arithmetic / Reasoning / Grammar / GK)", "7:15 – 8:15 AM", "PER"),
    ("Udemy: AI Engineer Course", "8:15 – 9:15 AM", "INT"),
    ("Office (lunch 1–2 PM)", "10:00 AM – 7:00 PM", "VIT"),
    ("NeetCode Practice", "7:30 – 8:15 PM", "AGI"),
    ("Water: 8 glasses", "6 AM – 10 PM", "VIT"),
    ("Sleep, 7–8 hrs", "10:00 PM – 6:00 AM", "VIT"),
]
_SAT_EXAM = [
    ("Exercise", "7:00 – 7:45 AM", "STR"),
    ("Udemy: Deep Focus", "8:00 – 10:00 AM", "INT"),
    ("NeetCode: Deep Focus", "10:15 AM – 12:15 PM", "AGI"),
    ("Govt Exam: Timed Practice Set", "3:00 – 5:00 PM", "PER"),
    ("Rest, no guilt", "5:30 – 8:00 PM", "VIT"),
    ("Water: 8 glasses", "7 AM – 10 PM", "VIT"),
    ("Sleep, 7–8 hrs", "10:00 PM – 6:00 AM", "VIT"),
]
_SUN_EXAM = [
    ("Exercise", "7:00 – 7:45 AM", "STR"),
    ("Udemy: Deep Focus", "8:00 – 10:00 AM", "INT"),
    ("NeetCode: Deep Focus", "10:15 AM – 12:15 PM", "AGI"),
    ("Govt Exam: Mock Test", "3:00 – 5:00 PM", "PER"),
    ("Weekly Review", "5:30 – 6:15 PM", "PER"),
    ("Water: 8 glasses", "7 AM – 10 PM", "VIT"),
    ("Sleep, 7–8 hrs", "10:00 PM – 6:00 AM", "VIT"),
]

_WEEKDAY_FOCUS = [
    ("Move your body", "7:00 – 7:30 AM", "STR"),
    ("Deep work block", "9:00 – 11:00 AM", "INT"),
    ("Learn something new", "7:00 – 8:00 PM", "INT"),
    ("Read 20 minutes", "9:00 – 9:20 PM", "PER"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("Sleep before 11 PM", "11:00 PM", "VIT"),
]
_WEEKEND_FOCUS = [
    ("Move your body", "8:00 – 8:45 AM", "STR"),
    ("Side project", "10:00 AM – 12:00 PM", "INT"),
    ("Practice session", "4:00 – 5:00 PM", "AGI"),
    ("Plan the week", "6:00 – 6:30 PM", "PER"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("Sleep before 11 PM", "11:00 PM", "VIT"),
]

TEMPLATES = {
    "exam_ai": {
        "label": "Exam + AI Engineer",
        "desc": "Office hours, govt exam prep, an AI course, NeetCode, exercise, water and sleep. 7 quests a day.",
        "quests": _q("weekday", _WEEKDAY_EXAM) + _q("saturday", _SAT_EXAM) + _q("sunday", _SUN_EXAM),
    },
    "focus": {
        "label": "Deep focus",
        "desc": "A lighter plan: movement, deep work, learning, reading, water and sleep. 6 quests a day.",
        "quests": _q("weekday", _WEEKDAY_FOCUS) + _q("saturday", _WEEKEND_FOCUS) + _q("sunday", _WEEKEND_FOCUS),
    },
    "blank": {
        "label": "Blank slate",
        "desc": "Start empty and build your own quests.",
        "quests": [],
    },
}

# Backwards-compatible name used by older tests.
DEFAULT_QUESTS = TEMPLATES["exam_ai"]["quests"]
