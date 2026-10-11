import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .bootstrap import init_database
from .database import SessionLocal
from .routers import admin, auth, tracker


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once on startup: refuse an old v1/v2 database, create missing tables, make sure the admin exists.
    init_database(SessionLocal)
    yield


app = FastAPI(title="Growth Tracker API", version="3.0.0", lifespan=lifespan)

# Set CORS_ORIGINS on the host to your Vercel URL, e.g. https://growth-tracker.vercel.app
# (comma-separated for several). Defaults to "*" so local development just works.
# Sessions use an Authorization header (not cookies), so credentials stay off.
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("X-Frame-Options", "DENY")
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


app.include_router(auth.router)
app.include_router(tracker.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "growth-tracker-api", "version": 3}
