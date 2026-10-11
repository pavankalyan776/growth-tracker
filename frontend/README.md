# Frontend: React + Vite (v3)

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
  theme.js           Void/Daylight mode + shop accent themes
  styles/            tokens · base · shell · views · viz
  components/        Today, Calendar, Progress, Quests, Shop, Achievements, Profile, Onboarding, AuthScreen
  components/admin/  Console, Hunters table + drawer, Audit
```

Fonts are bundled (Big Shoulders Display and Instrument Sans), so nothing loads from Google at runtime.
Charts are plain SVG. Chart colours are checked for colour-blind separation in both modes, and every chart has
a readout and a table view.
