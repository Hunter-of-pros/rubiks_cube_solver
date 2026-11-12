#include "rubik/kociemba.hpp"

#include <algorithm>
#include <chrono>
#include <limits>
#include <stdexcept>

namespace rubik {

namespace {

constexpr int kBinomial12_4[12][4] = {
    {1, 0, 0, 0},
    {1, 1, 0, 0},
    {1, 2, 1, 0},
    {1, 3, 3, 1},
    {1, 4, 6, 4},
    {1, 5, 10, 10},
    {1, 6, 15, 20},
    {1, 7, 21, 35},
    {1, 8, 28, 56},
    {1, 9, 36, 84},
    {1, 10, 45, 120},
    {1, 11, 55, 165},
};

template <size_t N>
uint16_t rankPerm(const uint8_t* perm) noexcept {
    uint32_t rank = 0;
    for (size_t i = 0; i < N; ++i) {
        int smaller = 0;
        for (size_t j = 0; j < i; ++j) {
            if (perm[j] < perm[i]) {
                ++smaller;
            }
        }
        const uint32_t digit = static_cast<uint32_t>(perm[i] - smaller);
        rank = rank * static_cast<uint32_t>(N - i) + digit;
    }
    return static_cast<uint16_t>(rank);
}

template <size_t N>
void unrankPerm(uint16_t rank, uint8_t* outPerm) noexcept {
    std::array<uint8_t, N> digits{};
    uint32_t rem = rank;
    for (size_t i = N; i > 0; --i) {
        const size_t idx = i - 1;
        const uint32_t radix = static_cast<uint32_t>(N - idx);
        digits[idx] = static_cast<uint8_t>(rem % radix);
        rem /= radix;
    }

    std::array<bool, N> used{};
    for (size_t i = 0; i < N; ++i) {
        uint8_t count = 0;
        for (size_t v = 0; v < N; ++v) {
            if (!used[v]) {
                if (count == digits[i]) {
                    outPerm[i] = static_cast<uint8_t>(v);
                    used[v] = true;
                    break;
                }
                ++count;
            }
        }
    }
}

CubieCube decodeTwistCube(uint16_t twist) noexcept {
    CubieCube c = CubieCube::identity();
    int sum = 0;
    for (int i = 6; i >= 0; --i) {
        const uint8_t ori = static_cast<uint8_t>(twist % 3);
        c.co[i] = ori;
        sum += ori;
        twist /= 3;
    }
    c.co[7] = static_cast<uint8_t>((3 - (sum % 3)) % 3);
    return c;
}

CubieCube decodeFlipCube(uint16_t flip) noexcept {
    CubieCube c = CubieCube::identity();
    int parity = 0;
    for (int i = 10; i >= 0; --i) {
        const uint8_t ori = static_cast<uint8_t>(flip & 1u);
        c.eo[i] = ori;
        parity ^= ori;
        flip >>= 1;
    }
    c.eo[11] = static_cast<uint8_t>(parity);
    return c;
}

CubieCube decodeSliceCube(uint16_t slice) noexcept {
    CubieCube c = CubieCube::identity();
    c.ep.fill(0);
    int rem = static_cast<int>(slice);
    int x = 3;
    int nextSliceEdge = 8;
    int nextUdEdge = 0;

    for (int j = 11; j >= 0; --j) {
        if (x >= 0 && rem < kBinomial12_4[j][x]) {
            c.ep[j] = static_cast<uint8_t>(nextSliceEdge++);
            --x;
        } else {
            if (x >= 0) {
                rem -= kBinomial12_4[j][x];
            }
            c.ep[j] = static_cast<uint8_t>(nextUdEdge++);
        }
    }
    return c;
}

// Builds a 2D BFS pruning table over coordinates (A, B) with A in [0, countA),
// B in [0, countB), starting from solved state (0, 0).
template <typename MoveTableA, typename MoveTableB>
void buildPruneTable(int countA,
                     int countB,
                     int numMoves,
                     const MoveTableA& moveA,
                     const MoveTableB& moveB,
                     std::vector<uint8_t>& prune) {
    const size_t total = static_cast<size_t>(countA) * static_cast<size_t>(countB);
    prune.assign(total, 0xFF);
    prune[0] = 0;

    std::vector<uint32_t> frontier;
    std::vector<uint32_t> nextFrontier;
    frontier.push_back(0);

    uint8_t depth = 0;
    while (!frontier.empty()) {
        nextFrontier.clear();
        for (uint32_t idx : frontier) {
            const int a = static_cast<int>(idx) / countB;
            const int b = static_cast<int>(idx) % countB;

            for (int m = 0; m < numMoves; ++m) {
                const int na = static_cast<int>(moveA[a][m]);
                const int nb = static_cast<int>(moveB[b][m]);
                const uint32_t nextIdx = static_cast<uint32_t>(na * countB + nb);
                if (prune[nextIdx] == 0xFF) {
                    prune[nextIdx] = static_cast<uint8_t>(depth + 1);
                    nextFrontier.push_back(nextIdx);
                }
            }
        }
        frontier.swap(nextFrontier);
        ++depth;
    }
}

bool shouldPruneFace(int prevFace, int currFace) noexcept {
    if (prevFace < 0) return false;
    if (currFace == prevFace) return true;
    return (currFace % 3) == (prevFace % 3) && currFace < prevFace;
}

}  // namespace

uint16_t KociembaTables::encodeTwist(const CubieCube& c) noexcept {
    uint16_t twist = 0;
    for (int i = 0; i < 7; ++i) {
        twist = static_cast<uint16_t>(twist * 3 + c.co[i]);
    }
    return twist;
}

uint16_t KociembaTables::encodeFlip(const CubieCube& c) noexcept {
    uint16_t flip = 0;
    for (int i = 0; i < 11; ++i) {
        flip = static_cast<uint16_t>((flip << 1) | c.eo[i]);
    }
    return flip;
}

uint16_t KociembaTables::encodeSlice(const CubieCube& c) noexcept {
    int coord = 0;
    int x = -1;
    for (int j = 0; j < 12; ++j) {
        if (c.ep[j] >= 8) {
            ++x;
        } else if (x >= 0) {
            coord += kBinomial12_4[j][x];
        }
    }
    return static_cast<uint16_t>(coord);
}

uint16_t KociembaTables::encodeCornerPerm(const CubieCube& c) noexcept {
    return rankPerm<8>(c.cp.data());
}

uint16_t KociembaTables::encodeUdEdge(const CubieCube& c) noexcept {
    return rankPerm<8>(c.ep.data());
}

uint8_t KociembaTables::encodeSlicePerm(const CubieCube& c) noexcept {
    std::array<uint8_t, 4> slice{};
    for (int i = 0; i < 4; ++i) {
        slice[i] = static_cast<uint8_t>(c.ep[8 + i] - 8);
    }
    return static_cast<uint8_t>(rankPerm<4>(slice.data()));
}

void KociembaTables::build() {
    if (built_) return;

    const auto start = std::chrono::steady_clock::now();
    const auto& moveCubies = CubieCube::moveTable();

    // 1. Phase 1 move tables (all 18 moves)
    twistMove_.resize(kTwistCount);
    for (uint16_t t = 0; t < kTwistCount; ++t) {
        const CubieCube c = decodeTwistCube(t);
        for (int m = 0; m < kMoveCount; ++m) {
            twistMove_[t][m] = encodeTwist(c.multiply(moveCubies[m]));
        }
    }

    flipMove_.resize(kFlipCount);
    for (uint16_t f = 0; f < kFlipCount; ++f) {
        const CubieCube c = decodeFlipCube(f);
        for (int m = 0; m < kMoveCount; ++m) {
            flipMove_[f][m] = encodeFlip(c.multiply(moveCubies[m]));
        }
    }

    sliceMove_.resize(kSliceCount);
    for (uint16_t s = 0; s < kSliceCount; ++s) {
        const CubieCube c = decodeSliceCube(s);
        for (int m = 0; m < kMoveCount; ++m) {
            sliceMove_[s][m] = encodeSlice(c.multiply(moveCubies[m]));
        }
    }

    // 2. Phase 2 move tables (10 moves in G1)
    cpMove_.resize(kCornerPermCount);
    for (uint16_t cp = 0; cp < kCornerPermCount; ++cp) {
        CubieCube c = CubieCube::identity();
        unrankPerm<8>(cp, c.cp.data());
        for (int m2 = 0; m2 < kPhase2MoveCount; ++m2) {
            const int m = static_cast<int>(kPhase2Moves[m2]);
            cpMove_[cp][m2] = encodeCornerPerm(c.multiply(moveCubies[m]));
        }
    }

    udEdgeMove_.resize(kUdEdgeCount);
    for (uint16_t ud = 0; ud < kUdEdgeCount; ++ud) {
        CubieCube c = CubieCube::identity();
        unrankPerm<8>(ud, c.ep.data());
        for (int m2 = 0; m2 < kPhase2MoveCount; ++m2) {
            const int m = static_cast<int>(kPhase2Moves[m2]);
            udEdgeMove_[ud][m2] = encodeUdEdge(c.multiply(moveCubies[m]));
        }
    }

    slicePermMove_.resize(kSlicePermCount);
    for (uint8_t sp = 0; sp < kSlicePermCount; ++sp) {
        CubieCube c = CubieCube::identity();
        std::array<uint8_t, 4> perm{};
        unrankPerm<4>(sp, perm.data());
        for (int i = 0; i < 4; ++i) {
            c.ep[8 + i] = static_cast<uint8_t>(8 + perm[i]);
        }
        for (int m2 = 0; m2 < kPhase2MoveCount; ++m2) {
            const int m = static_cast<int>(kPhase2Moves[m2]);
            slicePermMove_[sp][m2] = encodeSlicePerm(c.multiply(moveCubies[m]));
        }
    }

    // 3. Pruning tables
    buildPruneTable(kSliceCount, kTwistCount, kMoveCount, sliceMove_, twistMove_, sliceTwistPrune_);
    buildPruneTable(kSliceCount, kFlipCount, kMoveCount, sliceMove_, flipMove_, sliceFlipPrune_);
    buildPruneTable(kSlicePermCount, kCornerPermCount, kPhase2MoveCount,
                    slicePermMove_, cpMove_, sliceCpPrune_);
    buildPruneTable(kSlicePermCount, kUdEdgeCount, kPhase2MoveCount,
                    slicePermMove_, udEdgeMove_, sliceUdEdgePrune_);

    const auto end = std::chrono::steady_clock::now();
    buildTimeMs_ = std::chrono::duration<double, std::milli>(end - start).count();
    built_ = true;
}

size_t KociembaTables::memoryBytes() const noexcept {
    return twistMove_.size() * sizeof(twistMove_[0]) +
           flipMove_.size() * sizeof(flipMove_[0]) +
           sliceMove_.size() * sizeof(sliceMove_[0]) +
           cpMove_.size() * sizeof(cpMove_[0]) +
           udEdgeMove_.size() * sizeof(udEdgeMove_[0]) +
           slicePermMove_.size() * sizeof(slicePermMove_[0]) +
           sliceTwistPrune_.size() +
           sliceFlipPrune_.size() +
           sliceCpPrune_.size() +
           sliceUdEdgePrune_.size();
}

KociembaSolver::KociembaSolver(const KociembaTables& tables) : tables_(tables) {
    if (!tables_.isBuilt()) {
        throw std::runtime_error("KociembaTables must be built before creating KociembaSolver");
    }
}

struct KociembaSearch {
    const KociembaTables& tables;
    const CubieCube& rootCubie;
    const KociembaOptions& options;
    std::chrono::steady_clock::time_point startTime;

