import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()


def _normalize(url: str) -> str:
    # Railway hands out "mysql://user:pass@host:port/db".
    # SQLAlchemy needs to be told which driver to use: "mysql+pymysql://".
    if url.startswith("mysql://"):
        return url.replace("mysql://", "mysql+pymysql://", 1)
    return url


# Local dev with nothing installed -> SQLite file. In production (Railway) or once
# you have MySQL locally, set DATABASE_URL (or MYSQL_URL) in .env / the host's variables:
#   mysql+pymysql://root:yourpassword@localhost:3306/growth_tracker
DATABASE_URL = _normalize(
    os.getenv("DATABASE_URL") or os.getenv("MYSQL_URL") or "sqlite:///./dev.db"
)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
