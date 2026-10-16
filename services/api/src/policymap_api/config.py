"""Runtime configuration with safe local defaults."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _project_root() -> Path:
    return Path(__file__).resolve().parents[4]


@dataclass(frozen=True)
class Settings:
    environment: str
    fixture_dir: Path
    allowed_origins: tuple[str, ...]


def get_settings() -> Settings:
    configured_fixture_dir = os.getenv("POLICYMAP_FIXTURE_DIR")
    fixture_dir = (
        Path(configured_fixture_dir).expanduser().resolve()
        if configured_fixture_dir
        else _project_root() / "data" / "fixtures"
    )
    default_origins = (
        "http://localhost:5173,http://localhost:5174,"
        "http://127.0.0.1:5173,http://127.0.0.1:5174"
    )
    origins = tuple(
        origin.strip()
        for origin in os.getenv("POLICYMAP_ALLOWED_ORIGINS", default_origins).split(",")
        if origin.strip()
    )
    return Settings(
        environment=os.getenv("POLICYMAP_ENV", "development"),
        fixture_dir=fixture_dir,
        allowed_origins=origins,
    )
