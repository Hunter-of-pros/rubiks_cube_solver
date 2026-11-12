#include "rubik/scrambler.hpp"

#include <random>
#include <stdexcept>

namespace rubik {

namespace {

// Opposite faces share an axis: U/D (0), R/L (1), F/B (2).
int faceAxis(Face f) noexcept {
    return static_cast<int>(f) % 3;
}

}  // namespace

std::vector<Move> generateScramble(int length, uint32_t seed) {
    if (length < 0) {
        throw std::invalid_argument("Scramble length cannot be negative");
    }

    std::mt19937 rng(seed);
    std::uniform_int_distribution<int> turnDist(0, 2);

    std::vector<Move> moves;
    moves.reserve(static_cast<size_t>(length));

    int prevFace = -1;
    int prevPrevFace = -1;

    for (int i = 0; i < length; ++i) {
        std::vector<int> candidates;
        candidates.reserve(6);
        for (int f = 0; f < 6; ++f) {
            if (f == prevFace) {
                continue;  // Never turn the same face twice in a row.
            }
            if (prevPrevFace != -1 &&
                faceAxis(static_cast<Face>(f)) == faceAxis(static_cast<Face>(prevFace)) &&
                f == prevPrevFace) {
                continue;  // Avoid A B A' redundancies on opposite faces.
            }
            candidates.push_back(f);
        }

        std::uniform_int_distribution<size_t> faceDist(0, candidates.size() - 1);
        const int chosenFace = candidates[faceDist(rng)];
        const int turnOffset = turnDist(rng);  // 0=CW, 1=2, 2=CCW

        moves.push_back(static_cast<Move>(chosenFace * 3 + turnOffset));
        prevPrevFace = prevFace;
        prevFace = chosenFace;
    }

    return moves;
}

std::vector<Move> generateScramble(int length) {
    std::random_device rd;
    return generateScramble(length, rd());
}

Cube createScrambledCube(int length, uint32_t seed, std::vector<Move>* outMoves) {
    auto moves = generateScramble(length, seed);
    Cube cube;
    for (Move m : moves) {
        cube.apply(m);
    }
    if (outMoves != nullptr) {
        *outMoves = std::move(moves);
    }
    return cube;
}

}  // namespace rubik
