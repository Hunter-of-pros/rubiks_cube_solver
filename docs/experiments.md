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

## Measured Results — Experiment 1: C++ Solver Comparison

Generated with `./cpp/build/benchmark_solvers --trials 10 --csv experiments/solver_benchmarks/solver_comparison.csv` (Release build, Apple arm64).

- **Table setup cost**:
  - `ida-pdb` (5 subset PDBs): `4,862.99 ms` build time, `11.82 MB` (`12,389,760` bytes)
  - `kociemba` (coordinate move + pruning tables): `176.72 ms` build time, `5.55 MB` (`5,815,005` bytes)

| Algorithm | Scramble Depth | Trials | Avg Moves (HTM) | Avg Nodes Expanded | Avg Time (ms) | Table Memory |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `ida-base` | 4 | 10 | 4.00 | 23.6 | 0.008 | 0.00 MB |
| `ida-base` | 5 | 10 | 5.00 | 252.4 | 0.079 | 0.00 MB |
| `ida-base` | 6 | 10 | 6.00 | 2,873.1 | 0.870 | 0.00 MB |
| `ida-pdb` | 4 | 10 | 4.00 | 4.0 | 0.018 | 11.82 MB |
| `ida-pdb` | 5 | 10 | 5.00 | 5.0 | 0.011 | 11.82 MB |
| `ida-pdb` | 6 | 10 | 6.00 | 9.9 | 0.025 | 11.82 MB |
| `ida-pdb` | 8 | 10 | 8.00 | 45.6 | 0.129 | 11.82 MB |
| `ida-pdb` | 10 | 10 | 10.00 | 3,543.2 | 6.224 | 11.82 MB |
| `kociemba` | 4 | 10 | 9.10 | 127.3 | 0.016 | 5.55 MB |
| `kociemba` | 5 | 10 | 10.30 | 555.3 | 0.048 | 5.55 MB |
| `kociemba` | 6 | 10 | 13.30 | 4,196.9 | 0.300 | 5.55 MB |
| `kociemba` | 8 | 10 | 16.00 | 4,128.6 | 0.287 | 5.55 MB |
| `kociemba` | 10 | 10 | 13.00 | 5,465.5 | 0.585 | 5.55 MB |
| `kociemba` | 20 | 20 | 20.40 | 294,217.1 | 26.122 | 5.55 MB |

**Key takeaway**: Pattern databases cut IDA\* nodes at depth 6 from `2,873.1` down to `9.9` (~290× fewer nodes) while staying strictly optimal. For full 20-move scrambles, Kociemba solves 20/20 trials in an average of `26.12 ms` and `20.40` moves while using less than half the memory and ~27× faster table startup than our 5-piece PDBs.


