# Changelog

All notable progress in `rubiks_cube_solver` is tracked here as milestones are completed.

## [Unreleased]

### Added
- Phase 6A FastAPI REST API (`backend/app/main.py`, `backend/app/api/routes.py`), `--validate-only` and `facelets` output in `rubik_solver`, expanded `solver_bridge.py`, and FastAPI `TestClient` integration tests (`test_api.py`).
- Phase 5 ML color classification (`backend/app/ml/dataset.py`, `backend/app/ml/classifier.py`), interactive `collect_dataset.py`, `evaluate_color_models.py` comparing HSV vs. k-NN/SVM/Random Forest across lighting regimes, `hsv_vs_ml_lighting.png` plot, and `test_ml_classifier.py`.
- Phase 4B sticker feature extraction (`colors.py`), glare filtering, HSV baseline classifier, contour fallback (`detector.py`), C++ `solver_bridge.py`, live auto-capture webcam scanner (`scan_live.py`) with mirrored preview and neighbor bars, and `test_vision_pipeline.py`.
- Phase 4A Python `.venv` setup (`opencv-python`, `numpy`, `pytest`), `CameraCapture`, 3×3 alignment grid and ROI geometry (`backend/app/cv/camera.py`), interactive `capture_faces.py`, and `test_camera.py`.
- Phase 3C Kociemba Two-Phase solver (`KociembaTables`, `KociembaSolver`, `solveWithKociemba`), `rubik_solver` JSON CLI, `benchmark_solvers` CSV benchmark tool, and `test_solver_kociemba`.
- Measured solver benchmark comparison saved to `experiments/solver_benchmarks/solver_comparison.csv` and documented in `docs/experiments.md`.
- Phase 3B Pattern Databases (`PatternDatabase`, `PdbHeuristic`) using Lehmer-code ranking and BFS precomputation, plus `solveWithIdaStarPdb` and `test_solver_pdb`.
- Phase 3A cubie-level move multiplication (`CubieCube::multiply`, `CubieCube::apply`) and baseline IDA* solver (`solveWithIdaStarBaseline`) with `test_solver_baseline`.
- Phase 2 C++ scrambler (`generateScramble`, `createScrambledCube`) and physical state validator (`CubieCube`, `validateCube`, `toCubieCube`) with unit tests (`test_engine`).
- Phase 1 C++ cube representation (`Cube` with 54-sticker `URFDLB` layout, 2D net formatting, and facelet string conversion).
- Phase 1 face rotations and move notation (`U/R/F/D/L/B` with clockwise, double, and inverse moves) plus unit tests (`test_cube`).
- Initialized project folder layout for C++, Python backend, React frontend, experiments, and docs.
- Added `.gitignore`, `README.md`, `CONTRIBUTING.md`, and initial project documentation under `docs/`.

