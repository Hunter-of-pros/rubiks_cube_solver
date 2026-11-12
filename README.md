# Rubik's Cube Solver (`rubiks_cube_solver`)

A from-scratch 3×3×3 Rubik's Cube solver built as an engineering and research project. Every core piece—C++ cube engine and search algorithms, OpenCV sticker detection, scikit-learn color classification, FastAPI backend, and React 3D/2D interface—is implemented directly and measured with reproducible benchmarks.

## What the system does

1. Scans all six faces of a physical cube using a webcam (or lets you paint sticker colors in a manual 2D editor).
2. Extracts glare-filtered sticker color features and classifies them using an HSV baseline or a trained ML classifier.
3. Validates physical solvability in C++ (color counts, centers, corner twist parity, edge flip parity, and permutation parity).
4. Solves the cube in C++ using baseline IDA\*, Pattern-Database IDA\*, or Kociemba's Two-Phase algorithm.
5. Guides you step-by-step through the solution with a rotatable 3D cube, 2D net, and playback controls.

## Setup & Running Locally

### 1. Build and test the C++ solver engine
```zsh
cmake -S cpp -B cpp/build -DCMAKE_BUILD_TYPE=Release
cmake --build cpp/build
ctest --test-dir cpp/build --output-on-failure
```

### 2. Set up the Python backend & run tests
```zsh
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/pytest backend/tests -v
```

### 3. Start the FastAPI server (Terminal 1)
```zsh
.venv/bin/uvicorn app.main:app --app-dir backend --reload --port 8000
```

### 4. Start the React frontend (Terminal 2)
```zsh
cd frontend
npm install
npm test
npm run dev
```
Open http://localhost:5173 in your browser.

## Folder layout

```text
rubiks_cube_solver/
├── cpp/            # C++ cube engine, IDA* + PDB, Kociemba solver, CLI, benchmarks
├── backend/        # OpenCV/ML pipeline, dataset tools, and FastAPI REST API
├── frontend/       # React + Vite UI (manual editor, webcam scanner, 3D/2D playback)
├── experiments/    # Saved CSV benchmarks and plots
├── data/           # Local datasets and captures (ignored by Git)
└── docs/           # Architecture notes, roadmap, experiments, limitations
```

## Documentation

- [System Architecture](docs/architecture.md)
- [Development Roadmap & Tracker](docs/roadmap.md)
- [Measured Experiments Log](docs/experiments.md)
- [Known Limitations](docs/limitations.md)
