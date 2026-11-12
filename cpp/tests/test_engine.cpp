#include "rubik/cube.hpp"
#include "rubik/cubie.hpp"
#include "rubik/move.hpp"
#include "rubik/scrambler.hpp"

#include <cstdlib>
#include <iostream>
#include <stdexcept>
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

int faceAxis(Face f) {
    return static_cast<int>(f) % 3;
}

void swapStickers(Cube& cube, Face f1, int i1, Face f2, int i2) {
    const Color tmp = cube.at(f1, i1);
    cube.set(f1, i1, cube.at(f2, i2));
    cube.set(f2, i2, tmp);
}

void testScramblerPropertiesAndReversibility() {
    const auto s1 = generateScramble(25, 42);
    const auto s2 = generateScramble(25, 42);
    REQUIRE(s1 == s2);
    REQUIRE(s1.size() == 25);

    // No same-face consecutive moves and no A B A' opposite-axis redundancies.
    for (size_t i = 1; i < s1.size(); ++i) {
        const Face curr = moveFace(s1[i]);
        const Face prev = moveFace(s1[i - 1]);
        REQUIRE(curr != prev);
        if (i >= 2) {
            const Face prevPrev = moveFace(s1[i - 2]);
            if (faceAxis(prev) == faceAxis(curr)) {
                REQUIRE(curr != prevPrev);
            }
        }
    }

    // Applying the inverse moves in reverse order restores solved state.
    std::vector<Move> usedMoves;
    Cube scrambled = createScrambledCube(30, 1337, &usedMoves);
    REQUIRE(!scrambled.isSolved());
    REQUIRE(validateCube(scrambled).valid);

    for (auto it = usedMoves.rbegin(); it != usedMoves.rend(); ++it) {
        scrambled.apply(inverseMove(*it));
    }
    REQUIRE(scrambled.isSolved());
}

void testScrambledCubesAreAlwaysValid() {
    const Cube solved;
    REQUIRE(validateCube(solved).valid);
    REQUIRE(toCubieCube(solved).isSolved());

    for (uint32_t seed = 1; seed <= 200; ++seed) {
        const Cube c = createScrambledCube(20 + static_cast<int>(seed % 15), seed);
        const ValidationResult res = validateCube(c);
        REQUIRE(res.valid);
        REQUIRE(res.error == ValidationError::None);
        const CubieCube cubie = toCubieCube(c);
        REQUIRE(cubie.isSolved() == c.isSolved());
    }
}

void testInvalidColorCountsAndCenters() {
    // 1. Wrong color count
    {
        Cube c;
        c.set(Face::U, 0, Color::Red);
        const ValidationResult res = validateCube(c);
        REQUIRE(!res.valid);
        REQUIRE(res.error == ValidationError::InvalidColorCounts);
    }

    // 2. Swapped center stickers (counts are 9 each, but centers don't match).
    {
        Cube c;
        c.set(Face::U, 4, Color::Red);
        c.set(Face::R, 4, Color::White);
        const ValidationResult res = validateCube(c);
        REQUIRE(!res.valid);
        REQUIRE(res.error == ValidationError::InvalidCenter);
    }
}

void testImpossibleCornerAndEdgePieces() {
    // Swap two adjacent stickers between U and D so a corner gets White+Yellow.
    {
        Cube c;
        swapStickers(c, Face::U, 8, Face::D, 2);
        const ValidationResult res = validateCube(c);
        REQUIRE(!res.valid);
        REQUIRE(res.error == ValidationError::InvalidCornerPiece);
    }

    // Swap two stickers across edges so an edge gets opposite colors (Yellow + White).
    {
        Cube c;
        swapStickers(c, Face::U, 5, Face::F, 7);
        const ValidationResult res = validateCube(c);
        REQUIRE(!res.valid);
        REQUIRE(res.error == ValidationError::InvalidEdgePiece);
    }
}

void testDuplicateCubie() {
    // Replace UFL corner with URF's colors while keeping color counts = 9
    // by moving UFL's colors onto DFR? Instead, construct two URF corners
    // and verify DuplicateCubie or InvalidCornerPiece, wait:
    // If we swap URF(U8,R0,F2) and UBR(U2,B0,R2) partially so counts match:
    // Actually: copy URF (W,R,G) into UFL (W,G,O)? That breaks counts unless
    // we give O back somewhere. Even simpler: swap UFL's Orange(L2) with DFR's Red(R6)
    // and DFR's Yellow(D2) with URF's... Wait: if two corners are identical,
    // all 9-sticker counts can still be preserved if the missing colors sit on
    // two other corners! Let's check:
    // Solved: URF(W,R,G), UFL(W,G,O), DFR(Y,G,R), DLF(Y,O,G).
    // Swap L2(O) <-> R6(R) and... wait, that creates (W,G,R) at UFL (impossible cyclic order).
    // Give UFL = {W, R, G} (URF!) and URF = {W, R, G}? No, we'd have two Reds and miss Orange.
    // To preserve counts: take Orange from UFL(L2), put it in... wait: any 8 corners with one duplicate
    // means another corner is missing; since every corner has unique color trio, two identical corners
    // require the 3 colors of the missing corner to be redistributed — which breaks color counts!
    // Unless... NO! Every corner is a 3-subset of {W,R,G,Y,O,B}. There are 8 corners, each color appears
    // on 4 corners. If you replace corner A with a duplicate of corner B, color counts change unless
    // another corner ALSO changes to restore the counts—leaving it an impossible corner!
    // Wait: what if we mirror/duplicate? Still: valid color counts + 8 valid corners => 2 corners could
    // be duplicates if e.g. URF+URF + DBL+DBL? Let's test!
    // Start with URF={W,R,G}, UFL={W,G,O}, ULB={W,O,B}, UBR={W,B,R}
    //            DFR={Y,G,R}, DLF={Y,O,G}, DBL={Y,B,O}, DRB={Y,R,B}
    // Replace UFL with URF ({W,R,G}) and replace DRB with DBL ({Y,B,O})?
    // Missing from UFL+DRB: {W,G,O} + {Y,R,B} = {W,G,O,Y,R,B}.
    // Added to URF+DBL:   {W,R,G} + {Y,B,O} = {W,G,O,Y,R,B}!! EXACT SAME COLOR COUNTS (9 each)!!
    Cube c;
    // Set UFL (U6, F0, L2) to URF (W, R, G)
    c.set(Face::U, 6, Color::White);
    c.set(Face::F, 0, Color::Red);
    c.set(Face::L, 2, Color::Green);
    // Set DRB (D8, R8, B6) to DBL (Y, B, O)
    c.set(Face::D, 8, Color::Yellow);
    c.set(Face::R, 8, Color::Blue);
    c.set(Face::B, 6, Color::Orange);

    const ValidationResult res = validateCube(c);
    REQUIRE(!res.valid);
    REQUIRE(res.error == ValidationError::DuplicateCubie);
}

