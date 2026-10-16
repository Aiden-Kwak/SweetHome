export type DataStatus =
  | "COMPLETE"
  | "INCOMPLETE"
  | "CONFLICTED"
  | "DEMO_INCOMPLETE";

export type ModelStatus =
  | "VALIDATED"
  | "EXPERIMENTAL"
  | "SYNTHETIC_FIXTURE"
  | "UNAVAILABLE";

export type EvidenceFitness = "DIRECT" | "PARTIAL" | "UNVERIFIED";

export type CacheStatus = "LIVE" | "VERIFIED_SNAPSHOT_CACHE" | "OFFLINE_FALLBACK";

export type ScenarioMatch = "MATCHED" | "PARTIAL_MATCH" | "MISMATCH";

export type HorizonMonths = 0 | 3 | 6 | 12;

export type MetricKey = "price_change" | "transaction_change" | "mortgage_limit_change";

export interface Coverage {
  status: DataStatus;
  policy_coverage: number;
  evidence_coverage: number;
  limitations: string[];
}

export interface DocumentProvenance {
  document_id: string;
  title: string;
  input_type: "text" | "pdf" | "hwpx" | "hwp" | "sample";
  extraction_status: "COMPLETED" | "PARTIAL" | "FAILED_FALLBACK_TEXT";
  source_hash: string;
  cache_mode: CacheStatus;
  fallback_reason?: string | null;
}

export interface MacroContext {
  base_rate_pct: number;
  stress_rate_capital_pct: number;
  Data_source_note?: string | null;
}

export interface PolicySource {
  title: string;
  publisher: string;
  url: string;
  published_at: string;
  excerpt: string;
  locator?: string | null;
}

export interface RuleRelation {
  relation: "SUPERSEDES" | "AMENDS" | "EXEMPTS" | "INTERACTS_WITH";
  target_rule_id: string;
  target_title: string;
  note?: string | null;
}

export interface PolicyRule {
  rule_id: string;
  measure_id?: string | null;
  title: string;
  category: "finance" | "tax" | "supply" | "land_use" | "lease";
  change_type: "tighten" | "loosen" | "maintain" | "expire";
  impact_priority?: number | null;
  announced_at: string | null;
  promulgated_at?: string | null;
  effective_from: string;
  effective_to?: string | null;
  grace_period_from?: string | null;
  grace_period_to?: string | null;
  previous_summary?: string | null;
  proposed_summary?: string | null;
  mechanisms: string[];
  verification_status: "verified" | "needs_review" | "synthetic";
  source: PolicySource;
  relations?: RuleRelation[];
}

export interface PolicySnapshot {
  schema_version: string;
  snapshot_id: string;
  package_id?: string | null;
  package_title?: string | null;
  as_of: string;
  region: {
    code: string;
    name: string;
  };
  document_provenance?: DocumentProvenance | null;
  macro_context?: MacroContext | null;
  coverage: Coverage;
  rules: PolicyRule[];
}

export interface ValueRange {
  low: number;
  median?: number | null;
  high: number;
  ci80_low?: number | null;
  ci80_high?: number | null;
  unit: string;
}

export interface RegionResult {
  region_code: string;
  region_name: string;
  price_change: ValueRange;
  transaction_change: ValueRange;
  mortgage_limit_change?: ValueRange | null;
  confidence: "low" | "medium" | "high";
  effect_type: "direct" | "spillover" | "baseline";
  primary_mechanism?: string | null;
  driving_rule_ids?: string[];
  supporting_claim_ids?: string[];
  related_cohort_ids?: string[];
  spillover_from_region_codes?: string[];
}

export interface ActionProbabilities {
  buy_target: number;
  buy_substitute: number;
  delay_or_jeonse: number;
}

export interface CohortResult {
  cohort_id: string;
  label: string;
  description?: string | null;
  response: string;
  exposure: number;
  budget_before_krw?: number | null;
  budget_after_krw?: number | null;
  max_loan_before_krw?: number | null;
  max_loan_after_krw?: number | null;
  dsr_before_pct?: number | null;
  dsr_after_pct?: number | null;
  selectable_regions_before?: string[];
  selectable_regions_after?: string[];
  action_probabilities_before?: ActionProbabilities | null;
  action_probabilities_after?: ActionProbabilities | null;
  target_region_codes?: string[];
  substitute_region_codes?: string[];
}

export interface CausalNode {
  node_id: string;
  stage:
    | "policy_rule"
    | "mechanism"
    | "household_behavior"
    | "demand_shift"
    | "regional_outcome";
  label: string;
  detail: string;
  is_uncertain: boolean;
  rule_id?: string | null;
  claim_ids?: string[];
  data_fields?: string[];
}

export interface TrustDimensions {
  policy_completeness: DataStatus;
  data_completeness: DataStatus;
  evidence_fitness: EvidenceFitness;
  model_reproducibility: ModelStatus;
}

export interface ScenarioResult {
  scenario_id: string;
  baseline_date?: string | null;
  horizon_months?: number | null;
  data_version?: string | null;
  cache_status?: CacheStatus | null;
  data_status: DataStatus;
  model_status: ModelStatus;
  model_version: string;
  is_investment_advice: false;
  trust_dimensions?: TrustDimensions | null;
  summary: string;
  regions: RegionResult[];
  cohorts: CohortResult[];
  causal_paths: string[][];
  structured_causal_chains?: Record<string, CausalNode[]>;
  limitations: string[];
}

export interface RelatedClaimRef {
  claim_id: string;
  relation: "CONFLICTS_WITH" | "COMPLEMENTS" | "CONTEXTUALIZES";
  reason: string;
}

export interface ClaimSource {
  title: string;
  publisher: string;
  url: string;
  published_at: string;
  series?: string | null;
  source_type?: string | null;
  review_status?: string | null;
  locator?: string | null;
}

export interface Claim {
  claim_id: string;
  evidence_id?: string | null;
  title: string;
  policy_type: string;
  target_region: string;
  sample_period: {
    start: string;
    end: string;
  };
  outcome_metric: string;
  effect_direction: "increase" | "decrease" | "mixed" | "null" | "unknown";
  effect_semantics?: string | null;
  effect_value: number | null;
  lower_bound: number | null;
  upper_bound: number | null;
  unit: string | null;
  horizon_months: number;
  horizon_class?:
    | "immediate"
    | "short_to_medium_run"
    | "long_run_equilibrium"
    | "dynamic_path"
    | "unknown"
    | null;
  is_quantitative_candidate?: boolean | null;
  scenario_match?: ScenarioMatch | null;
  method: string;
  market_regime: string;
  evidence_grade: "A" | "B" | "C" | "D";
  mechanisms: string[];
  related_claims?: RelatedClaimRef[];
  limitations: string[];
  source: ClaimSource;
}

export interface ExtractionStepStatus {
  step: number;
  label: string;
  status: "completed" | "fallback_warning";
  detail: string;
}

export interface PolicyExtractRequest {
  input_type: "text" | "pdf" | "hwpx" | "hwp" | "sample";
  title?: string;
  content_text?: string;
  filename?: string;
  as_of?: string;
  region_code?: string;
}

export interface PolicyExtractResponse {
  snapshot: PolicySnapshot;
  extraction_steps: ExtractionStepStatus[];
  fallback_message?: string | null;
}

export interface GraphNode {
  id: string;
  kind: string;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  metadata?: Record<string, unknown>;
}

export interface GraphResponse {
  as_of: string;
  region_code: string;
  data_status: DataStatus;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
