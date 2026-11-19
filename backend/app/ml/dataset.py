"""Sticker dataset I/O and controlled synthetic lighting generator across 3x3 cube brands."""

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
    "awb_shift",
    "harsh_sunlight",
)

# Realistic physical color profiles for major 3x3 Rubik's cube types:
CUBE_BRAND_PROFILES: Dict[str, Dict[str, Tuple[int, int, int]]] = {
    # 1. Modern Frosted Stickerless Speedcube (GAN 356 M / MoYu RS3M):
    # Fluorescent orange with high green component, deep ruby crimson red.
    "gan_moyu_frosted": {
        "W": (240, 242, 245),
        "R": (20, 25, 215),
        "G": (40, 185, 30),
        "Y": (25, 225, 245),
        "O": (15, 100, 248),
        "B": (210, 85, 20),
    },
    # 2. Official Rubik's Brand (Classic Glossy Vinyl Stickered Cube):
    # Deep crimson red, warm pumpkin orange.
    "rubiks_brand_vinyl": {
        "W": (228, 228, 228),
        "R": (35, 30, 185),
        "G": (48, 165, 35),
        "Y": (30, 210, 220),
        "O": (25, 115, 230),
        "B": (185, 65, 25),
    },
    # 3. QiYi Warrior / Cyclone Boys (Matte Plastic Speedcube):
    "qiyi_cyclone_matte": {
        "W": (232, 232, 235),
        "R": (25, 32, 210),
        "G": (45, 175, 38),
        "Y": (35, 215, 230),
        "O": (20, 110, 240),
        "B": (200, 75, 25),
    },
    # 4. DaYan / Meilong / Monster Go (Vibrant Pastel Speedcube):
    "dayan_meilong_vibrant": {
        "W": (235, 238, 240),
        "R": (22, 28, 205),
        "G": (42, 180, 45),
        "Y": (32, 220, 235),
        "O": (18, 120, 242),
        "B": (195, 78, 22),
    },
    # 5. Worn / Scratched Physical Cube (Slight surface scatter and pigment aging):
    "worn_scratched_cube": {
        "W": (220, 222, 224),
        "R": (28, 38, 195),
        "G": (48, 168, 42),
        "Y": (38, 205, 218),
        "O": (24, 112, 228),
        "B": (188, 72, 32),
    },
}

# Backward compatibility alias for single-brand baseline
BASE_STICKER_BGR: Dict[str, Tuple[int, int, int]] = CUBE_BRAND_PROFILES["rubiks_brand_vinyl"]


@dataclass(frozen=True)
class LabeledStickerSample:
    features: StickerFeatures
    label: str
    lighting: str = "normal"
    brand: str = "rubiks_brand_vinyl"


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
                "brand",
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
                    s.brand,
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
                    brand=row.get("brand", "rubiks_brand_vinyl").strip(),
                )
            )
    return samples


def _render_perturbed_patch(
    base_bgr: Tuple[int, int, int],
    lighting: str,
    rng: np.random.Generator,
    patch_size: int = 24,
) -> np.ndarray:
    # Jitter base color to simulate realistic plastic and manufacturing tolerances
    color = np.array(base_bgr, dtype=np.float32) + rng.normal(0.0, 7.0, size=3)

    if lighting == "normal":
        gains = np.array([1.0, 1.0, 1.0], dtype=np.float32) * rng.uniform(0.92, 1.06)
    elif lighting == "dim":
        gains = np.array([1.0, 1.0, 1.0], dtype=np.float32) * rng.uniform(0.35, 0.58)
    elif lighting == "warm_tungsten":
        # Amber/warm indoor lighting (boosts red/green, suppresses blue)
        gains = np.array(
            [rng.uniform(0.58, 0.74), rng.uniform(0.92, 1.05), rng.uniform(1.08, 1.25)],
            dtype=np.float32,
        )
    elif lighting == "cool_daylight":
        # Blue-tinted LED / overcast daylight
        gains = np.array(
            [rng.uniform(1.08, 1.26), rng.uniform(0.96, 1.06), rng.uniform(0.80, 0.94)],
            dtype=np.float32,
        )
    elif lighting == "glare":
        gains = np.array([1.0, 1.0, 1.0], dtype=np.float32) * rng.uniform(0.95, 1.15)
    elif lighting == "awb_shift":
        # Camera auto-white balance shifts red gain down when red/orange dominates frame
        gains = np.array(
            [rng.uniform(0.95, 1.10), rng.uniform(0.95, 1.12), rng.uniform(0.82, 0.96)],
            dtype=np.float32,
        )
    elif lighting == "harsh_sunlight":
        # High dynamic range with intense direct illumination
        gains = np.array([1.0, 1.0, 1.0], dtype=np.float32) * rng.uniform(1.15, 1.35)
    else:
        raise ValueError(f"Unknown lighting condition: {lighting}")

    lit = color * gains
    patch = np.tile(lit, (patch_size, patch_size, 1))
    patch += rng.normal(0.0, 4.0, size=patch.shape).astype(np.float32)

    if lighting == "glare":
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
    brands: Sequence[str] | None = None,
) -> List[LabeledStickerSample]:
    """Generates labeled sticker feature samples across multiple cube brands and lighting conditions."""
    rng = np.random.default_rng(seed)
    samples: List[LabeledStickerSample] = []
    selected_brands = brands if brands is not None else list(CUBE_BRAND_PROFILES.keys())

    for brand in selected_brands:
        brand_colors = CUBE_BRAND_PROFILES.get(brand, BASE_STICKER_BGR)
        for lighting in LIGHTING_CONDITIONS:
            for label in VALID_COLORS:
                base_bgr = brand_colors[label]
                for _ in range(samples_per_cell):
                    patch = _render_perturbed_patch(base_bgr, lighting=lighting, rng=rng)
                    feat = extract_sticker_features(patch)
                    samples.append(
                        LabeledStickerSample(
                            features=feat,
                            label=label,
                            lighting=lighting,
                            brand=brand,
                        )
                    )

    return samples
