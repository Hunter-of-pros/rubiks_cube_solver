"""REST API routes connecting React frontend with OpenCV/ML and C++ solver."""

from __future__ import annotations

from pathlib import Path
from typing import List, Literal, Optional

import cv2
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
import numpy as np
from pydantic import BaseModel, Field

from app.cv.colors import VALID_COLORS
from app.cv.detector import analyze_face_frame
from app.ml.classifier import StickerColorClassifier
from app.services.solver_bridge import (
    DEFAULT_SOLVER_BIN,
    apply_moves_to_solved,
    generate_random_scramble_moves,
    solve_facelets,
    validate_facelets,
)


router = APIRouter(prefix="/api", tags=["rubik"])

DEFAULT_MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "color_classifier.joblib"

_cached_classifier: Optional[StickerColorClassifier] = None
_model_checked = False


def get_ml_classifier() -> Optional[StickerColorClassifier]:
    global _cached_classifier, _model_checked
    if not _model_checked:
        _model_checked = True
        if DEFAULT_MODEL_PATH.exists():
            _cached_classifier = StickerColorClassifier.load(DEFAULT_MODEL_PATH)
    return _cached_classifier


class FaceletsRequest(BaseModel):
    facelets: str = Field(..., min_length=54, max_length=54)


class SolveRequest(FaceletsRequest):
    algorithm: Literal["kociemba", "ida-pdb", "ida-base"] = "kociemba"


class ScrambleRequest(BaseModel):
    length: int = Field(default=20, ge=1, le=50)
    seed: Optional[int] = None


class ApplyMovesRequest(BaseModel):
    moves: str = Field(default="")


def _normalize_facelets(raw: str) -> str:
    cleaned = raw.strip().upper()
    if len(cleaned) != 54 or any(ch not in VALID_COLORS for ch in cleaned):
        raise HTTPException(
            status_code=400,
            detail="facelets must be 54 characters using only W, R, G, Y, O, B",
        )
    return cleaned


@router.get("/health")
def health() -> dict:
    clf = get_ml_classifier()
    return {
        "status": "ok",
        "solver_available": DEFAULT_SOLVER_BIN.exists(),
        "ml_model_loaded": clf is not None,
        "ml_model_name": clf.model_name if clf is not None else None,
    }


@router.post("/validate")
def validate_cube_endpoint(payload: FaceletsRequest) -> dict:
    facelets = _normalize_facelets(payload.facelets)
    res = validate_facelets(facelets)
    return {
        "valid": res.valid,
        "solved": res.solved,
        "facelets": res.facelets,
        "error": res.error,
    }


@router.post("/solve")
def solve_cube_endpoint(payload: SolveRequest) -> dict:
    facelets = _normalize_facelets(payload.facelets)
    res = solve_facelets(facelets, algorithm=payload.algorithm)
    move_list: List[str] = res.moves.split() if res.moves else []
    return {
        "valid": res.valid,
        "solved": res.solved,
        "facelets": res.facelets,
        "algorithm": res.algorithm,
        "moves": res.moves,
        "move_list": move_list,
        "solution_length": res.solution_length,
        "nodes_expanded": res.nodes_expanded,
        "elapsed_ms": res.elapsed_ms,
        "memory_bytes": res.memory_bytes,
        "error": res.error,
    }


@router.post("/scramble")
def scramble_cube_endpoint(payload: ScrambleRequest) -> dict:
    moves = generate_random_scramble_moves(length=payload.length, seed=payload.seed)
    res = apply_moves_to_solved(moves)
    return {
        "scramble_moves": moves,
        "facelets": res.facelets,
        "valid": res.valid,
    }


@router.post("/apply-moves")
def apply_moves_endpoint(payload: ApplyMovesRequest) -> dict:
    try:
        res = apply_moves_to_solved(payload.moves)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not res.valid:
        raise HTTPException(status_code=400, detail=res.error or "Invalid move sequence")
    return {
        "moves": payload.moves,
        "facelets": res.facelets,
        "solved": res.solved,
    }


@router.post("/scan-face")
async def scan_face_endpoint(
    image: UploadFile = File(...),
    use_ml: bool = Form(True),
    use_contour: bool = Form(False),
    box_fraction: float = Form(0.48),
) -> dict:
    raw_bytes = await image.read()
    arr = np.frombuffer(raw_bytes, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode uploaded image")

    clf = get_ml_classifier() if use_ml else None
    result = analyze_face_frame(
        frame,
        box_fraction=box_fraction,
        use_contour=use_contour,
        classifier=clf,
    )
    return {
        "colors": result.colors,
        "face_string": result.face_string,
        "confidences": [round(c, 4) for c in result.confidences],
        "min_confidence": round(result.min_confidence, 4),
        "classifier_used": clf.model_name if clf is not None else "hsv_baseline",
        "used_contour": result.used_contour,
        "face_box": list(result.face_box),
    }

