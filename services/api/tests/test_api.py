import io
import zipfile

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from policymap_api.main import app
from policymap_api.models import Claim, PolicyRule
from policymap_api.repository import extract_text_from_hwpx_bytes

client = TestClient(app)


def test_health_discloses_fixture_mode() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["fixture_mode"] is True


def test_policy_state_is_explicitly_incomplete() -> None:
    response = client.get(
        "/api/v1/policy-state",
        params={"date": "2025-06-28", "region_code": "11680"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["coverage"]["status"] == "DEMO_INCOMPLETE"
    assert len(payload["rules"]) == 5
    assert all(rule["verification_status"] == "synthetic" for rule in payload["rules"])
    assert all(rule["previous_summary"] for rule in payload["rules"])
    assert all(rule["proposed_summary"] for rule in payload["rules"])


def test_unknown_fixture_scope_is_not_silently_substituted() -> None:
    response = client.get(
        "/api/v1/policy-state",
        params={"date": "2025-06-28", "region_code": "11710"},
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "DEMO_SCOPE_NOT_FOUND"


def test_simulation_requires_explicit_demo_confirmation() -> None:
    response = client.post(
        "/api/v1/scenarios/simulate",
        json={
            "baseline_date": "2025-06-28",
            "region_code": "11680",
            "horizon_months": 6,
            "change_ids": ["demo_rule_mortgage_cap"],
            "allow_demo": False,
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "DEMO_CONFIRMATION_REQUIRED"


def test_simulation_returns_synthetic_status_and_limitations() -> None:
    response = client.post(
        "/api/v1/scenarios/simulate",
        json={
            "baseline_date": "2025-06-28",
            "region_code": "11680",
            "horizon_months": 6,
            "change_ids": ["demo_rule_mortgage_cap", "demo_rule_land_permit"],
            "allow_demo": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["data_status"] == "DEMO_INCOMPLETE"
    assert payload["model_status"] == "SYNTHETIC_FIXTURE"
    assert payload["is_investment_advice"] is False
    assert len(payload["regions"]) == 11
    assert len(payload["cohorts"]) == 4
    assert payload["regions"][0]["region_code"] == "11680"
    assert payload["regions"][0]["effect_type"] == "direct"
    assert payload["limitations"]
    for region in payload["regions"]:
        code = region["region_code"]
        assert code in payload["structured_causal_chains"]
        assert len(payload["structured_causal_chains"][code]) == 5


def test_multi_horizon_simulation_scales_deterministically() -> None:
    horizons = [0, 3, 6, 12]
    results = {}
    for h in horizons:
        resp = client.post(
            "/api/v1/scenarios/simulate",
            json={
                "baseline_date": "2025-06-28",
                "region_code": "11680",
                "horizon_months": h,
                "change_ids": [
                    "demo_rule_mortgage_cap",
                    "demo_rule_land_permit",
                    "demo_rule_stress_dsr_phase3",
                ],
                "allow_demo": True,
            },
        )
        assert resp.status_code == 200
        results[h] = resp.json()

    # Immediate (0m) price effect magnitude is smaller than 6m medium-run effect
    assert abs(results[0]["regions"][0]["price_change"]["low"]) < abs(
        results[6]["regions"][0]["price_change"]["low"]
    )
    assert results[0]["horizon_months"] == 0
    assert results[12]["horizon_months"] == 12


def test_claims_preserve_conflicting_research_and_null_unverified_effects() -> None:
    response = client.get("/api/v1/claims")
    assert response.status_code == 200
    claims = response.json()
    assert len(claims) >= 24

    evidence_ids = {c.get("evidence_id") for c in claims}
    assert {
        "EV-KDI-2023-06",
        "EV-BOK-2016-10",
        "EV-KDI-2022-09",
        "EV-BOK-2025-26",
        "EV-BOK-2025-HHDEBT",
        "EV-BOK-2022-45",
        "EV-KDI-2025-COLUMN",
    }.issubset(evidence_ids)

    has_conflict = any(
        any(rel["relation"] == "CONFLICTS_WITH" for rel in (c.get("related_claims") or []))
        for c in claims
    )
    assert has_conflict is True

    # Ensure unverified paper coefficients are explicitly kept null rather than fabricated
    bok_2016_dti = next(c for c in claims if c["claim_id"] == "CL-BOK16-DTI-PRICE-TIGHTEN")
    assert bok_2016_dti["effect_value"] is None

    kdi_2023_ltp = next(c for c in claims if c["claim_id"] == "CL-KDI23-LTP-PRICE-DIRECT")
    assert kdi_2023_ltp["effect_value"] == -4.3


def test_graph_contains_policy_and_mechanism_relationships() -> None:
    response = client.get(
        "/api/v1/graph",
        params={"date": "2025-06-28", "region_code": "11680"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["data_status"] == "DEMO_INCOMPLETE"
    node_kinds = {node["kind"] for node in payload["nodes"]}
    assert {
        "policy_package",
        "measure",
        "policy_rule",
        "legal_source",
        "region",
        "household_cohort",
        "mechanism",
        "market_metric",
        "evidence",
        "claim",
    }.issubset(node_kinds)
    edge_relations = {edge["relation"] for edge in payload["edges"]}
    assert {
        "CONTAINS",
        "IMPLEMENTS",
        "SUPERSEDES",
        "APPLIES_TO",
        "ACTS_THROUGH",
        "DIRECT_EFFECT",
        "SPILLOVER_EFFECT",
        "SPILLOVER_TO",
        "SUBSTITUTES_TO",
        "MAKES_CLAIM",
        "CONFLICTS_WITH",
    }.issubset(edge_relations)


def test_policy_extract_endpoint_and_hwp_visible_fallback() -> None:
    sample_resp = client.post(
        "/api/v1/policies/extract",
        json={
            "input_type": "sample",
            "title": "2025년 6월 수도권 가계부채 관리방안 및 토지거래허가구역 확대",
            "filename": "20250627_수도권_가계부채_관리방안_검증샘플.pdf",
            "content_text": "수도권 주담대 한도 6억원 신설 및 토지거래허가구역 확대",
            "as_of": "2025-06-28",
            "region_code": "11680",
        },
    )
    assert sample_resp.status_code == 200
    sample_data = sample_resp.json()
    assert sample_data["snapshot"]["document_provenance"]["format"] == "PDF"
    assert all(bool(step["detail"]) for step in sample_data["extraction_steps"])

    hwpx_resp = client.post(
        "/api/v1/policies/extract",
        json={
            "input_type": "hwpx",
            "title": "2025년 6월 수도권 가계부채 관리방안 및 토지거래허가구역 확대",
            "filename": "20250627_수도권_가계부채_관리방안.hwpx",
            "content_text": "수도권 주담대 한도 6억원 신설 및 토지거래허가구역 확대",
            "as_of": "2025-06-28",
            "region_code": "11680",
        },
    )
    assert hwpx_resp.status_code == 200
    hwpx_data = hwpx_resp.json()
    assert hwpx_data["fallback_message"] is None
    assert len(hwpx_data["extraction_steps"]) == 4
    assert hwpx_data["snapshot"]["document_provenance"]["extraction_status"] == "COMPLETED"

    hwp_resp = client.post(
        "/api/v1/policies/extract",
        json={
            "input_type": "hwp",
            "title": "2025년 6월 수도권 가계부채 관리방안 및 토지거래허가구역 확대",
            "filename": "20250627_수도권_가계부채_관리방안.hwp",
            "as_of": "2025-06-28",
            "region_code": "11680",
        },
    )
    assert hwp_resp.status_code == 200
    hwp_data = hwp_resp.json()
    assert hwp_data["fallback_message"] is not None
    assert hwp_data["extraction_steps"][0]["status"] == "fallback_warning"
    assert (
        hwp_data["snapshot"]["document_provenance"]["extraction_status"] == "FAILED_FALLBACK_TEXT"
    )


def test_extract_text_from_hwpx_bytes() -> None:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            "Contents/section0.xml",
            "<sec><p><t>수도권 주담대 한도 6억 원 제한</t></p></sec>",
        )
    extracted = extract_text_from_hwpx_bytes(buf.getvalue())
    assert "수도권 주담대 한도 6억 원 제한" in extracted


def test_contract_rejects_invalid_claim_and_policy_rule() -> None:
    with pytest.raises(ValidationError):
        Claim.model_validate(
            {
                "claim_id": "invalid_claim",
                "source_title": "Test",
                "institution": "INVALID_INSTITUTION",
                "published_year": 2025,
                "policy_category": "FINANCE",
                "target_metric": "PRICE_GROWTH",
                "direction": "DECREASE",
                "lag_months": [0, 6],
                "method": "DiD",
                "sample_scope": "Seoul",
                "confidence_grade": "A",
                "limitation": "None",
                "citation_excerpt": "Short",
                "verification_status": "verified",
            }
        )

    with pytest.raises(ValidationError):
        PolicyRule.model_validate(
            {
                "rule_id": "invalid_rule",
                "package_id": "pkg",
                "title": "Short Rule",
                "category": "FINANCE",
                "region_codes": ["ABC"],
                "announced_at": "2025-06-27",
                "effective_from": "2025-06-28",
                "effective_to": None,
                "parameters": {},
                "summary": "Too short",
                "source": {
                    "title": "Source",
                    "issuer": "FSC",
                    "published_at": "2025-06-27",
                    "url": "https://www.fsc.go.kr",
                    "citation_label": "p.1",
                    "excerpt": "Too short",
                },
                "verification_status": "synthetic",
            }
        )

