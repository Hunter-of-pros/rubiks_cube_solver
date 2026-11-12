#include "rubik/cube.hpp"

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

}  // namespace rubik
