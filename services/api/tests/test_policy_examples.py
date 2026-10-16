import copy

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from policymap_api.main import app
from policymap_api.policy_examples import PolicyExample


def test_official_examples_preserve_proposed_and_scheduled_status() -> None:
    response = TestClient(app).get("/api/v1/policy-examples")
    assert response.status_code == 200
    examples = [PolicyExample.model_validate(row) for row in response.json()]
    assert len(examples) == 2
    assert len({row.id for row in examples}) == 2
    assert all(row.source_url.host in {"www.fsc.go.kr", "moleg.go.kr"} for row in examples)
    assert all(row.locator and row.source_excerpt and row.review_note for row in examples)
    scheduled = next(row for row in examples if row.legal_status == "SCHEDULED")
    assert scheduled.effective_from > scheduled.verified_on
    assert {file.format for file in scheduled.attachments} == {"PDF", "HWPX"}
    proposed = next(row for row in examples if row.legal_status == "PROPOSED")
    assert proposed.effective_from is None
    assert all(not row.id.startswith("demo_") for row in examples)


def test_examples_reject_unverified_status_and_unsafe_urls() -> None:
    source = TestClient(app).get("/api/v1/policy-examples").json()[0]
    for key, value in [
        ("legal_status", "VALIDATED_FORECAST"),
        ("source_url", "javascript:alert(1)"),
        ("announced_at", "not-a-date"),
    ]:
        invalid = copy.deepcopy(source)
        invalid[key] = value
        with pytest.raises(ValidationError):
            PolicyExample.model_validate(invalid)


def test_examples_do_not_modify_demo_snapshot() -> None:
    client = TestClient(app)
    url = "/api/v1/policy-state?date=2025-06-28&region_code=11680"
    before = client.get(url).json()
    assert client.get("/api/v1/policy-examples").status_code == 200
    assert client.get(url).json() == before
