#include "rubik/cubie.hpp"

#include <sstream>
#include <stdexcept>

namespace rubik {

namespace {

constexpr int stickerIdx(Face face, int local) noexcept {
    return static_cast<int>(face) * Cube::kStickersPerFace + local;
}

// Each corner slot lists its 3 facelet indices in clockwise order starting
// from the U/D facelet when looking at that corner from outside the cube.
constexpr std::array<std::array<int, 3>, 8> kCornerFacelets = {{
    {stickerIdx(Face::U, 8), stickerIdx(Face::R, 0), stickerIdx(Face::F, 2)},  // URF
    {stickerIdx(Face::U, 6), stickerIdx(Face::F, 0), stickerIdx(Face::L, 2)},  // UFL
    {stickerIdx(Face::U, 0), stickerIdx(Face::L, 0), stickerIdx(Face::B, 2)},  // ULB
    {stickerIdx(Face::U, 2), stickerIdx(Face::B, 0), stickerIdx(Face::R, 2)},  // UBR
    {stickerIdx(Face::D, 2), stickerIdx(Face::F, 8), stickerIdx(Face::R, 6)},  // DFR
    {stickerIdx(Face::D, 0), stickerIdx(Face::L, 8), stickerIdx(Face::F, 6)},  // DLF
    {stickerIdx(Face::D, 6), stickerIdx(Face::B, 8), stickerIdx(Face::L, 6)},  // DBL
    {stickerIdx(Face::D, 8), stickerIdx(Face::R, 8), stickerIdx(Face::B, 6)},  // DRB
}};

constexpr std::array<std::array<Color, 3>, 8> kCornerColors = {{
    {Color::White,  Color::Red,    Color::Green},   // URF
    {Color::White,  Color::Green,  Color::Orange},  // UFL
    {Color::White,  Color::Orange, Color::Blue},    // ULB
    {Color::White,  Color::Blue,   Color::Red},     // UBR
    {Color::Yellow, Color::Green,  Color::Red},     // DFR
    {Color::Yellow, Color::Orange, Color::Green},   // DLF
    {Color::Yellow, Color::Blue,   Color::Orange},  // DBL
    {Color::Yellow, Color::Red,    Color::Blue},    // DRB
}};

// Each edge slot lists its primary orientation facelet first (U/D, or F/B in E-slice).
constexpr std::array<std::array<int, 2>, 12> kEdgeFacelets = {{
    {stickerIdx(Face::U, 5), stickerIdx(Face::R, 1)},  // UR
    {stickerIdx(Face::U, 7), stickerIdx(Face::F, 1)},  // UF
    {stickerIdx(Face::U, 3), stickerIdx(Face::L, 1)},  // UL
    {stickerIdx(Face::U, 1), stickerIdx(Face::B, 1)},  // UB
    {stickerIdx(Face::D, 5), stickerIdx(Face::R, 7)},  // DR
    {stickerIdx(Face::D, 1), stickerIdx(Face::F, 7)},  // DF
    {stickerIdx(Face::D, 3), stickerIdx(Face::L, 7)},  // DL
    {stickerIdx(Face::D, 7), stickerIdx(Face::B, 7)},  // DB
    {stickerIdx(Face::F, 5), stickerIdx(Face::R, 3)},  // FR
    {stickerIdx(Face::F, 3), stickerIdx(Face::L, 5)},  // FL
    {stickerIdx(Face::B, 5), stickerIdx(Face::L, 3)},  // BL
    {stickerIdx(Face::B, 3), stickerIdx(Face::R, 5)},  // BR
}};

constexpr std::array<std::array<Color, 2>, 12> kEdgeColors = {{
    {Color::White,  Color::Red},     // UR
    {Color::White,  Color::Green},   // UF
    {Color::White,  Color::Orange},  // UL
    {Color::White,  Color::Blue},    // UB
    {Color::Yellow, Color::Red},     // DR
    {Color::Yellow, Color::Green},   // DF
    {Color::Yellow, Color::Orange},  // DL
    {Color::Yellow, Color::Blue},    // DB
    {Color::Green,  Color::Red},     // FR
    {Color::Green,  Color::Orange},  // FL
    {Color::Blue,   Color::Orange},  // BL
    {Color::Blue,   Color::Red},     // BR
}};

template <size_t N>
int permutationParity(const std::array<uint8_t, N>& perm) noexcept {
    int inversions = 0;
    for (size_t i = 0; i < N; ++i) {
        for (size_t j = i + 1; j < N; ++j) {
            if (perm[i] > perm[j]) {
                ++inversions;
            }
        }
    }
    return inversions % 2;
}

ValidationResult parseAndValidate(const Cube& cube, CubieCube& out) {
    const auto& s = cube.stickers();

    // 1. Every color must appear exactly 9 times.
    std::array<int, 6> counts{};
    for (Color c : s) {
        ++counts[static_cast<int>(c)];
    }
    for (int f = 0; f < 6; ++f) {
        if (counts[f] != Cube::kStickersPerFace) {
            std::ostringstream oss;
            oss << "Expected 9 stickers of color " << colorToChar(static_cast<Color>(f))
                << ", found " << counts[f];
            return {false, ValidationError::InvalidColorCounts, oss.str()};
        }
    }

    // 2. Fixed center orientation check (U=W, R=R, F=G, D=Y, L=O, B=B).
    for (int f = 0; f < 6; ++f) {
        const auto face = static_cast<Face>(f);
        const auto expected = static_cast<Color>(f);
        if (cube.at(face, 4) != expected) {
            std::ostringstream oss;
            oss << "Center on face " << faceToChar(face) << " must be "
                << colorToChar(expected) << ", found " << colorToChar(cube.at(face, 4));
            return {false, ValidationError::InvalidCenter, oss.str()};
        }
    }

    // 3. Identify all 8 corners and their twists.
    std::array<bool, 8> cornerSeen{};
    int twistSum = 0;
    for (int slot = 0; slot < 8; ++slot) {
        const Color c0 = s[kCornerFacelets[slot][0]];
        const Color c1 = s[kCornerFacelets[slot][1]];
        const Color c2 = s[kCornerFacelets[slot][2]];

        int matchedPiece = -1;
        int matchedOri = -1;
        for (int piece = 0; piece < 8; ++piece) {
            const auto& ref = kCornerColors[piece];
            if (c0 == ref[0] && c1 == ref[1] && c2 == ref[2]) {
                matchedPiece = piece;
                matchedOri = 0;
                break;
            }
            if (c1 == ref[0] && c2 == ref[1] && c0 == ref[2]) {
                matchedPiece = piece;
                matchedOri = 1;
                break;
            }
            if (c2 == ref[0] && c0 == ref[1] && c1 == ref[2]) {
                matchedPiece = piece;
                matchedOri = 2;
                break;
            }
        }

        if (matchedPiece < 0) {
            return {false, ValidationError::InvalidCornerPiece,
                    "Corner slot " + std::to_string(slot) + " has an impossible sticker combination"};
        }
        if (cornerSeen[matchedPiece]) {
            return {false, ValidationError::DuplicateCubie,
                    "Duplicate corner cubie detected"};
        }
        cornerSeen[matchedPiece] = true;
        out.cp[slot] = static_cast<uint8_t>(matchedPiece);
        out.co[slot] = static_cast<uint8_t>(matchedOri);
        twistSum += matchedOri;
    }

    // 4. Identify all 12 edges and their flips.
    std::array<bool, 12> edgeSeen{};
    int flipSum = 0;
    for (int slot = 0; slot < 12; ++slot) {
        const Color c0 = s[kEdgeFacelets[slot][0]];
        const Color c1 = s[kEdgeFacelets[slot][1]];

        int matchedPiece = -1;
        int matchedOri = -1;
        for (int piece = 0; piece < 12; ++piece) {
            const auto& ref = kEdgeColors[piece];
            if (c0 == ref[0] && c1 == ref[1]) {
                matchedPiece = piece;
                matchedOri = 0;
                break;
            }
            if (c1 == ref[0] && c0 == ref[1]) {
                matchedPiece = piece;
                matchedOri = 1;
                break;
            }
        }

        if (matchedPiece < 0) {
            return {false, ValidationError::InvalidEdgePiece,
                    "Edge slot " + std::to_string(slot) + " has an impossible sticker combination"};
        }
        if (edgeSeen[matchedPiece]) {
            return {false, ValidationError::DuplicateCubie,
                    "Duplicate edge cubie detected"};
        }
        edgeSeen[matchedPiece] = true;
        out.ep[slot] = static_cast<uint8_t>(matchedPiece);
        out.eo[slot] = static_cast<uint8_t>(matchedOri);
        flipSum += matchedOri;
    }

    // 5. Group-theoretic parity invariants.
    if (twistSum % 3 != 0) {
        return {false, ValidationError::CornerTwistParity,
                "Invalid corner twist parity (sum mod 3 != 0)"};
    }
    if (flipSum % 2 != 0) {
        return {false, ValidationError::EdgeFlipParity,
                "Invalid edge flip parity (sum mod 2 != 0)"};
    }
    if (permutationParity(out.cp) != permutationParity(out.ep)) {
        return {false, ValidationError::PermutationParity,
                "Invalid permutation parity (corner parity != edge parity)"};
    }

    return {true, ValidationError::None, "Valid cube state"};
}

}  // namespace

bool CubieCube::isSolved() const noexcept {
    for (uint8_t i = 0; i < 8; ++i) {
        if (cp[i] != i || co[i] != 0) return false;
    }
    for (uint8_t i = 0; i < 12; ++i) {
        if (ep[i] != i || eo[i] != 0) return false;
    }
    return true;
}

ValidationResult validateCube(const Cube& cube) {
    CubieCube unused;
    return parseAndValidate(cube, unused);
}

CubieCube toCubieCube(const Cube& cube) {
    CubieCube cubie;
    const ValidationResult res = parseAndValidate(cube, cubie);
    if (!res.valid) {
        throw std::invalid_argument(res.message);
    }
    return cubie;
}

}  // namespace rubik
