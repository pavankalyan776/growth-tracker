"""Promote an existing account to admin:   python -m app.make_admin you@example.com"""
import sys

from . import crud
from .database import SessionLocal


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python -m app.make_admin you@example.com")
        return 2
    db = SessionLocal()
    try:
        user = crud.get_user_by_email(db, sys.argv[1])
        if not user:
            print("No account with that email. Register in the app first, then run this again.")
            return 1
        user.role = "admin"
        user.is_active = True
        db.commit()
        crud.audit(db, "admin.promote_cli", target=user, detail="Promoted from the command line")
        print("{} is now an admin.".format(user.email))
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
