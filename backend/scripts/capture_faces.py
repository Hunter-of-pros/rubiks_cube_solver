"""Interactive webcam script to capture all 6 Rubik's Cube faces."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

import cv2

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.cv.camera import CameraCapture, FACE_SCAN_ORDER, draw_scan_overlay


def main() -> int:
    parser = argparse.ArgumentParser(description="Capture 6 cube faces via webcam.")
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default: 0)")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("data/captures"),
        help="Directory to save captured face images",
    )
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    idx = 0

    with CameraCapture(device_index=args.camera) as cam:
        while idx < len(FACE_SCAN_ORDER):
            frame = cam.read_frame()
            prompt = FACE_SCAN_ORDER[idx]
            preview = draw_scan_overlay(
                frame,
                face_prompt=prompt,
                status_text=f"[{idx + 1}/6] SPACE: capture {prompt.code} | R: retake | Q: quit",
            )
            cv2.imshow("Rubik's Cube Scanner", preview)
            key = cv2.waitKey(1) & 0xFF

            if key == ord(" "):
                out_path = args.out_dir / f"{idx + 1}_{prompt.code}.png"
                cv2.imwrite(str(out_path), frame)
                print(f"Saved {prompt.code} -> {out_path}")
                idx += 1
            elif key in (ord("r"), ord("R")) and idx > 0:
                idx -= 1
                print(f"Retaking face {FACE_SCAN_ORDER[idx].code}")
            elif key in (ord("q"), ord("Q"), 27):
                print("Scan cancelled.")
                break

    cv2.destroyAllWindows()
    if idx == len(FACE_SCAN_ORDER):
        print(f"All 6 faces captured in {args.out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

