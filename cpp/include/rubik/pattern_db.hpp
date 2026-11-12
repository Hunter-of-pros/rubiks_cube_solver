#pragma once

#include "rubik/cubie.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace rubik {

enum class PieceType {
    Corner,
    Edge
};

// Precomputes exact HTM move distances for a chosen subset of corners or edges.
//
// Each state in the subset is ranked bijectively into [0, tableSize) using
// mixed-radix Lehmer coding for piece positions and base-3/base-2 for
// orientations, then populated via BFS starting from the solved configuration.
class PatternDatabase {
public:
    PatternDatabase(PieceType type, std::vector<uint8_t> subsetPieces);

    void build();
    bool isBuilt() const noexcept { return built_; }

    uint8_t lookup(const CubieCube& state) const noexcept;
    uint8_t lookupFromInverse(const std::array<uint8_t, 12>& slotOfPiece,
                              const std::array<uint8_t, 12>& oriOfPiece) const noexcept;

    size_t size() const noexcept { return table_.size(); }
    size_t memoryBytes() const noexcept { return table_.size(); }
    uint8_t maxDistance() const noexcept { return maxDistance_; }

private:
    static constexpr size_t kMaxSubset = 6;

    PieceType type_;
    int totalPieces_ = 0;  // 8 for Corner, 12 for Edge
    int oriBase_ = 0;      // 3 for Corner, 2 for Edge
    std::vector<uint8_t> subsetPieces_;
    uint32_t oriSpaceSize_ = 1;
    uint32_t totalStates_ = 1;
    std::vector<uint8_t> table_;
    bool built_ = false;
    uint8_t maxDistance_ = 0;

    uint32_t rankState(const std::array<uint8_t, kMaxSubset>& slots,
                       const std::array<uint8_t, kMaxSubset>& oris) const noexcept;
    void unrankState(uint32_t index,
                     std::array<uint8_t, kMaxSubset>& slots,
                     std::array<uint8_t, kMaxSubset>& oris) const noexcept;
};

// Combines multiple corner and edge pattern databases using max(),
// preserving admissibility while tightening lower bounds across all pieces.
class PdbHeuristic {
public:
    PdbHeuristic();

    void build();
    bool isBuilt() const noexcept;

    int evaluate(const CubieCube& state) const noexcept;
    size_t memoryBytes() const noexcept;
    double buildTimeMs() const noexcept { return buildTimeMs_; }

private:
    std::vector<PatternDatabase> cornerDbs_;
    std::vector<PatternDatabase> edgeDbs_;
    double buildTimeMs_ = 0.0;
};

}  // namespace rubik

