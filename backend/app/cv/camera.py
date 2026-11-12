"""Webcam capture, image loading, and 3x3 scan-guide geometry."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import cv2
import numpy as np


@dataclass(frozen=True)
class FacePrompt:
    code: str
    name: str
    center_color: str
    orientation_hint: str
    # Neighbor center colors from the RAW camera perspective (used for edge bars).
    top_color: str
    bottom_color: str
    camera_left_color: str
    camera_right_color: str


# Matches the C++ URFDLB face ordering and row-major 0..8 sticker indexing.
FACE_PROMPTS: Dict[str, FacePrompt] = {
    "F": FacePrompt(
        "F",
        "Front",
        "G",
        "Show GREEN center | White on TOP | Turn from solved front",
        top_color="W",
        bottom_color="Y",
        camera_left_color="O",
        camera_right_color="R",
    ),
    "R": FacePrompt(
        "R",
        "Right",
        "R",
        "Turn cube 90 deg LEFT to show RED center | White on TOP",
        top_color="W",
        bottom_color="Y",
        camera_left_color="G",
        camera_right_color="B",
    ),
    "B": FacePrompt(
        "B",
        "Back",
        "B",
        "Turn cube 90 deg LEFT again to show BLUE center | White on TOP",
        top_color="W",
        bottom_color="Y",
        camera_left_color="R",
        camera_right_color="O",
    ),
    "L": FacePrompt(
        "L",
        "Left",
        "O",
        "Turn cube 90 deg LEFT again to show ORANGE center | White on TOP",
        top_color="W",
        bottom_color="Y",
        camera_left_color="B",
        camera_right_color="G",
    ),
    "U": FacePrompt(
        "U",
        "Up",
        "W",
        "From Green front, tilt TOP toward camera for WHITE | Green on BOTTOM",
        top_color="B",
        bottom_color="G",
        camera_left_color="O",
        camera_right_color="R",
    ),
    "D": FacePrompt(
        "D",
        "Down",
        "Y",
        "From Green front, tilt BOTTOM toward camera for YELLOW | Green on TOP",
        top_color="G",
        bottom_color="B",
        camera_left_color="O",
        camera_right_color="R",
    ),
}

# Canonical C++ state order, plus a natural physical hand-turn scan order.
URFDLB_ORDER: Tuple[str, ...] = ("U", "R", "F", "D", "L", "B")
NATURAL_SCAN_ORDER: Tuple[FacePrompt, ...] = tuple(
    FACE_PROMPTS[code] for code in ("F", "R", "B", "L", "U", "D")
)
FACE_SCAN_ORDER: Tuple[FacePrompt, ...] = tuple(FACE_PROMPTS[code] for code in URFDLB_ORDER)

PREVIEW_BGR: Dict[str, Tuple[int, int, int]] = {
    "W": (245, 245, 245),
    "R": (30, 30, 220),
    "G": (40, 180, 40),
    "Y": (30, 225, 235),
    "O": (20, 130, 245),
    "B": (210, 80, 30),
}


def compute_guide_box(
    frame_width: int,
    frame_height: int,
    box_fraction: float = 0.48,
) -> Tuple[int, int, int]:
    """Returns (x0, y0, size) for a centered square 3x3 alignment box."""
    if frame_width <= 0 or frame_height <= 0:
        raise ValueError("Frame dimensions must be positive")
    if not (0.1 <= box_fraction <= 0.95):
        raise ValueError("box_fraction must be between 0.1 and 0.95")

    size = int(min(frame_width, frame_height) * box_fraction)
    size = max(size - (size % 3), 30)  # Keep divisible by 3 for crisp grid cells.
    x0 = (frame_width - size) // 2
    y0 = (frame_height - size) // 2
    return x0, y0, size


def compute_cell_rois(
    guide_box: Tuple[int, int, int],
    inner_margin: float = 0.22,
) -> List[Tuple[int, int, int, int]]:
    """Returns 9 row-major (x1, y1, x2, y2) sticker sampling ROIs inside guide_box.

    Skipping an outer margin inside each cell avoids dark cube bezels and
    rounded stickerless corners when sampling colors.
    """
    if not (0.0 <= inner_margin < 0.45):
        raise ValueError("inner_margin must be in [0.0, 0.45)")

    x0, y0, size = guide_box
    cell = size / 3.0
    pad = cell * inner_margin

    rois: List[Tuple[int, int, int, int]] = []
    for row in range(3):
        for col in range(3):
            cx1 = x0 + col * cell
            cy1 = y0 + row * cell
            x1 = int(round(cx1 + pad))
            y1 = int(round(cy1 + pad))
            x2 = int(round(cx1 + cell - pad))
            y2 = int(round(cy1 + cell - pad))
            rois.append((x1, y1, max(x1 + 1, x2), max(y1 + 1, y2)))
    return rois


def _draw_neighbor_bars(
    canvas: np.ndarray,
    box: Tuple[int, int, int],
    prompt: FacePrompt,
    mirrored: bool,
) -> None:
    x0, y0, size = box
    bar = 12
    gap = 8
    left_code = prompt.camera_right_color if mirrored else prompt.camera_left_color
    right_code = prompt.camera_left_color if mirrored else prompt.camera_right_color

    cv2.rectangle(canvas, (x0, y0 - gap - bar), (x0 + size, y0 - gap), PREVIEW_BGR[prompt.top_color], -1)
    cv2.rectangle(canvas, (x0, y0 + size + gap), (x0 + size, y0 + size + gap + bar), PREVIEW_BGR[prompt.bottom_color], -1)
    cv2.rectangle(canvas, (x0 - gap - bar, y0), (x0 - gap, y0 + size), PREVIEW_BGR[left_code], -1)
    cv2.rectangle(canvas, (x0 + size + gap, y0), (x0 + size + gap + bar, y0 + size), PREVIEW_BGR[right_code], -1)


def draw_scan_overlay(
    frame: np.ndarray,
    face_prompt: FacePrompt | None = None,
    status_text: str | None = None,
    box_fraction: float = 0.48,
    mirror_preview: bool = False,
    predicted_colors: Sequence[str] | None = None,
    confidences: Sequence[float] | None = None,
) -> np.ndarray:
    """Draws the 3x3 alignment grid, neighbor bars, and live predictions."""
    if frame is None or frame.ndim != 3:
        raise ValueError("Expected an HxWxC BGR image")

    out = cv2.flip(frame, 1) if mirror_preview else frame.copy()
    h, w = out.shape[:2]
    x0, y0, size = compute_guide_box(w, h, box_fraction=box_fraction)
    step = size // 3

    # Outer square and 3x3 divider lines
    cv2.rectangle(out, (x0, y0), (x0 + size, y0 + size), (0, 255, 180), 2)
    for k in (1, 2):
        cv2.line(out, (x0 + k * step, y0), (x0 + k * step, y0 + size), (0, 255, 180), 1)
        cv2.line(out, (x0, y0 + k * step), (x0 + size, y0 + k * step), (0, 255, 180), 1)

    rois = compute_cell_rois((x0, y0, size))
    for idx, (x1, y1, x2, y2) in enumerate(rois):
        # When preview is mirrored, flip column index 0<->2 so badges align visually
        # with the mirrored image while raw sampling stays un-mirrored.
        src_idx = (idx // 3) * 3 + (2 - (idx % 3)) if mirror_preview else idx
        border_color = (255, 220, 60)
        if confidences is not None and confidences[src_idx] < 0.55:
            border_color = (0, 120, 255)
        cv2.rectangle(out, (x1, y1), (x2, y2), border_color, 1)

        if predicted_colors is not None:
            code = predicted_colors[src_idx]
            bgr = PREVIEW_BGR.get(code, (180, 180, 180))
            cv2.rectangle(out, (x1, y1), (x1 + 22, y1 + 22), bgr, -1)
            cv2.putText(out, code, (x1 + 4, y1 + 17), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 0, 0), 2)

    if face_prompt is not None:
        _draw_neighbor_bars(out, (x0, y0, size), face_prompt, mirrored=mirror_preview)
        header = f"Face {face_prompt.code} ({face_prompt.name} - {face_prompt.center_color} center)"
        cv2.putText(out, header, (20, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.78, (255, 255, 255), 2)
        cv2.putText(
            out,
            face_prompt.orientation_hint,
            (20, 62),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (210, 240, 255),
            1,
        )

    footer = status_text or "Auto-scans when steady | SPACE: lock | R: redo | Q: quit"
    cv2.putText(out, footer, (20, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (230, 230, 230), 1)
    return out


def load_image(path: str | Path) -> np.ndarray:
    """Loads a BGR image from disk or raises FileNotFoundError/ValueError."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Image not found: {p}")
    img = cv2.imread(str(p), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Could not decode image: {p}")
    return img


class CameraCapture:
    """Thin wrapper around cv2.VideoCapture with clean resource cleanup."""

    def __init__(self, device_index: int = 0, width: int = 1280, height: int = 720) -> None:
        self.device_index = device_index
        self.width = width
        self.height = height
        self._cap: cv2.VideoCapture | None = None

    def open(self) -> None:
        cap = cv2.VideoCapture(self.device_index)
        if not cap.isOpened():
            cap.release()
            raise RuntimeError(
                f"Unable to open camera index {self.device_index}. "
                "Check macOS camera permissions for Terminal/VS Code."
            )
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        self._cap = cap

    def read_frame(self) -> np.ndarray:
        if self._cap is None or not self._cap.isOpened():
            raise RuntimeError("Camera is not open")
        ok, frame = self._cap.read()
        if not ok or frame is None:
            raise RuntimeError("Failed to read frame from camera")
        return frame

    def release(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    def __enter__(self) -> "CameraCapture":
        self.open()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.release()
