"""Cube face contour detection, sticker color sampling, and state assembly."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Mapping, Protocol, Sequence, Tuple

import cv2
import numpy as np

from app.cv.camera import URFDLB_ORDER, compute_cell_rois, compute_guide_box
from app.cv.colors import VALID_COLORS, StickerFeatures, classify_hsv, extract_sticker_features


@dataclass(frozen=True)
class FaceDetectionResult:
    colors: List[str]
    confidences: List[float]
    features: List[StickerFeatures]
    face_box: Tuple[int, int, int]
    used_contour: bool

    @property
    def min_confidence(self) -> float:
        return min(self.confidences) if self.confidences else 0.0

    @property
    def face_string(self) -> str:
        return "".join(self.colors)


def detect_cube_quad(frame: np.ndarray) -> Tuple[int, int, int] | None:
    """Finds a prominent square-ish cube face bounding box (x0, y0, size) if visible."""
    if frame is None or frame.ndim != 3:
        raise ValueError("Expected an HxWxC BGR image")

    h, w = frame.shape[:2]
    frame_area = float(h * w)

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 40, 120)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best_box: Tuple[int, int, int] | None = None
    best_area = 0.0

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 0.04 * frame_area or area > 0.85 * frame_area:
            continue
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.04 * peri, True)
        if len(approx) != 4:
            continue

        bx, by, bw, bh = cv2.boundingRect(approx)
        aspect = bw / float(max(bh, 1))
        if 0.80 <= aspect <= 1.25 and area > best_area:
            size = int((bw + bh) / 2)
            size = max(size - (size % 3), 30)
            cx = bx + bw // 2
            cy = by + bh // 2
            x0 = max(0, min(w - size, cx - size // 2))
            y0 = max(0, min(h - size, cy - size // 2))
            best_box = (x0, y0, size)
            best_area = area

    return best_box


class ColorPredictor(Protocol):
    def predict_one(self, feat: StickerFeatures) -> Tuple[str, float]: ...


def analyze_face_frame(
    frame: np.ndarray,
    box_fraction: float = 0.48,
    use_contour: bool = False,
    classifier: ColorPredictor | None = None,
) -> FaceDetectionResult:
    """Extracts 9 sticker ROIs and classifies their colors (HSV baseline by default)."""
    if frame is None or frame.ndim != 3:
        raise ValueError("Expected an HxWxC BGR image")

    h, w = frame.shape[:2]
    contour_box = detect_cube_quad(frame) if use_contour else None
    used_contour = contour_box is not None
    box = contour_box if contour_box is not None else compute_guide_box(w, h, box_fraction=box_fraction)

    rois = compute_cell_rois(box)
    colors: List[str] = []
    confidences: List[float] = []
    features_list: List[StickerFeatures] = []

    for x1, y1, x2, y2 in rois:
        patch = frame[y1:y2, x1:x2]
        feat = extract_sticker_features(patch)
        if classifier is not None:
            color, conf = classifier.predict_one(feat)
        else:
            color, conf = classify_hsv(feat)
        features_list.append(feat)
        colors.append(color)
        confidences.append(conf)

    return FaceDetectionResult(
        colors=colors,
        confidences=confidences,
        features=features_list,
        face_box=box,
        used_contour=used_contour,
    )


def reconstruct_cube_state(faces: Mapping[str, Sequence[str] | str]) -> str:
    """Assembles scanned face maps into a 54-char URFDLB facelet string."""
    parts: List[str] = []
    for code in URFDLB_ORDER:
        if code not in faces:
            raise ValueError(f"Missing face '{code}' in scanned faces")
        raw = faces[code]
        face_str = "".join(raw) if not isinstance(raw, str) else raw
        face_str = face_str.strip().upper()
        if len(face_str) != 9:
            raise ValueError(f"Face '{code}' must have 9 stickers, got {len(face_str)}")
        for ch in face_str:
            if ch not in VALID_COLORS:
                raise ValueError(f"Invalid sticker color '{ch}' on face '{code}'")
        parts.append(face_str)
    return "".join(parts)

