# Rubik's Cube Solver (`rubiks_cube_solver`)

A from-scratch 3×3×3 Rubik's Cube solver built as an engineering and research project. The goal is to implement and understand every layer directly—no black-box solver libraries—and measure how different algorithms and vision models behave in practice.

## What the system will do

1. Scan all six faces of a physical cube using a webcam (or let you enter sticker colors manually).
2. Detect stickers and classify their colors.
3. Reconstruct the 54-sticker state and check whether the cube is physically solvable.
4. Solve the cube in C++ using search algorithms (IDA* with pattern databases and Kociemba's two-phase algorithm).
5. Show the solution step-by-step in a React UI so you can follow along on your own cube.

## Architecture

- **C++ (`cpp/`)**: Cube state representation, face rotations, scrambler, physical validation, IDA* / Kociemba solvers, and performance benchmarks. Exposed as a standalone CLI executable.
- **Python (`backend/`)**: OpenCV sticker detection, color classification (HSV baseline vs. scikit-learn models), and a FastAPI server that talks to the C++ solver.
- **React (`frontend/`)**: Webcam scanning UI, manual 54-sticker editor, cube visualization, and move-by-move playback.
- **Experiments & Docs (`experiments/`, `docs/`)**: Reproducible benchmarks comparing solver runtime/memory/move counts and vision accuracy across lighting conditions.

## Folder layout

```text
rubiks_cube_solver/
├── cpp/            # C++ cube engine, solvers, tests, and benchmarks
├── backend/        # Python OpenCV/ML pipeline and FastAPI API
├── frontend/       # React web interface
├── experiments/    # Saved benchmark outputs and analysis plots
├── data/           # Local sticker datasets (ignored by Git)
└── docs/           # Architecture notes, roadmap, experiments, limitations
```

## Status

Currently setting up the repository and moving into **Phase 1: C++ Cube Representation**. See [docs/roadmap.md](docs/roadmap.md) for the full task list.

