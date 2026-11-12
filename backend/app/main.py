"""FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as rubik_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="Rubik's Cube Solver API",
        description="Computer vision, ML color recognition, and C++ solver API.",
        version="0.6.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(rubik_router)
    return app


app = create_app()

