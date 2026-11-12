"""Trains and compares HSV baseline vs. ML color classifiers across lighting conditions."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
import sys
from typing import List

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from sklearn.model_selection import StratifiedShuffleSplit

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.cv.colors import VALID_COLORS
from app.ml.classifier import (
    ModelEvaluation,
    StickerColorClassifier,
    evaluate_hsv_baseline,
    evaluate_predictions,
)
from app.ml.dataset import (
    LIGHTING_CONDITIONS,
    LabeledStickerSample,
    generate_synthetic_lighting_dataset,
    load_samples_csv,
)


def _stratified_split(
    samples: List[LabeledStickerSample],
    test_size: float = 0.30,
    seed: int = 42,
) -> tuple[List[LabeledStickerSample], List[LabeledStickerSample]]:
    strata = [f"{s.lighting}:{s.label}" for s in samples]
    splitter = StratifiedShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
    train_idx, test_idx = next(splitter.split(np.zeros(len(samples)), strata))
    return [samples[i] for i in train_idx], [samples[i] for i in test_idx]


def _plot_results(
    evals: List[ModelEvaluation],
    best_eval: ModelEvaluation,
    hsv_eval: ModelEvaluation,
    out_path: Path,
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig, axes = plt.subplots(1, 3, figsize=(16, 4.8))

    # 1. Accuracy by lighting condition
    lightings = [lc for lc in LIGHTING_CONDITIONS if lc in hsv_eval.per_lighting_accuracy]
    x = np.arange(len(lightings))
    width = 0.8 / max(1, len(evals))
    for i, ev in enumerate(evals):
        vals = [ev.per_lighting_accuracy.get(lc, 0.0) * 100.0 for lc in lightings]
        axes[0].bar(x + i * width, vals, width=width, label=ev.name)
    axes[0].set_xticks(x + width * (len(evals) - 1) / 2.0)
    axes[0].set_xticklabels([lc.replace("_", "\n") for lc in lightings], fontsize=8.5)
    axes[0].set_ylim(0, 105)
    axes[0].set_ylabel("Accuracy (%)")
    axes[0].set_title("Accuracy by Lighting Condition")
    axes[0].legend(fontsize=8)

    # 2 & 3. Confusion matrices (HSV vs best ML)
    for ax, ev, title in [
        (axes[1], hsv_eval, f"HSV Baseline ({hsv_eval.overall_accuracy * 100:.1f}%)"),
        (axes[2], best_eval, f"{best_eval.name} ({best_eval.overall_accuracy * 100:.1f}%)"),
    ]:
        im = ax.imshow(ev.confusion, cmap="Blues")
        ax.set_xticks(range(len(VALID_COLORS)))
        ax.set_yticks(range(len(VALID_COLORS)))
        ax.set_xticklabels(VALID_COLORS)
        ax.set_yticklabels(VALID_COLORS)
        ax.set_xlabel("Predicted")
        ax.set_ylabel("True")
        ax.set_title(title)
        thresh = ev.confusion.max() / 2.0 if ev.confusion.size else 0
        for r in range(len(VALID_COLORS)):
            for c in range(len(VALID_COLORS)):
                val = int(ev.confusion[r, c])
                ax.text(
                    c,
                    r,
                    str(val),
                    ha="center",
                    va="center",
                    color="white" if val > thresh else "black",
                    fontsize=8.5,
                )
        fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate HSV baseline vs ML classifiers.")
    parser.add_argument("--dataset", type=Path, default=None, help="Optional real CSV dataset")
    parser.add_argument("--samples-per-cell", type=int, default=60)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--out-csv",
        type=Path,
        default=Path("experiments/vision_benchmarks/color_model_comparison.csv"),
    )
    parser.add_argument(
        "--out-plot",
        type=Path,
        default=Path("experiments/vision_benchmarks/hsv_vs_ml_lighting.png"),
    )
    parser.add_argument(
        "--save-model",
        type=Path,
        default=Path("backend/models/color_classifier.joblib"),
    )
    args = parser.parse_args()

    if args.dataset is not None:
        samples = load_samples_csv(args.dataset)
        source_desc = f"real dataset ({args.dataset})"
    else:
        samples = generate_synthetic_lighting_dataset(
            samples_per_cell=args.samples_per_cell,
            seed=args.seed,
        )
        source_desc = (
            f"synthetic lighting benchmark (seed={args.seed}, "
            f"{args.samples_per_cell} samples/color/lighting, total={len(samples)})"
        )

    train_samples, test_samples = _stratified_split(samples, test_size=0.30, seed=args.seed)
    print(f"Dataset: {source_desc}")
    print(f"Split: train={len(train_samples)}, test={len(test_samples)}\n")

    hsv_eval = evaluate_hsv_baseline(test_samples)
    evals: List[ModelEvaluation] = [hsv_eval]
    trained_models: dict[str, StickerColorClassifier] = {}

    y_test = [s.label for s in test_samples]
    test_lightings = [s.lighting for s in test_samples]
    test_features = [s.features for s in test_samples]

    for model_name in ("knn", "svm_rbf", "random_forest"):
        clf = StickerColorClassifier.train(train_samples, model_name=model_name, seed=args.seed)
        y_pred = clf.predict_batch(test_features)
        ev = evaluate_predictions(model_name, y_test, y_pred, test_lightings)
        evals.append(ev)
        trained_models[model_name] = clf

    # Print formatted summary
    for ev in evals:
        lighting_str = ", ".join(
            f"{k}={v * 100:.1f}%" for k, v in ev.per_lighting_accuracy.items()
        )
        print(
            f"{ev.name:14s} | acc={ev.overall_accuracy * 100:5.2f}% "
            f"| macro_P={ev.macro_precision * 100:5.2f}% "
            f"| macro_R={ev.macro_recall * 100:5.2f}% | {lighting_str}"
        )
        if ev.top_confusions:
            err_str = ", ".join(f"{t}->{p}:{cnt}" for t, p, cnt in ev.top_confusions)
            print(f"  top errors: {err_str}")

    best_ml_eval = max(evals[1:], key=lambda e: e.overall_accuracy)
    trained_models[best_ml_eval.name].save(args.save_model)
    print(f"\nSaved best ML classifier ({best_ml_eval.name}) to {args.save_model}")

    # Export metrics CSV
    args.out_csv.parent.mkdir(parents=True, exist_ok=True)
    with args.out_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        lighting_cols = [lc for lc in LIGHTING_CONDITIONS if lc in hsv_eval.per_lighting_accuracy]
        writer.writerow(
            ["model", "overall_accuracy", "macro_precision", "macro_recall"]
            + [f"acc_{lc}" for lc in lighting_cols]
        )
        for ev in evals:
            writer.writerow(
                [
                    ev.name,
                    f"{ev.overall_accuracy:.4f}",
                    f"{ev.macro_precision:.4f}",
                    f"{ev.macro_recall:.4f}",
                ]
                + [f"{ev.per_lighting_accuracy.get(lc, 0.0):.4f}" for lc in lighting_cols]
            )
    print(f"Saved benchmark CSV to {args.out_csv}")

    _plot_results(evals, best_ml_eval, hsv_eval, args.out_plot)
    print(f"Saved comparison plot to {args.out_plot}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