    std::vector<Move> phase1Moves;
    std::vector<Move> phase2Moves;
    std::vector<Move> bestMoves;
    int bestLength = std::numeric_limits<int>::max();
    bool hasSolution = false;
    bool stopRequested = false;
    uint64_t nodesExpanded = 0;

    int h1(uint16_t twist, uint16_t flip, uint16_t slice) const noexcept {
        const uint8_t dTwist =
            tables.sliceTwistPrune_[static_cast<size_t>(slice) * KociembaTables::kTwistCount + twist];
        const uint8_t dFlip =
            tables.sliceFlipPrune_[static_cast<size_t>(slice) * KociembaTables::kFlipCount + flip];
        return std::max(static_cast<int>(dTwist), static_cast<int>(dFlip));
    }

    int h2(uint16_t cp, uint16_t udEdge, uint8_t slicePerm) const noexcept {
        const uint8_t dCp =
            tables.sliceCpPrune_[static_cast<size_t>(slicePerm) * KociembaTables::kCornerPermCount + cp];
        const uint8_t dUd =
            tables.sliceUdEdgePrune_[static_cast<size_t>(slicePerm) * KociembaTables::kUdEdgeCount + udEdge];
        return std::max(static_cast<int>(dCp), static_cast<int>(dUd));
    }

