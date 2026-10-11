"""
Daily Dares: one small optional challenge a day, on top of your quests.

The dare for a given user and date is derived from the pool (built-ins plus the dares the admin added), not stored.
When a member finishes one, we store the date AND the dare key (models.DareDone), so editing the pool later can
never rewrite what someone already did.
The index steps through the list with a stride coprime to its length, so two days in a row never
repeat and every dare comes round once per cycle.
"""
from datetime import date
from typing import Dict, List, Optional

# category is for the icon only: body, mind, kind, home
DARES: List[Dict[str, str]] = [
    {"key": "walk10", "category": "body", "label": "Take a 10-minute walk", "hint": "Outside if you can. No phone.", "emoji": "🚶"},
    {"key": "stairs", "category": "body", "label": "Take the stairs, every time today", "hint": "Every flight, no exceptions.", "emoji": "🪜"},
    {"key": "stretch", "category": "body", "label": "Stretch for 5 minutes", "hint": "Neck, shoulders, back, legs.", "emoji": "🧘"},
    {"key": "water_first", "category": "body", "label": "Drink a full glass of water before anything else", "hint": "Before coffee, before your phone.", "emoji": "💧"},
    {"key": "pushups", "category": "body", "label": "Do one set of exercise you've been avoiding", "hint": "Just one set. Starting is the win.", "emoji": "💪"},
    {"key": "posture", "category": "body", "label": "Stand up and move every hour at work", "hint": "One minute is enough.", "emoji": "🧍"},
    {"key": "sunlight", "category": "body", "label": "Get 10 minutes of daylight", "hint": "A balcony or a window seat counts.", "emoji": "☀️"},
    {"key": "early_bed", "category": "body", "label": "Be in bed 30 minutes earlier tonight", "hint": "Screens off, lights low.", "emoji": "🛏️"},
    {"key": "no_sugar", "category": "body", "label": "Skip sugary drinks today", "hint": "Water or tea instead.", "emoji": "🥤"},
    {"key": "breathe", "category": "mind", "label": "Breathe slowly for 3 minutes", "hint": "In for 4, out for 6.", "emoji": "🌬️"},
    {"key": "no_phone_meal", "category": "mind", "label": "Eat one meal without your phone", "hint": "Taste the food.", "emoji": "🍽️"},
    {"key": "one_thing", "category": "mind", "label": "Do your hardest task first", "hint": "Before email, before chat.", "emoji": "🐸"},
    {"key": "read10", "category": "mind", "label": "Read 10 pages of anything", "hint": "A book, not a feed.", "emoji": "📖"},
    {"key": "learn_word", "category": "mind", "label": "Learn 3 new words and use one", "hint": "Any language you are studying.", "emoji": "🔤"},
    {"key": "plan_tomorrow", "category": "mind", "label": "Write tomorrow's top 3 tasks tonight", "hint": "Three lines, then stop.", "emoji": "📝"},
    {"key": "no_scroll", "category": "mind", "label": "No social media until lunch", "hint": "Notice the urge, let it pass.", "emoji": "📵"},
    {"key": "gratitude", "category": "mind", "label": "Write down 3 things that went well", "hint": "Small things count.", "emoji": "🙏"},
    {"key": "silence", "category": "mind", "label": "Sit in silence for 5 minutes", "hint": "No music, no screen.", "emoji": "🤫"},
    {"key": "teach", "category": "mind", "label": "Explain something you learned to someone", "hint": "Or write it in two sentences.", "emoji": "🎓"},
    {"key": "call_someone", "category": "kind", "label": "Call or message someone you haven't spoken to lately", "hint": "A short hello is enough.", "emoji": "📞"},
    {"key": "compliment", "category": "kind", "label": "Give someone a sincere compliment", "hint": "Be specific.", "emoji": "💬"},
    {"key": "thank", "category": "kind", "label": "Thank someone who helped you recently", "hint": "In person or in a message.", "emoji": "💌"},
    {"key": "help", "category": "kind", "label": "Do one helpful thing nobody asked you to", "hint": "Hold a door, carry a bag, answer a question.", "emoji": "🤝"},
    {"key": "listen", "category": "kind", "label": "Listen to someone fully, without checking your phone", "hint": "Ask one follow-up question.", "emoji": "👂"},
    {"key": "family", "category": "kind", "label": "Have a proper conversation with someone at home", "hint": "Ask how their day really was.", "emoji": "🏡"},
    {"key": "tidy_desk", "category": "home", "label": "Clear and wipe your desk", "hint": "Two minutes, big difference.", "emoji": "🧹"},
    {"key": "make_bed", "category": "home", "label": "Make your bed and open the window", "hint": "Fresh air first thing.", "emoji": "🛌"},
    {"key": "cook", "category": "home", "label": "Cook one meal from scratch", "hint": "Simple is fine.", "emoji": "🍳"},
    {"key": "declutter", "category": "home", "label": "Remove 5 things you don't need", "hint": "Bin, donate or recycle.", "emoji": "📦"},
    {"key": "inbox", "category": "home", "label": "Clear 10 old emails or messages", "hint": "Delete, reply, or archive.", "emoji": "📥"},
    {"key": "budget", "category": "home", "label": "Write down what you spent today", "hint": "No judging, only noticing.", "emoji": "💰"},
    {"key": "laundry", "category": "home", "label": "Finish one chore you've been putting off", "hint": "The one you thought of first.", "emoji": "🧺"},
    {"key": "prep_bag", "category": "home", "label": "Pack your bag and clothes for tomorrow", "hint": "Future you says thanks.", "emoji": "🎒"},
    {"key": "new_thing", "category": "mind", "label": "Try something new, however small", "hint": "A new route, recipe or song.", "emoji": "🎲"},
    {"key": "digital_tidy", "category": "home", "label": "Unsubscribe from 3 things you never read", "hint": "Instant quiet.", "emoji": "📧"},
    {"key": "evening_walk", "category": "body", "label": "Walk for 15 minutes after dinner", "hint": "Easy pace, good for sleep.", "emoji": "🌆"},
]

