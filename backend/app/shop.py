"""
The coin shop. Everything here is purely virtual and cosmetic: titles and accent themes.
(Streak Shields are bought from the calendar / penalty banner, not from this catalogue.)

Theme colours were contrast-checked: `on_fill` text on `fill` and `text` on the dark panels
are >= 4.5:1; `light` on the Daylight panels is >= 4.5:1 (white text on it too).
"""

DEFAULT_TITLE = "title_rookie"
DEFAULT_THEME = "theme_arise"

SHOP_ITEMS = [
    # ---- Titles (shown under your name on the hunter card) ----
    {"key": "title_rookie", "kind": "title", "label": "Rookie Hunter", "cost": 0,
     "desc": "Everyone starts here."},
    {"key": "title_riser", "kind": "title", "label": "Early Riser", "cost": 40,
     "desc": "For the ones who beat the sunrise."},
    {"key": "title_iron", "kind": "title", "label": "Iron Will", "cost": 80,
     "desc": "Pain is just data."},
    {"key": "title_shadow", "kind": "title", "label": "Shadow Soldier", "cost": 150,
     "desc": "Silent, consistent, relentless."},
    {"key": "title_knight", "kind": "title", "label": "Knight of Focus", "cost": 250,
     "desc": "Distractions fall before you."},
    {"key": "title_monarch", "kind": "title", "label": "Shadow Monarch", "cost": 500,
     "desc": "Arise."},
    # ---- Accent themes (recolour the whole app) ----
    {"key": "theme_arise", "kind": "theme", "label": "Arise Violet", "cost": 0,
     "desc": "The default System window.",
     "fill": "#6F4DFF", "text": "#A58FFF", "on_fill": "#FFFFFF", "light": "#5B3FE0",
     "glow": "rgba(111,77,255,0.30)"},
    {"key": "theme_glacier", "kind": "theme", "label": "Glacier", "cost": 60,
     "desc": "Cold, clear, focused.",
     "fill": "#5CA8FF", "text": "#5CA8FF", "on_fill": "#0A0B1E", "light": "#1D6FD6",
     "glow": "rgba(92,168,255,0.30)"},
    {"key": "theme_ember", "kind": "theme", "label": "Ember", "cost": 60,
     "desc": "Red-gate heat.",
     "fill": "#FF8A3D", "text": "#FF8A3D", "on_fill": "#0A0B1E", "light": "#C2410C",
     "glow": "rgba(255,138,61,0.30)"},
    {"key": "theme_jade", "kind": "theme", "label": "Jade Gate", "cost": 60,
     "desc": "Calm and growing.",
     "fill": "#2FD6A0", "text": "#2FD6A0", "on_fill": "#0A0B1E", "light": "#047857",
     "glow": "rgba(47,214,160,0.28)"},
    {"key": "theme_rose", "kind": "theme", "label": "Rose Blade", "cost": 60,
     "desc": "Sharp and bright.",
     "fill": "#FF6FAE", "text": "#FF6FAE", "on_fill": "#0A0B1E", "light": "#BE185D",
     "glow": "rgba(255,111,174,0.28)"},
]

ITEMS_BY_KEY = {item["key"]: item for item in SHOP_ITEMS}


def theme_payload(key: str) -> dict:
    item = ITEMS_BY_KEY.get(key)
    if not item or item["kind"] != "theme":
        item = ITEMS_BY_KEY[DEFAULT_THEME]
    return {k: item[k] for k in ("key", "label", "fill", "text", "on_fill", "light", "glow")}
