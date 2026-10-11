"""
The coin shop. Everything here is purely virtual and cosmetic: titles and accent colours.
(Streak Shields are bought from the calendar / penalty banner, not from this catalogue.)

Every colour pair was contrast-checked (WCAG): text on panels is at least 4.5:1 in both modes, and the
fill used for rings and bars is at least 3:1 against the panel it sits on.
  fill / text / on_fill      accent, accent text, and text-on-accent in DARK mode
  light / light_text / on_light  the same three in LIGHT mode
"""

DEFAULT_TITLE = "title_rookie"
DEFAULT_THEME = "theme_sprout"

SHOP_ITEMS = [
    # ---- Titles (shown under your name). "calm" is the same title in plain words. ----
    {"key": "title_rookie", "kind": "title", "label": "Rookie Hunter", "calm": "Beginner", "cost": 0,
     "desc": "Everyone starts here."},
    {"key": "title_riser", "kind": "title", "label": "Early Riser", "calm": "Early Riser", "cost": 40,
     "desc": "For the ones who beat the sunrise."},
    {"key": "title_iron", "kind": "title", "label": "Iron Will", "calm": "Steady Hands", "cost": 80,
     "desc": "Pain is just data."},
    {"key": "title_shadow", "kind": "title", "label": "Shadow Soldier", "calm": "Quiet Force", "cost": 150,
     "desc": "Silent, consistent, relentless."},
    {"key": "title_knight", "kind": "title", "label": "Knight of Focus", "calm": "Deep Focus", "cost": 250,
     "desc": "Distractions fall before you."},
    {"key": "title_monarch", "kind": "title", "label": "Shadow Monarch", "calm": "Grand Master", "cost": 500,
     "desc": "Arise."},
    # ---- Accent colours (recolour the whole app) ----
    {"key": "theme_sprout", "kind": "theme", "label": "Sprout", "cost": 0,
     "desc": "Fresh green. The default.",
     "fill": "#2CC9A5", "text": "#2CC9A5", "on_fill": "#06201A",
     "light": "#0B7A64", "light_text": "#0B7A64", "on_light": "#FFFFFF", "glow": "rgba(44,201,165,0.28)"},
    {"key": "theme_ocean", "kind": "theme", "label": "Ocean", "cost": 60,
     "desc": "Clear and bright blue.",
     "fill": "#5AA9FF", "text": "#5AA9FF", "on_fill": "#061B33",
     "light": "#1565C8", "light_text": "#1565C8", "on_light": "#FFFFFF", "glow": "rgba(90,169,255,0.28)"},
    {"key": "theme_coral", "kind": "theme", "label": "Coral", "cost": 60,
     "desc": "Warm and energetic.",
     "fill": "#FF7A5C", "text": "#FF7A5C", "on_fill": "#2A0C04",
     "light": "#BD3A0C", "light_text": "#BD3A0C", "on_light": "#FFFFFF", "glow": "rgba(255,122,92,0.28)"},
    {"key": "theme_plum", "kind": "theme", "label": "Plum", "cost": 60,
     "desc": "Rich and a little mysterious.",
     "fill": "#B58CFF", "text": "#B58CFF", "on_fill": "#1E0A3A",
     "light": "#7A3FD0", "light_text": "#7A3FD0", "on_light": "#FFFFFF", "glow": "rgba(181,140,255,0.28)"},
    {"key": "theme_blossom", "kind": "theme", "label": "Blossom", "cost": 60,
     "desc": "Bold pink.",
     "fill": "#FF7FB5", "text": "#FF7FB5", "on_fill": "#33081A",
     "light": "#B4155B", "light_text": "#B4155B", "on_light": "#FFFFFF", "glow": "rgba(255,127,181,0.28)"},
    {"key": "theme_marigold", "kind": "theme", "label": "Marigold", "cost": 60,
     "desc": "Sunny and optimistic.",
     "fill": "#FFB520", "text": "#FFB520", "on_fill": "#2A1A00",
     "light": "#C77D00", "light_text": "#8A5300", "on_light": "#2A1A00", "glow": "rgba(255,181,32,0.30)"},
    {"key": "theme_ink", "kind": "theme", "label": "Ink", "cost": 0,
     "desc": "Black and white, maximum contrast. Easiest on the eyes.",
     "fill": "#F5F2EC", "text": "#F5F2EC", "on_fill": "#161513",
     "light": "#1C2420", "light_text": "#1C2420", "on_light": "#FFFFFF", "glow": "rgba(245,242,236,0.20)"},
]

ITEMS_BY_KEY = {item["key"]: item for item in SHOP_ITEMS}

# v3 used different keys. Existing rows are rewritten on startup (see bootstrap.migrate_theme_keys).
LEGACY_KEYS = {
    "theme_arise": "theme_sprout", "theme_jade": "theme_sprout",
    "theme_glacier": "theme_ocean", "theme_ember": "theme_coral", "theme_rose": "theme_blossom",
}

THEME_FIELDS = ("key", "label", "fill", "text", "on_fill", "light", "light_text", "on_light", "glow")


def theme_payload(key: str) -> dict:
    key = LEGACY_KEYS.get(key, key)
    item = ITEMS_BY_KEY.get(key)
    if not item or item["kind"] != "theme":
        item = ITEMS_BY_KEY[DEFAULT_THEME]
    return {k: item[k] for k in THEME_FIELDS}
