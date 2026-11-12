"""Sticker dataset I/O and controlled synthetic lighting generator."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import numpy as np

from app.cv.colors import VALID_COLORS, StickerFeatures, extract_sticker_features


LIGHTING_CONDITIONS: Tuple[str, ...] = (
    "normal",
    "dim",
    "warm_tungsten",
    "cool_daylight",
    "glare",
)

# Typical BGR base ranges for physical cube stickers under neutral indoor light.
BASE_STICKER_BGR: Dict[str, Tuple[int, int, int]] = {
    "W": (228, 228, 228),
    "R": (28, 30, 200),
    "G": (45, 175, 40),
    "Y": (35, 215, 225),
    "O": (25, 118, 235),
    "B": (195, 70, 28),
}


@dataclass(frozen=True)
class LabeledStickerSample:
    features: StickerFeatures
    label: str
    lighting: str = "normal"


def save_samples_csv(path: str | Path, samples: Sequence[LabeledStickerSample]) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "h_med",
                "s_med",
                "v_med",
                "l_med",
                "a_med",
                "b_med",
                "bgr_b",
                "bgr_g",
                "bgr_r",
                "glare_fraction",
                "lighting",
                "label",
            ]
        )
        for s in samples:
            feat = s.features
            writer.writerow(
                [
                    f"{feat.h_med:.4f}",
                    f"{feat.s_med:.4f}",
                    f"{feat.v_med:.4f}",
                    f"{feat.l_med:.4f}",
                    f"{feat.a_med:.4f}",
                    f"{feat.b_med:.4f}",
                    f"{feat.bgr_med[0]:.4f}",
                    f"{feat.bgr_med[1]:.4f}",
                    f"{feat.bgr_med[2]:.4f}",
                    f"{feat.glare_fraction:.4f}",
                    s.lighting,
                    s.label,
                ]
            )


def load_samples_csv(path: str | Path) -> List[LabeledStickerSample]:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Dataset CSV not found: {p}")

    samples: List[LabeledStickerSample] = []
    with p.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            feat = StickerFeatures(
                h_med=float(row["h_med"]),
                s_med=float(row["s_med"]),
                v_med=float(row["v_med"]),
                l_med=float(row["l_med"]),
                a_med=float(row["a_med"]),
                b_med=float(row["b_med"]),
                bgr_med=(
                    float(row["bgr_b"]),
                    float(row["bgr_g"]),
                    float(row["bgr_r"]),
                ),
                glare_fraction=float(row["glare_fraction"]),
            )
            samples.append(
                LabeledStickerSample(
                    features=feat,
                    label=row["label"].strip().upper(),
                    lighting=row.get("lighting", "normal").strip(),
                )
            )
    return samples


def _render_perturbed_patch(
    base_bgr: Tuple[int, int, int],
    lighting: str,
    rng: np.random.Generator,
    patch_size: int = 24,
) -> np.ndarray:
    # Per-sample sticker tint variation (simulates different cube brands/wear).
    color = np.array(base_bgr, dtype=np.float32) + rng.normal(0.0, 10.0, size=3)

    if lighting == "normal":
        gains = np.array([1.0, 1.0, 1.0], dtype=np.float32) * rng.uniform(0.90, 1.08)
    elif lighting == "dim":
        gains = np.array([1.0, 1.0, 1.0], dtype=np.float32) * rng.uniform(0.32, 0.55)
    elif lighting == "warm_tungsten":
        # Heavy amber/red cast (low B, boosted R/G) that shifts White->Yellow and Orange->Red.
        gains = np.array(
            [rng.uniform(0.55, 0.72), rng.uniform(0.90, 1.04), rng.uniform(1.08, 1.24)],
            dtype=np.float32,
        )
    elif lighting == "cool_daylight":
        # Blue-tinted daylight / LED shift.
        gains = np.array(
            [rng.uniform(1.08, 1.25), rng.uniform(0.96, 1.06), rng.uniform(0.80, 0.94)],
            dtype=np.float32,
        )
    elif lighting == "glare":
        gains = np.array([1.0, 1.0, 1.0], dtype=np.float32) * rng.uniform(0.95, 1.15)
    else:
        raise ValueError(f"Unknown lighting condition: {lighting}")

    lit = color * gains
    patch = np.tile(lit, (patch_size, patch_size, 1))
    patch += rng.normal(0.0, 5.0, size=patch.shape).astype(np.float32)

    if lighting == "glare":
        # Add both specular hotspot and broader haze across part of the sticker.
        haze = rng.uniform(25.0, 65.0)
        patch += haze
        gx = int(rng.integers(2, patch_size // 2))
        gy = int(rng.integers(2, patch_size // 2))
        gw = int(rng.integers(4, patch_size // 2))
        patch[gy : gy + gw, gx : gx + gw] = 254.0

    return np.clip(patch, 0, 255).astype(np.uint8)


def generate_synthetic_lighting_dataset(
    samples_per_cell: int = 50,
    seed: int = 42,
) -> List[LabeledStickerSample]:
    """Generates labeled sticker feature samples across 5 synthetic lighting regimes."""
    rng = np.random.default_rng(seed)
    samples: List[LabeledStickerSample] = []

    for lighting in LIGHTING_CONDITIONS:
        for label in VALID_COLORS:
            base_bgr = BASE_STICKER_BGR[label]
            for _ in range(samples_per_cell):
                patch = _render_perturbed_patch(base_bgr, lighting=lighting, rng=rng)
                feat = extract_sticker_features(patch)
                samples.append(LabeledStickerSample(features=feat, label=label, lighting=lighting))

    return samples

