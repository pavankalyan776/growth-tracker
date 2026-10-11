# Frontend: React + Vite (v5)

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
  App.jsx            auth gate, onboarding gate, member app vs admin app, lazy routes
  auth.jsx · game.jsx  session state; overview, toasts and celebrations (write responses are applied, not refetched)
  api.js             every backend call (bearer token, ?today=), read cache that any write clears, idle prefetch
  router.js          tiny hash router (#/today/2026-10-03, #/admin/studio/dares)
  look.jsx           Adventure/Calm word lists (with emoji), text size, useLook()
  theme.js           brightness (Day/Night/System), words, size, shop colour gradients
  styles/            tokens (Sunset Day/Night) · base · app (member pages) · viz (charts) · admin (separate console)
  components/        AppShell (grouped menu), Today, ChallengesView + Challenges (dare, boss, builder), Hall, Calendar,
                     Progress, Quests, Shop, Achievements, Profile, Appearance, Onboarding, AuthScreen, ui (shared bits)
  components/admin/  AdminApp (own shell), Dashboard, Members, ContentStudio, Audit
```

Fonts are bundled (Fredoka for headings, Nunito for text), so nothing loads from Google at runtime.
Charts are plain SVG with a readout and a table view. Only Today ships in the first download; every other page is a
separate chunk that the browser fetches while idle, so moving around never waits.

The admin app ignores shop colours and uses its own indigo palette (`styles/admin.css`, scoped under `.admin-app`).

Look settings (words, brightness, text size) are stored in the browser (`gt-style`, `gt-mode`, `gt-size`) and applied
before first paint from `index.html`, so there is no flash. Change the default in `src/theme.js` (`DEFAULT_STYLE`).
