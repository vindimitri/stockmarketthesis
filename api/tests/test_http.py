import pytest
from fastapi.testclient import TestClient

from fdax_api.main import app


@pytest.fixture(scope="module")
def client():
    try:
        with TestClient(app) as test_client:
            health = test_client.get("/health")
            if health.status_code != 200:
                pytest.skip("database not available")
            yield test_client
    except Exception as exc:
        pytest.skip(f"database not available: {exc}")


def test_health_ok(client: TestClient):
    body = client.get("/health").json()
    assert body["ok"] is True
    assert body["database"] == "up"
    assert body["tape_delay_seconds"] == 900
    assert body["last_ingest"] is None or body["last_ingest"]["status"] in {"ok", "running", "error"}


def test_days_contains_september_17(client: TestClient):
    days = client.get("/days").json()
    assert any(d["berlin_date"] == "2026-09-17" for d in days)


def test_summary_default_window(client: TestClient):
    body = client.get("/summary", params={"date": "2026-09-17"}).json()
    assert body["n_trades"] > 0
    assert body["low"] is not None
    assert body["high"] is not None
    assert body["open"] is not None
    assert body["close"] is not None


def test_trades_after_returns_only_newer(client: TestClient):
    trades = client.get(
        "/trades",
        params={"date": "2026-09-17", "from": "00:00", "to": "24:00"},
    ).json()["trades"]
    assert len(trades) > 10
    cursor = trades[9]
    newer = client.get(
        "/trades",
        params={
            "date": "2026-09-17",
            "from": "00:00",
            "to": "24:00",
            "after_time": cursor["event_time"],
            "after_id": cursor["id"],
        },
    ).json()["trades"]
    assert newer[0]["id"] != cursor["id"]
    assert all(t["id"] != cursor["id"] for t in newer[:20])


def test_trades_have_prices(client: TestClient):
    trades = client.get(
        "/trades",
        params={"date": "2026-09-17", "from": "00:00", "to": "24:00"},
    ).json()
    assert trades["count"] > 0
    first = trades["trades"][0]
    last = trades["trades"][-1]
    assert first["event_time"] < last["event_time"]
    assert first["price"] > 0
    assert first["id"] > 0


def test_unknown_day_is_404(client: TestClient):
    res = client.get("/summary", params={"date": "1999-01-01"})
    assert res.status_code == 404


def test_trades_full_day_covers_default_window(client: TestClient):
    day = client.get(
        "/trades",
        params={"date": "2026-09-17", "from": "00:00", "to": "24:00"},
    ).json()
    hour = client.get("/trades", params={"date": "2026-09-17"}).json()
    assert day["count"] >= hour["count"]
    assert day["start"].endswith("00:00:00+02:00") or day["start"].endswith("00:00:00+01:00")

