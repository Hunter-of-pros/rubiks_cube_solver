#include "rubik/solver.hpp"
#include "rubik/cubie.hpp"

#include <algorithm>
#include <chrono>
#include <limits>
#include <stdexcept>

namespace rubik {

namespace {

// Returns an admissible lower bound on HTM moves remaining.
// Each move alters at most 4 corners and 4 edges, so dividing the
// misplaced cubie count by 4 (rounded up) never overestimates distance.
int baselineHeuristic(const CubieCube& state) noexcept {
    int badCorners = 0;
    for (uint8_t i = 0; i < 8; ++i) {
        if (state.cp[i] != i || state.co[i] != 0) {
            ++badCorners;
        }
    }

    int badEdges = 0;
    for (uint8_t i = 0; i < 12; ++i) {
        if (state.ep[i] != i || state.eo[i] != 0) {
            ++badEdges;
        }
    }

    const int cornerBound = (badCorners + 3) / 4;
    const int edgeBound = (badEdges + 3) / 4;
    return std::max(cornerBound, edgeBound);
}

bool shouldPruneMove(int prevFace, int currFace) noexcept {
    if (prevFace < 0) {
        return false;
    }
    if (currFace == prevFace) {
        return true;  // Consecutive turns on the same face collapse into one move.
    }
    // Opposite faces commute (U/D=0, R/L=1, F/B=2). Enforce U->D, R->L, F->B
    // so we never search both "D U" and "U D".
    if ((currFace % 3) == (prevFace % 3) && currFace < prevFace) {
        return true;
    }
    return false;
}

constexpr int kFound = -1;
constexpr int kNodeLimitHit = -2;
constexpr int kInfinity = std::numeric_limits<int>::max();

template <typename HeuristicFn>
int dfsIdaStar(const CubieCube& state,
               int g,
               int bound,
               int prevFace,
               uint64_t maxNodes,
               uint64_t& nodesExpanded,
               std::vector<Move>& path,
               const HeuristicFn& heuristicFn) {
    const int h = heuristicFn(state);
    const int f = g + h;
    if (f > bound) {
        return f;
    }
    if (state.isSolved()) {
        return kFound;
    }

    if (maxNodes > 0 && nodesExpanded >= maxNodes) {
        return kNodeLimitHit;
    }
    ++nodesExpanded;

    int minExcess = kInfinity;
    const auto& moveTable = CubieCube::moveTable();

    for (int m = 0; m < kMoveCount; ++m) {
        const int currFace = m / 3;
        if (shouldPruneMove(prevFace, currFace)) {
            continue;
        }

        const CubieCube next = state.multiply(moveTable[m]);
        path.push_back(static_cast<Move>(m));

        const int res = dfsIdaStar(
            next, g + 1, bound, currFace, maxNodes, nodesExpanded, path, heuristicFn);
        if (res == kFound || res == kNodeLimitHit) {
            return res;
        }
        if (res < minExcess) {
            minExcess = res;
        }

        path.pop_back();
    }

    return minExcess;
}

template <typename HeuristicFn>
SolveResult runIdaStar(const Cube& cube,
                       const SolveOptions& options,
                       size_t extraMemoryBytes,
                       const HeuristicFn& heuristicFn) {
    SolveResult result;

    const ValidationResult validation = validateCube(cube);
    if (!validation.valid) {
        result.error = validation.message;
        return result;
    }

    const auto start = std::chrono::steady_clock::now();
    const CubieCube root = toCubieCube(cube);

    if (root.isSolved()) {
        result.solved = true;
        result.metrics.memoryBytes = sizeof(CubieCube) * 2 + extraMemoryBytes;
        return result;
    }

    int bound = heuristicFn(root);
    std::vector<Move> path;
    path.reserve(static_cast<size_t>(std::max(1, options.maxDepth)));

    while (bound <= options.maxDepth) {
        path.clear();
        const int res = dfsIdaStar(
            root, 0, bound, -1, options.maxNodes, result.metrics.nodesExpanded, path, heuristicFn);

        if (res == kFound) {
            const auto end = std::chrono::steady_clock::now();
            result.solved = true;
            result.moves = std::move(path);
            result.metrics.solutionLength = static_cast<int>(result.moves.size());
            result.metrics.elapsedMs =
                std::chrono::duration<double, std::milli>(end - start).count();
            result.metrics.memoryBytes =
                extraMemoryBytes +
                sizeof(CubieCube) * (result.moves.size() + 2) +
                sizeof(Move) * result.moves.capacity() +
                sizeof(CubieCube) * kMoveCount;
            return result;
        }

        if (res == kNodeLimitHit) {
            result.error = "Search stopped after hitting maxNodes limit";
            break;
        }
        if (res == kInfinity) {
            result.error = "No solution found within search space";
            break;
        }

        bound = res;
    }

    const auto end = std::chrono::steady_clock::now();
    result.metrics.elapsedMs =
        std::chrono::duration<double, std::milli>(end - start).count();
    result.metrics.memoryBytes = extraMemoryBytes + sizeof(CubieCube) * kMoveCount;
    if (result.error.empty()) {
        result.error = "No solution found within maxDepth=" + std::to_string(options.maxDepth);
    }
    return result;
}

}  // namespace

SolveResult solveWithIdaStarBaseline(const Cube& cube, const SolveOptions& options) {
    return runIdaStar(cube, options, 0, baselineHeuristic);
}

SolveResult solveWithIdaStarPdb(const Cube& cube,
                                const PdbHeuristic& heuristic,
                                const SolveOptions& options) {
    if (!heuristic.isBuilt()) {
        throw std::runtime_error("PdbHeuristic must be built before calling solveWithIdaStarPdb");
    }
    return runIdaStar(cube, options, heuristic.memoryBytes(),
                      [&heuristic](const CubieCube& state) { return heuristic.evaluate(state); });
}

SolveResult solveWithIdaStarPdb(const Cube& cube, const SolveOptions& options) {
    static PdbHeuristic sharedPdb = [] {
        PdbHeuristic pdb;
        pdb.build();
        return pdb;
    }();
    return solveWithIdaStarPdb(cube, sharedPdb, options);
}

}  // namespace rubik
