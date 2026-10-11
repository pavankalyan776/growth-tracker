# Frontend: React + Vite (v4)

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build -> dist/
npm run lint
npm test           # renders the real app against a running backend (see root README, "Tests")
```

The app talks to `http://localhost:8000` by default. For production create `frontend/.env`:

```
VITE_API_URL=https://your-backend.up.railway.app
```

## Layout

```
src/
  App.jsx            auth gate, onboarding gate, shell, routes
  auth.jsx · game.jsx  session state, overview/toasts/celebration
  api.js             every backend call (bearer token, ?today=)
  router.js          tiny hash router (#/today/2026-10-03, #/admin/users)
  look.jsx           Adventure/Calm word lists, text size, useLook()
  theme.js           brightness (Day/Night/System), style, size, shop colour themes
  styles/            tokens · base · shell · views · viz · features · calm
  components/        Today, Challenges (dare + boss), Hall, Calendar, Progress, Quests, Shop, Achievements,
                     Profile, Appearance, Avatar, Onboarding, AuthScreen
  components/admin/  Overview, Members table + drawer, Audit
```

Fonts are bundled (Big Shoulders Display, Instrument Sans and Lexend), so nothing loads from Google at runtime.
Charts are plain SVG. Chart colours are checked for colour-blind separation in both modes, and every chart has
a readout and a table view.

Look settings (style, brightness, text size) are stored in the browser (`gt-style`, `gt-mode`, `gt-size`) and applied
before first paint from `index.html`, so there is no flash. Change the default in `src/theme.js` (`DEFAULT_STYLE`).
