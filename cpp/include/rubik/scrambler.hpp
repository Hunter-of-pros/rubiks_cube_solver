#pragma once

#include "rubik/cube.hpp"
#include "rubik/move.hpp"

#include <cstdint>
#include <vector>

namespace rubik {

// Generates a random move sequence of `length` moves without redundant
// consecutive turns on the same face or commutative opposite-axis repeats
// (e.g., R L R').
std::vector<Move> generateScramble(int length, uint32_t seed);
std::vector<Move> generateScramble(int length);

// Returns a scrambled cube and, optionally, the move sequence used.
Cube createScrambledCube(int length, uint32_t seed, std::vector<Move>* outMoves = nullptr);

}  // namespace rubik
