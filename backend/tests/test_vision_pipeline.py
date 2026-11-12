"""Unit and integration tests for sticker detection, HSV classification, and C++ solve."""

from __future__ import annotations

from pathlib import Path
import subprocess
import sys
from typing import Dict, List

import cv2
import numpy as np
import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.cv.camera import URFDLB_ORDER, compute_guide_box
from app.cv.colors import classify_hsv, extract_sticker_features
from app.cv.detector import analyze_face_frame, reconstruct_cube_state
from app.services.solver_bridge import DEFAULT_SOLVER_BIN, solve_facelets


SYNTHETIC_BGR: Dict[str, tuple[int, int, int]] = {
    "W": (240, 240, 240),
    "R": (20, 20, 210),
    "G": (35, 185, 35),
    "Y": (20, 225, 235),
    "O": (20, 125, 245),
    "B": (215, 70, 25),
}


def render_synthetic_face(
    colors: List[str],
    width: int = 640,
    height: int = 480,
    offset: tuple[int, int] = (0, 0),
    add_glare_on_cell0: bool = False,
) -> np.ndarray:
    """Renders a 3x3 face image matching compute_guide_box (plus optional offset/glare)."""
    img = np.full((height, width, 3), 30, dtype=np.uint8)
    x0, y0, size = compute_guide_box(width, height, box_fraction=0.48)
    x0 += offset[0]
    y0 += offset[1]
    step = size // 3

    # Dark cube body background
    cv2.rectangle(img, (x0 - 6, y0 - 6), (x0 + size + 6, y0 + size + 6), (15, 15, 15), -1)

    for idx, code in enumerate(colors):
        r, c = divmod(idx, 3)
        cx1 = x0 + c * step + 4
        cy1 = y0 + r * step + 4
        cx2 = x0 + (c + 1) * step - 4
        cy2 = y0 + (r + 1) * step - 4
        cv2.rectangle(img, (cx1, cy1), (cx2, cy2), SYNTHETIC_BGR[code], -1)

    if add_glare_on_cell0:
        # Bright specular highlight over ~20% of cell 0
        gx1, gy1 = x0 + 18, y0 + 18
        cv2.rectangle(img, (gx1, gy1), (gx1 + step // 3, gy1 + step // 3), (255, 255, 255), -1)

    return img


def test_hsv_classifies_all_six_colors() -> None:
    colors = ["W", "R", "G", "Y", "O", "B", "W", "R", "G"]
    frame = render_synthetic_face(colors)
    res = analyze_face_frame(frame)
    assert res.face_string == "".join(colors)
    assert res.min_confidence >= 0.7


def test_glare_filtering_preserves_colored_sticker() -> None:
    colors = ["B", "R", "O", "Y", "G", "W", "B", "R", "O"]
    frame = render_synthetic_face(colors, add_glare_on_cell0=True)
    res = analyze_face_frame(frame)
    assert res.colors[0] == "B"
    assert res.features[0].glare_fraction > 0.05


def test_contour_detection_finds_off_center_cube_face() -> None:
    colors = ["R", "G", "B", "Y", "O", "W", "G", "B", "R"]
    # High-contrast light background so contour detection isolates the dark cube quad
    frame = render_synthetic_face(colors, offset=(80, -40))
    frame[frame[:, :, 0] == 30] = (200, 200, 200)
    res = analyze_face_frame(frame, use_contour=True)
    assert res.used_contour is True
    assert res.face_string == "".join(colors)


def test_reconstruct_cube_state_validation() -> None:
    color_by_face = {"U": "W", "R": "R", "F": "G", "D": "Y", "L": "O", "B": "B"}
    faces = {code: color_by_face[code] * 9 for code in URFDLB_ORDER}
    assert reconstruct_cube_state(faces) == (
        "WWWWWWWWWRRRRRRRRRGGGGGGGGGYYYYYYYYYOOOOOOOOOBBBBBBBBB"
    )

    with pytest.raises(ValueError):
        reconstruct_cube_state({"U": "WWWWWWWWW"})

    with pytest.raises(ValueError):
        reconstruct_cube_state({**faces, "U": "UUUUUUUUU"})


def test_end_to_end_synthetic_scan_to_cpp_solver() -> None:
    if not DEFAULT_SOLVER_BIN.exists():
        pytest.skip("C++ rubik_solver binary not built")

    # Apply a known scramble on a solved facelet string using C++ logic or known state:
    # Single 'U' turn rotates F,L,B,R top rows while keeping centers intact.
    u_face = "WWWWWWWWW"
    r_face = "BBBRRRRRR"
    f_face = "RRRGGGGGG"
    d_face = "YYYYYYYYY"
    l_face = "GGGOOOOOO"
    b_face = "OOOBBBBBB"

    scanned = {}
    for code, face_str in zip(URFDLB_ORDER, [u_face, r_face, f_face, d_face, l_face, b_face]):
        frame = render_synthetic_face(list(face_str))
        scanned[code] = analyze_face_frame(frame).colors

    facelets = reconstruct_cube_state(scanned)
    res = solve_facelets(facelets, algorithm="kociemba")
    assert res.valid is True
    assert res.solved is True
    assert res.solution_length == 1
    assert res.moves == "U'"
