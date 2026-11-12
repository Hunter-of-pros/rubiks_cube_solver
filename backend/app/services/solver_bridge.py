"""Subprocess wrapper around the compiled C++ rubik_solver CLI."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import subprocess


DEFAULT_SOLVER_BIN = Path(__file__).resolve().parents[3] / "cpp" / "build" / "rubik_solver"


@dataclass(frozen=True)
class SolverResponse:
    valid: bool
    solved: bool
    algorithm: str
    moves: str
    solution_length: int
    nodes_expanded: int
    elapsed_ms: float
    memory_bytes: int
    error: str


def solve_facelets(
    facelets: str,
    algorithm: str = "kociemba",
    solver_bin: Path = DEFAULT_SOLVER_BIN,
) -> SolverResponse:
    """Validates and solves a 54-character URFDLB facelet string using C++ rubik_solver."""
    if len(facelets) != 54:
        raise ValueError(f"Expected 54-character facelet string, got {len(facelets)}")
    if not solver_bin.exists():
        raise FileNotFoundError(
            f"C++ solver binary not found at {solver_bin}. "
            "Build it with: cmake -S cpp -B cpp/build && cmake --build cpp/build"
        )

    proc = subprocess.run(
        [str(solver_bin), "--facelets", facelets, "--algo", algorithm, "--json"],
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
        algorithm=str(data.get("algorithm", algorithm)),
        moves=str(data.get("moves", "")),
        solution_length=int(data.get("solution_length", 0)),
        nodes_expanded=int(data.get("nodes_expanded", 0)),
        elapsed_ms=float(data.get("elapsed_ms", 0.0)),
        memory_bytes=int(data.get("memory_bytes", 0)),
        error=str(data.get("error", "")),
    )
