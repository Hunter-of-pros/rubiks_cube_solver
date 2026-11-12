#pragma once

#include "rubik/cube.hpp"
#include "rubik/move.hpp"
#include "rubik/pattern_db.hpp"

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace rubik {

struct SolveMetrics {
    uint64_t nodesExpanded = 0;
    double elapsedMs = 0.0;
    int solutionLength = 0;
    size_t memoryBytes = 0;
};

struct SolveOptions {
    int maxDepth = 20;
    uint64_t maxNodes = 0;  // 0 means unlimited
};

struct KociembaOptions {
    int maxLength = 24;
    int targetLength = 20;
    double timeBudgetMs = 50.0;
};

struct SolveResult {
    bool solved = false;
    std::vector<Move> moves;
    SolveMetrics metrics;
    std::string error;
};

// Baseline IDA* solver using a simple admissible cubie-mismatch heuristic
// (no pattern databases yet). Best for shallow scrambles and benchmarking.
SolveResult solveWithIdaStarBaseline(const Cube& cube, const SolveOptions& options = {});

// Optimal IDA* solver guided by corner and edge Pattern Databases.
SolveResult solveWithIdaStarPdb(const Cube& cube,
                                const PdbHeuristic& heuristic,
                                const SolveOptions& options = {});
SolveResult solveWithIdaStarPdb(const Cube& cube, const SolveOptions& options = {});

// Near-optimal fast solver using Kociemba's Two-Phase Algorithm.
SolveResult solveWithKociemba(const Cube& cube, const KociembaOptions& options = {});

}  // namespace rubik

