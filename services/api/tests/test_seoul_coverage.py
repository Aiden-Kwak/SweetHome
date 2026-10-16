import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError

from policymap_api.models import RegionResult
from policymap_api.public_data import load_public_context

ROOT = Path(__file__).resolve().parents[3]


def test_context_region_contract_and_invalid_status() -> None:
    row = json.loads((ROOT / "data/fixtures/region_context_only.json").read_text())
    schema = json.loads((ROOT / "packages/contracts/scenario-result.schema.json").read_text())
    validator = Draft202012Validator(schema["properties"]["regions"]["items"])
    validator.validate(row)
    assert RegionResult.model_validate(row).price_change is None
    invalid = {**row, "coverage_status": "verified_forecast"}
    assert list(validator.iter_errors(invalid))
    with pytest.raises(ValidationError):
        RegionResult.model_validate(invalid)


def test_seoul_mapping_preserves_names_and_does_not_capture_other_jung_gu() -> None:
    mapping = json.loads((ROOT / "data/public/seoul-districts.json").read_text())["districts"]
    context = load_public_context()
    seoul = [b for b in context.boundaries if b.code.startswith("11")]
    assert {b.name: b.region_code for b in seoul} == mapping
    other_jung = [b for b in context.boundaries if b.name == "중구" and not b.code.startswith("11")]
    assert other_jung
    assert all(b.region_code != "11140" for b in other_jung)