    bool searchPhase2(uint16_t cp,
                      uint16_t udEdge,
                      uint8_t slicePerm,
                      int depthRemaining,
                      int prevFace) {
        const int dist = h2(cp, udEdge, slicePerm);
        if (dist > depthRemaining) {
            return false;
        }
        if (depthRemaining == 0) {
            return cp == 0 && udEdge == 0 && slicePerm == 0;
        }

        ++nodesExpanded;
        for (int m2 = 0; m2 < KociembaTables::kPhase2MoveCount; ++m2) {
            const Move move = KociembaTables::kPhase2Moves[m2];
            const int currFace = static_cast<int>(moveFace(move));
            if (shouldPruneFace(prevFace, currFace)) {
                continue;
            }

            phase2Moves.push_back(move);
            if (searchPhase2(tables.cpMove_[cp][m2],
                             tables.udEdgeMove_[udEdge][m2],
                             tables.slicePermMove_[slicePerm][m2],
                             depthRemaining - 1,
                             currFace)) {
                return true;
            }
            phase2Moves.pop_back();
        }
        return false;
    }

    void solvePhase2FromCurrentG1(int prevFace1) {
        CubieCube g1State = rootCubie;
        for (Move m : phase1Moves) {
            g1State.apply(m);
        }

        const uint16_t cp = KociembaTables::encodeCornerPerm(g1State);
        const uint16_t udEdge = KociembaTables::encodeUdEdge(g1State);
        const uint8_t slicePerm = KociembaTables::encodeSlicePerm(g1State);

        const int d1 = static_cast<int>(phase1Moves.size());
        const int maxD2 = std::min(18, bestLength - 1 - d1);
        const int minD2 = h2(cp, udEdge, slicePerm);

        for (int d2 = minD2; d2 <= maxD2; ++d2) {
            phase2Moves.clear();
            if (searchPhase2(cp, udEdge, slicePerm, d2, prevFace1)) {
                bestMoves = phase1Moves;
                bestMoves.insert(bestMoves.end(), phase2Moves.begin(), phase2Moves.end());
                bestLength = d1 + d2;
                hasSolution = true;
                if (bestLength <= options.targetLength) {
                    stopRequested = true;
                }
                return;
            }
        }
    }

