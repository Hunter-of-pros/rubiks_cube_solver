#pragma once

#include "rubik/cube.hpp"
#include "rubik/cubie.hpp"
#include "rubik/move.hpp"
#include "rubik/solver.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace rubik {

// Holds precomputed coordinate move tables and BFS pruning tables
// for Kociemba's Two-Phase algorithm.
class KociembaTables {
public:
    static constexpr int kTwistCount = 2187;      // 3^7
    static constexpr int kFlipCount = 2048;       // 2^11
    static constexpr int kSliceCount = 495;       // C(12, 4)
    static constexpr int kCornerPermCount = 40320;  // 8!
    static constexpr int kUdEdgeCount = 40320;      // 8!
    static constexpr int kSlicePermCount = 24;      // 4!
    static constexpr int kPhase2MoveCount = 10;

    static constexpr std::array<Move, kPhase2MoveCount> kPhase2Moves = {
        Move::U, Move::U2, Move::Up,
        Move::R2, Move::F2,
        Move::D, Move::D2, Move::Dp,
        Move::L2, Move::B2
    };

    void build();
    bool isBuilt() const noexcept { return built_; }

    size_t memoryBytes() const noexcept;
    double buildTimeMs() const noexcept { return buildTimeMs_; }

    static uint16_t encodeTwist(const CubieCube& c) noexcept;
    static uint16_t encodeFlip(const CubieCube& c) noexcept;
    static uint16_t encodeSlice(const CubieCube& c) noexcept;
    static uint16_t encodeCornerPerm(const CubieCube& c) noexcept;
    static uint16_t encodeUdEdge(const CubieCube& c) noexcept;
    static uint8_t encodeSlicePerm(const CubieCube& c) noexcept;

private:
    friend class KociembaSolver;
    friend struct KociembaSearch;

    bool built_ = false;
    double buildTimeMs_ = 0.0;

    // Move transition tables
    std::vector<std::array<uint16_t, kMoveCount>> twistMove_;
    std::vector<std::array<uint16_t, kMoveCount>> flipMove_;
    std::vector<std::array<uint16_t, kMoveCount>> sliceMove_;
    std::vector<std::array<uint16_t, kPhase2MoveCount>> cpMove_;
    std::vector<std::array<uint16_t, kPhase2MoveCount>> udEdgeMove_;
    std::vector<std::array<uint8_t, kPhase2MoveCount>> slicePermMove_;

    // BFS pruning tables
    std::vector<uint8_t> sliceTwistPrune_;   // kSliceCount * kTwistCount
    std::vector<uint8_t> sliceFlipPrune_;    // kSliceCount * kFlipCount
    std::vector<uint8_t> sliceCpPrune_;      // kSlicePermCount * kCornerPermCount
    std::vector<uint8_t> sliceUdEdgePrune_;  // kSlicePermCount * kUdEdgeCount
};

class KociembaSolver {
public:
    explicit KociembaSolver(const KociembaTables& tables);

    SolveResult solve(const Cube& cube, const KociembaOptions& options = {}) const;

private:
    const KociembaTables& tables_;
};

}  // namespace rubik