DARE_XP = 15
DARE_COINS = 5
CATEGORY_EMOJI = {"body": "🏃", "mind": "🧠", "kind": "💛", "home": "🏡"}
CATEGORIES = tuple(CATEGORY_EMOJI)
BUILTIN_BY_KEY = {d["key"]: d for d in DARES}
BY_KEY = BUILTIN_BY_KEY                       # kept for older imports

# Strides that visit every dare once per cycle when coprime to the pool size. With the 36 built-ins this is 7,
# exactly as in v4, so nobody's dare changes just because the app was upgraded.
_STRIDES = (7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53)


def custom_to_dare(row) -> Dict[str, str]:
    return {"key": "c{}".format(row.id), "category": row.category, "label": row.label, "hint": row.hint or "",
            "emoji": row.emoji or CATEGORY_EMOJI.get(row.category, "✨"), "custom": True}


def build_pool(custom_rows, on: Optional[date] = None) -> List[Dict[str, str]]:
    """Built-ins followed by the admin's ACTIVE custom dares, oldest first.

    A custom dare only joins the pool for days AFTER the day it was created, so adding one at noon can't change
    the dare someone already saw this morning."""
    extra = [r for r in sorted(custom_rows, key=lambda r: r.id)
             if r.active and (on is None or r.created_at is None or r.created_at.date() < on)]
    return DARES + [custom_to_dare(r) for r in extra]


def lookup(key: str, all_custom_rows) -> Optional[Dict[str, str]]:
    """Find a dare by key, including inactive custom ones (history must still show what you did)."""
    if key in BUILTIN_BY_KEY:
        return BUILTIN_BY_KEY[key]
    for r in all_custom_rows:
        if "c{}".format(r.id) == key:
            return custom_to_dare(r)
    return None


def dare_for(user_id: int, on: date, pool: Optional[List[Dict[str, str]]] = None) -> Dict[str, str]:
    pool = pool or DARES
    n = len(pool)
    stride = next(p for p in _STRIDES if n % p)
    return pool[(on.toordinal() * stride + user_id * 5) % n]
