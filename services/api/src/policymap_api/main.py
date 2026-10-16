"""PolicyMap FastAPI application."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from policymap_api import __version__
from policymap_api.config import get_settings
from policymap_api.models import (
    GraphResponse,
    HealthResponse,
    PolicyExtractRequest,
    PolicyExtractResponse,
    PolicySnapshot,
    ScenarioRequest,
    ScenarioResult,
)
from policymap_api.repository import FixtureNotFoundError, FixtureRepository

settings = get_settings()
repository = FixtureRepository(settings.fixture_dir)

app = FastAPI(
    title="PolicyMap API",
    version=__version__,
    description=(
        "Korean real-estate policy graph and scenario API. "
        "The initial harness serves explicitly synthetic fixtures."
    ),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def _not_found(error: FixtureNotFoundError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "code": "DEMO_SCOPE_NOT_FOUND",
            "message": str(error),
            "limitations": [
                "The harness intentionally refuses to substitute another date or region."
            ],
        },
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        environment=settings.environment,
        api_version=__version__,
        fixture_mode=True,
    )


@app.get("/api/v1/policy-state", response_model=PolicySnapshot)
def policy_state(
    date: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    region_code: str = Query(min_length=2),
) -> PolicySnapshot:
    try:
        return repository.get_policy_snapshot(date, region_code)
    except FixtureNotFoundError as error:
        raise _not_found(error) from error


@app.get("/api/v1/coverage", response_model=dict)
def coverage(
    date: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    region_code: str = Query(min_length=2),
) -> dict:
    try:
        snapshot = repository.get_policy_snapshot(date, region_code)
    except FixtureNotFoundError as error:
        raise _not_found(error) from error
    return {
        "snapshot_id": snapshot.snapshot_id,
        "date": snapshot.as_of,
        "region": snapshot.region,
        "coverage": snapshot.coverage,
    }


@app.get("/api/v1/claims", response_model=list[dict])
def claims() -> list[dict]:
    return repository.get_claims()


@app.get("/api/v1/graph", response_model=GraphResponse)
def graph(
    date: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    region_code: str = Query(min_length=2),
) -> GraphResponse:
    try:
        return repository.get_graph(date, region_code)
    except FixtureNotFoundError as error:
        raise _not_found(error) from error


@app.post("/api/v1/policies/extract", response_model=PolicyExtractResponse)
def extract_policy(request: PolicyExtractRequest) -> PolicyExtractResponse:
    try:
        return repository.extract_policy_document(request)
    except FixtureNotFoundError as error:
        raise _not_found(error) from error


@app.post("/api/v1/scenarios/simulate", response_model=ScenarioResult)
def simulate(request: ScenarioRequest) -> ScenarioResult:
    if not request.allow_demo:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "DEMO_CONFIRMATION_REQUIRED",
                "message": "Synthetic fixture results require allow_demo=true.",
            },
        )

    try:
        snapshot = repository.get_policy_snapshot(
            request.baseline_date.isoformat(), request.region_code
        )
    except FixtureNotFoundError as error:
        raise _not_found(error) from error

    available_change_ids = {rule.rule_id for rule in snapshot.rules}
    unknown_ids = sorted(set(request.change_ids) - available_change_ids)
    if unknown_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "UNKNOWN_DEMO_CHANGE",
                "message": "Unsupported synthetic change IDs.",
                "unknown_change_ids": unknown_ids,
            },
        )

    return repository.get_scenario_result(request)
