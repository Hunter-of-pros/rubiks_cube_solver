#include "rubik/cube.hpp"
#include "rubik/cubie.hpp"
#include "rubik/move.hpp"
#include "rubik/scrambler.hpp"
#include "rubik/solver.hpp"

#include <cstdlib>
#include <iostream>

using namespace rubik;

namespace {

void requireImpl(bool cond, const char* expr, int line) {
    if (!cond) {
        std::cerr << "Test assertion failed at line " << line << ": " << expr << '\n';
        std::exit(1);
    }
}

#define REQUIRE(cond) requireImpl((cond), #cond, __LINE__)

void testCubieMultiplicationMatchesFaceletCube() {
    Cube facelet;
    CubieCube cubie = CubieCube::identity();

    const auto scramble = generateScramble(300, 999);
    for (Move m : scramble) {
        facelet.apply(m);
        cubie.apply(m);
        REQUIRE(toCubieCube(facelet) == cubie);
    }
}

void testBaselineIdaStarSolvesShallowScramblesOptimally() {
    // 0-move solved cube
    {
        Cube c;
        const SolveResult res = solveWithIdaStarBaseline(c);
        REQUIRE(res.solved);
        REQUIRE(res.moves.empty());
        REQUIRE(res.metrics.solutionLength == 0);
    }

    // 1-move scrambles across multiple faces must solve in exactly 1 move.
    for (int m = 0; m < kMoveCount; ++m) {
        Cube c;
        c.apply(static_cast<Move>(m));
        const SolveResult res = solveWithIdaStarBaseline(c);
        REQUIRE(res.solved);
        REQUIRE(res.metrics.solutionLength == 1);
        c.apply(movesToString(res.moves));
        REQUIRE(c.isSolved());
    }

    // Depth 2..5 scrambles: optimal solution must be <= scramble length and solve the cube.
    for (int depth = 2; depth <= 5; ++depth) {
        for (uint32_t seed = 10; seed < 15; ++seed) {
            Cube c = createScrambledCube(depth, seed + static_cast<uint32_t>(depth * 100));
            const SolveResult res = solveWithIdaStarBaseline(c);
            REQUIRE(res.solved);
            REQUIRE(res.metrics.solutionLength <= depth);
            c.apply(movesToString(res.moves));
            REQUIRE(c.isSolved());
        }
    }

    // Print a quick baseline measurement for a 6-move scramble so we can observe node count.
    Cube sixMove = createScrambledCube(6, 42);
    const SolveResult res6 = solveWithIdaStarBaseline(sixMove);
    REQUIRE(res6.solved);
    REQUIRE(res6.metrics.solutionLength <= 6);
    sixMove.apply(movesToString(res6.moves));
    REQUIRE(sixMove.isSolved());
    std::cout << "6-move baseline IDA* solved in " << res6.metrics.solutionLength
              << " moves, nodes=" << res6.metrics.nodesExpanded
              << ", time=" << res6.metrics.elapsedMs << " ms\n";
}

void testRejectsInvalidCubeAndRespectsNodeLimit() {
    Cube invalid;
    invalid.set(Face::U, 0, Color::Red);
    const SolveResult badRes = solveWithIdaStarBaseline(invalid);
    REQUIRE(!badRes.solved);
    REQUIRE(!badRes.error.empty());

    Cube deep = createScrambledCube(15, 77);
    SolveOptions opts;
    opts.maxDepth = 20;
    opts.maxNodes = 5000;
    const SolveResult limited = solveWithIdaStarBaseline(deep, opts);
    REQUIRE(!limited.solved);
    REQUIRE(limited.metrics.nodesExpanded == 5000);
}

}  // namespace

int main() {
    testCubieMultiplicationMatchesFaceletCube();
    testBaselineIdaStarSolvesShallowScramblesOptimally();
    testRejectsInvalidCubeAndRespectsNodeLimit();
    std::cout << "All Phase 3A cubie-move and baseline IDA* tests passed.\n";
    return 0;
}
