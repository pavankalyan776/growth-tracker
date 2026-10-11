"""
The coin shop. Everything here is purely virtual and cosmetic: titles and colour themes.
(Streak Shields are bought from the calendar / penalty banner, not from this catalogue.)

Every colour pair was contrast-checked (WCAG): accent text on cards, the page and sunken areas, and the text
on buttons, are all at least 4.5:1 in both modes. A theme is a two-colour gradient.
  fill / fill2 / text / on_fill          gradient start, gradient end, accent text, text-on-accent in NIGHT mode
  light / light2 / light_text / on_light  the same four in DAY mode
"""

DEFAULT_TITLE = "title_rookie"
DEFAULT_THEME = "theme_sunset"


def _theme(key, label, emoji, cost, desc, light, light2, light_text, dark, dark2, dark_text, on_dark, on_light="#FFFFFF"):
    return {"key": key, "kind": "theme", "label": label, "emoji": emoji, "cost": cost, "desc": desc,
            "light": light, "light2": light2, "light_text": light_text, "on_light": on_light,
            "fill": dark, "fill2": dark2, "text": dark_text, "on_fill": on_dark}


SHOP_ITEMS = [
    # ---- Titles (shown under your name). "calm" is the same title in plain words. ----
    {"key": "title_rookie", "kind": "title", "label": "Rookie Hunter", "calm": "Beginner", "emoji": "🌱", "cost": 0,
     "desc": "Everyone starts here."},
    {"key": "title_riser", "kind": "title", "label": "Early Riser", "calm": "Early Riser", "emoji": "🌅", "cost": 40,
     "desc": "For the ones who beat the sunrise."},
    {"key": "title_iron", "kind": "title", "label": "Iron Will", "calm": "Steady Hands", "emoji": "🛡️", "cost": 80,
     "desc": "Hard days are just data."},
    {"key": "title_shadow", "kind": "title", "label": "Shadow Soldier", "calm": "Quiet Force", "emoji": "🥷", "cost": 150,
     "desc": "Silent, consistent, relentless."},
    {"key": "title_knight", "kind": "title", "label": "Knight of Focus", "calm": "Deep Focus", "emoji": "🎯", "cost": 250,
     "desc": "Distractions fall before you."},
    {"key": "title_monarch", "kind": "title", "label": "Shadow Monarch", "calm": "Grand Master", "emoji": "👑", "cost": 500,
     "desc": "Arise."},
    # ---- Colour themes (recolour the whole app) ----
    _theme("theme_sunset", "Sunset", "🌇", 0, "Orange to raspberry. The default.",
           "#CD4107", "#C0246F", "#B93A08", "#FF8A5C", "#FF5C8F", "#FF9A72", "#2B0B1F"),
    _theme("theme_ocean", "Ocean", "🌊", 60, "Clear blue into sea green.",
           "#0F6FC2", "#087A8A", "#0F62B0", "#5CB4FF", "#35D0D8", "#7DC3FF", "#06213A"),
    _theme("theme_coral", "Coral", "🪸", 60, "Warm coral and red.",
           "#CC3A1E", "#B01E4C", "#C2361B", "#FF8066", "#FF5A78", "#FF9580", "#2E0A08"),
    _theme("theme_plum", "Plum", "🍇", 60, "Rich violet and orchid.",
           "#7A3FD0", "#B03FB5", "#7437C8", "#B992FF", "#E58BFF", "#C6A8FF", "#1F0A3C"),
    _theme("theme_blossom", "Blossom", "🌸", 60, "Bold pink melting into orange.",
           "#C0155F", "#CC3F08", "#B4155B", "#FF86BA", "#FFA86B", "#FF93C2", "#33081A"),
    _theme("theme_marigold", "Marigold", "🌼", 60, "Sunny gold and amber.",
           "#AB6000", "#C23F10", "#8A5000", "#FFC233", "#FF9040", "#FFCB5C", "#2A1A00"),
    _theme("theme_forest", "Forest", "🌿", 60, "Fresh green into teal.",
           "#0B7F5E", "#1A7F9A", "#0A7455", "#42DDA8", "#4BC9E8", "#5DE6B6", "#052A1E"),
    _theme("theme_ink", "Ink", "🖤", 0, "Near-black and white. Maximum contrast, easiest on the eyes.",
           "#2B1B2E", "#5A3A60", "#2B1B2E", "#FFF1F7", "#E6C9E0", "#FFF1F7", "#170F1E"),
]

ITEMS_BY_KEY = {item["key"]: item for item in SHOP_ITEMS}

# Older versions used different keys. Existing rows are rewritten on startup (see bootstrap.migrate_theme_keys).
# v3 -> v4 renamed the colours; v4 -> v5 replaced the green default "Sprout" with the orange-to-raspberry "Sunset".
LEGACY_KEYS = {
    "theme_arise": "theme_sunset", "theme_jade": "theme_forest", "theme_sprout": "theme_sunset",
    "theme_glacier": "theme_ocean", "theme_ember": "theme_coral", "theme_rose": "theme_blossom",
}

THEME_FIELDS = ("key", "label", "emoji", "fill", "fill2", "text", "on_fill", "light", "light2", "light_text", "on_light")


def theme_payload(key: str) -> dict:
    key = LEGACY_KEYS.get(key, key)
    item = ITEMS_BY_KEY.get(key)
    if not item or item["kind"] != "theme":
        item = ITEMS_BY_KEY[DEFAULT_THEME]
    return {k: item[k] for k in THEME_FIELDS}
