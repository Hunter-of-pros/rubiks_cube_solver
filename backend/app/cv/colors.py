"""Color feature extraction and HSV baseline sticker classifier."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

import cv2
import numpy as np


VALID_COLORS = ("W", "R", "G", "Y", "O", "B")


@dataclass(frozen=True)
class StickerFeatures:
    h_med: float
    s_med: float
    v_med: float
    l_med: float
    a_med: float
    b_med: float
    bgr_med: Tuple[float, float, float]
    glare_fraction: float

    def to_vector(self) -> np.ndarray:
        """Numeric feature vector reused later by Phase 5 ML classifiers."""
        return np.array(
            [
                self.h_med,
                self.s_med,
                self.v_med,
                self.l_med,
                self.a_med,
                self.b_med,
                self.bgr_med[0],
                self.bgr_med[1],
                self.bgr_med[2],
            ],
            dtype=np.float32,
        )


def extract_sticker_features(bgr_patch: np.ndarray) -> StickerFeatures:
    """Extracts median HSV, CIE LAB, and BGR features, filtering specular glare."""
    if bgr_patch is None or bgr_patch.size == 0 or bgr_patch.ndim != 3:
        raise ValueError("Expected non-empty HxWx3 BGR sticker patch")

    hsv = cv2.cvtColor(bgr_patch, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(bgr_patch, cv2.COLOR_BGR2LAB)

    hsv_flat = hsv.reshape(-1, 3)
    lab_flat = lab.reshape(-1, 3)
    bgr_flat = bgr_patch.reshape(-1, 3)

    # Specular reflections blow out value (V) while washing out saturation (S).
    # Drop them if enough non-glare pixels remain; otherwise keep the full patch
    # (e.g., an actual bright white sticker).
    glare_mask = (hsv_flat[:, 2] >= 248) & (hsv_flat[:, 1] <= 22)
    glare_fraction = float(np.mean(glare_mask))
    keep = ~glare_mask
    if int(np.sum(keep)) >= max(8, int(0.25 * len(hsv_flat))):
        hsv_use = hsv_flat[keep]
        lab_use = lab_flat[keep]
        bgr_use = bgr_flat[keep]
    else:
        hsv_use = hsv_flat
        lab_use = lab_flat
        bgr_use = bgr_flat

    # Hue wraps at 180 in OpenCV; circular mean handles Red around 0/179 cleanly.
    angles = hsv_use[:, 0].astype(np.float64) * (2.0 * np.pi / 180.0)
    mean_angle = np.arctan2(np.mean(np.sin(angles)), np.mean(np.cos(angles)))
    if mean_angle < 0:
        mean_angle += 2.0 * np.pi
    h_circ = float(mean_angle * (180.0 / (2.0 * np.pi)))

    s_med = float(np.median(hsv_use[:, 1]))
    v_med = float(np.median(hsv_use[:, 2]))
    l_med = float(np.median(lab_use[:, 0]))
    a_med = float(np.median(lab_use[:, 1]))
    b_med = float(np.median(lab_use[:, 2]))
    bgr_med_arr = np.median(bgr_use, axis=0)

    return StickerFeatures(
        h_med=h_circ,
        s_med=s_med,
        v_med=v_med,
        l_med=l_med,
        a_med=a_med,
        b_med=b_med,
        bgr_med=(float(bgr_med_arr[0]), float(bgr_med_arr[1]), float(bgr_med_arr[2])),
        glare_fraction=glare_fraction,
    )


def _hue_band_confidence(h: float, center: float, half_width: float) -> float:
    diff = abs(h - center)
    diff = min(diff, 180.0 - diff)
    margin = max(0.0, 1.0 - (diff / half_width) * 0.6)
    return float(np.clip(margin, 0.2, 0.99))


def classify_hsv(features: StickerFeatures) -> Tuple[str, float]:
    """Rule-based HSV baseline color classifier returning (color_code, confidence)."""
    h, s, v = features.h_med, features.s_med, features.v_med

    # Achromatic check first: white stickers have low saturation and decent brightness.
    if s < 55.0 and v > 95.0:
        conf = float(np.clip((55.0 - s) / 55.0 * 0.5 + 0.45, 0.35, 0.99))
        return "W", conf

    # Very dark/shadowed pixels are unreliable.
    if v < 35.0:
        return "W" if s < 55.0 else "B", 0.25

    # OpenCV Hue range is [0, 180).
    # Red wraps around 0/180, Orange sits roughly 6..21, Yellow 21..39, Green 39..86, Blue 86..135.
    if h >= 165.0 or h < 6.0:
        conf = _hue_band_confidence(h, 0.0, 15.0)
        if 4.0 <= h < 6.0:
            conf = min(conf, 0.5)  # Borderline Red/Orange
        return "R", conf
    if h < 21.0:
        conf = _hue_band_confidence(h, 13.0, 8.0)
        if h < 8.0 or h > 19.0:
            conf = min(conf, 0.52)
        return "O", conf
    if h < 39.0:
        conf = _hue_band_confidence(h, 29.0, 9.0)
        return "Y", conf
    if h < 86.0:
        conf = _hue_band_confidence(h, 60.0, 24.0)
        return "G", conf
    if h < 138.0:
        conf = _hue_band_confidence(h, 110.0, 26.0)
        return "B", conf

    # Hue 138..165 (magenta/purple cast on warm red) -> lean Red with lower confidence.
    return "R", 0.4
