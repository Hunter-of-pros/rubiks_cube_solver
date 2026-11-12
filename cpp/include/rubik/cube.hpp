#pragma once

#include <array>
#include <cstdint>
#include <string>
#include <string_view>

namespace rubik {

// Standard cube colors in URFDLB solved-face order.
enum class Color : uint8_t {
    White = 0,   // U
    Red = 1,     // R
    Green = 2,   // F
    Yellow = 3,  // D
    Orange = 4,  // L
    Blue = 5     // B
};

// Six faces in Kociemba's standard URFDLB ordering.
enum class Face : uint8_t {
    U = 0,
    R = 1,
    F = 2,
    D = 3,
    L = 4,
    B = 5
};

char colorToChar(Color color);
Color charToColor(char ch);
char faceToChar(Face face);

// Represents a 3x3x3 Rubik's Cube as 54 contiguous stickers (9 per face).
//
// Storing all stickers in a flat 54-byte array instead of Color[6][3][3]
// keeps the entire cube state in a single 64-byte CPU cache line, makes
// copying O(1), and gives every sticker a single global index [0..53]
// (face * 9 + row * 3 + col, looking straight at that face).
class Cube {
public:
    static constexpr int kStickersPerFace = 9;
    static constexpr int kTotalStickers = 54;

    // Initializes a solved cube (U=White, R=Red, F=Green, D=Yellow, L=Orange, B=Blue).
    Cube();

    explicit Cube(const std::array<Color, kTotalStickers>& stickers);

    Color at(Face face, int localIndex) const;
    void set(Face face, int localIndex, Color color);

    const std::array<Color, kTotalStickers>& stickers() const noexcept { return stickers_; }

    // Returns true when each face matches its standard solved color.
    bool isSolved() const noexcept;

    // Converts the cube to/from a 54-character string using W/R/G/Y/O/B in URFDLB order.
    std::string toFaceletString() const;
    static Cube fromFaceletString(std::string_view facelets);

    // Formats the cube as a readable 2D unfolded cross (U above L F R B above D).
    std::string toNetString() const;

    bool operator==(const Cube& other) const noexcept = default;

private:
    static int globalIndex(Face face, int localIndex);

    std::array<Color, kTotalStickers> stickers_{};
};

}  // namespace rubik
