#include "rubik/cube.hpp"

#include <cassert>
#include <iostream>
#include <stdexcept>
#include <string>

using namespace rubik;

namespace {

void testSolvedInitialization() {
    Cube cube;
    assert(cube.isSolved());
    assert(cube.at(Face::U, 0) == Color::White);
    assert(cube.at(Face::R, 4) == Color::Red);
    assert(cube.at(Face::F, 8) == Color::Green);
    assert(cube.at(Face::D, 4) == Color::Yellow);
    assert(cube.at(Face::L, 4) == Color::Orange);
    assert(cube.at(Face::B, 4) == Color::Blue);
    assert(cube.toFaceletString() ==
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
    assert(!cube.isSolved());
    assert(cube.at(Face::F, 0) == Color::Red);

    cube.set(Face::F, 0, Color::Green);
    assert(cube.isSolved());
}

void testFaceletRoundTripAndErrors() {
    const std::string sample =
        "WWWWWWWWWRRRRRRRRRGGGGGGGGGYYYYYYYYYOOOOOOOOOBBBBBBBBB";
    Cube parsed = Cube::fromFaceletString(sample);
    assert(parsed.isSolved());
    assert(parsed.toFaceletString() == sample);

    bool threwLength = false;
    try {
        Cube::fromFaceletString("WWW");
    } catch (const std::invalid_argument&) {
        threwLength = true;
    }
    assert(threwLength);

    bool threwBounds = false;
    try {
        (void)parsed.at(Face::U, 9);
    } catch (const std::out_of_range&) {
        threwBounds = true;
    }
    assert(threwBounds);
}

void testNetFormatting() {
    Cube cube;
    const std::string net = cube.toNetString();
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
    assert(net == expected);
}

}  // namespace

int main() {
    testSolvedInitialization();
    testSetAndIsSolved();
    testFaceletRoundTripAndErrors();
    testNetFormatting();
    std::cout << "All cube representation tests passed.\n";
    return 0;
}
