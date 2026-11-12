#pragma once

#include "rubik/cube.hpp"

#include <array>
#include <cstdint>
#include <string>

namespace rubik {

// Cubie-level representation of a 3x3x3 cube.
//
// Corners (0..7): URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB.
// Edges (0..11):  UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR.
//   cp[i] / ep[i] store which piece currently sits in slot i.
//   co[i] in {0, 1, 2} tracks clockwise twist from the U/D sticker.
//   eo[i] in {0, 1} tracks edge flip relative to U/D (or F/B on E-slice).
struct CubieCube {
    std::array<uint8_t, 8> cp{};
    std::array<uint8_t, 8> co{};
    std::array<uint8_t, 12> ep{};
    std::array<uint8_t, 12> eo{};

    bool isSolved() const noexcept;
    bool operator==(const CubieCube& other) const noexcept = default;
};

enum class ValidationError {
    None = 0,
    InvalidColorCounts,
    InvalidCenter,
    InvalidCornerPiece,
    InvalidEdgePiece,
    DuplicateCubie,
    CornerTwistParity,
    EdgeFlipParity,
    PermutationParity
};

struct ValidationResult {
    bool valid = false;
    ValidationError error = ValidationError::None;
    std::string message;
};

// Checks whether a 54-sticker Cube state is physically reachable from a solved cube.
ValidationResult validateCube(const Cube& cube);

// Converts a valid Cube into its CubieCube representation.
// Throws std::invalid_argument if validateCube(cube).valid is false.
CubieCube toCubieCube(const Cube& cube);

}  // namespace rubik
