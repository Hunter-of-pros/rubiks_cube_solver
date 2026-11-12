#include "rubik/cube.hpp"
#include "rubik/cubie.hpp"
#include "rubik/move.hpp"
#include "rubik/pattern_db.hpp"
#include "rubik/scrambler.hpp"
#include "rubik/solver.hpp"

#include <cstdlib>
#include <iostream>
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

void testPdbBuildAndAdmissibility(const PdbHeuristic& pdb) {
    REQUIRE(pdb.isBuilt());
    REQUIRE(pdb.memoryBytes() > 0);
    std::cout << "PDB built in " << pdb.buildTimeMs() << " ms, memory="
              << (static_cast<double>(pdb.memoryBytes()) / (1024.0 * 1024.0)) << " MB\n";

    // Solved state must have heuristic 0.
    REQUIRE(pdb.evaluate(CubieCube::identity()) == 0);

    // Every single move must have heuristic == 1.
    for (int m = 0; m < kMoveCount; ++m) {
        CubieCube c = CubieCube::identity();
        c.apply(static_cast<Move>(m));
        REQUIRE(pdb.evaluate(c) == 1);
    }

    // Admissibility check on shallow scrambles: h(s) <= true optimal distance.
    for (int depth = 1; depth <= 5; ++depth) {
        Cube c = createScrambledCube(depth, static_cast<uint32_t>(500 + depth));
        const int h = pdb.evaluate(toCubieCube(c));
        const SolveResult opt = solveWithIdaStarBaseline(c);
        REQUIRE(opt.solved);
        REQUIRE(h <= opt.metrics.solutionLength);
    }
}

void testPdbBeatsBaselineOn6To9MoveScrambles(const PdbHeuristic& pdb) {
    // Direct comparison on the 6-move scramble from Step 3A (seed=42).
    {
        Cube c = createScrambledCube(6, 42);
        const SolveResult baseRes = solveWithIdaStarBaseline(c);
        const SolveResult pdbRes = solveWithIdaStarPdb(c, pdb);

        REQUIRE(baseRes.solved);
        REQUIRE(pdbRes.solved);
        REQUIRE(pdbRes.metrics.solutionLength == baseRes.metrics.solutionLength);
        REQUIRE(pdbRes.metrics.nodesExpanded < baseRes.metrics.nodesExpanded);

        Cube verify = c;
        verify.apply(movesToString(pdbRes.moves));
        REQUIRE(verify.isSolved());

        std::cout << "6-move (seed=42): baseline nodes=" << baseRes.metrics.nodesExpanded
                  << " (" << baseRes.metrics.elapsedMs << " ms) vs PDB nodes="
                  << pdbRes.metrics.nodesExpanded << " (" << pdbRes.metrics.elapsedMs << " ms)\n";
    }

    // Solve deeper 8-move and 10-move scrambles cleanly.
    for (int depth : {8, 10}) {
        for (uint32_t seed = 1; seed <= 3; ++seed) {
            Cube c = createScrambledCube(depth, seed + static_cast<uint32_t>(depth * 10));
            const SolveResult res = solveWithIdaStarPdb(c, pdb);
            REQUIRE(res.solved);
            REQUIRE(res.metrics.solutionLength <= depth);

            Cube verify = c;
            verify.apply(movesToString(res.moves));
            REQUIRE(verify.isSolved());

            if (seed == 1) {
                std::cout << depth << "-move (seed=" << (seed + depth * 10)
                          << "): len=" << res.metrics.solutionLength
                          << ", nodes=" << res.metrics.nodesExpanded
                          << ", time=" << res.metrics.elapsedMs << " ms\n";
            }
        }
    }
}

}  // namespace

int main() {
    PdbHeuristic pdb;
    pdb.build();

    testPdbBuildAndAdmissibility(pdb);
    testPdbBeatsBaselineOn6To9MoveScrambles(pdb);

    std::cout << "All Phase 3B Pattern Database IDA* tests passed.\n";
    return 0;
}

