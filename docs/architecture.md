# System Architecture

This document tracks how the pieces of `rubiks_cube_solver` fit together and will be updated as each layer is built.

## High-level data flow

1. **Input (Frontend)**: The user either scans six cube faces with a webcam or clicks colors into a manual 2D/3D cube editor.
2. **Vision & Classification (Python / FastAPI)**:
   - OpenCV locates the cube face, finds the 3×3 sticker grid, and extracts color features from each sticker region.
   - A classifier (starting with an HSV threshold baseline, later compared with ML models) maps each sticker to one of six colors (`W, R, G, Y, O, B`).
   - Uncertain stickers can be corrected manually in the UI before solving.
3. **Validation & Solving (C++ Engine)**:
   - FastAPI passes the 54-sticker state to the compiled C++ solver executable via stdin/stdout.
   - The C++ engine checks sticker counts and cubie parity (corner twists, edge flips, permutation parity).
   - If valid, the solver computes a solution using IDA* or Kociemba's two-phase algorithm and returns the move list plus search stats (time, nodes expanded, move count).
4. **Playback (Frontend)**: React displays the move sequence and steps the user through each turn visually.

## Why keep C++ as a separate executable?

- We can compile, test, and benchmark the solver directly in C++ without Python overhead.
- Avoids C-extension build issues across Python versions.
- Keeps the API boundary explicit: JSON in, JSON out.

## FastAPI REST endpoints

- `GET /api/health` — solver binary and ML model availability
- `POST /api/validate` — physical solvability check via `rubik_solver --validate-only`
- `POST /api/solve` — solves a 54-char `URFDLB` facelet state (`kociemba`, `ida-pdb`, `ida-base`)
- `POST /api/scramble` — generates a random scramble and returns its resulting 54-char state
- `POST /api/apply-moves` — applies a move sequence to a solved cube via C++
- `POST /api/scan-face` — classifies a webcam face image into 9 colors + confidence scores


