import os
import tempfile

# Point the app at a throwaway SQLite file and fast hashing BEFORE the app is imported, so running
# the tests can never touch your real database (python-dotenv doesn't override these).
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["DATABASE_URL"] = "sqlite:///{}".format(_tmp.name)
os.environ["PBKDF2_ITERATIONS"] = "1000"
os.environ["CACHE_SECONDS"] = "0"           # tests must always see fresh numbers
os.environ["TRUST_CLIENT_DATE"] = "1"            # tests use fixed 2026 dates
os.environ["ADMIN_EMAIL"] = "boss@example.com"
os.environ["ADMIN_PASSWORD"] = "BossPass123"
os.environ.pop("JWT_SECRET", None)
os.environ.pop("ALLOW_REGISTRATION", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.ratelimit import limiter  # noqa: E402

PASSWORD = "Sup3rSecret"
START, END = "2026-09-16", "2026-12-31"


class Api:
    """A TestClient that remembers one user's token, like a browser tab would."""

    def __init__(self, client, token=None, user=None):
        self.c, self.token, self.user = client, token, user

    def _h(self):
        return {"Authorization": "Bearer " + self.token} if self.token else {}

    def get(self, url, **kw):
        return self.c.get(url, headers=self._h(), **kw)

    def post(self, url, **kw):
        return self.c.post(url, headers=self._h(), **kw)

    def put(self, url, **kw):
        return self.c.put(url, headers=self._h(), **kw)

    def patch(self, url, **kw):
        return self.c.patch(url, headers=self._h(), **kw)

    def delete(self, url, **kw):
        return self.c.delete(url, headers=self._h(), **kw)


@pytest.fixture()
def raw(request):
    limiter.clear()
    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as c:      # entering the context runs startup: tables, signing key, admin
        yield c


@pytest.fixture()
def signup(raw):
    def _signup(email="hunter@example.com", name="Messi", onboard=True, template="exam_ai"):
        r = raw.post("/api/auth/register", json={"email": email, "password": PASSWORD, "name": name})
        assert r.status_code == 201, r.text
        api = Api(raw, r.json()["token"], r.json()["user"])
        if onboard:
            o = api.post("/api/onboarding", params={"today": START},
                         json={"template": template, "plan_start": START, "plan_end": END})
            assert o.status_code == 200, o.text
            api.user = o.json()
        return api
    return _signup


@pytest.fixture()
def client(signup):
    """A signed-in, onboarded hunter (exam_ai template, 16 Sep to 31 Dec 2026)."""
    return signup()


@pytest.fixture()
def admin(raw):
    r = raw.post("/api/auth/login", json={"email": "boss@example.com", "password": "BossPass123"})
    assert r.status_code == 200, r.text
    return Api(raw, r.json()["token"], r.json()["user"])
