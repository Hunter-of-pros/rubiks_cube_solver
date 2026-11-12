"""ML color classifiers and comparative evaluation against the HSV baseline."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from app.cv.colors import VALID_COLORS, StickerFeatures, classify_hsv
from app.ml.dataset import LIGHTING_CONDITIONS, LabeledStickerSample


def features_to_ml_vector(feat: StickerFeatures) -> np.ndarray:
    """Converts StickerFeatures to an 11-D vector with continuous circular Hue.

    OpenCV Hue wraps at 0/180 (Red sits at both ends), so encoding sin/cos of
    Hue avoids splitting Red across opposite sides of feature space.
    """
    angle = feat.h_med * (2.0 * np.pi / 180.0)
    return np.array(
        [
            float(np.sin(angle)),
            float(np.cos(angle)),
            feat.s_med,
            feat.v_med,
            feat.l_med,
            feat.a_med,
            feat.b_med,
            feat.bgr_med[0],
            feat.bgr_med[1],
            feat.bgr_med[2],
            feat.glare_fraction,
        ],
        dtype=np.float32,
    )


def samples_to_xy(samples: Sequence[LabeledStickerSample]) -> Tuple[np.ndarray, np.ndarray]:
    x = np.vstack([features_to_ml_vector(s.features) for s in samples])
    y = np.array([s.label for s in samples])
    return x, y


def build_estimator(model_name: str, seed: int = 42) -> Pipeline:
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
                        SVC(C=3.0, kernel="rbf", random_state=seed),
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
                        n_estimators=120,
                        random_state=seed,
                        n_jobs=-1,
                    ),
                )
            ]
        )
    raise ValueError(f"Unknown model_name '{model_name}'. Expected knn, svm_rbf, or random_forest.")


class StickerColorClassifier:
    """Wrapper around a trained scikit-learn color classifier."""

    def __init__(self, model_name: str, pipeline: Pipeline) -> None:
        self.model_name = model_name
        self.pipeline = pipeline

    @classmethod
    def train(
        cls,
        samples: Sequence[LabeledStickerSample],
        model_name: str = "svm_rbf",
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


@dataclass(frozen=True)
class ModelEvaluation:
    name: str
    overall_accuracy: float
    macro_precision: float
    macro_recall: float
    per_color_precision: Dict[str, float]
    per_color_recall: Dict[str, float]
    per_lighting_accuracy: Dict[str, float]
    confusion: np.ndarray
    top_confusions: List[Tuple[str, str, int]]


def evaluate_predictions(
    name: str,
    y_true: Sequence[str],
    y_pred: Sequence[str],
    lightings: Sequence[str],
) -> ModelEvaluation:
    acc = float(accuracy_score(y_true, y_pred))
    prec, rec, _, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=list(VALID_COLORS), zero_division=0
    )
    cm = confusion_matrix(y_true, y_pred, labels=list(VALID_COLORS))

    per_color_prec = {c: float(p) for c, p in zip(VALID_COLORS, prec)}
    per_color_rec = {c: float(r) for c, r in zip(VALID_COLORS, rec)}

    per_lighting: Dict[str, float] = {}
    unique_lightings = [lc for lc in LIGHTING_CONDITIONS if lc in lightings]
    for lc in unique_lightings:
        mask = [i for i, val in enumerate(lightings) if val == lc]
        yt = [y_true[i] for i in mask]
        yp = [y_pred[i] for i in mask]
        per_lighting[lc] = float(accuracy_score(yt, yp))

    confusions: List[Tuple[str, str, int]] = []
    for i, t_lbl in enumerate(VALID_COLORS):
        for j, p_lbl in enumerate(VALID_COLORS):
            if i != j and cm[i, j] > 0:
                confusions.append((t_lbl, p_lbl, int(cm[i, j])))
    confusions.sort(key=lambda item: item[2], reverse=True)

    return ModelEvaluation(
        name=name,
        overall_accuracy=acc,
        macro_precision=float(np.mean(prec)),
        macro_recall=float(np.mean(rec)),
        per_color_precision=per_color_prec,
        per_color_recall=per_color_rec,
        per_lighting_accuracy=per_lighting,
        confusion=cm,
        top_confusions=confusions[:5],
    )


def evaluate_hsv_baseline(samples: Sequence[LabeledStickerSample]) -> ModelEvaluation:
    y_true = [s.label for s in samples]
    y_pred = [classify_hsv(s.features)[0] for s in samples]
    lightings = [s.lighting for s in samples]
    return evaluate_predictions("hsv_baseline", y_true, y_pred, lightings)

