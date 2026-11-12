"""Subprocess wrapper around the compiled C++ rubik_solver CLI."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import random
import subprocess
from typing import List


DEFAULT_SOLVER_BIN = Path(__file__).resolve().parents[3] / "cpp" / "build" / "rubik_solver"

_FACES = ("U", "R", "F", "D", "L", "B")
_TURNS = ("", "2", "'")


@dataclass(frozen=True)
class SolverResponse:
    valid: bool
    solved: bool
    facelets: str
    algorithm: str
    moves: str
    solution_length: int
    nodes_expanded: int
    elapsed_ms: float
    memory_bytes: int
    error: str


def _run_solver_cli(args: List[str], solver_bin: Path) -> SolverResponse:
    if not solver_bin.exists():
        raise FileNotFoundError(
            f"C++ solver binary not found at {solver_bin}. "
            "Build it with: cmake -S cpp -B cpp/build && cmake --build cpp/build"
        )

    proc = subprocess.run(
        [str(solver_bin), *args, "--json"],
        capture_output=True,
        text=True,
        check=False,
    )
    output = proc.stdout.strip()
    if not output:
        raise RuntimeError(f"rubik_solver returned empty output (stderr: {proc.stderr.strip()})")

    data = json.loads(output)
    return SolverResponse(
        valid=bool(data.get("valid", False)),
        solved=bool(data.get("solved", False)),
        facelets=str(data.get("facelets", "")),
        algorithm=str(data.get("algorithm", "")),
        moves=str(data.get("moves", "")),
        solution_length=int(data.get("solution_length", 0)),
        nodes_expanded=int(data.get("nodes_expanded", 0)),
        elapsed_ms=float(data.get("elapsed_ms", 0.0)),
        memory_bytes=int(data.get("memory_bytes", 0)),
        error=str(data.get("error", "")),
    )


def validate_facelets(
    facelets: str,
    solver_bin: Path = DEFAULT_SOLVER_BIN,
) -> SolverResponse:
    """Validates a 54-character URFDLB facelet string via C++ rubik_solver."""
    if len(facelets) != 54:
        raise ValueError(f"Expected 54-character facelet string, got {len(facelets)}")
    return _run_solver_cli(["--facelets", facelets, "--validate-only"], solver_bin)


def solve_facelets(
    facelets: str,
    algorithm: str = "kociemba",
    solver_bin: Path = DEFAULT_SOLVER_BIN,
) -> SolverResponse:
    """Validates and solves a 54-character URFDLB facelet string using C++ rubik_solver."""
    if len(facelets) != 54:
        raise ValueError(f"Expected 54-character facelet string, got {len(facelets)}")
    return _run_solver_cli(["--facelets", facelets, "--algo", algorithm], solver_bin)


def apply_moves_to_solved(
    moves: str,
    solver_bin: Path = DEFAULT_SOLVER_BIN,
) -> SolverResponse:
    """Applies a move sequence to a solved cube via C++ rubik_solver and returns its state."""
    return _run_solver_cli(["--scramble", moves, "--validate-only"], solver_bin)


def generate_random_scramble_moves(length: int = 20, seed: int | None = None) -> str:
    """Generates a non-redundant random move sequence (matching C++ axis rules)."""
    if length < 0:
        raise ValueError("Scramble length cannot be negative")
    rng = random.Random(seed)
    chosen: List[str] = []
    prev_face = -1
    prev_prev_face = -1

    for _ in range(length):
        candidates = []
        for f in range(6):
            if f == prev_face:
                continue
            if prev_prev_face != -1 and (f % 3) == (prev_face % 3) and f == prev_prev_face:
                continue
            candidates.append(f)
        face_idx = rng.choice(candidates)
        chosen.append(_FACES[face_idx] + rng.choice(_TURNS))
        prev_prev_face = prev_face
        prev_face = face_idx

    return " ".join(chosen)
