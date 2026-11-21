# Changelog

All notable progress in `rubiks_cube_solver` is tracked here as milestones are completed.

## [Unreleased]

### Added
- Vercel production deployment configuration (`vercel.json`, `.vercelignore`) deployed live at `https://rubikscube-beta.vercel.app`.
- Client-side Kociemba Two-Phase solver engine (`cubejs`), non-redundant scramble generator (`generateRandomScrambleMoves`), and client validator in `frontend/src/utils/cube.js` and `api.js` for zero-latency edge solving and full offline resiliency.
- Client-side canvas webcam sticker color classifier with physical $G/R$ ratio discrimination as a resilient fallback when remote backend is offline.
- Enhanced Orange vs. Red color recognition with 21-D feature vectors ($G/R$ ratio, $(R-G)/(R+G)$, CIE LAB $L^*$ luminance, normalized $rgb$ chromaticity) and multi-brand physical 3×3 cube profiles (GAN/MoYu frosted, Rubik's vinyl, QiYi matte, DaYan vibrant, worn cube) across 7 lighting regimes, achieving 100.00% accuracy on 700 Red/Orange test samples.
- Fixed center piece locking in webcam scanner (`WebcamScanner.jsx`) and exported `CANONICAL_FACE_CENTERS` to enforce the physical 3×3 core invariant (`U: W, R: R, F: G, D: Y, L: O, B: B`).
- Phase 7 Research & Benchmarking visualization tool (`backend/scripts/plot_solver_benchmarks.py`) and publication-grade plots (`solver_runtime_vs_depth.png`, `solver_nodes_vs_depth.png`, `solver_moves_vs_depth.png`, `solver_summary_dashboard.png`) documenting empirical performance across IDA* baseline, IDA* with Pattern Databases, and Kociemba Two-Phase algorithms.
- Phase 6B React + Vite UI (`frontend/`) featuring a 2D manual sticker editor, draggable 3D cube view, browser webcam scanner wired to `/api/scan-face`, step-by-step solution playback, and Vitest cube-rotation tests.
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

