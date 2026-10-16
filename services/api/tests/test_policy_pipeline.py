import base64
import copy
import io
import json
import zipfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from policymap_api.main import app

client = TestClient(app)
TEXT = "수도권 주택담보대출 한도를 6억 원에서 4억 원으로 변경한다."


def analysis(text: str = TEXT) -> dict:
    response = client.post(
        "/api/v1/policies/analyze",
        json={"content_text": text, "engine": "rules", "source_url": "https://www.fsc.go.kr/"},
    )
    assert response.status_code == 200, response.text
    return response.json()


def experiment_request(text: str = TEXT) -> dict:
    data = analysis(text)
    return {
        "content_text": text,
        "candidate": data["candidates"][0],
        "reviewed": True,
        "region_codes": ["11680"],
        "simulation_date": "2026-10-20",
        "effective_from": "2026-10-19",
        "price_elasticity": 0.1,
        "households": [
            {
                "id": "demo_test",
                "label": "합성 테스트 가구",
                "eligible": True,
                "cash_krw": 200_000_000,
                "financing_need_krw": 700_000_000,
                "property_price_krw": 900_000_000,
                "annual_income_krw": 80_000_000,
                "other_annual_payment_krw": 0,
            }
        ],
    }


def test_text_candidates_are_grounded_and_change_with_input() -> None:
    data = analysis()
    assert data["engine"] == "RULE_BASED_V1"
    assert data["status"] == "REVIEW_REQUIRED"
    assert data["candidates"][0]["before"] == 600_000_000
    assert data["candidates"][0]["after"] == 400_000_000
    different = analysis(TEXT.replace("4억", "3억"))
    assert different["text_hash"] != data["text_hash"]
    assert different["candidates"][0]["after"] == 300_000_000
    unknown = analysis("예외 조건만 검토합니다. 변경 전 금액은 명시하지 않았습니다.")
    assert unknown["candidates"] == []
    assert unknown["status"] == "NO_SUPPORTED_RULES"


def test_official_review_examples_extract_only_supported_pairs() -> None:
    rows = json.loads(
        (Path(__file__).resolve().parents[3] / "data/public/policy-examples.json").read_text()
    )
    fsc = analysis(rows[0]["summary"])
    kinds = {c["kind"] for c in fsc["candidates"]}
    assert {"age", "guarantee_cap"} <= kinds
    assert "mortgage_cap" not in kinds
    housing = analysis(rows[1]["summary"])
    assert {"units", "area_share"} <= {c["kind"] for c in housing["candidates"]}
    assert len({c["id"] for c in housing["candidates"]}) == len(housing["candidates"])
    assert housing["candidates"][0]["quote"] == rows[1]["summary"]


def test_experiment_recalculates_and_has_reproducible_id() -> None:
    request = experiment_request()
    response = client.post("/api/v1/scenarios/policy", json=request)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["data_status"] == "INCOMPLETE"
    assert result["model_status"] == "EXPERIMENTAL"
    h = result["households"][0]
    assert (h["financing_before_krw"], h["financing_after_krw"]) == (600_000_000, 400_000_000)
    assert h["budget_change_percent"] == -25
    assert result["regions"][0]["price_sensitivity_percent"] == -2.5
    assert client.post("/api/v1/scenarios/policy", json=request).json() == result
    request["price_elasticity"] = None
    changed = client.post("/api/v1/scenarios/policy", json=request).json()
    assert changed["regions"][0]["price_sensitivity_percent"] is None
    assert changed["scenario_id"] != result["scenario_id"]


def test_temporal_and_household_gates() -> None:
    request = experiment_request()
    request["simulation_date"] = "2026-10-18"
    result = client.post("/api/v1/scenarios/policy", json=request).json()
    assert result["applied"] is False
    assert result["households"][0]["financing_after_krw"] == 600_000_000
    request["simulation_date"] = "2026-10-20"
    request["households"][0]["eligible"] = False
    result = client.post("/api/v1/scenarios/policy", json=request).json()
    assert result["households"][0]["financing_after_krw"] == 600_000_000
    request["proposed"] = True
    assert client.post("/api/v1/scenarios/policy", json=request).status_code == 422
    request["hypothetical"] = True
    assert client.post("/api/v1/scenarios/policy", json=request).status_code == 200


