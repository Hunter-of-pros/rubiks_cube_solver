# Experiments Log

All experiments recorded here must come from real runs of our code—no estimated or fabricated numbers.

## Planned Experiments

### 1. Solver Comparison (Phase 3 & Phase 7)
Compare search strategies on a fixed, seeded set of random scrambles:
- Baseline search (IDDFS / simple heuristic IDA*)
- IDA* with Corner + Edge Pattern Databases
- Kociemba's Two-Phase Algorithm

Metrics to record:
- Execution time (ms)
- Solution length (Half-Turn Metric)
- Nodes expanded
- Peak memory usage (MB)

### 2. Color Classification Under Varied Lighting (Phase 5 & Phase 7)
Compare:
- Rule-based HSV thresholding (baseline)
- Classical ML classifiers (k-NN, SVM, Random Forest) trained on extracted color features
- Optional PyTorch model (only if classical ML struggles on hard failure cases)

Metrics to record:
- Overall accuracy, per-color precision and recall
- Confusion matrices (especially orange vs. red, white vs. yellow under warm light)
- Failure-case analysis under shadows and specular glare

---

*Results will be added here once the corresponding benchmarks are implemented and run.*

