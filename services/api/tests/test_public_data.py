import copy
import hashlib
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from policymap_api.main import app
from policymap_api.public_data import PublicContext, load_public_context


def test_public_context_is_observed_not_a_forecast() -> None:
    response = TestClient(app).get("/api/v1/public-context")
    assert response.status_code == 200
    context = PublicContext.model_validate(response.json())
    assert context.status == "OBSERVED_SAMPLE"
    assert len(context.transactions) == 30
    assert len(context.queries) == 6
    assert len({b.region_code for b in context.boundaries if b.region_code}) == 29
    seoul = [b for b in context.boundaries if b.code.startswith("11")]
    assert len(seoul) == 25
    assert len({b.region_code for b in seoul}) == 25
    assert all(b.region_code and b.region_code.startswith("11") for b in seoul)
    scenario = json.loads(
        (Path(__file__).resolve().parents[3] / "data/fixtures/scenario_result.json").read_text()
    )
    assert {b.region_code for b in context.boundaries if b.region_code} >= {
        r["region_code"] for r in scenario["regions"]
    }
    assert context.boundary_source.reference_year == 2018
    assert context.limitations
    assert "시나리오 계수나 예측값에 반영하지" in " ".join(context.limitations)
    assert any(t.canceled_at is not None for t in context.transactions)


def test_observations_match_archived_official_responses() -> None:
    context = load_public_context()
    root = Path(__file__).resolve().parents[3] / "data" / "public" / "raw"
    for index, query in enumerate(context.queries):
        filename = f"seoul-{query.region_code}-{query.contract_date:%Y%m%d}.json"
        raw = (root / filename).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == query.sha256
        source = json.loads(raw)["tbLnOpendataRtmsV"]
        assert query.returned == len(source["row"])
        assert query.total_matching == source["list_total_count"]
        rows = [t for t in context.transactions if t.source_query == index]
        assert len(rows) == query.returned
        for row, original in zip(rows, source["row"], strict=True):
            assert row.price_krw == int(original["THING_AMT"]) * 10000
            assert row.area_m2 == original["ARCH_AREA"]
            assert row.building_name == original["BLDG_NM"]
            assert row.contract_date == query.contract_date
            assert row.region_code == query.region_code
            assert row.contract_date.isoformat() <= "2025-06-28"
    raw_boundary = (root / "kostat-2018.topo.json").read_bytes()
    assert hashlib.sha256(raw_boundary).hexdigest() == context.boundary_source.sha256


def test_public_contract_rejects_fake_status_and_invalid_prices() -> None:
    payload = load_public_context().model_dump(mode="json")
    invalid = copy.deepcopy(payload)
    invalid["status"] = "VALIDATED_FORECAST"
    with pytest.raises(ValidationError):
        PublicContext.model_validate(invalid)
    invalid = copy.deepcopy(payload)
    invalid["transactions"][0]["price_krw"] = -10000
    with pytest.raises(ValidationError):
        PublicContext.model_validate(invalid)
    invalid = copy.deepcopy(payload)
    del invalid["transaction_source"]
    with pytest.raises(ValidationError):
        PublicContext.model_validate(invalid)


def test_kdi_report_link_matches_verified_title() -> None:
    claims = TestClient(app).get("/api/v1/claims").json()
    rows = [c for c in claims if c.get("evidence_id") == "EV-KDI-2023-06"]
    assert rows
    assert all(c["source"]["url"].endswith("pub_no=18385") for c in rows)
    assert all(c["source"]["title"] == "주택시장과 규제" for c in rows)
