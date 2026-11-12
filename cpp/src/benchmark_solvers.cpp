#include "rubik/cube.hpp"
#include "rubik/kociemba.hpp"
#include "rubik/move.hpp"
#include "rubik/pattern_db.hpp"
#include "rubik/scrambler.hpp"
#include "rubik/solver.hpp"

#include <fstream>
#include <iomanip>
#include <iostream>
#include <string>
#include <vector>

using namespace rubik;

namespace {

void recordRow(std::ostream& csv,
               const std::string& algo,
               int depth,
               uint32_t seed,
               const SolveResult& res) {
    csv << algo << ','
        << depth << ','
        << seed << ','
        << (res.solved ? 1 : 0) << ','
        << res.metrics.solutionLength << ','
        << res.metrics.nodesExpanded << ','
        << std::fixed << std::setprecision(4) << res.metrics.elapsedMs << ','
        << res.metrics.memoryBytes << '\n';
}

}  // namespace

int main(int argc, char** argv) {
    std::string csvPath;
    int trials = 10;

    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg == "--csv" && i + 1 < argc) {
            csvPath = argv[++i];
        } else if (arg == "--trials" && i + 1 < argc) {
            trials = std::stoi(argv[++i]);
        }
    }

    PdbHeuristic pdb;
    pdb.build();
    KociembaTables kociembaTables;
    kociembaTables.build();
    KociembaSolver kociemba(kociembaTables);

    std::ofstream fileOut;
    if (!csvPath.empty()) {
        fileOut.open(csvPath);
        if (!fileOut) {
            std::cerr << "Failed to open CSV output path: " << csvPath << '\n';
            return 1;
        }
    }
    std::ostream& csv = fileOut.is_open() ? fileOut : std::cout;
    csv << "algorithm,scramble_depth,seed,solved,solution_length,nodes_expanded,elapsed_ms,memory_bytes\n";

    // 1. Shallow depths (4..6): compare all three solvers head-to-head.
    for (int depth : {4, 5, 6}) {
        for (int t = 0; t < trials; ++t) {
            const uint32_t seed = static_cast<uint32_t>(depth * 100 + t);
            const Cube c = createScrambledCube(depth, seed);
            recordRow(csv, "ida-base", depth, seed, solveWithIdaStarBaseline(c));
            recordRow(csv, "ida-pdb", depth, seed, solveWithIdaStarPdb(c, pdb));
            recordRow(csv, "kociemba", depth, seed, kociemba.solve(c));
        }
    }

    // 2. Medium depths (8..10): compare PDB IDA* vs Kociemba.
    for (int depth : {8, 10}) {
        for (int t = 0; t < trials; ++t) {
            const uint32_t seed = static_cast<uint32_t>(depth * 100 + t);
            const Cube c = createScrambledCube(depth, seed);
            recordRow(csv, "ida-pdb", depth, seed, solveWithIdaStarPdb(c, pdb));
            recordRow(csv, "kociemba", depth, seed, kociemba.solve(c));
        }
    }

    // 3. Full WCA-length scrambles (20 moves): Kociemba benchmark.
    for (int t = 0; t < trials * 2; ++t) {
        const uint32_t seed = static_cast<uint32_t>(2000 + t);
        const Cube c = createScrambledCube(20, seed);
        recordRow(csv, "kociemba", 20, seed, kociemba.solve(c));
    }

    if (fileOut.is_open()) {
        std::cout << "Benchmark CSV written to " << csvPath << '\n';
    }
    std::cerr << "Setup summary — PDB build: " << pdb.buildTimeMs()
              << " ms (" << pdb.memoryBytes() << " bytes), Kociemba build: "
              << kociembaTables.buildTimeMs() << " ms (" << kociembaTables.memoryBytes()
              << " bytes)\n";

    return 0;
}

