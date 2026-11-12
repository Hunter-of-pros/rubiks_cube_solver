# Development Roadmap & Project Tracker

## Milestones

- [x] **M0: Project Setup** — Folder structure, Git, GitHub repo, `.gitignore`, initial docs
- [ ] **M1: Phase 1 — Cube Representation** — 54-sticker layout, `U/D/L/R/F/B` + `'` + `2` moves, unit tests
- [ ] **M2: Phase 2 — Cube Engine** — Random scrambler, solved check, physical state validation
- [ ] **M3: Phase 3 — Algorithmic Solver** — Cubie model, Pattern Databases, IDA*, Kociemba two-phase, benchmarks
- [ ] **M4: Phase 4 — Computer Vision** — OpenCV webcam capture, sticker grid detection, 6-face reconstruction
- [ ] **M5: Phase 5 — Machine Learning** — Labeled sticker dataset, HSV baseline vs. ML models, lighting tests
- [ ] **M6: Phase 6 — Frontend & Integration** — FastAPI routes, C++ bridge, React scanner/editor/playback UI
- [ ] **M7: Phase 7 — Research & Benchmarking** — Reproducible experiments, measured tables and plots

## Completed Modules

- Project skeleton and documentation layout.

## Pending Tasks (Next Up)

1. Define `Color`, `Face`, and the `Cube` 54-sticker array in C++ (`feature/cube-representation`).
2. Add a 2D unfolded net printer and `isSolved()` check.
3. Implement clockwise, counterclockwise, and double rotations (`feature/face-rotations`).
4. Write unit tests verifying `move` + `inverse` restores the original cube.

## Testing Checklist

- [ ] Move + inverse restores solved and scrambled states for all 6 faces
- [ ] 4× clockwise rotation returns to identity for every face
- [ ] Move order identities (e.g., `(R U R' U')^6 == identity`, superflip / known cube order checks)
- [ ] Validator catches bad sticker counts, twisted corners, flipped edges, and odd permutation parity
- [ ] Solver produces valid solutions that return scrambled cubes to solved state
- [ ] Vision pipeline tested across bright, dim, warm, and glare-heavy lighting

