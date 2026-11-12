"""Unit tests for webcam capture geometry, overlay drawing, and image loading."""

from __future__ import annotations

from pathlib import Path
import sys

import cv2
import numpy as np
import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.cv.camera import (
    FACE_SCAN_ORDER,
    CameraCapture,
    compute_cell_rois,
    compute_guide_box,
    draw_scan_overlay,
    load_image,
)


def test_face_scan_order_matches_urfdlb() -> None:
    assert tuple(p.code for p in FACE_SCAN_ORDER) == ("U", "R", "F", "D", "L", "B")


def test_compute_guide_box_and_cell_rois() -> None:
    x0, y0, size = compute_guide_box(1280, 720, box_fraction=0.5)
    assert size % 3 == 0
    assert 0 <= x0 and x0 + size <= 1280
    assert 0 <= y0 and y0 + size <= 720

    rois = compute_cell_rois((x0, y0, size), inner_margin=0.2)
    assert len(rois) == 9

    for x1, y1, x2, y2 in rois:
        assert x0 <= x1 < x2 <= x0 + size
        assert y0 <= y1 < y2 <= y0 + size

    # Row-major check: cell 0 is left of cell 1, cell 0 is above cell 3.
    assert rois[0][2] < rois[1][0]
    assert rois[0][3] < rois[3][1]


def test_compute_guide_box_rejects_bad_inputs() -> None:
    with pytest.raises(ValueError):
        compute_guide_box(0, 720)
    with pytest.raises(ValueError):
        compute_guide_box(640, 480, box_fraction=0.05)
    with pytest.raises(ValueError):
        compute_cell_rois((0, 0, 90), inner_margin=0.5)


def test_draw_scan_overlay_does_not_mutate_input() -> None:
    blank = np.zeros((480, 640, 3), dtype=np.uint8)
    rendered = draw_scan_overlay(blank, face_prompt=FACE_SCAN_ORDER[0])
    assert rendered.shape == blank.shape
    assert rendered.dtype == blank.dtype
    assert np.all(blank == 0)
    assert np.any(rendered > 0)


def test_load_image_round_trip_and_missing_file(tmp_path: Path) -> None:
    img = np.full((60, 80, 3), 123, dtype=np.uint8)
    path = tmp_path / "sample.png"
    assert cv2.imwrite(str(path), img)

    loaded = load_image(path)
    assert loaded.shape == (60, 80, 3)
    assert np.array_equal(loaded, img)

    with pytest.raises(FileNotFoundError):
        load_image(tmp_path / "does_not_exist.png")


def test_camera_read_before_open_raises() -> None:
    cam = CameraCapture(device_index=0)
    with pytest.raises(RuntimeError):
        cam.read_frame()