    void searchPhase1(uint16_t twist,
                      uint16_t flip,
                      uint16_t slice,
                      int depthRemaining,
                      int prevFace) {
        if (stopRequested) return;

        const int dist = h1(twist, flip, slice);
        if (dist > depthRemaining) {
            return;
        }
        if (depthRemaining == 0) {
            if (twist == 0 && flip == 0 && slice == 0) {
                solvePhase2FromCurrentG1(prevFace);
            }
            return;
        }

        ++nodesExpanded;
        if (hasSolution && (nodesExpanded & 4095u) == 0) {
            const double elapsed = std::chrono::duration<double, std::milli>(
                std::chrono::steady_clock::now() - startTime).count();
            if (elapsed >= options.timeBudgetMs) {
                stopRequested = true;
                return;
            }
        }

        for (int m = 0; m < kMoveCount; ++m) {
            const int currFace = m / 3;
            if (shouldPruneFace(prevFace, currFace)) {
                continue;
            }

            const Move move = static_cast<Move>(m);
            phase1Moves.push_back(move);
            searchPhase1(tables.twistMove_[twist][m],
                         tables.flipMove_[flip][m],
                         tables.sliceMove_[slice][m],
                         depthRemaining - 1,
                         currFace);
            phase1Moves.pop_back();

            if (stopRequested) return;
        }
    }
};

SolveResult KociembaSolver::solve(const Cube& cube, const KociembaOptions& options) const {
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
        result.metrics.memoryBytes = tables_.memoryBytes();
        return result;
    }

    const uint16_t twist = KociembaTables::encodeTwist(root);
    const uint16_t flip = KociembaTables::encodeFlip(root);
    const uint16_t slice = KociembaTables::encodeSlice(root);

    KociembaSearch ctx{
        tables_,
        root,
        options,
        start,
        {},
        {},
        {},
        options.maxLength + 1,
        false,
        false,
        0
    };

    const int minD1 = ctx.h1(twist, flip, slice);
    const int maxD1 = std::min(12, options.maxLength);

    for (int d1 = minD1; d1 <= maxD1 && !ctx.stopRequested; ++d1) {
        if (ctx.hasSolution && d1 >= ctx.bestLength) {
            break;
        }
        ctx.phase1Moves.clear();
        ctx.searchPhase1(twist, flip, slice, d1, -1);
    }

    const auto end = std::chrono::steady_clock::now();
    result.metrics.nodesExpanded = ctx.nodesExpanded;
    result.metrics.elapsedMs = std::chrono::duration<double, std::milli>(end - start).count();
    result.metrics.memoryBytes = tables_.memoryBytes();

    if (ctx.hasSolution) {
        result.solved = true;
        result.moves = std::move(ctx.bestMoves);
        result.metrics.solutionLength = static_cast<int>(result.moves.size());
    } else {
        result.error = "No Kociemba solution found within maxLength=" +
                       std::to_string(options.maxLength);
    }

    return result;
}

SolveResult solveWithKociemba(const Cube& cube, const KociembaOptions& options) {
    static KociembaTables sharedTables = [] {
        KociembaTables tables;
        tables.build();
        return tables;
    }();
    KociembaSolver solver(sharedTables);
    return solver.solve(cube, options);
}

}  // namespace rubik
