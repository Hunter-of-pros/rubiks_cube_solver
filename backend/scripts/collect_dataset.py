"""Interactive webcam collector to build a real labeled sticker feature dataset."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys
from typing import List

import cv2

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.cv.camera import CameraCapture, compute_cell_rois, compute_guide_box, draw_scan_overlay
from app.cv.colors import VALID_COLORS, extract_sticker_features
from app.ml.dataset import LabeledStickerSample, load_samples_csv, save_samples_csv


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Collect labeled sticker color features from a solved cube face."
    )
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument(
        "--lighting",
        default="normal",
        help="Lighting tag (e.g., normal, dim, warm_tungsten, cool_daylight, glare)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data/sticker_dataset/stickers.csv"),
    )
    args = parser.parse_args()

    existing: List[LabeledStickerSample] = (
        load_samples_csv(args.out) if args.out.exists() else []
    )
    collected = list(existing)
    color_idx = 0

    with CameraCapture(device_index=args.camera) as cam:
        while color_idx < len(VALID_COLORS):
            frame = cam.read_frame()
            label = VALID_COLORS[color_idx]
            status = (
                f"Hold solved '{label}' face ({args.lighting}) | "
                "SPACE: +9 samples | N: next color | Q: save & quit"
            )
            preview = draw_scan_overlay(frame, status_text=status, mirror_preview=True)
            cv2.imshow("Sticker Dataset Collector", preview)
            key = cv2.waitKey(1) & 0xFF

            if key == ord(" "):
                h, w = frame.shape[:2]
                box = compute_guide_box(w, h)
                for x1, y1, x2, y2 in compute_cell_rois(box):
                    feat = extract_sticker_features(frame[y1:y2, x1:x2])
                    collected.append(
                        LabeledStickerSample(features=feat, label=label, lighting=args.lighting)
                    )
                print(f"Added 9 samples for '{label}' ({args.lighting}). Total={len(collected)}")
            elif key in (ord("n"), ord("N")):
                color_idx += 1
            elif key in (ord("q"), ord("Q"), 27):
                break

    cv2.destroyAllWindows()
    save_samples_csv(args.out, collected)
    print(f"Saved {len(collected)} total samples to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

