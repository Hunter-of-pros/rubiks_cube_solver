"""Integration tests for the FastAPI REST API."""

from __future__ import annotations

from pathlib import Path
import sys

import cv2
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app
from tests.test_vision_pipeline import render_synthetic_face


client = TestClient(app)
SOLVED_FACELETS = "WWWWWWWWWRRRRRRRRRGGGGGGGGGYYYYYYYYYOOOOOOOOOBBBBBBBBB"


def test_health_endpoint() -> None:
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["solver_available"] is True


def test_validate_solved_and_invalid_cube() -> None:
    ok_res = client.post("/api/validate", json={"facelets": SOLVED_FACELETS})
    assert ok_res.status_code == 200
    assert ok_res.json()["valid"] is True
    assert ok_res.json()["solved"] is True

    # Bad color count
    bad_facelets = "R" + SOLVED_FACELETS[1:]
    bad_res = client.post("/api/validate", json={"facelets": bad_facelets})
    assert bad_res.status_code == 200
    assert bad_res.json()["valid"] is False
    assert "Expected 9 stickers" in bad_res.json()["error"]

    # Bad character rejected at API layer
    char_res = client.post("/api/validate", json={"facelets": "X" + SOLVED_FACELETS[1:]})
    assert char_res.status_code == 400


def test_scramble_and_solve_round_trip() -> None:
    scr_res = client.post("/api/scramble", json={"length": 15, "seed": 42})
    assert scr_res.status_code == 200
    scr_data = scr_res.json()
    assert scr_data["valid"] is True
    assert len(scr_data["facelets"]) == 54

    solve_res = client.post(
        "/api/solve",
        json={"facelets": scr_data["facelets"], "algorithm": "kociemba"},
    )
    assert solve_res.status_code == 200
    sol_data = solve_res.json()
    assert sol_data["valid"] is True
    assert sol_data["solved"] is True
    assert sol_data["solution_length"] > 0
    assert len(sol_data["move_list"]) == sol_data["solution_length"]

    # Verify solution moves return cube to solved state
    applied = client.post(
        "/api/apply-moves",
        json={"moves": f"{scr_data['scramble_moves']} {sol_data['moves']}"},
    )
    assert applied.status_code == 200
    assert applied.json()["solved"] is True


def test_scan_face_image_upload() -> None:
    colors = ["W", "R", "G", "Y", "O", "B", "W", "R", "G"]
    img = render_synthetic_face(colors)
    ok, buf = cv2.imencode(".png", img)
    assert ok

    res = client.post(
        "/api/scan-face",
        files={"image": ("face.png", buf.tobytes(), "image/png")},
        data={"use_ml": "false"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["face_string"] == "".join(colors)
    assert body["classifier_used"] == "hsv_baseline"
    assert len(body["confidences"]) == 9