void testParityViolationsAndValidPairs() {
    // 1. Single twisted corner (URF twisted 120 deg CW): catches CornerTwistParity.
    {
        Cube c;
        const Color u8 = c.at(Face::U, 8);
        const Color r0 = c.at(Face::R, 0);
        const Color f2 = c.at(Face::F, 2);
        c.set(Face::U, 8, f2);
        c.set(Face::R, 0, u8);
        c.set(Face::F, 2, r0);

        const ValidationResult res = validateCube(c);
        REQUIRE(!res.valid);
        REQUIRE(res.error == ValidationError::CornerTwistParity);
    }

    // 2. Twist URF CW + UFL CCW: twist sum = 1 + 2 = 3 = 0 mod 3 -> VALID!
    {
        Cube c;
        // Twist URF CW
        const Color u8 = c.at(Face::U, 8), r0 = c.at(Face::R, 0), f2 = c.at(Face::F, 2);
        c.set(Face::U, 8, f2);
        c.set(Face::R, 0, u8);
        c.set(Face::F, 2, r0);
        // Twist UFL CCW
        const Color u6 = c.at(Face::U, 6), f0 = c.at(Face::F, 0), l2 = c.at(Face::L, 2);
        c.set(Face::U, 6, f0);
        c.set(Face::F, 0, l2);
        c.set(Face::L, 2, u6);

        REQUIRE(validateCube(c).valid);
    }

    // 3. Single flipped edge (UF flipped): catches EdgeFlipParity.
    {
        Cube c;
        swapStickers(c, Face::U, 7, Face::F, 1);
        const ValidationResult res = validateCube(c);
        REQUIRE(!res.valid);
        REQUIRE(res.error == ValidationError::EdgeFlipParity);
    }

    // 4. Flip two edges (UF and UR): flip sum = 2 = 0 mod 2 -> VALID!
    {
        Cube c;
        swapStickers(c, Face::U, 7, Face::F, 1);
        swapStickers(c, Face::U, 5, Face::R, 1);
        REQUIRE(validateCube(c).valid);
    }

    // 5. Swap only two corners (URF <-> UFL): catches PermutationParity.
    {
        Cube c;
        swapStickers(c, Face::U, 8, Face::U, 6);
        swapStickers(c, Face::R, 0, Face::F, 0);
        swapStickers(c, Face::F, 2, Face::L, 2);
        const ValidationResult res = validateCube(c);
        REQUIRE(!res.valid);
        REQUIRE(res.error == ValidationError::PermutationParity);
    }

    // 6. Swap only two edges (UR <-> UF): catches PermutationParity.
    {
        Cube c;
        swapStickers(c, Face::U, 5, Face::U, 7);
        swapStickers(c, Face::R, 1, Face::F, 1);
        const ValidationResult res = validateCube(c);
        REQUIRE(!res.valid);
        REQUIRE(res.error == ValidationError::PermutationParity);
    }

    // 7. Swap two corners AND two edges together (like a PLL): VALID!
    {
        Cube c;
        swapStickers(c, Face::U, 8, Face::U, 6);
        swapStickers(c, Face::R, 0, Face::F, 0);
        swapStickers(c, Face::F, 2, Face::L, 2);
        swapStickers(c, Face::U, 5, Face::U, 7);
        swapStickers(c, Face::R, 1, Face::F, 1);
        REQUIRE(validateCube(c).valid);
    }

    // toCubieCube throws on invalid state.
    bool threw = false;
    try {
        Cube bad;
        swapStickers(bad, Face::U, 7, Face::F, 1);
        (void)toCubieCube(bad);
    } catch (const std::invalid_argument&) {
        threw = true;
    }
    REQUIRE(threw);
}

}  // namespace

int main() {
    testScramblerPropertiesAndReversibility();
    testScrambledCubesAreAlwaysValid();
    testInvalidColorCountsAndCenters();
    testImpossibleCornerAndEdgePieces();
    testDuplicateCubie();
    testParityViolationsAndValidPairs();
    std::cout << "All Phase 2 scrambler and validation tests passed.\n";
    return 0;
}
