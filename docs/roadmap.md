# Development Roadmap & Project Tracker

## Milestones

- [x] **M0: Project Setup** — Folder structure, Git, GitHub repo, `.gitignore`, initial docs
- [x] **M1: Phase 1 — Cube Representation** — 54-sticker layout, `U/D/L/R/F/B` + `'` + `2` moves, unit tests
- [x] **M2: Phase 2 — Cube Engine** — Random scrambler, solved check, physical state validation
- [ ] **M3: Phase 3 — Algorithmic Solver** — Cubie model, Pattern Databases, IDA*, Kociemba two-phase, benchmarks
- [ ] **M4: Phase 4 — Computer Vision** — OpenCV webcam capture, sticker grid detection, 6-face reconstruction
- [ ] **M5: Phase 5 — Machine Learning** — Labeled sticker dataset, HSV baseline vs. ML models, lighting tests
- [ ] **M6: Phase 6 — Frontend & Integration** — FastAPI routes, C++ bridge, React scanner/editor/playback UI
- [ ] **M7: Phase 7 — Research & Benchmarking** — Reproducible experiments, measured tables and plots

## Completed Modules

- Project skeleton and documentation layout.
- `cpp/include/rubik/cube.hpp` & `cpp/src/cube.cpp`: 54-sticker `Cube` state, `URFDLB` indexing, `isSolved()`, `toFaceletString()` / `fromFaceletString()`, 2D net printer, and table-driven quarter-turn rotations.
- `cpp/include/rubik/move.hpp` & `cpp/src/move.cpp`: All 18 standard moves (`U/R/F/D/L/B` × CW/2/CCW), move parsing, string formatting, and `inverseMove()`.
- `cpp/tests/test_cube.cpp`: Unit tests for representation, single-turn sticker positions, move inverses, group order identities (`(R U R' U')^6`, `(R U)^105`), and 500-step piece preservation.
- `cpp/include/rubik/scrambler.hpp` & `cpp/src/scrambler.cpp`: Seeded random scrambler avoiding redundant same-face and opposite-axis moves.
- `cpp/include/rubik/cubie.hpp` & `cpp/src/cubie.cpp`: `CubieCube` conversion and full physical solvability validator (`validateCube`).
- `cpp/tests/test_engine.cpp`: Scrambler reversibility tests and validation checks for color counts, centers, impossible pieces, duplicate cubies, and twist/flip/permutation parity.
- `cpp/include/rubik/solver.hpp` & `cpp/src/ida_star.cpp` (plus `CubieCube::multiply` in `cubie.cpp`): Fast cubie-level move multiplication and IDA* solvers (`solveWithIdaStarBaseline`, `solveWithIdaStarPdb`) with node/time/memory metrics.
- `cpp/include/rubik/pattern_db.hpp` & `cpp/src/pattern_db.cpp`: Mixed-radix Lehmer ranking and BFS-built corner/edge Pattern Databases (`PatternDatabase`, `PdbHeuristic`).
- `cpp/tests/test_solver_baseline.cpp` & `cpp/tests/test_solver_pdb.cpp`: Baseline vs. PDB admissibility and speedup verification up to 10-move scrambles.

## Pending Tasks (Next Up)

1. Implement Kociemba's two-phase solver (`feature/kociemba-solver`) to solve arbitrary 20-move scrambles in milliseconds.
2. Build the C++ solver CLI executable + benchmark harness comparing baseline IDA*, PDB IDA*, and Kociemba.

## Testing Checklist

- [x] Move + inverse restores solved and scrambled states for all 6 faces
- [x] 4× clockwise rotation returns to identity for every face
- [x] Move order identities (e.g., `(R U R' U')^6 == identity`, `(R U)^105 == identity`, checkerboard)
- [x] Validator catches bad sticker counts, twisted corners, flipped edges, and odd permutation parity
- [ ] Solver produces valid solutions that return scrambled cubes to solved state
- [ ] Vision pipeline tested across bright, dim, warm, and glare-heavy lighting

