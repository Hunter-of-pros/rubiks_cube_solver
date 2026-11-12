#include "rubik/move.hpp"

#include <sstream>
#include <stdexcept>

namespace rubik {

Face moveFace(Move move) noexcept {
    return static_cast<Face>(static_cast<int>(move) / 3);
}

int moveQuarterTurns(Move move) noexcept {
    return (static_cast<int>(move) % 3) + 1;
}

Move makeMove(Face face, int quarterTurns) {
    const int normalized = ((quarterTurns % 4) + 4) % 4;
    if (normalized == 0) {
        throw std::invalid_argument("Zero quarter turns is not a Move");
    }
    return static_cast<Move>(static_cast<int>(face) * 3 + (normalized - 1));
}

Move inverseMove(Move move) noexcept {
    const int idx = static_cast<int>(move);
    const int base = (idx / 3) * 3;
    const int offset = idx % 3;
    if (offset == 1) {
        return move;  // Double turns are self-inverse.
    }
    return static_cast<Move>(base + (2 - offset));
}

std::string moveToString(Move move) {
    std::string s(1, faceToChar(moveFace(move)));
    const int turns = moveQuarterTurns(move);
    if (turns == 2) {
        s.push_back('2');
    } else if (turns == 3) {
        s.push_back('\'');
    }
    return s;
}

Move parseMove(std::string_view token) {
    if (token.empty() || token.size() > 2) {
        throw std::invalid_argument("Invalid move token: " + std::string(token));
    }

    Face face;
    switch (token[0]) {
        case 'U': case 'u': face = Face::U; break;
        case 'R': case 'r': face = Face::R; break;
        case 'F': case 'f': face = Face::F; break;
        case 'D': case 'd': face = Face::D; break;
        case 'L': case 'l': face = Face::L; break;
        case 'B': case 'b': face = Face::B; break;
        default:
            throw std::invalid_argument("Invalid face in move: " + std::string(token));
    }

    if (token.size() == 1) {
        return makeMove(face, 1);
    }
    if (token[1] == '2') {
        return makeMove(face, 2);
    }
    if (token[1] == '\'') {
        return makeMove(face, 3);
    }
    throw std::invalid_argument("Invalid move suffix in: " + std::string(token));
}

std::vector<Move> parseMoves(std::string_view sequence) {
    std::vector<Move> moves;
    std::istringstream iss{std::string(sequence)};
    std::string token;
    while (iss >> token) {
        moves.push_back(parseMove(token));
    }
    return moves;
}

std::string movesToString(const std::vector<Move>& moves) {
    std::string out;
    for (size_t i = 0; i < moves.size(); ++i) {
        if (i > 0) out.push_back(' ');
        out += moveToString(moves[i]);
    }
    return out;
}

}  // namespace rubik

