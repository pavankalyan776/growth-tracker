"""
Daily Dares: one small optional challenge a day, on top of your quests.

The dare for a given user and date is derived, not stored, so there is nothing to seed or migrate.
Only "this user finished the dare on this date" is stored (models.DareDone).
The index steps through the list with a stride coprime to its length, so two days in a row never
repeat and every dare comes round once per cycle.
"""
from datetime import date
from typing import Dict, List

# category is for the icon only: body, mind, kind, home
DARES: List[Dict[str, str]] = [
    {"key": "walk10", "category": "body", "label": "Take a 10-minute walk", "hint": "Outside if you can. No phone."},
    {"key": "stairs", "category": "body", "label": "Take the stairs, every time today", "hint": "Every flight, no exceptions."},
    {"key": "stretch", "category": "body", "label": "Stretch for 5 minutes", "hint": "Neck, shoulders, back, legs."},
    {"key": "water_first", "category": "body", "label": "Drink a full glass of water before anything else", "hint": "Before coffee, before your phone."},
    {"key": "pushups", "category": "body", "label": "Do one set of exercise you've been avoiding", "hint": "Just one set. Starting is the win."},
    {"key": "posture", "category": "body", "label": "Stand up and move every hour at work", "hint": "One minute is enough."},
    {"key": "sunlight", "category": "body", "label": "Get 10 minutes of daylight", "hint": "A balcony or a window seat counts."},
    {"key": "early_bed", "category": "body", "label": "Be in bed 30 minutes earlier tonight", "hint": "Screens off, lights low."},
    {"key": "no_sugar", "category": "body", "label": "Skip sugary drinks today", "hint": "Water or tea instead."},
    {"key": "breathe", "category": "mind", "label": "Breathe slowly for 3 minutes", "hint": "In for 4, out for 6."},
    {"key": "no_phone_meal", "category": "mind", "label": "Eat one meal without your phone", "hint": "Taste the food."},
    {"key": "one_thing", "category": "mind", "label": "Do your hardest task first", "hint": "Before email, before chat."},
    {"key": "read10", "category": "mind", "label": "Read 10 pages of anything", "hint": "A book, not a feed."},
    {"key": "learn_word", "category": "mind", "label": "Learn 3 new words and use one", "hint": "Any language you are studying."},
    {"key": "plan_tomorrow", "category": "mind", "label": "Write tomorrow's top 3 tasks tonight", "hint": "Three lines, then stop."},
    {"key": "no_scroll", "category": "mind", "label": "No social media until lunch", "hint": "Notice the urge, let it pass."},
    {"key": "gratitude", "category": "mind", "label": "Write down 3 things that went well", "hint": "Small things count."},
    {"key": "silence", "category": "mind", "label": "Sit in silence for 5 minutes", "hint": "No music, no screen."},
    {"key": "teach", "category": "mind", "label": "Explain something you learned to someone", "hint": "Or write it in two sentences."},
    {"key": "call_someone", "category": "kind", "label": "Call or message someone you haven't spoken to lately", "hint": "A short hello is enough."},
    {"key": "compliment", "category": "kind", "label": "Give someone a sincere compliment", "hint": "Be specific."},
    {"key": "thank", "category": "kind", "label": "Thank someone who helped you recently", "hint": "In person or in a message."},
    {"key": "help", "category": "kind", "label": "Do one helpful thing nobody asked you to", "hint": "Hold a door, carry a bag, answer a question."},
    {"key": "listen", "category": "kind", "label": "Listen to someone fully, without checking your phone", "hint": "Ask one follow-up question."},
    {"key": "family", "category": "kind", "label": "Have a proper conversation with someone at home", "hint": "Ask how their day really was."},
    {"key": "tidy_desk", "category": "home", "label": "Clear and wipe your desk", "hint": "Two minutes, big difference."},
    {"key": "make_bed", "category": "home", "label": "Make your bed and open the window", "hint": "Fresh air first thing."},
    {"key": "cook", "category": "home", "label": "Cook one meal from scratch", "hint": "Simple is fine."},
    {"key": "declutter", "category": "home", "label": "Remove 5 things you don't need", "hint": "Bin, donate or recycle."},
    {"key": "inbox", "category": "home", "label": "Clear 10 old emails or messages", "hint": "Delete, reply, or archive."},
    {"key": "budget", "category": "home", "label": "Write down what you spent today", "hint": "No judging, only noticing."},
    {"key": "laundry", "category": "home", "label": "Finish one chore you've been putting off", "hint": "The one you thought of first."},
    {"key": "prep_bag", "category": "home", "label": "Pack your bag and clothes for tomorrow", "hint": "Future you says thanks."},
    {"key": "new_thing", "category": "mind", "label": "Try something new, however small", "hint": "A new route, recipe or song."},
    {"key": "digital_tidy", "category": "home", "label": "Unsubscribe from 3 things you never read", "hint": "Instant quiet."},
    {"key": "evening_walk", "category": "body", "label": "Walk for 15 minutes after dinner", "hint": "Easy pace, good for sleep."},
]

N = len(DARES)          # 36; 7 is coprime to 36, so the stride below visits every dare once per cycle
_STRIDE = 7
DARE_XP = 15
DARE_COINS = 5
BY_KEY = {d["key"]: d for d in DARES}


def dare_for(user_id: int, on: date) -> Dict[str, str]:
    return DARES[(on.toordinal() * _STRIDE + user_id * 5) % N]
