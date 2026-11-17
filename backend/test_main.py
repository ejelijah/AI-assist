from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def test_health_endpoint() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_blank_question_is_rejected() -> None:
    response = client.post("/api/chat", json={"question": "   "})

    assert response.status_code == 422
