#include "rubik/cube.hpp"
#include "rubik/move.hpp"

#include <sstream>
#include <stdexcept>

namespace rubik {

char colorToChar(Color color) {
    switch (color) {
        case Color::White:  return 'W';
        case Color::Red:    return 'R';
        case Color::Green:  return 'G';
        case Color::Yellow: return 'Y';
        case Color::Orange: return 'O';
        case Color::Blue:   return 'B';
    }
    throw std::invalid_argument("Unknown Color value");
}

Color charToColor(char ch) {
    switch (ch) {
        case 'W': case 'w': return Color::White;
        case 'R': case 'r': return Color::Red;
        case 'G': case 'g': return Color::Green;
        case 'Y': case 'y': return Color::Yellow;
        case 'O': case 'o': return Color::Orange;
        case 'B': case 'b': return Color::Blue;
        default:
            throw std::invalid_argument(std::string("Invalid color character: ") + ch);
    }
}

char faceToChar(Face face) {
    switch (face) {
        case Face::U: return 'U';
        case Face::R: return 'R';
        case Face::F: return 'F';
        case Face::D: return 'D';
        case Face::L: return 'L';
        case Face::B: return 'B';
    }
    throw std::invalid_argument("Unknown Face value");
}

Cube::Cube() {
    for (int f = 0; f < 6; ++f) {
        const auto color = static_cast<Color>(f);
        for (int i = 0; i < kStickersPerFace; ++i) {
            stickers_[f * kStickersPerFace + i] = color;
        }
    }
}

Cube::Cube(const std::array<Color, kTotalStickers>& stickers) : stickers_(stickers) {}

int Cube::globalIndex(Face face, int localIndex) {
    if (localIndex < 0 || localIndex >= kStickersPerFace) {
        throw std::out_of_range("Local sticker index must be in [0, 8]");
    }
    return static_cast<int>(face) * kStickersPerFace + localIndex;
}

Color Cube::at(Face face, int localIndex) const {
    return stickers_[globalIndex(face, localIndex)];
}

void Cube::set(Face face, int localIndex, Color color) {
    stickers_[globalIndex(face, localIndex)] = color;
}

bool Cube::isSolved() const noexcept {
    for (int f = 0; f < 6; ++f) {
        const auto expected = static_cast<Color>(f);
        const int base = f * kStickersPerFace;
        for (int i = 0; i < kStickersPerFace; ++i) {
            if (stickers_[base + i] != expected) {
                return false;
            }
        }
    }
    return true;
}

std::string Cube::toFaceletString() const {
    std::string out;
    out.reserve(kTotalStickers);
    for (Color c : stickers_) {
        out.push_back(colorToChar(c));
    }
    return out;
}

Cube Cube::fromFaceletString(std::string_view facelets) {
    if (facelets.size() != kTotalStickers) {
        throw std::invalid_argument("Facelet string must have exactly 54 characters");
    }
    std::array<Color, kTotalStickers> parsed{};
    for (int i = 0; i < kTotalStickers; ++i) {
        parsed[i] = charToColor(facelets[i]);
    }
    return Cube(parsed);
}

std::string Cube::toNetString() const {
    auto rowStr = [this](Face face, int row) {
        std::string s;
        s.reserve(5);
        for (int col = 0; col < 3; ++col) {
            if (col > 0) s.push_back(' ');
            s.push_back(colorToChar(at(face, row * 3 + col)));
        }
        return s;
    };

    std::ostringstream oss;
    const std::string pad(6, ' ');

    for (int r = 0; r < 3; ++r) {
        oss << pad << rowStr(Face::U, r) << '\n';
    }
    for (int r = 0; r < 3; ++r) {
        oss << rowStr(Face::L, r) << ' '
            << rowStr(Face::F, r) << ' '
            << rowStr(Face::R, r) << ' '
            << rowStr(Face::B, r) << '\n';
    }
    for (int r = 0; r < 3; ++r) {
        oss << pad << rowStr(Face::D, r) << '\n';
    }

    return oss.str();
}

namespace {

constexpr int stickerIdx(Face face, int localIndex) noexcept {
    return static_cast<int>(face) * Cube::kStickersPerFace + localIndex;
}

// For each face, 4 adjacent edges of 3 stickers each in clockwise order
// when looking straight at that face.
constexpr std::array<std::array<int, 12>, 6> kAdjacentRings = {{
    // U: F(0,1,2) -> L(0,1,2) -> B(0,1,2) -> R(0,1,2)
    {{stickerIdx(Face::F, 0), stickerIdx(Face::F, 1), stickerIdx(Face::F, 2),
      stickerIdx(Face::L, 0), stickerIdx(Face::L, 1), stickerIdx(Face::L, 2),
      stickerIdx(Face::B, 0), stickerIdx(Face::B, 1), stickerIdx(Face::B, 2),
      stickerIdx(Face::R, 0), stickerIdx(Face::R, 1), stickerIdx(Face::R, 2)}},
    // R: U(8,5,2) -> B(0,3,6) -> D(8,5,2) -> F(8,5,2)
    {{stickerIdx(Face::U, 8), stickerIdx(Face::U, 5), stickerIdx(Face::U, 2),
      stickerIdx(Face::B, 0), stickerIdx(Face::B, 3), stickerIdx(Face::B, 6),
      stickerIdx(Face::D, 8), stickerIdx(Face::D, 5), stickerIdx(Face::D, 2),
      stickerIdx(Face::F, 8), stickerIdx(Face::F, 5), stickerIdx(Face::F, 2)}},
    // F: U(6,7,8) -> R(0,3,6) -> D(2,1,0) -> L(8,5,2)
    {{stickerIdx(Face::U, 6), stickerIdx(Face::U, 7), stickerIdx(Face::U, 8),
      stickerIdx(Face::R, 0), stickerIdx(Face::R, 3), stickerIdx(Face::R, 6),
      stickerIdx(Face::D, 2), stickerIdx(Face::D, 1), stickerIdx(Face::D, 0),
      stickerIdx(Face::L, 8), stickerIdx(Face::L, 5), stickerIdx(Face::L, 2)}},
    // D: F(6,7,8) -> R(6,7,8) -> B(6,7,8) -> L(6,7,8)
    {{stickerIdx(Face::F, 6), stickerIdx(Face::F, 7), stickerIdx(Face::F, 8),
      stickerIdx(Face::R, 6), stickerIdx(Face::R, 7), stickerIdx(Face::R, 8),
      stickerIdx(Face::B, 6), stickerIdx(Face::B, 7), stickerIdx(Face::B, 8),
      stickerIdx(Face::L, 6), stickerIdx(Face::L, 7), stickerIdx(Face::L, 8)}},
    // L: U(0,3,6) -> F(0,3,6) -> D(0,3,6) -> B(8,5,2)
    {{stickerIdx(Face::U, 0), stickerIdx(Face::U, 3), stickerIdx(Face::U, 6),
      stickerIdx(Face::F, 0), stickerIdx(Face::F, 3), stickerIdx(Face::F, 6),
      stickerIdx(Face::D, 0), stickerIdx(Face::D, 3), stickerIdx(Face::D, 6),
      stickerIdx(Face::B, 8), stickerIdx(Face::B, 5), stickerIdx(Face::B, 2)}},
    // B: U(2,1,0) -> L(0,3,6) -> D(6,7,8) -> R(8,5,2)
    {{stickerIdx(Face::U, 2), stickerIdx(Face::U, 1), stickerIdx(Face::U, 0),
      stickerIdx(Face::L, 0), stickerIdx(Face::L, 3), stickerIdx(Face::L, 6),
      stickerIdx(Face::D, 6), stickerIdx(Face::D, 7), stickerIdx(Face::D, 8),
      stickerIdx(Face::R, 8), stickerIdx(Face::R, 5), stickerIdx(Face::R, 2)}},
}};

void cycleFour(std::array<Color, Cube::kTotalStickers>& s,
               int a, int b, int c, int d) noexcept {
    const Color temp = s[d];
    s[d] = s[c];
    s[c] = s[b];
    s[b] = s[a];
    s[a] = temp;
}

}  // namespace

void Cube::rotateQuarterTurnCW(Face face) noexcept {
    const int base = static_cast<int>(face) * kStickersPerFace;

    // Rotate the 8 outer stickers on the face itself.
    cycleFour(stickers_, base + 0, base + 2, base + 8, base + 6);
    cycleFour(stickers_, base + 1, base + 5, base + 7, base + 3);

    // Cycle the 12 adjacent stickers around the rim (3 parallel 4-cycles).
    const auto& ring = kAdjacentRings[static_cast<int>(face)];
    for (int offset = 0; offset < 3; ++offset) {
        cycleFour(stickers_,
                  ring[offset],
                  ring[offset + 3],
                  ring[offset + 6],
                  ring[offset + 9]);
    }
}

void Cube::apply(Move move) {
    const Face face = moveFace(move);
    const int turns = moveQuarterTurns(move);
    for (int i = 0; i < turns; ++i) {
        rotateQuarterTurnCW(face);
    }
}

void Cube::apply(std::string_view sequence) {
    for (Move m : parseMoves(sequence)) {
        apply(m);
    }
}

}  // namespace rubik
