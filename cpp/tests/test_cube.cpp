#include "rubik/cube.hpp"
#include "rubik/move.hpp"

#include <algorithm>
#include <array>
#include <cstdlib>
#include <iostream>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>

using namespace rubik;

namespace {

void requireImpl(bool cond, const char* expr, int line) {
    if (!cond) {
        std::cerr << "Test assertion failed at line " << line << ": " << expr << '\n';
        std::exit(1);
    }
}

#define REQUIRE(cond) requireImpl((cond), #cond, __LINE__)

constexpr int gIdx(Face f, int local) {
    return static_cast<int>(f) * Cube::kStickersPerFace + local;
}

std::multiset<std::set<Color>> extractCornerColorSets(const Cube& cube) {
    constexpr std::array<std::array<int, 3>, 8> kCornerFacelets = {{
        {gIdx(Face::U, 8), gIdx(Face::R, 0), gIdx(Face::F, 2)},  // URF
        {gIdx(Face::U, 6), gIdx(Face::F, 0), gIdx(Face::L, 2)},  // UFL
        {gIdx(Face::U, 0), gIdx(Face::L, 0), gIdx(Face::B, 2)},  // ULB
        {gIdx(Face::U, 2), gIdx(Face::B, 0), gIdx(Face::R, 2)},  // UBR
        {gIdx(Face::D, 2), gIdx(Face::F, 8), gIdx(Face::R, 6)},  // DFR
        {gIdx(Face::D, 0), gIdx(Face::L, 8), gIdx(Face::F, 6)},  // DLF
        {gIdx(Face::D, 6), gIdx(Face::B, 8), gIdx(Face::L, 6)},  // DBL
        {gIdx(Face::D, 8), gIdx(Face::R, 8), gIdx(Face::B, 6)},  // DRB
    }};

    const auto& s = cube.stickers();
    std::multiset<std::set<Color>> out;
    for (const auto& c : kCornerFacelets) {
        out.insert({s[c[0]], s[c[1]], s[c[2]]});
    }
    return out;
}

std::multiset<std::set<Color>> extractEdgeColorSets(const Cube& cube) {
    constexpr std::array<std::array<int, 2>, 12> kEdgeFacelets = {{
        {gIdx(Face::U, 5), gIdx(Face::R, 1)},  // UR
        {gIdx(Face::U, 7), gIdx(Face::F, 1)},  // UF
        {gIdx(Face::U, 3), gIdx(Face::L, 1)},  // UL
        {gIdx(Face::U, 1), gIdx(Face::B, 1)},  // UB
        {gIdx(Face::D, 5), gIdx(Face::R, 7)},  // DR
        {gIdx(Face::D, 1), gIdx(Face::F, 7)},  // DF
        {gIdx(Face::D, 3), gIdx(Face::L, 7)},  // DL
        {gIdx(Face::D, 7), gIdx(Face::B, 7)},  // DB
        {gIdx(Face::F, 5), gIdx(Face::R, 3)},  // FR
        {gIdx(Face::F, 3), gIdx(Face::L, 5)},  // FL
        {gIdx(Face::B, 5), gIdx(Face::L, 3)},  // BL
        {gIdx(Face::B, 3), gIdx(Face::R, 5)},  // BR
    }};

    const auto& s = cube.stickers();
    std::multiset<std::set<Color>> out;
    for (const auto& e : kEdgeFacelets) {
        out.insert({s[e[0]], s[e[1]]});
    }
    return out;
}

void testSolvedInitialization() {
    Cube cube;
    REQUIRE(cube.isSolved());
    REQUIRE(cube.at(Face::U, 0) == Color::White);
    REQUIRE(cube.at(Face::R, 4) == Color::Red);
    REQUIRE(cube.at(Face::F, 8) == Color::Green);
    REQUIRE(cube.at(Face::D, 4) == Color::Yellow);
    REQUIRE(cube.at(Face::L, 4) == Color::Orange);
    REQUIRE(cube.at(Face::B, 4) == Color::Blue);
    REQUIRE(cube.toFaceletString() ==
            "WWWWWWWWW"
            "RRRRRRRRR"
            "GGGGGGGGG"
            "YYYYYYYYY"
            "OOOOOOOOO"
            "BBBBBBBBB");
}

void testSetAndIsSolved() {
    Cube cube;
    cube.set(Face::F, 0, Color::Red);
    REQUIRE(!cube.isSolved());
    REQUIRE(cube.at(Face::F, 0) == Color::Red);

    cube.set(Face::F, 0, Color::Green);
    REQUIRE(cube.isSolved());
}

void testFaceletRoundTripAndErrors() {
    const std::string sample =
        "WWWWWWWWWRRRRRRRRRGGGGGGGGGYYYYYYYYYOOOOOOOOOBBBBBBBBB";
    Cube parsed = Cube::fromFaceletString(sample);
    REQUIRE(parsed.isSolved());
    REQUIRE(parsed.toFaceletString() == sample);

    bool threwLength = false;
    try {
        Cube::fromFaceletString("WWW");
    } catch (const std::invalid_argument&) {
        threwLength = true;
    }
    REQUIRE(threwLength);

    bool threwBounds = false;
    try {
        (void)parsed.at(Face::U, 9);
    } catch (const std::out_of_range&) {
        threwBounds = true;
    }
    REQUIRE(threwBounds);
}

void testNetFormatting() {
    Cube cube;
    const std::string expected =
        "      W W W\n"
        "      W W W\n"
        "      W W W\n"
        "O O O G G G R R R B B B\n"
        "O O O G G G R R R B B B\n"
        "O O O G G G R R R B B B\n"
        "      Y Y Y\n"
        "      Y Y Y\n"
        "      Y Y Y\n";
    REQUIRE(cube.toNetString() == expected);
}

void testMoveParsingAndInverse() {
    for (int i = 0; i < kMoveCount; ++i) {
        const auto m = static_cast<Move>(i);
        const std::string text = moveToString(m);
        REQUIRE(parseMove(text) == m);
        REQUIRE(inverseMove(inverseMove(m)) == m);
    }

    const auto seq = parseMoves("R U R' U' F2 D' L2 B");
    REQUIRE(seq.size() == 8);
    REQUIRE(movesToString(seq) == "R U R' U' F2 D' L2 B");

    bool threwInvalid = false;
    try {
        (void)parseMove("X");
    } catch (const std::invalid_argument&) {
        threwInvalid = true;
    }
    REQUIRE(threwInvalid);
}

void testSingleFaceMoveOrdersAndInverses() {
    constexpr std::array<Face, 6> kFaces = {
        Face::U, Face::R, Face::F, Face::D, Face::L, Face::B
    };

    for (Face f : kFaces) {
        const Move cw = makeMove(f, 1);
        const Move dbl = makeMove(f, 2);
        const Move ccw = makeMove(f, 3);

        // M^4 == identity, M^2 == M2, M^3 == M'
        Cube c;
        c.apply(cw);
        REQUIRE(!c.isSolved());
        c.apply(cw);
        Cube c2;
        c2.apply(dbl);
        REQUIRE(c == c2);

        c.apply(cw);
        Cube c3;
        c3.apply(ccw);
        REQUIRE(c == c3);

        c.apply(cw);
        REQUIRE(c.isSolved());

        // Double turn applied twice returns to solved.
        c2.apply(dbl);
        REQUIRE(c2.isSolved());
    }

    // Move followed by inverse restores both solved and scrambled states.
    Cube base;
    base.apply("R U2 F' L D2 B'");
    REQUIRE(!base.isSolved());

    for (int i = 0; i < kMoveCount; ++i) {
        const auto m = static_cast<Move>(i);
        Cube test = base;
        test.apply(m);
        REQUIRE(!(test == base));
        test.apply(inverseMove(m));
        REQUIRE(test == base);
    }
}

void testSingleTurnStickerPositions() {
    // U turn: R top -> F top -> L top -> B top -> R top
    {
        Cube c;
        c.apply(Move::U);
        REQUIRE(c.at(Face::F, 0) == Color::Red);
        REQUIRE(c.at(Face::L, 0) == Color::Green);
        REQUIRE(c.at(Face::B, 0) == Color::Orange);
        REQUIRE(c.at(Face::R, 0) == Color::Blue);
    }
    // R turn: F right -> U right -> B left (flipped) -> D right -> F right
    {
        Cube c;
        c.apply(Move::R);
        REQUIRE(c.at(Face::U, 8) == Color::Green);
        REQUIRE(c.at(Face::B, 0) == Color::White);
        REQUIRE(c.at(Face::D, 8) == Color::Blue);
        REQUIRE(c.at(Face::F, 8) == Color::Yellow);
    }
    // F turn: U bottom -> R left -> D top -> L right -> U bottom
    {
        Cube c;
        c.apply(Move::F);
        REQUIRE(c.at(Face::R, 0) == Color::White);
        REQUIRE(c.at(Face::D, 2) == Color::Red);
        REQUIRE(c.at(Face::L, 8) == Color::Yellow);
        REQUIRE(c.at(Face::U, 6) == Color::Orange);
    }
    // D turn: L bottom -> F bottom -> R bottom -> B bottom -> L bottom
    {
        Cube c;
        c.apply(Move::D);
        REQUIRE(c.at(Face::F, 6) == Color::Orange);
        REQUIRE(c.at(Face::R, 6) == Color::Green);
        REQUIRE(c.at(Face::B, 6) == Color::Red);
        REQUIRE(c.at(Face::L, 6) == Color::Blue);
    }
    // L turn: U left -> F left -> D left -> B right -> U left
    {
        Cube c;
        c.apply(Move::L);
        REQUIRE(c.at(Face::F, 0) == Color::White);
        REQUIRE(c.at(Face::D, 0) == Color::Green);
        REQUIRE(c.at(Face::B, 8) == Color::Yellow);
        REQUIRE(c.at(Face::U, 0) == Color::Blue);
    }
    // B turn: U top -> L left -> D bottom -> R right -> U top
    {
        Cube c;
        c.apply(Move::B);
        REQUIRE(c.at(Face::L, 0) == Color::White);
        REQUIRE(c.at(Face::D, 6) == Color::Orange);
        REQUIRE(c.at(Face::R, 8) == Color::Yellow);
        REQUIRE(c.at(Face::U, 2) == Color::Red);
    }
}

void testGroupIdentitiesAndPiecePreservation() {
    // (R U R' U') has order 6.
    {
        Cube c;
        for (int rep = 1; rep <= 6; ++rep) {
            c.apply("R U R' U'");
            if (rep < 6) {
                REQUIRE(!c.isSolved());
            } else {
                REQUIRE(c.isSolved());
            }
        }
    }

    // (R U) has order 105.
    {
        Cube c;
        for (int rep = 1; rep <= 105; ++rep) {
            c.apply("R U");
            if (rep < 105) {
                REQUIRE(!c.isSolved());
            } else {
                REQUIRE(c.isSolved());
            }
        }
    }

    // Checkerboard pattern: U2 D2 R2 L2 F2 B2 has order 2.
    {
        Cube c;
        c.apply("U2 D2 R2 L2 F2 B2");
        REQUIRE(!c.isSolved());
        REQUIRE(c.at(Face::U, 0) == Color::White);
        REQUIRE(c.at(Face::U, 1) == Color::Yellow);
        REQUIRE(c.at(Face::F, 1) == Color::Blue);
        c.apply("U2 D2 R2 L2 F2 B2");
        REQUIRE(c.isSolved());
    }

    // Every move and long move sequence must preserve all 8 corners and 12 edges.
    const Cube solved;
    const auto expectedCorners = extractCornerColorSets(solved);
    const auto expectedEdges = extractEdgeColorSets(solved);

    Cube scrambled;
    for (int step = 0; step < 500; ++step) {
        const auto m = static_cast<Move>((step * 7 + 3) % kMoveCount);
        scrambled.apply(m);
        REQUIRE(extractCornerColorSets(scrambled) == expectedCorners);
        REQUIRE(extractEdgeColorSets(scrambled) == expectedEdges);
    }
}

}  // namespace

int main() {
    testSolvedInitialization();
    testSetAndIsSolved();
    testFaceletRoundTripAndErrors();
    testNetFormatting();
    testMoveParsingAndInverse();
    testSingleFaceMoveOrdersAndInverses();
    testSingleTurnStickerPositions();
    testGroupIdentitiesAndPiecePreservation();
    std::cout << "All Phase 1 cube representation and rotation tests passed.\n";
    return 0;
}