@pytest.mark.parametrize(
    "text",
    [
        "전세대출보증 한도를 2억 원에서 3억 원으로 변경합니다.",
        "세대수 기준을 300세대 미만에서 500세대 미만으로 변경합니다.",
    ],
)
def test_guarantee_and_supply_without_assumptions_do_not_imply_purchase_price(text: str) -> None:
    result = client.post("/api/v1/scenarios/policy", json=experiment_request(text)).json()
    assert result["regions"][0]["price_sensitivity_percent"] is None


def supply_request(
    text: str = "세대수 기준을 300세대 미만에서 500세대 미만으로 변경합니다.",
) -> dict:
    request = experiment_request(text)
    request["supply_assumptions"] = [
        {
            "region_code": "11680",
            "housing_stock": 100_000,
            "project_count": 10,
            "units_per_project": 400,
            "residential_share_percent": 95,
            "comparator": "lt",
            "delivery_fraction": 0.25,
            "horizon_months": 12,
            "price_response_coefficient": 0.5,
            "other_conditions_satisfied": True,
            "input_basis": "illustrative",
        }
    ]
    return request


def test_supply_connects_eligibility_delivery_stock_and_price() -> None:
    request = supply_request()
    request["region_codes"].append("11440")
    request["supply_assumptions"].append(
        {**request["supply_assumptions"][0], "region_code": "11440", "housing_stock": 200_000}
    )
    response = client.post("/api/v1/scenarios/policy", json=request)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["households"] == []
    s = result["supply"][0]
    assert not s["eligible_before"] and s["eligible_after"]
    assert s["planned_units"] == 4000
    assert s["accelerated_units"] == 1000
    assert s["stock_change_percent"] == 1
    assert [r["metric_value"] for r in result["regions"]] == [-0.5, -0.25]
    assert result["regions"][0]["metric_label"] == "가격 민감도"
    assert client.post("/api/v1/scenarios/policy", json=request).json() == result
    request["simulation_date"] = "2026-10-18"
    before = client.post("/api/v1/scenarios/policy", json=request).json()
    assert before["supply"][0]["accelerated_units"] == 0
    assert before["regions"][0]["metric_value"] == 0


@pytest.mark.parametrize(
    "units,comparator,expected",
    [(299, "lt", 0), (500, "lt", 0), (500, "lte", 1250), (300, "lt", 750)],
)
def test_supply_boundary_is_not_automatic_extra_houses(units, comparator, expected) -> None:
    request = supply_request()
    request["supply_assumptions"][0].update(units_per_project=units, comparator=comparator)
    response = client.post("/api/v1/scenarios/policy", json=request)
    assert response.status_code == 200, response.text
    assert response.json()["supply"][0]["accelerated_units"] == expected


def test_supply_area_share_tightening_and_validation() -> None:
    request = supply_request("연면적 기준은 90% 미만에서 100% 미만으로 변경합니다.")
    assert (
        client.post("/api/v1/scenarios/policy", json=request).json()["supply"][0][
            "price_sensitivity_percent"
        ]
        == -0.5
    )
    request = supply_request("세대수 기준을 500세대 미만에서 300세대 미만으로 변경합니다.")
    assert (
        client.post("/api/v1/scenarios/policy", json=request).json()["supply"][0][
            "price_sensitivity_percent"
        ]
        == 0.5
    )
    for key, value in [
        ("housing_stock", 0),
        ("delivery_fraction", 1.1),
        ("other_conditions_satisfied", False),
        ("region_code", "11440"),
        ("price_response_coefficient", -0.5),
        ("housing_stock", 1),
    ]:
        invalid = copy.deepcopy(request)
        invalid["supply_assumptions"][0][key] = value
        assert client.post("/api/v1/scenarios/policy", json=invalid).status_code == 422
    request["supply_assumptions"].append(request["supply_assumptions"][0])
    assert client.post("/api/v1/scenarios/policy", json=request).status_code == 422


def test_policy_specific_metric_prevents_empty_price_cards() -> None:
    request = experiment_request()
    request["price_elasticity"] = None
    result = client.post("/api/v1/scenarios/policy", json=request).json()
    assert result["regions"][0]["metric_label"] == "구매 예산 변화"
    assert result["regions"][0]["metric_value"] == -25
    request = experiment_request("연령 기준을 34세에서 39세로 변경합니다.")
    result = client.post("/api/v1/scenarios/policy", json=request).json()
    assert result["regions"][0]["metric_value"] == 5
    assert result["regions"][0]["metric_unit"] == "세"
    assert result["households"] == []


