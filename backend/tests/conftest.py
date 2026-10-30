import os

# Tests run against SQLite by default; set TEST_DATABASE_URL to run against PostgreSQL.
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "sqlite:///./test.db")
os.environ["SEED_DEMO_DATA"] = "false"
os.environ["JWT_SECRET"] = "test-secret"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Role, User
from app.security import hash_password
from app.seed import seed_plans


@pytest.fixture()
def db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_plans(session)
        yield session
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db):
    with TestClient(app) as c:
        yield c


def make_user(db, email, role=Role.free, password="Passw0rd!x"):
    u = User(email=email, display_name=email.split("@")[0], password_hash=hash_password(password), role=role)
    db.add(u)
    db.commit()
    return u


def login(client, email, password="Passw0rd!x"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
