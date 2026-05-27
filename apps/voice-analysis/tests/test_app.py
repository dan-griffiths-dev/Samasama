from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_route() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "voice-analysis"}


def test_analyze_voice_route_accepts_multipart_upload() -> None:
    response = client.post(
        "/analyze/voice",
        data={"exercise_reference_id": "INFANT_VOWEL_A_E1"},
        files={"audio_file": ("sample.wav", b"fake-audio-bytes", "audio/wav")},
    )

    assert response.status_code == 200

    body = response.json()
    assert set(body.keys()) == {
        "feedback_code",
        "pitch_score",
        "phoneme_score",
        "confidence",
        "notes",
    }
    assert body["feedback_code"] == "PITCH_STEADY"
    assert 0.0 <= body["pitch_score"] <= 1.0
    assert 0.0 <= body["phoneme_score"] <= 1.0
    assert 0.0 <= body["confidence"] <= 1.0
    assert "INFANT_VOWEL_A_E1" in body["notes"]
