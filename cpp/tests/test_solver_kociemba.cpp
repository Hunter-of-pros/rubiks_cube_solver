#include "rubik/cube.hpp"
#include "rubik/kociemba.hpp"
#include "rubik/move.hpp"
#include "rubik/scrambler.hpp"
#include "rubik/solver.hpp"

#include <cstdlib>
#include <iostream>
#include <numeric>
#include <vector>

using namespace rubik;

namespace {

void requireImpl(bool cond, const char* expr, int line) {
    if (!cond) {
        std::cerr << "Test assertion failed at line " << line << ": " << expr << '\n';
        std::exit(1);
    }
}

#define REQUIRE(cond) requireImpl((cond), #cond, __LINE__)

void testSolvedAndShallowScrambles(const KociembaSolver& solver) {
    // Solved cube
    {
        Cube c;
        const SolveResult res = solver.solve(c);
        REQUIRE(res.solved);
        REQUIRE(res.moves.empty());
    }

    // Pure G1 scramble
    {
        Cube c;
        c.apply("U R2 F2 D' L2 B2 U2 R2");
        const SolveResult res = solver.solve(c);
        REQUIRE(res.solved);
        c.apply(movesToString(res.moves));
        REQUIRE(c.isSolved());
    }

    // Superflip (known 20-move optimal position)
    {
        Cube superflip;
        superflip.apply("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");
        const SolveResult res = solver.solve(superflip);
        REQUIRE(res.solved);
        REQUIRE(res.metrics.solutionLength <= 24);
        superflip.apply(movesToString(res.moves));
        REQUIRE(superflip.isSolved());
        std::cout << "Superflip solved in " << res.metrics.solutionLength
                  << " moves, nodes=" << res.metrics.nodesExpanded
                  << ", time=" << res.metrics.elapsedMs << " ms\n";
    }
}

void testFiftyRandom20MoveScrambles(const KociembaSolver& solver) {
    constexpr int kTrials = 50;
    int totalMoves = 0;
    int maxMoves = 0;
    double totalMs = 0.0;
    double maxMs = 0.0;

    KociembaOptions opts;
    opts.maxLength = 25;
    opts.targetLength = 20;
    opts.timeBudgetMs = 50.0;

    for (uint32_t seed = 1; seed <= kTrials; ++seed) {
        Cube c = createScrambledCube(20, 1000 + seed);
        const SolveResult res = solver.solve(c, opts);
        REQUIRE(res.solved);
        REQUIRE(res.metrics.solutionLength <= opts.maxLength);

        c.apply(movesToString(res.moves));
        REQUIRE(c.isSolved());

        totalMoves += res.metrics.solutionLength;
        maxMoves = std::max(maxMoves, res.metrics.solutionLength);
        totalMs += res.metrics.elapsedMs;
        maxMs = std::max(maxMs, res.metrics.elapsedMs);
    }

    std::cout << "Kociemba 50x 20-move scrambles: avg_len="
              << (static_cast<double>(totalMoves) / kTrials)
              << ", max_len=" << maxMoves
              << ", avg_time=" << (totalMs / kTrials) << " ms"
              << ", max_time=" << maxMs << " ms\n";
}

void testInvalidCubeRejected(const KociembaSolver& solver) {
    Cube invalid;
    invalid.set(Face::U, 0, Color::Red);
    const SolveResult res = solver.solve(invalid);
    REQUIRE(!res.solved);
    REQUIRE(!res.error.empty());
}

}  // namespace

int main() {
    KociembaTables tables;
    tables.build();
    REQUIRE(tables.isBuilt());

    std::cout << "Kociemba tables built in " << tables.buildTimeMs() << " ms, memory="
              << (static_cast<double>(tables.memoryBytes()) / (1024.0 * 1024.0)) << " MB\n";

    KociembaSolver solver(tables);
    testSolvedAndShallowScrambles(solver);
    testFiftyRandom20MoveScrambles(solver);
    testInvalidCubeRejected(solver);

    std::cout << "All Phase 3C Kociemba tests passed.\n";
    return 0;
}