def test_invalid_grounding_review_scope_and_numbers_are_rejected() -> None:
    request = experiment_request()
    for field, value in [
        ("reviewed", False),
        ("region_codes", ["invalid"]),
        ("price_elasticity", 10),
        ("content_text", "다른 본문"),
        ("effective_from", "not-a-date"),
    ]:
        invalid = copy.deepcopy(request)
        invalid[field] = value
        assert client.post("/api/v1/scenarios/policy", json=invalid).status_code == 422
    invalid = copy.deepcopy(request)
    invalid["candidate"]["after"] = 12345
    assert client.post("/api/v1/scenarios/policy", json=invalid).status_code == 422
    assert (
        client.post(
            "/api/v1/policies/analyze",
            json={"content_text": TEXT, "source_url": "javascript:alert(1)"},
        ).status_code
        == 422
    )


def test_ltv_and_zero_rate_dsr_calculations() -> None:
    ltv = experiment_request("LTV를 70%에서 50%로 변경합니다.")
    result = client.post("/api/v1/scenarios/policy", json=ltv).json()
    assert result["households"][0]["financing_after_krw"] == 450_000_000
    dsr = experiment_request("DSR을 40%에서 30%로 변경합니다.")
    dsr["annual_rate_percent"] = 0
    dsr["loan_years"] = 10
    result = client.post("/api/v1/scenarios/policy", json=dsr).json()
    assert result["households"][0]["financing_after_krw"] == 240_000_000


def test_hwpx_and_pdf_are_actually_parsed() -> None:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("Contents/section0.xml", f"<sec><p><t>{TEXT}</t></p></sec>")
    response = client.post(
        "/api/v1/policies/analyze",
        json={
            "filename": "policy.hwpx",
            "file_base64": base64.b64encode(buffer.getvalue()).decode(),
            "engine": "rules",
        },
    )
    assert response.status_code == 200, response.text
    assert len(response.json()["candidates"]) == 1
    writer = PdfWriter()
    page = writer.add_blank_page(width=500, height=500)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})}
    )
    content = DecodedStreamObject()
    content.set_data(b"BT /F1 12 Tf 10 400 Td (LTV 70% -> 50%) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(content)
    buffer = io.BytesIO()
    writer.write(buffer)
    response = client.post(
        "/api/v1/policies/analyze",
        json={
            "filename": "policy.pdf",
            "file_base64": base64.b64encode(buffer.getvalue()).decode(),
            "engine": "rules",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["candidates"][0]["kind"] == "ltv"
    assert "[PDF 1쪽]" in response.json()["content_text"]


def test_blank_pdf_and_hwp_are_not_reported_as_parsed() -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    buffer = io.BytesIO()
    writer.write(buffer)
    for name, raw in [("blank.pdf", buffer.getvalue()), ("old.hwp", b"unsupported")]:
        response = client.post(
            "/api/v1/policies/analyze",
            json={
                "filename": name,
                "file_base64": base64.b64encode(raw).decode(),
                "engine": "rules",
            },
        )
        assert response.status_code == 422


def test_gemini_missing_config_and_failure_are_visible(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert (
        client.post(
            "/api/v1/policies/analyze", json={"content_text": TEXT, "engine": "gemini"}
        ).status_code
        == 422
    )
    monkeypatch.setenv("GEMINI_API_KEY", "test-not-real")
    monkeypatch.setenv("GEMINI_MODEL", "test-model")
    with patch("urllib.request.urlopen", side_effect=TimeoutError):
        response = client.post(
            "/api/v1/policies/analyze", json={"content_text": TEXT, "engine": "gemini"}
        )
    assert response.status_code == 422
    assert "test-not-real" not in response.text


def test_gemini_response_is_validated_without_calling_a_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-not-real")
    monkeypatch.setenv("GEMINI_MODEL", "test-model")
    row = {
        "kind": "mortgage_cap",
        "label": "주택담보대출 한도",
        "before": 600_000_000,
        "after": 400_000_000,
        "unit": "KRW",
        "quote": TEXT,
    }
    for quote, expected in [(TEXT, 200), ("원문에 없는 인용", 422)]:
        row["quote"] = quote
        response = {
            "candidates": [
                {"content": {"parts": [{"text": json.dumps({"rules": [row]}, ensure_ascii=False)}]}}
            ]
        }
        with patch(
            "urllib.request.urlopen", return_value=io.BytesIO(json.dumps(response).encode())
        ):
            result = client.post(
                "/api/v1/policies/analyze",
                json={
                    "content_text": TEXT,
                    "engine": "gemini",
                },
            )
        assert result.status_code == expected
        if expected == 200:
            assert result.json()["engine"] == "GEMINI"
            assert result.json()["candidates"][0]["quote"] == TEXT
