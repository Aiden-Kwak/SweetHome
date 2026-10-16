from datetime import date
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class DataStatus(StrEnum):
    COMPLETE = "COMPLETE"
    INCOMPLETE = "INCOMPLETE"
    CONFLICTED = "CONFLICTED"
    DEMO_INCOMPLETE = "DEMO_INCOMPLETE"


class ModelStatus(StrEnum):
    VALIDATED = "VALIDATED"
    EXPERIMENTAL = "EXPERIMENTAL"
    SYNTHETIC_FIXTURE = "SYNTHETIC_FIXTURE"
    UNAVAILABLE = "UNAVAILABLE"


VerificationStatus = Literal["verified", "unverified", "conflicted", "synthetic"]
ChangeType = Literal[
    "new",
    "tightened",
    "loosened",
    "extended",
    "expired",
    "superseded",
    "corrected",
    "unchanged",
]
RuleRelationType = Literal["AMENDS", "SUPERSEDES", "EXEMPTS", "INTERACTS_WITH"]
ClaimRelationType = Literal["CONFLICTS_WITH", "COMPLEMENTS", "CONTEXTUALIZES"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Region(StrictModel):
    code: str
    name: str


class RuleParameter(StrictModel):
    name: str
    previous_value: float | int | str | bool | None = None
    operator: str | None = None
    value: float | int | str | bool
    unit: str


class RuleScope(StrictModel):
    region_codes: list[str]
    region_names: list[str] | None = None
    household_cohorts: list[str]
    property_types: list[str]


class RuleRelation(StrictModel):
    relation: RuleRelationType
    target_rule_id: str
    note: str | None = None


class SourceReference(StrictModel):
    title: str
    url: str
    authority: str
    locator: str
    excerpt: str | None = None
    is_official: bool
    content_hash: str | None = None


class PolicyRule(StrictModel):
    rule_id: str = Field(min_length=3)
    title: str = Field(min_length=3)
    category: Literal[
        "finance", "tax", "supply", "subscription", "land_use", "lease", "macro", "transaction"
    ]
    change_type: ChangeType
    package_id: str | None = None
    measure_id: str | None = None
    previous_rule_id: str | None = None
    previous_summary: str | None = None
    proposed_summary: str | None = None
    impact_priority: int | None = Field(default=None, ge=1, le=20)
    source_priority: int | None = Field(default=None, ge=1, le=5)
    parameters: list[RuleParameter]
    announced_at: date | None = None
    promulgated_at: date | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    grace_period_from: date | None = None
    grace_period_to: date | None = None
    grace_period_note: str | None = None
    recorded_from: str | None = None
    recorded_to: str | None = None
    applies_to: RuleScope
    exceptions: list[str] = Field(default_factory=list)
    mechanisms: list[str] = Field(min_length=1)
    relations: list[RuleRelation] | None = None
    source: SourceReference
    verification_status: VerificationStatus
    extraction_confidence: float | None = Field(default=None, ge=0, le=1)


class CoverageSummary(StrictModel):
    status: DataStatus
    policy_coverage: float = Field(ge=0, le=1)
    evidence_coverage: float = Field(ge=0, le=1)
    limitations: list[str]
    verified_rules: int = Field(ge=0)
    required_rules: int = Field(ge=1)


class DocumentProvenance(StrictModel):
    document_id: str
    filename: str
    format: Literal["TEXT", "PDF", "HWPX", "HWP"]
    authority: str
    announced_at: date
    document_hash: str
    extraction_status: str
    cache_status: str


class PolicySnapshot(StrictModel):
    schema_version: str = "1.1.0"
    snapshot_id: str
    package_title: str | None = None
    as_of: date
    as_of_date: date
    region: Region
    region_code: str
    data_status: DataStatus
    is_investment_advice: Literal[False] = False
    coverage: CoverageSummary
    document_provenance: DocumentProvenance | None = None
    rules: list[PolicyRule]
    missing_requirements: list[str] = Field(default_factory=list)


class ExtractionStepStatus(StrictModel):
    step: int = Field(ge=1, le=4)
    code: Literal[
        "READING_DOC",
        "FINDING_DIFF",
        "LINKING_TARGET",
        "CHECKING_EVIDENCE",
    ]
    label: str
    status: Literal["completed", "fallback_warning"]
    detail: str = ""


class PolicyExtractRequest(StrictModel):
    input_type: Literal["text", "pdf", "hwpx", "hwp", "sample"] = "text"
    title: str | None = None
    content_text: str | None = None
    filename: str | None = None
    authority: str | None = None
    announced_at: date | None = None
    region_code: str = "11680"
    as_of: date | None = None
    as_of_date: date = date(2025, 6, 28)
    use_verified_cache: bool = True


class PolicyExtractResponse(StrictModel):
    snapshot: PolicySnapshot
    extraction_steps: list[ExtractionStepStatus]
    fallback_message: str | None = None
    diff_summary: str
    is_investment_advice: Literal[False] = False


class ScenarioRequest(StrictModel):
    baseline_date: date
    region_code: str
    horizon_months: int = Field(ge=0, le=60)
    change_ids: list[str] = Field(min_length=1)
    allow_demo: bool = False
    base_rate_delta_bp: int = 0
    policy_lead_months: int = 0


class ValueRange(StrictModel):
    low: float
    median: float | None = None
    high: float
    ci80_low: float | None = None
    ci80_high: float | None = None
    unit: str


class RegionResult(StrictModel):
    region_code: str
    region_name: str
    price_change: ValueRange
    transaction_change: ValueRange
    mortgage_limit_change: ValueRange | None = None
    confidence: Literal["low", "medium", "high"]
    effect_type: Literal["direct", "spillover", "baseline"]
    primary_mechanism: str | None = None
    driving_rule_ids: list[str] | None = None
    supporting_claim_ids: list[str] | None = None
    related_cohort_ids: list[str] | None = None
    spillover_from_region_codes: list[str] | None = None


class ActionProbabilities(StrictModel):
    buy: float
    sell: float
    lease: float
    gift: float
    wait: float


class CohortResult(StrictModel):
    cohort_id: str
    label: str
    response: str
    exposure: float = Field(ge=0, le=1)
    purchasing_power_before: ValueRange | None = None
    purchasing_power_after: ValueRange | None = None
    max_loan_before_krw: float | None = None
    max_loan_after_krw: float | None = None
    dsr_before_percent: float | None = None
    dsr_after_percent: float | None = None
    selectable_regions_before: list[str] | None = None
    selectable_regions_after: list[str] | None = None
    action_probabilities_before: ActionProbabilities | None = None
    action_probabilities_after: ActionProbabilities | None = None
    dominant_constraint: str | None = None
    assumptions: str | None = None
    related_region_codes: list[str] | None = None
    driving_rule_ids: list[str] | None = None
    supporting_claim_ids: list[str] | None = None


class CausalNode(StrictModel):
    node_id: str
    stage: Literal[
        "policy_rule",
        "mechanism",
        "household_behavior",
        "demand_shift",
        "regional_outcome",
    ]
    label: str
    detail: str | None = None
    is_uncertain: bool | None = None
    rule_id: str | None = None
    claim_ids: list[str] | None = None
    data_fields: list[str] | None = None


class TrustDimensions(StrictModel):
    policy_completeness: str
    data_completeness: str
    evidence_fitness: str
    model_reproducibility: str


class ScenarioResult(StrictModel):
    scenario_id: str
    baseline_date: date | None = None
    horizon_months: int | None = Field(default=None, ge=0, le=60)
    data_version: str | None = None
    cache_status: Literal["LIVE", "VERIFIED_SNAPSHOT_CACHE", "SYNTHETIC_FIXTURE"] | None = None
    data_status: DataStatus
    model_status: ModelStatus
    model_version: str
    is_investment_advice: Literal[False] = False
    trust_dimensions: TrustDimensions | None = None
    summary: str
    regions: list[RegionResult]
    cohorts: list[CohortResult]
    causal_paths: list[list[str]]
    structured_causal_chains: dict[str, list[CausalNode]] | None = None
    relevant_claim_ids: list[str] | None = None
    limitations: list[str]


class SamplePeriod(StrictModel):
    start: date
    end: date


class ClaimSource(StrictModel):
    title: str
    publisher: str
    url: str
    published_at: str | None = None
    series: str | None = None
    source_type: str | None = None
    review_status: str | None = None
    locator: str | None = None


class RelatedClaimLink(StrictModel):
    claim_id: str
    relation: ClaimRelationType
    reason: str | None = None


class Claim(StrictModel):
    claim_id: str
    evidence_id: str | None = None
    title: str | None = None
    policy_type: str
    target_region: str
    sample_period: SamplePeriod
    outcome_metric: str
    effect_direction: Literal["increase", "decrease", "neutral", "mixed", "unknown"]
    effect_semantics: str | None = None
    effect_value: float | None
    lower_bound: float | None
    upper_bound: float | None
    unit: str | None
    horizon_months: int | None = Field(ge=0)
    horizon_class: (
        Literal[
            "immediate",
            "short_to_medium_run",
            "long_run_equilibrium",
            "dynamic_path",
            "unknown",
        ]
        | None
    ) = None
    is_quantitative_candidate: bool | None = None
    scenario_match: Literal["MATCHED", "PARTIAL_MATCH", "DIFFERENT_REGIME"] | None = None
    method: str
    market_regime: str
    evidence_grade: Literal["A", "B", "C", "D"]
    mechanisms: list[str] | None = None
    related_claims: list[RelatedClaimLink] | None = None
    limitations: list[str] = Field(min_length=1)
    source: ClaimSource


class GraphNode(StrictModel):
    id: str
    label: str
    kind: str
    status: str | None = None
    metadata: dict[str, Any] | None = None


class GraphEdge(StrictModel):
    source: str
    target: str
    relation: str
    metadata: dict[str, Any] | None = None


class GraphResponse(StrictModel):
    data_status: DataStatus
    is_investment_advice: Literal[False] = False
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    limitations: list[str]


GraphView = GraphResponse


class HealthResponse(StrictModel):
    status: str
    environment: str
    api_version: str
    fixture_mode: bool
