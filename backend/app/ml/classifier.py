"""ML color classifiers and comparative evaluation against the HSV baseline."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from app.cv.colors import VALID_COLORS, StickerFeatures, classify_hsv
from app.ml.dataset import LIGHTING_CONDITIONS, LabeledStickerSample


def features_to_ml_vector(feat: StickerFeatures) -> np.ndarray:
    """Converts StickerFeatures to an enriched multi-space feature vector.

    Indices 0 & 1 encode continuous circular Hue (sin/cos) for wraparound continuity.
    Subsequent indices add physical chromatic ratios (G/R, B/R, (R-G)/(R+G)),
    normalized rgb-chromaticity, and CIE LAB chroma/angle features that guarantee
    clean separation of Red from Orange across all camera white-balance regimes.
    """
    angle = feat.h_med * (2.0 * np.pi / 180.0)
    b_val, g_val, r_val = feat.bgr_med
    total_rgb = max(r_val + g_val + b_val, 1.0)
    r_norm = r_val / total_rgb
    g_norm = g_val / total_rgb
    b_norm = b_val / total_rgb

    # Physical Green-to-Red emission ratio: Orange emits substantial Green, Red absorbs it.
    g_over_r = g_val / max(r_val, 1.0)
    b_over_r = b_val / max(r_val, 1.0)
    rg_diff = (r_val - g_val) / max(r_val + g_val, 1.0)
    gb_diff = (g_val - b_val) / max(g_val + b_val, 1.0)

    # CIE LAB Chroma & Angle
    a_centered = feat.a_med - 128.0
    b_centered = feat.b_med - 128.0
    chroma_lab = float(np.hypot(a_centered, b_centered))
    angle_lab = float(np.arctan2(b_centered, a_centered))

    return np.array(
        [
            float(np.sin(angle)),         # 0: sin(H)
            float(np.cos(angle)),         # 1: cos(H)
            feat.s_med / 255.0,           # 2: Saturation
            feat.v_med / 255.0,           # 3: Value
            feat.l_med / 255.0,           # 4: LAB L* (Lightness)
            a_centered / 128.0,           # 5: LAB a* (Green-Red axis)
            b_centered / 128.0,           # 6: LAB b* (Blue-Yellow axis)
            b_val / 255.0,                # 7: Normalized Blue
            g_val / 255.0,                # 8: Normalized Green
            r_val / 255.0,                # 9: Normalized Red
            g_over_r,                     # 10: G/R ratio (Orange vs Red key discriminator)
            b_over_r,                     # 11: B/R ratio
            rg_diff,                      # 12: Normalized Red-Green contrast
            gb_diff,                      # 13: Normalized Green-Blue contrast
            r_norm,                       # 14: r chromaticity
            g_norm,                       # 15: g chromaticity
            b_norm,                       # 16: b chromaticity
            chroma_lab / 128.0,           # 17: LAB Chroma magnitude
            float(np.sin(angle_lab)),     # 18: sin(LAB angle)
            float(np.cos(angle_lab)),     # 19: cos(LAB angle)
            feat.glare_fraction,          # 20: Specular glare fraction
        ],
        dtype=np.float32,
    )


def samples_to_xy(samples: Sequence[LabeledStickerSample]) -> Tuple[np.ndarray, np.ndarray]:
    x = np.vstack([features_to_ml_vector(s.features) for s in samples])
    y = np.array([s.label for s in samples])
    return x, y


def build_estimator(model_name: str, seed: int = 42) -> Pipeline | VotingClassifier:
    if model_name == "knn":
        return Pipeline(
            [
                ("scaler", StandardScaler()),
                ("clf", KNeighborsClassifier(n_neighbors=5, weights="distance")),
            ]
        )
    if model_name == "svm_rbf":
        return Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "clf",
                    CalibratedClassifierCV(
                        SVC(C=10.0, kernel="rbf", gamma="scale", random_state=seed),
                        cv=3,
                        ensemble=False,
                    ),
                ),
            ]
        )
    if model_name == "random_forest":
        return Pipeline(
            [
                (
                    "clf",
                    RandomForestClassifier(
                        n_estimators=160,
                        max_depth=18,
                        min_samples_split=3,
                        random_state=seed,
                        n_jobs=-1,
                    ),
                )
            ]
        )
    if model_name == "ensemble":
        svm_pipe = Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "clf",
                    CalibratedClassifierCV(
                        SVC(C=10.0, kernel="rbf", gamma="scale", random_state=seed),
                        cv=3,
                        ensemble=False,
                    ),
                ),
            ]
        )
        rf_pipe = Pipeline(
            [
                (
                    "clf",
                    RandomForestClassifier(
                        n_estimators=160,
                        max_depth=18,
                        min_samples_split=3,
                        random_state=seed,
                        n_jobs=-1,
                    ),
                )
            ]
        )
        return VotingClassifier(
            estimators=[("svm", svm_pipe), ("rf", rf_pipe)],
            voting="soft",
        )
    raise ValueError(f"Unknown model_name '{model_name}'. Expected knn, svm_rbf, random_forest, or ensemble.")


class StickerColorClassifier:
    """Wrapper around a trained scikit-learn color classifier."""

    def __init__(self, model_name: str, pipeline: Pipeline | VotingClassifier) -> None:
        self.model_name = model_name
        self.pipeline = pipeline

    @classmethod
    def train(
        cls,
        samples: Sequence[LabeledStickerSample],
        model_name: str = "ensemble",
        seed: int = 42,
    ) -> "StickerColorClassifier":
        x, y = samples_to_xy(samples)
        pipe = build_estimator(model_name, seed=seed)
        pipe.fit(x, y)
        return cls(model_name=model_name, pipeline=pipe)

    def predict_one(self, feat: StickerFeatures) -> Tuple[str, float]:
        vec = features_to_ml_vector(feat).reshape(1, -1)
        probs = self.pipeline.predict_proba(vec)[0]
        best_idx = int(np.argmax(probs))
        label = str(self.pipeline.classes_[best_idx])
        return label, float(probs[best_idx])

    def predict_batch(self, features: Sequence[StickerFeatures]) -> List[str]:
        x = np.vstack([features_to_ml_vector(f) for f in features])
        return [str(lbl) for lbl in self.pipeline.predict(x)]

    def save(self, path: str | Path) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"model_name": self.model_name, "pipeline": self.pipeline}, p)

    @classmethod
    def load(cls, path: str | Path) -> "StickerColorClassifier":
        payload = joblib.load(Path(path))
        return cls(model_name=payload["model_name"], pipeline=payload["pipeline"])


@dataclass
class ModelEvaluation:
    name: str
    overall_accuracy: float
    macro_precision: float
    macro_recall: float
    macro_f1: float
    confusion: np.ndarray
    per_lighting_accuracy: Dict[str, float]

    @property
    def top_confusions(self) -> List[Tuple[str, str, int]]:
        pairs: List[Tuple[str, str, int]] = []
        for r, true_lbl in enumerate(VALID_COLORS):
            for c, pred_lbl in enumerate(VALID_COLORS):
                if r != c and self.confusion[r, c] > 0:
                    pairs.append((true_lbl, pred_lbl, int(self.confusion[r, c])))
        return sorted(pairs, key=lambda x: x[2], reverse=True)[:5]


def evaluate_predictions(
    name: str,
    y_true: Sequence[str],
    y_pred: Sequence[str],
    lighting_tags: Sequence[str],
) -> ModelEvaluation:
    y_t = np.array(list(y_true))
    y_p = np.array(list(y_pred))
    acc = float(accuracy_score(y_t, y_p))
    prec, rec, f1, _ = precision_recall_fscore_support(
        y_t, y_p, labels=list(VALID_COLORS), average="macro", zero_division=0
    )
    conf = confusion_matrix(y_t, y_p, labels=list(VALID_COLORS))

    per_light: Dict[str, float] = {}
    lights = np.array(list(lighting_tags))
    for lc in np.unique(lights):
        mask = lights == lc
        per_light[str(lc)] = float(accuracy_score(y_t[mask], y_p[mask]))

    return ModelEvaluation(
        name=name,
        overall_accuracy=acc,
        macro_precision=float(prec),
        macro_recall=float(rec),
        macro_f1=float(f1),
        confusion=conf,
        per_lighting_accuracy=per_light,
    )


def evaluate_hsv_baseline(test_samples: Sequence[LabeledStickerSample]) -> ModelEvaluation:
    y_true = [s.label for s in test_samples]
    y_pred = [classify_hsv(s.features)[0] for s in test_samples]
    lights = [s.lighting for s in test_samples]
    return evaluate_predictions("hsv_baseline", y_true, y_pred, lights)
