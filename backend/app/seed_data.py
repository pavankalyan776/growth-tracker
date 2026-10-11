"""Starting plans a new member can choose from during onboarding. Stats: STR fitness, INT learning, PER focus, VIT wellbeing, AGI skills."""

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

_WEEKDAY_WELL = [
    ("Morning stretch or walk", "7:00 – 7:30 AM", "STR"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("A proper lunch away from your screen", "1:00 – 1:30 PM", "VIT"),
    ("Read or learn for 20 minutes", "8:00 – 8:20 PM", "INT"),
    ("Tidy up for 10 minutes", "8:30 – 8:40 PM", "PER"),
    ("Screens off, wind down", "10:00 – 10:30 PM", "VIT"),
    ("Sleep, 7–8 hrs", "10:30 PM – 6:30 AM", "VIT"),
]
_WEEKEND_WELL = [
    ("Longer walk or workout", "8:00 – 9:00 AM", "STR"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("Do something you enjoy", "3:00 – 5:00 PM", "AGI"),
    ("Call or meet someone you like", "5:00 – 6:00 PM", "PER"),
    ("Plan the week ahead", "7:00 – 7:20 PM", "PER"),
    ("Sleep, 7–8 hrs", "10:30 PM – 7:00 AM", "VIT"),
]

_WEEKDAY_STUDENT = [
    ("Morning revision", "6:30 – 7:30 AM", "INT"),
    ("Classes or lectures", "9:00 AM – 3:00 PM", "VIT"),
    ("Homework and assignments", "4:30 – 6:00 PM", "PER"),
    ("Exercise or sport", "6:00 – 7:00 PM", "STR"),
    ("Practice problems", "8:00 – 9:00 PM", "AGI"),
    ("Water: 8 glasses", "All day", "VIT"),
    ("Sleep, 7–8 hrs", "10:30 PM – 6:00 AM", "VIT"),
]
_WEEKEND_STUDENT = [
    ("Deep study block", "9:00 – 11:00 AM", "INT"),
    ("Mock test or past paper", "11:30 AM – 1:30 PM", "PER"),
    ("Hobby or time with friends", "3:00 – 5:00 PM", "AGI"),
    ("Exercise or sport", "5:00 – 6:00 PM", "STR"),
    ("Plan next week", "7:00 – 7:30 PM", "PER"),
    ("Sleep, 7–8 hrs", "10:30 PM – 7:00 AM", "VIT"),
]

TEMPLATES = {
    "wellbeing": {
        "label": "Everyday wellbeing",
        "desc": "For anyone: movement, water, a proper lunch, a little learning, tidying and good sleep. 7 tasks a day.",
        "quests": _q("weekday", _WEEKDAY_WELL) + _q("saturday", _WEEKEND_WELL) + _q("sunday", _WEEKEND_WELL),
    },
    "student": {
        "label": "Student life",
        "desc": "Revision, classes, homework, sport, practice problems and rest. 7 tasks a day.",
        "quests": _q("weekday", _WEEKDAY_STUDENT) + _q("saturday", _WEEKEND_STUDENT) + _q("sunday", _WEEKEND_STUDENT),
    },
    "exam_ai": {
        "label": "Exam + AI Engineer",
        "desc": "Office hours, govt exam prep, an AI course, NeetCode, exercise, water and sleep. 7 tasks a day.",
        "quests": _q("weekday", _WEEKDAY_EXAM) + _q("saturday", _SAT_EXAM) + _q("sunday", _SUN_EXAM),
    },
    "focus": {
        "label": "Deep focus",
        "desc": "A lighter plan: movement, deep work, learning, reading, water and sleep. 6 tasks a day.",
        "quests": _q("weekday", _WEEKDAY_FOCUS) + _q("saturday", _WEEKEND_FOCUS) + _q("sunday", _WEEKEND_FOCUS),
    },
    "blank": {
        "label": "Blank slate",
        "desc": "Start empty and build your own list.",
        "quests": [],
    },
}

# Backwards-compatible name used by older tests.
DEFAULT_QUESTS = TEMPLATES["exam_ai"]["quests"]
