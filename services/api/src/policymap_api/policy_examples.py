"""Curated official-document review examples, not executable policy rules."""

import json
from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import HttpUrl

from policymap_api.models import StrictModel


class PolicyAttachment(StrictModel):
    format: Literal["PDF", "HWPX"]
    url: HttpUrl


class PolicyExample(StrictModel):
    id: str
    title: str
    title_en: str
    authority: str
    announced_at: date
    effective_from: date | None
    legal_status: Literal["SCHEDULED", "PROPOSED"]
    source_url: HttpUrl
    source_title: str
    locator: str
    source_excerpt: str
    summary: str
    summary_en: str
    attachments: list[PolicyAttachment]
    verified_on: date
    review_note: str


def load_policy_examples() -> list[PolicyExample]:
    path = Path(__file__).resolve().parents[4] / "data/public/policy-examples.json"
    return [PolicyExample.model_validate(row) for row in json.loads(path.read_text("utf-8"))]
