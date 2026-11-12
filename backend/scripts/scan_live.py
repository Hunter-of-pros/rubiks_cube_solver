"""Live webcam Rubik's Cube scanner with auto-capture, manual fix, and C++ solve."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys
from typing import Dict

import cv2

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.cv.camera import CameraCapture, NATURAL_SCAN_ORDER, draw_scan_overlay
from app.cv.colors import VALID_COLORS
from app.cv.detector import analyze_face_frame, reconstruct_cube_state
from app.services.solver_bridge import solve_facelets


def _prompt_manual_fix(face_code: str, current: str) -> str:
    print(f"\nCurrent {face_code} stickers (row-major 0..8): {current}")
    edited = input("Enter corrected 9 letters (W/R/G/Y/O/B) or press Enter to keep: ").strip().upper()
    if not edited:
        return current
    if len(edited) == 9 and all(ch in VALID_COLORS for ch in edited):
        return edited
    print("Invalid input; keeping detected face.")
    return current


def main() -> int:
    parser = argparse.ArgumentParser(description="Live webcam cube scanner and solver.")
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default: 0)")
    parser.add_argument("--stable-frames", type=int, default=12, help="Frames required for auto-capture")
    parser.add_argument("--algo", default="kociemba", choices=["kociemba", "ida-pdb", "ida-base"])
    args = parser.parse_args()

    scanned: Dict[str, str] = {}
    idx = 0
    last_face_str = ""
    stable_count = 0

    with CameraCapture(device_index=args.camera) as cam:
        while idx < len(NATURAL_SCAN_ORDER):
            frame = cam.read_frame()
            prompt = NATURAL_SCAN_ORDER[idx]
            detection = analyze_face_frame(frame)
            face_str = detection.face_string

            if face_str == last_face_str and detection.min_confidence >= 0.50:
                stable_count += 1
            else:
                last_face_str = face_str
                stable_count = 1

            progress = min(stable_count, args.stable_frames)
            status = (
                f"[{idx + 1}/6] Hold steady ({progress}/{args.stable_frames}) "
                "| SPACE: lock | R: redo | Q: quit"
            )
            preview = draw_scan_overlay(
                frame,
                face_prompt=prompt,
                status_text=status,
                mirror_preview=True,
                predicted_colors=detection.colors,
                confidences=detection.confidences,
            )
            cv2.imshow("Rubik's Cube Live Scanner", preview)
            key = cv2.waitKey(1) & 0xFF

            if stable_count >= args.stable_frames or key == ord(" "):
                scanned[prompt.code] = face_str
                print(f"Captured {prompt.code}: {face_str} (min_conf={detection.min_confidence:.2f})")
                idx += 1
                last_face_str = ""
                stable_count = 0
            elif key in (ord("r"), ord("R")) and idx > 0:
                idx -= 1
                last_face_str = ""
                stable_count = 0
                print(f"Redoing {NATURAL_SCAN_ORDER[idx].code}")
            elif key in (ord("q"), ord("Q"), 27):
                cv2.destroyAllWindows()
                print("Scan cancelled.")
                return 0

    cv2.destroyAllWindows()

    # Let user review/correct any misread stickers before solving.
    while True:
        print("\nScanned faces:")
        for code in ("U", "R", "F", "D", "L", "B"):
            print(f"  {code}: {scanned[code]}")

        facelets = reconstruct_cube_state(scanned)
        res = solve_facelets(facelets, algorithm=args.algo)
        if res.valid and res.solved:
            print(f"\nValid cube! Solution ({res.solution_length} moves, {res.elapsed_ms:.2f} ms):")
            print(res.moves if res.moves else "(already solved)")
            return 0

        print(f"\nValidation/solve error: {res.error}")
        fix_code = input("Enter face to edit (U/R/F/D/L/B) or 'q' to quit: ").strip().upper()
        if fix_code == "Q" or not fix_code:
            return 1
        if fix_code in scanned:
            scanned[fix_code] = _prompt_manual_fix(fix_code, scanned[fix_code])


if __name__ == "__main__":
    raise SystemExit(main())
