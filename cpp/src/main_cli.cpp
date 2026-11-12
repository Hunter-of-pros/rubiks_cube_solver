#include "rubik/cube.hpp"
#include "rubik/cubie.hpp"
#include "rubik/kociemba.hpp"
#include "rubik/move.hpp"
#include "rubik/solver.hpp"

#include <iostream>
#include <string>

namespace {

std::string jsonEscape(const std::string& input) {
    std::string out;
    out.reserve(input.size());
    for (char ch : input) {
        if (ch == '"' || ch == '\\') out.push_back('\\');
        out.push_back(ch);
    }
    return out;
}

void printUsage() {
    std::cerr << "Usage: rubik_solver [--facelets <54-char> | --scramble \"<moves>\"] "
                 "[--algo kociemba|ida-pdb|ida-base] [--json]\n";
}

}  // namespace

int main(int argc, char** argv) {
    std::string facelets;
    std::string scramble;
    std::string algo = "kociemba";
    bool jsonOutput = false;

    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg == "--facelets" && i + 1 < argc) {
            facelets = argv[++i];
        } else if (arg == "--scramble" && i + 1 < argc) {
            scramble = argv[++i];
        } else if (arg == "--algo" && i + 1 < argc) {
            algo = argv[++i];
        } else if (arg == "--json") {
            jsonOutput = true;
        } else {
            printUsage();
            return 1;
        }
    }

    if (facelets.empty() == scramble.empty()) {
        printUsage();
        return 1;
    }

    try {
        rubik::Cube cube;
        if (!facelets.empty()) {
            cube = rubik::Cube::fromFaceletString(facelets);
        } else {
            cube.apply(scramble);
        }

        const rubik::ValidationResult validation = rubik::validateCube(cube);
        rubik::SolveResult result;

        if (!validation.valid) {
            result.solved = false;
            result.error = validation.message;
        } else if (algo == "kociemba") {
            result = rubik::solveWithKociemba(cube);
        } else if (algo == "ida-pdb") {
            result = rubik::solveWithIdaStarPdb(cube);
        } else if (algo == "ida-base") {
            result = rubik::solveWithIdaStarBaseline(cube);
        } else {
            std::cerr << "Unknown algorithm: " << algo << '\n';
            return 1;
        }

        const std::string movesStr = rubik::movesToString(result.moves);
        if (jsonOutput) {
            std::cout << "{"
                      << "\"valid\":" << (validation.valid ? "true" : "false") << ","
                      << "\"solved\":" << (result.solved ? "true" : "false") << ","
                      << "\"algorithm\":\"" << jsonEscape(algo) << "\","
                      << "\"moves\":\"" << jsonEscape(movesStr) << "\","
                      << "\"solution_length\":" << result.metrics.solutionLength << ","
                      << "\"nodes_expanded\":" << result.metrics.nodesExpanded << ","
                      << "\"elapsed_ms\":" << result.metrics.elapsedMs << ","
                      << "\"memory_bytes\":" << result.metrics.memoryBytes << ","
                      << "\"error\":\"" << jsonEscape(result.error) << "\""
                      << "}\n";
        } else {
            if (!validation.valid || !result.solved) {
                std::cerr << "Failed: " << result.error << '\n';
                return 1;
            }
            std::cout << "Algorithm: " << algo << '\n'
                      << "Solution (" << result.metrics.solutionLength << " moves): "
                      << (movesStr.empty() ? "(already solved)" : movesStr) << '\n'
                      << "Nodes: " << result.metrics.nodesExpanded
                      << " | Time: " << result.metrics.elapsedMs << " ms"
                      << " | Memory: " << result.metrics.memoryBytes << " bytes\n";
        }

        return result.solved ? 0 : 2;
    } catch (const std::exception& ex) {
        if (jsonOutput) {
            std::cout << "{\"valid\":false,\"solved\":false,\"error\":\""
                      << jsonEscape(ex.what()) << "\"}\n";
        } else {
            std::cerr << "Error: " << ex.what() << '\n';
        }
        return 1;
    }
}

