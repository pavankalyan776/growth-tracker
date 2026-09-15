# Growth Tracker — Frontend (React + Vite)

## Local setup

```bash
npm install
npm run dev
```

Opens at http://localhost:5173 by default. It expects the FastAPI backend
running at http://localhost:8000 (see ../backend/README.md).

## Environment variable

Create a `.env` file in this folder if your backend runs somewhere other
than localhost:8000:

```
VITE_API_URL=http://localhost:8000
```

## Build for production

```bash
npm run build
```

Outputs static files to `dist/`. This is what Vercel builds automatically
when you connect this repo — no manual step needed there.
