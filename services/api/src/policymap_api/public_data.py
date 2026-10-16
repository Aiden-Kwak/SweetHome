"""Observed public snapshots, deliberately isolated from the synthetic simulator."""

import json
from datetime import date, datetime
from pathlib import Path
from typing import Literal

from pydantic import Field

from policymap_api.models import StrictModel


class PublicSource(StrictModel):
    title: str
    url: str
    publisher: str
    license: str
    reference_year: int | None = None
    sha256: str | None = None


class Boundary(StrictModel):
    code: str
    region_code: str | None
    name: str
    rings: list[list[tuple[float, float]]]


class SourceQuery(StrictModel):
    region_code: str
    contract_date: date
    source_url: str
    sha256: str
    total_matching: int = Field(ge=0)
    returned: int = Field(ge=0, le=5)


class ObservedTransaction(StrictModel):
    id: str
    region_code: str
    region_name: str
    neighborhood: str
    building_name: str
    contract_date: date
    area_m2: float = Field(gt=0)
    floor: int
    price_krw: int = Field(gt=0)
    canceled_at: date | None
    transaction_type: str
    source_query: int = Field(ge=0)


class PublicContext(StrictModel):
    schema_version: Literal["1.0.0"]
    status: Literal["OBSERVED_SAMPLE"]
    retrieved_at: datetime
    boundary_source: PublicSource
    transaction_source: PublicSource
    sampling_note: str
    limitations: list[str]
    boundaries: list[Boundary]
    queries: list[SourceQuery]
    transactions: list[ObservedTransaction]


def load_public_context() -> PublicContext:
    path = Path(__file__).resolve().parents[4] / "data" / "public" / "context.json"
    return PublicContext.model_validate(json.loads(path.read_text(encoding="utf-8")))
