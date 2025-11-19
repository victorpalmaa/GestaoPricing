from fastapi.testclient import TestClient
import bcrypt


class _Result:
    def __init__(self, data=None, count=0):
        self.data = data or []
        self.count = count


class _Table:
    def __init__(self, name, state):
        self.name = name
        self.state = state
        self._query = {
            "select": None,
            "filters": {},
            "order": None,
            "limit": None,
            "update": None,
            "delete": False,
            "insert": None,
        }

    def select(self, columns):
        self._query["select"] = columns
        return self

    def insert(self, doc):
        self._query["insert"] = doc
        self.state.setdefault(self.name, []).append(doc)
        return self

    def update(self, doc):
        self._query["update"] = doc
        return self

    def delete(self):
        self._query["delete"] = True
        return self

    def eq(self, field, value):
        self._query["filters"][field] = value
        return self

    def order(self, field, desc=False):
        self._query["order"] = (field, desc)
        return self

    def limit(self, n):
        self._query["limit"] = n
        return self

    def execute(self):
        items = list(self.state.get(self.name, []))
        for k, v in self._query["filters"].items():
            items = [i for i in items if i.get(k) == v]
        if self._query["order"]:
            field, desc = self._query["order"]
            items.sort(key=lambda x: x.get(field), reverse=bool(desc))
        if self._query["limit"] is not None:
            items = items[: self._query["limit"]]
        if self._query["update"] is not None:
            for i in items:
                i.update(self._query["update"])
        if self._query["delete"]:
            before = len(self.state.get(self.name, []))
            self.state[self.name] = [i for i in self.state.get(self.name, []) if i not in items]
            return _Result([], count=before - len(self.state[self.name]))
        return _Result(items, count=len(items))


class FakeSupabase:
    def __init__(self, initial_state=None):
        self._state = initial_state or {}
        class _Auth:
            def verify_otp(self, payload):
                token = payload.get("token")
                if token == "invalid":
                    raise Exception("invalid token")
                return {"data": True}
            def update_user(self, payload):
                return {"data": True}
            def reset_password_for_email(self, email, opts):
                return {"data": True}
            class admin:
                @staticmethod
                def create_user(payload):
                    return {"data": True}
        self.auth = _Auth()

    def table(self, name):
        return _Table(name, self._state)


def setup_app(monkeypatch):
    from backend.server import app
    import backend.server as server

    server.SECRET_KEY = "test-secret"
    server.ACCESS_TOKEN_EXPIRE_MINUTES = 60

    # Create test user
    password = "S3nh@F0rte"
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user = {
        "id": "user-1",
        "nome": "Ana",
        "sobrenome": "Silva",
        "email": "ana@pronutrition.com.br",
        "area": "Comercial",
        "password_hash": password_hash,
    }

    prices = [
        {
            "id": "p1",
            "cliente": "Cliente 1",
            "sku": "SKU1",
            "precoLiquido": 10.0,
            "precoBruto": 12.0,
            "margemBruta": 2.0,
            "volume": 5,
            "createdAt": "2025-01-01T00:00:00+00:00",
        }
    ]

    fake = FakeSupabase({"users": [user], "prices": prices})
    monkeypatch.setattr(server, "supabase", fake)
    return TestClient(app)


def test_login_returns_token_and_user(monkeypatch):
    client = setup_app(monkeypatch)
    resp = client.post(
        "/api/login",
        json={"email": "ana@pronutrition.com.br", "password": "S3nh@F0rte"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["token"]["token_type"] == "bearer"
    assert "access_token" in data["token"]
    assert data["user"]["email"] == "ana@pronutrition.com.br"


def test_prices_requires_auth(monkeypatch):
    client = setup_app(monkeypatch)
    resp = client.get("/api/prices")
    assert resp.status_code == 401


def test_prices_with_token(monkeypatch):
    client = setup_app(monkeypatch)
    login = client.post(
        "/api/login",
        json={"email": "ana@pronutrition.com.br", "password": "S3nh@F0rte"},
    )
    token = login.json()["token"]["access_token"]
    resp = client.get("/api/prices", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    items = resp.json()
    assert isinstance(items, list)
    assert len(items) >= 1


def test_healthz(monkeypatch):
    client = setup_app(monkeypatch)
    resp = client.get("/healthz")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


def test_login_remember_extends_expiry(monkeypatch):
    from backend import server
    client = setup_app(monkeypatch)
    server.ACCESS_TOKEN_EXPIRE_MINUTES = 60
    server.ACCESS_TOKEN_EXPIRE_LONG_MINUTES = 43200
    resp = client.post(
        "/api/login",
        json={"email": "ana@pronutrition.com.br", "password": "S3nh@F0rte", "remember": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["token"]["expires_in"] >= 24 * 3600


def test_reset_password_updates_hash_and_login(monkeypatch):
    client = setup_app(monkeypatch)
    client.post(
        "/api/forgot-password",
        json={"email": "ana@pronutrition.com.br"},
    )
    resp = client.post(
        "/api/reset-password",
        json={"email": "ana@pronutrition.com.br", "token": "invalid", "new_password": "Nova123"},
    )
    assert resp.status_code == 400
    resp = client.post(
        "/api/reset-password",
        json={"email": "ana@pronutrition.com.br", "token": "abc123", "new_password": "Nova123"},
    )
    assert resp.status_code == 200
    # old password should fail
    resp_old = client.post(
        "/api/login",
        json={"email": "ana@pronutrition.com.br", "password": "S3nh@F0rte"},
    )
    assert resp_old.status_code == 401
    # new password should succeed
    resp_new = client.post(
        "/api/login",
        json={"email": "ana@pronutrition.com.br", "password": "Nova123"},
    )
    assert resp_new.status_code == 200


def test_forgot_password_user_not_found(monkeypatch):
    client = setup_app(monkeypatch)
    resp = client.post(
        "/api/forgot-password",
        json={"email": "naoexiste@pronutrition.com.br"},
    )
    assert resp.status_code == 404
