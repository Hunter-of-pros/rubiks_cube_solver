#pragma once

#include "rubik/cube.hpp"

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace rubik {

// All 18 standard Half-Turn Metric (HTM) moves ordered by face (URFDLB)
// and turn count (CW = 0, double = 1, CCW = 2).
enum class Move : uint8_t {
    U = 0, U2 = 1, Up = 2,
    R = 3, R2 = 4, Rp = 5,
    F = 6, F2 = 7, Fp = 8,
    D = 9, D2 = 10, Dp = 11,
    L = 12, L2 = 13, Lp = 14,
    B = 15, B2 = 16, Bp = 17
};

constexpr int kMoveCount = 18;

Face moveFace(Move move) noexcept;

// Returns 1 for clockwise, 2 for 180-degree double, 3 for counterclockwise.
int moveQuarterTurns(Move move) noexcept;

Move makeMove(Face face, int quarterTurns);
Move inverseMove(Move move) noexcept;

std::string moveToString(Move move);
Move parseMove(std::string_view token);
std::vector<Move> parseMoves(std::string_view sequence);
std::string movesToString(const std::vector<Move>& moves);

}  // namespace rubik

