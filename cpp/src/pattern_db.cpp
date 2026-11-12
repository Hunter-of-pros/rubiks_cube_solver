#include "rubik/pattern_db.hpp"

#include <algorithm>
#include <chrono>
#include <stdexcept>

namespace rubik {

namespace {

struct MoveSlotTable {
    std::array<std::array<uint8_t, 12>, kMoveCount> nextSlot{};
    std::array<std::array<uint8_t, 12>, kMoveCount> oriDelta{};
};

const MoveSlotTable& getMoveSlotTable(PieceType type) {
    static const MoveSlotTable cornerTable = [] {
        MoveSlotTable t;
        const auto& moves = CubieCube::moveTable();
        for (int m = 0; m < kMoveCount; ++m) {
            for (uint8_t dst = 0; dst < 8; ++dst) {
                const uint8_t src = moves[m].cp[dst];
                t.nextSlot[m][src] = dst;
                t.oriDelta[m][src] = moves[m].co[dst];
            }
        }
        return t;
    }();

    static const MoveSlotTable edgeTable = [] {
        MoveSlotTable t;
        const auto& moves = CubieCube::moveTable();
        for (int m = 0; m < kMoveCount; ++m) {
            for (uint8_t dst = 0; dst < 12; ++dst) {
                const uint8_t src = moves[m].ep[dst];
                t.nextSlot[m][src] = dst;
                t.oriDelta[m][src] = moves[m].eo[dst];
            }
        }
        return t;
    }();

    return (type == PieceType::Corner) ? cornerTable : edgeTable;
}

}  // namespace

PatternDatabase::PatternDatabase(PieceType type, std::vector<uint8_t> subsetPieces)
    : type_(type),
      totalPieces_(type == PieceType::Corner ? 8 : 12),
      oriBase_(type == PieceType::Corner ? 3 : 2),
      subsetPieces_(std::move(subsetPieces)) {
    if (subsetPieces_.empty() || subsetPieces_.size() > kMaxSubset) {
        throw std::invalid_argument("PatternDatabase subset size must be in [1, 6]");
    }
    for (uint8_t p : subsetPieces_) {
        if (p >= totalPieces_) {
            throw std::out_of_range("Subset piece index out of range");
        }
    }

    uint64_t permCount = 1;
    uint64_t oriCount = 1;
    for (size_t i = 0; i < subsetPieces_.size(); ++i) {
        permCount *= static_cast<uint64_t>(totalPieces_ - static_cast<int>(i));
        oriCount *= static_cast<uint64_t>(oriBase_);
    }

    oriSpaceSize_ = static_cast<uint32_t>(oriCount);
    totalStates_ = static_cast<uint32_t>(permCount * oriCount);
}

uint32_t PatternDatabase::rankState(const std::array<uint8_t, kMaxSubset>& slots,
                                    const std::array<uint8_t, kMaxSubset>& oris) const noexcept {
    const size_t k = subsetPieces_.size();
    uint32_t permRank = 0;
    uint32_t oriRank = 0;

    for (size_t i = 0; i < k; ++i) {
        int smallerBefore = 0;
        for (size_t j = 0; j < i; ++j) {
            if (slots[j] < slots[i]) {
                ++smallerBefore;
            }
        }
        const uint32_t digit = static_cast<uint32_t>(slots[i] - smallerBefore);
        permRank = permRank * static_cast<uint32_t>(totalPieces_ - static_cast<int>(i)) + digit;
        oriRank = oriRank * static_cast<uint32_t>(oriBase_) + oris[i];
    }

    return permRank * oriSpaceSize_ + oriRank;
}

void PatternDatabase::unrankState(uint32_t index,
                                  std::array<uint8_t, kMaxSubset>& slots,
                                  std::array<uint8_t, kMaxSubset>& oris) const noexcept {
    const size_t k = subsetPieces_.size();
    uint32_t oriRank = index % oriSpaceSize_;
    uint32_t permRank = index / oriSpaceSize_;

    for (size_t i = k; i > 0; --i) {
        const size_t idx = i - 1;
        oris[idx] = static_cast<uint8_t>(oriRank % static_cast<uint32_t>(oriBase_));
        oriRank /= static_cast<uint32_t>(oriBase_);
    }

    std::array<uint8_t, kMaxSubset> digits{};
    for (size_t i = k; i > 0; --i) {
        const size_t idx = i - 1;
        const uint32_t radix = static_cast<uint32_t>(totalPieces_ - static_cast<int>(idx));
        digits[idx] = static_cast<uint8_t>(permRank % radix);
        permRank /= radix;
    }

    std::array<bool, 12> used{};
    for (size_t i = 0; i < k; ++i) {
        uint8_t count = 0;
        for (int s = 0; s < totalPieces_; ++s) {
            if (!used[s]) {
                if (count == digits[i]) {
                    slots[i] = static_cast<uint8_t>(s);
                    used[s] = true;
                    break;
                }
                ++count;
            }
        }
    }
}

void PatternDatabase::build() {
    if (built_) return;

    table_.assign(totalStates_, 0xFF);
    const MoveSlotTable& transitions = getMoveSlotTable(type_);
    const size_t k = subsetPieces_.size();

    std::array<uint8_t, kMaxSubset> solvedSlots{};
    std::array<uint8_t, kMaxSubset> solvedOris{};
    for (size_t i = 0; i < k; ++i) {
        solvedSlots[i] = subsetPieces_[i];
        solvedOris[i] = 0;
    }

    const uint32_t rootIdx = rankState(solvedSlots, solvedOris);
    table_[rootIdx] = 0;

    std::vector<uint32_t> frontier;
    std::vector<uint32_t> nextFrontier;
    frontier.push_back(rootIdx);

    uint8_t depth = 0;
    while (!frontier.empty()) {
        maxDistance_ = depth;
        nextFrontier.clear();

        for (uint32_t stateIdx : frontier) {
            std::array<uint8_t, kMaxSubset> slots{};
            std::array<uint8_t, kMaxSubset> oris{};
            unrankState(stateIdx, slots, oris);

            for (int m = 0; m < kMoveCount; ++m) {
                std::array<uint8_t, kMaxSubset> nextSlots{};
                std::array<uint8_t, kMaxSubset> nextOris{};
                for (size_t i = 0; i < k; ++i) {
                    const uint8_t s = slots[i];
                    nextSlots[i] = transitions.nextSlot[m][s];
                    nextOris[i] = static_cast<uint8_t>((oris[i] + transitions.oriDelta[m][s]) % oriBase_);
                }

                const uint32_t nextIdx = rankState(nextSlots, nextOris);
                if (table_[nextIdx] == 0xFF) {
                    table_[nextIdx] = static_cast<uint8_t>(depth + 1);
                    nextFrontier.push_back(nextIdx);
                }
            }
        }

        frontier.swap(nextFrontier);
        ++depth;
    }

    built_ = true;
}

uint8_t PatternDatabase::lookupFromInverse(const std::array<uint8_t, 12>& slotOfPiece,
                                           const std::array<uint8_t, 12>& oriOfPiece) const noexcept {
    std::array<uint8_t, kMaxSubset> slots{};
    std::array<uint8_t, kMaxSubset> oris{};
    const size_t k = subsetPieces_.size();
    for (size_t i = 0; i < k; ++i) {
        const uint8_t piece = subsetPieces_[i];
        slots[i] = slotOfPiece[piece];
        oris[i] = oriOfPiece[piece];
    }
    return table_[rankState(slots, oris)];
}

uint8_t PatternDatabase::lookup(const CubieCube& state) const noexcept {
    std::array<uint8_t, 12> slotOfPiece{};
    std::array<uint8_t, 12> oriOfPiece{};
    if (type_ == PieceType::Corner) {
        for (uint8_t slot = 0; slot < 8; ++slot) {
            const uint8_t piece = state.cp[slot];
            slotOfPiece[piece] = slot;
            oriOfPiece[piece] = state.co[slot];
        }
    } else {
        for (uint8_t slot = 0; slot < 12; ++slot) {
            const uint8_t piece = state.ep[slot];
            slotOfPiece[piece] = slot;
            oriOfPiece[piece] = state.eo[slot];
        }
    }
    return lookupFromInverse(slotOfPiece, oriOfPiece);
}

PdbHeuristic::PdbHeuristic() {
    // Two 5-corner PDBs covering all 8 corners.
    cornerDbs_.emplace_back(PieceType::Corner, std::vector<uint8_t>{0, 1, 2, 3, 4});
    cornerDbs_.emplace_back(PieceType::Corner, std::vector<uint8_t>{3, 4, 5, 6, 7});

    // Three 5-edge PDBs covering all 12 edges (U/D layers + E-slice).
    edgeDbs_.emplace_back(PieceType::Edge, std::vector<uint8_t>{0, 1, 2, 3, 8});
    edgeDbs_.emplace_back(PieceType::Edge, std::vector<uint8_t>{4, 5, 6, 7, 9});
    edgeDbs_.emplace_back(PieceType::Edge, std::vector<uint8_t>{0, 5, 8, 10, 11});
}

void PdbHeuristic::build() {
    if (isBuilt()) return;

    const auto start = std::chrono::steady_clock::now();
    for (auto& db : cornerDbs_) {
        db.build();
    }
    for (auto& db : edgeDbs_) {
        db.build();
    }
    const auto end = std::chrono::steady_clock::now();
    buildTimeMs_ = std::chrono::duration<double, std::milli>(end - start).count();
}

bool PdbHeuristic::isBuilt() const noexcept {
    for (const auto& db : cornerDbs_) {
        if (!db.isBuilt()) return false;
    }
    for (const auto& db : edgeDbs_) {
        if (!db.isBuilt()) return false;
    }
    return true;
}

int PdbHeuristic::evaluate(const CubieCube& state) const noexcept {
    std::array<uint8_t, 12> cornerSlot{};
    std::array<uint8_t, 12> cornerOri{};
    for (uint8_t slot = 0; slot < 8; ++slot) {
        const uint8_t piece = state.cp[slot];
        cornerSlot[piece] = slot;
        cornerOri[piece] = state.co[slot];
    }

    uint8_t best = 0;
    for (const auto& db : cornerDbs_) {
        best = std::max(best, db.lookupFromInverse(cornerSlot, cornerOri));
    }

    std::array<uint8_t, 12> edgeSlot{};
    std::array<uint8_t, 12> edgeOri{};
    for (uint8_t slot = 0; slot < 12; ++slot) {
        const uint8_t piece = state.ep[slot];
        edgeSlot[piece] = slot;
        edgeOri[piece] = state.eo[slot];
    }

    for (const auto& db : edgeDbs_) {
        best = std::max(best, db.lookupFromInverse(edgeSlot, edgeOri));
    }

    return static_cast<int>(best);
}

size_t PdbHeuristic::memoryBytes() const noexcept {
    size_t total = 0;
    for (const auto& db : cornerDbs_) {
        total += db.memoryBytes();
    }
    for (const auto& db : edgeDbs_) {
        total += db.memoryBytes();
    }
    return total;
}

}  // namespace rubik

