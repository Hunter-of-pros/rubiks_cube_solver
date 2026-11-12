# Changelog

All notable progress in `rubiks_cube_solver` is tracked here as milestones are completed.

## [Unreleased]

### Added
- Phase 3C Kociemba Two-Phase solver (`KociembaTables`, `KociembaSolver`, `solveWithKociemba`), `rubik_solver` JSON CLI, `benchmark_solvers` CSV benchmark tool, and `test_solver_kociemba`.
- Measured solver benchmark comparison saved to `experiments/solver_benchmarks/solver_comparison.csv` and documented in `docs/experiments.md`.
- Phase 3B Pattern Databases (`PatternDatabase`, `PdbHeuristic`) using Lehmer-code ranking and BFS precomputation, plus `solveWithIdaStarPdb` and `test_solver_pdb`.
- Phase 3A cubie-level move multiplication (`CubieCube::multiply`, `CubieCube::apply`) and baseline IDA* solver (`solveWithIdaStarBaseline`) with `test_solver_baseline`.
- Phase 2 C++ scrambler (`generateScramble`, `createScrambledCube`) and physical state validator (`CubieCube`, `validateCube`, `toCubieCube`) with unit tests (`test_engine`).
- Phase 1 C++ cube representation (`Cube` with 54-sticker `URFDLB` layout, 2D net formatting, and facelet string conversion).
- Phase 1 face rotations and move notation (`U/R/F/D/L/B` with clockwise, double, and inverse moves) plus unit tests (`test_cube`).
- Initialized project folder layout for C++, Python backend, React frontend, experiments, and docs.
- Added `.gitignore`, `README.md`, `CONTRIBUTING.md`, and initial project documentation under `docs/`.

