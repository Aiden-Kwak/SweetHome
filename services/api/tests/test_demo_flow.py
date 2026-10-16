from fastapi.testclient import TestClient

from policymap_api.main import app

client = TestClient(app)


def demo_request(example_id: str, kind: str) -> dict:
    example = next(e for e in client.get("/api/v1/policy-examples").json() if e["id"] == example_id)
    extracted = client.post(
        "/api/v1/policies/analyze",
        json={
            "content_text": example["summary"],
            "engine": "rules",
            "source_url": example["source_url"],
        },
    )
    assert extracted.status_code == 200
    return {
        "content_text": example["summary"],
        "source_url": example["source_url"],
        "candidate": next(c for c in extracted.json()["candidates"] if c["kind"] == kind),
        "reviewed": True,
        "region_codes": ["11680"],
        "simulation_date": "2026-10-16",
        "effective_from": example["effective_from"],
        "proposed": example["legal_status"] == "PROPOSED",
        "hypothetical": True,
        "price_elasticity": None,
        "households": [
            {
                "id": "demo_newlywed",
                "label": "무주택 신혼부부 사례",
                "eligible": True,
                "cash_krw": 100_000_000,
                "financing_need_krw": 400_000_000,
                "property_price_krw": 600_000_000,
                "annual_income_krw": 70_000_000,
                "other_annual_payment_krw": 0,
            }
        ],
    }


def test_official_supply_review_runs_all_seoul_and_recalculates_one_district() -> None:
    request = demo_request("molit-20260916-housing-act-draft", "units")
    boundaries = client.get("/api/v1/public-context").json()["boundaries"]
    codes = [b["region_code"] for b in boundaries if b["code"].startswith("11")]
    request["region_codes"] = codes
    request["supply_assumptions"] = [
        {
            "region_code": code,
            "housing_stock": 100000,
            "project_count": 10,
            "units_per_project": 400,
            "residential_share_percent": 85,
            "comparator": "lt",
            "delivery_fraction": 0.25,
            "horizon_months": 12,
            "price_response_coefficient": 0.5,
            "other_conditions_satisfied": True,
            "input_basis": "illustrative",
            "source_url": None,
        }
        for code in codes
    ]
    response = client.post("/api/v1/scenarios/policy", json=request)
    assert response.status_code == 200
    first = response.json()
    assert len(first["regions"]) == 25
    assert all(r["metric_value"] == -0.5 for r in first["regions"])
    next(s for s in request["supply_assumptions"] if s["region_code"] == "11680")[
        "project_count"
    ] = 20
    second = client.post("/api/v1/scenarios/policy", json=request).json()
    assert second["scenario_id"] != first["scenario_id"]
    assert next(r for r in second["regions"] if r["code"] == "11680")["metric_value"] == -1
    assert all(r["metric_value"] == -0.5 for r in second["regions"] if r["code"] != "11680")
    assert second["source_url"] == request["source_url"]


def test_official_guarantee_review_shows_household_impact_not_house_price() -> None:
    request = demo_request("fsc-20261015-housing-finance", "guarantee_cap")
    response = client.post("/api/v1/scenarios/policy", json=request)
    assert response.status_code == 200
    result = response.json()
    household = result["households"][0]
    assert household["financing_before_krw"] == 200_000_000
    assert household["financing_after_krw"] == 300_000_000
    assert household["budget_before_krw"] == 300_000_000
    assert household["budget_after_krw"] == 400_000_000
    assert result["regions"][0]["price_sensitivity_percent"] is None
    assert result["regions"][0]["metric_label"] == "임차 예산 변화"
