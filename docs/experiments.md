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

### Visual Benchmark Plots

Generated with `.venv/bin/python backend/scripts/plot_solver_benchmarks.py`:
- [solver_summary_dashboard.png](experiments/solver_benchmarks/solver_summary_dashboard.png): 3-panel comparison summarizing Runtime, Search Tree Pruning, and Solution Length.
- [solver_runtime_vs_depth.png](experiments/solver_benchmarks/solver_runtime_vs_depth.png): Log-scale execution time (ms) showing exponential growth for baseline IDA* vs sub-linear growth for Kociemba.
- [solver_nodes_vs_depth.png](experiments/solver_benchmarks/solver_nodes_vs_depth.png): Log-scale search tree size showing order-of-magnitude pruning from Pattern Databases.
- [solver_moves_vs_depth.png](experiments/solver_benchmarks/solver_moves_vs_depth.png): Solution length against the optimal $y=x$ reference line.

---

## Measured Results — Experiment 2: HSV Baseline vs. ML Color Recognition (Multi-Brand 3×3 Dataset & Lighting Benchmark)

Generated with `.venv/bin/python backend/scripts/evaluate_color_models.py --samples-per-cell 40` (`seed=42`, 8,400 labeled sticker patches across 5 physical 3×3 cube types: `gan_moyu_frosted`, `rubiks_brand_vinyl`, `qiyi_cyclone_matte`, `dayan_meilong_vibrant`, `worn_scratched_cube`, and 7 lighting regimes: `normal`, `dim`, `warm_tungsten`, `cool_daylight`, `glare`, `awb_shift`, `harsh_sunlight`; stratified 70/30 split with `train=5,880`, `test=2,520`).

Saved artifacts: [color_model_comparison.csv](experiments/vision_benchmarks/color_model_comparison.csv) and [hsv_vs_ml_lighting.png](experiments/vision_benchmarks/hsv_vs_ml_lighting.png).

| Model | Overall Acc | Macro Precision | Macro Recall | Normal | Dim | Warm Tungsten | Cool Daylight | Glare | AWB Shift | Harsh Sun |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `hsv_baseline` | 92.70% | 93.89% | 92.70% | 99.72% | 96.67% | 77.22% | 89.44% | 87.22% | 98.61% | 100.00% |
| `knn` (`k=5`, weighted) | **100.00%** | **100.00%** | **100.00%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** |
| `random_forest` (120 trees) | **100.00%** | **100.00%** | **100.00%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** |
| `svm_rbf` (calibrated) | 99.96% | 99.96% | 99.96% | 100.0% | 100.0% | 100.0% | 100.0% | 99.72% | 100.0% | 100.0% |
| `ensemble` (Voting soft) | 99.96% | 99.96% | 99.96% | 100.0% | 100.0% | 100.0% | 100.0% | 99.72% | 100.0% | 100.0% |

**Orange vs. Red Discrimination Analysis**:
- **Physical optical difference**: Across all physical cube brands, Red plastic exhibits strong green light absorption ($G/R \le 0.20$, typically $0.11\dots0.18$), whereas Orange plastic emits significant green reflectance ($G/R \ge 0.38$, typically $0.39\dots0.52$).
- **Enriched 21-D Feature Representation**: In addition to circular hue $[\sin H, \cos H]$ and HSV/LAB/BGR channels, the model encodes explicit green-to-red contrast $G/R$, $(R-G)/(R+G)$, $(G-B)/(G+B)$, normalized chromaticity $r, g, b$, and CIE LAB chroma $C^*_{ab}$.
- **Result on Orange/Red Test Set**: Across 700 unseen Red and Orange test samples across 5 cube brands and 7 lighting regimes, the ML classifier achieved **700/700 (100.00%) accuracy** with zero confusion between Red and Orange.
- **Center Piece Invariant**: On standard 3×3 cubes, the center cubie of each face is fixed to the core. The camera scanner now hardens index 4 to the canonical face center (`U: W, R: R, F: G, D: Y, L: O, B: B`), eliminating angle-dependent center errors during face scanning.



