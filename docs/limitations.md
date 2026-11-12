# Known Limitations

This file tracks current constraints and edge cases we know about as we build the system.

- **Vision dataset scope**: Phase 5's `100%` ML accuracy is measured on controlled synthetic lighting perturbations (`seed=42`); real webcam performance depends on collecting samples from the user's physical cube and room lighting via `backend/scripts/collect_dataset.py`.
- **Fixed cube orientation**: The solver and scanner assume a standard Western color scheme (`U=White, R=Red, F=Green, D=Yellow, L=Orange, B=Blue`) with fixed center orientation.
- **Solver trade-off**: Optimal PDB IDA\* handles up to ~10–12 moves quickly; deep 20-move scrambles rely on Kociemba's two-phase solver, which targets <= 20–24 moves rather than strict optimal HTM.
- **UI status**: The React web interface and FastAPI REST service (Phase 6) have not been built yet.
