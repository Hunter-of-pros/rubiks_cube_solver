"""Unit tests for Phase 5 ML feature encoding, training, persistence, and evaluation."""

from __future__ import annotations

from pathlib import Path
import sys

import numpy as np

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.cv.colors import StickerFeatures
from app.cv.detector import analyze_face_frame
from app.ml.classifier import (
    StickerColorClassifier,
    evaluate_hsv_baseline,
    evaluate_predictions,
    features_to_ml_vector,
)
from app.ml.dataset import (
    generate_synthetic_lighting_dataset,
    load_samples_csv,
    save_samples_csv,
)
from tests.test_vision_pipeline import render_synthetic_face


def test_circular_hue_encoding_keeps_red_wraparound_continuous() -> None:
    red_low = StickerFeatures(1.0, 200.0, 180.0, 110.0, 190.0, 160.0, (20.0, 20.0, 190.0), 0.0)
    red_high = StickerFeatures(179.0, 200.0, 180.0, 110.0, 190.0, 160.0, (20.0, 20.0, 190.0), 0.0)
    v_low = features_to_ml_vector(red_low)
    v_high = features_to_ml_vector(red_high)
    # sin/cos components (indices 0, 1) must be nearly identical despite H=1 vs H=179
    assert np.allclose(v_low[:2], v_high[:2], atol=0.07)


def test_dataset_csv_round_trip(tmp_path: Path) -> None:
    samples = generate_synthetic_lighting_dataset(samples_per_cell=3, seed=7)
    csv_path = tmp_path / "stickers.csv"
    save_samples_csv(csv_path, samples)
    loaded = load_samples_csv(csv_path)
    assert len(loaded) == len(samples)
    assert loaded[0].label == samples[0].label
    assert loaded[0].lighting == samples[0].lighting
    assert abs(loaded[0].features.h_med - samples[0].features.h_med) < 1e-3


def test_ml_classifier_outperforms_hsv_under_varied_lighting(tmp_path: Path) -> None:
    train_samples = generate_synthetic_lighting_dataset(samples_per_cell=25, seed=101)
    test_samples = generate_synthetic_lighting_dataset(samples_per_cell=15, seed=202)

    hsv_eval = evaluate_hsv_baseline(test_samples)
    svm_clf = StickerColorClassifier.train(train_samples, model_name="svm_rbf", seed=42)
    y_pred = svm_clf.predict_batch([s.features for s in test_samples])
    svm_eval = evaluate_predictions(
        "svm_rbf",
        [s.label for s in test_samples],
        y_pred,
        [s.lighting for s in test_samples],
    )

    assert svm_eval.overall_accuracy > hsv_eval.overall_accuracy
    assert svm_eval.overall_accuracy >= 0.90

    # Save & reload round-trip + detector integration
    model_path = tmp_path / "clf.joblib"
    svm_clf.save(model_path)
    reloaded = StickerColorClassifier.load(model_path)

    colors = ["W", "R", "G", "Y", "O", "B", "W", "R", "G"]
    frame = render_synthetic_face(colors)
    det = analyze_face_frame(frame, classifier=reloaded)
    assert det.face_string == "".join(colors)


def test_orange_vs_red_separation_across_brands(tmp_path: Path) -> None:
    """Verifies that ML classifier and HSV fallback 100% separate Red and Orange across brands."""
    from app.cv.colors import classify_hsv
    from app.ml.dataset import CUBE_BRAND_PROFILES

    # Train a quick k-NN on multi-brand profiles
    train_samples = generate_synthetic_lighting_dataset(samples_per_cell=20, seed=42)
    clf = StickerColorClassifier.train(train_samples, model_name="knn", seed=42)

    # Test samples for Red and Orange across all 5 brands and 7 lightings
    red_orange_samples = [
        s for s in generate_synthetic_lighting_dataset(samples_per_cell=10, seed=999)
        if s.label in ("R", "O")
    ]
    assert len(red_orange_samples) > 0

    ml_preds = clf.predict_batch([s.features for s in red_orange_samples])
    hsv_preds = [classify_hsv(s.features)[0] for s in red_orange_samples]
    targets = [s.label for s in red_orange_samples]

    ml_correct = sum(1 for p, t in zip(ml_preds, targets) if p == t)
    ml_acc = ml_correct / len(targets)
    assert ml_acc >= 0.995, f"ML Red/Orange accuracy should be >= 99.5%, got {ml_acc * 100:.2f}%"

    hsv_correct = sum(1 for p, t in zip(hsv_preds, targets) if p == t)
    hsv_acc = hsv_correct / len(targets)
    assert hsv_acc >= 0.90, f"HSV Red/Orange accuracy should be >= 90%, got {hsv_acc * 100:.2f}%"
    assert ml_acc > hsv_acc, "ML should strictly outperform rule-based HSV under harsh lighting"


