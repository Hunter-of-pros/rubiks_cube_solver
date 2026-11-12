# Development Roadmap & Project Tracker

## Milestones

- [x] **M0: Project Setup** — Folder structure, Git, GitHub repo, `.gitignore`, initial docs
- [x] **M1: Phase 1 — Cube Representation** — 54-sticker layout, `U/D/L/R/F/B` + `'` + `2` moves, unit tests
- [ ] **M2: Phase 2 — Cube Engine** — Random scrambler, solved check, physical state validation
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

## Pending Tasks (Next Up)

1. Build a seeded random scrambler (`feature/cube-scrambler` or `feature/cube-validation`).
2. Add physical cube-state validation: color counts, center check, and Facelet -> Cubie conversion to verify corner twist sum, edge flip sum, and permutation parity.
3. Add unit tests for solvable vs. impossible states (twisted corner, flipped edge, swapped pair).

## Testing Checklist

- [x] Move + inverse restores solved and scrambled states for all 6 faces
- [x] 4× clockwise rotation returns to identity for every face
- [x] Move order identities (e.g., `(R U R' U')^6 == identity`, `(R U)^105 == identity`, checkerboard)
- [ ] Validator catches bad sticker counts, twisted corners, flipped edges, and odd permutation parity
- [ ] Solver produces valid solutions that return scrambled cubes to solved state
- [ ] Vision pipeline tested across bright, dim, warm, and glare-heavy lighting

