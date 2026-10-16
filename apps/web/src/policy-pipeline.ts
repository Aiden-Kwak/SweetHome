import type { Boundary } from "./types";

export function experimentRegionCode(boundary: Boundary): string {
  return boundary.region_code ?? `kostat:${boundary.code}`;
}

export function experimentRegionName(boundary: Boundary): string {
  const province = ({"11":"서울", "23":"인천", "31":"경기"} as Record<string,string>)[boundary.code.slice(0,2)] ?? "";
  return `${province} ${boundary.name}`.trim();
}

export interface PolicyCandidate {
  extraction_confidence: "unmeasured";
  id: string; kind: "mortgage_cap" | "guarantee_cap" | "ltv" | "dsr" | "age" | "units" | "area_share";
  label: string; before: number; after: number; unit: string; quote: string; start: number; end: number;
}
export interface PolicyAnalysis {
  document_hash: string; text_hash: string; filename: string; source_url: string | null;
  extracted_at: string; engine: string; status: "REVIEW_REQUIRED" | "NO_SUPPORTED_RULES";
  content_text: string; candidates: PolicyCandidate[]; warnings: string[];
}
export interface ExperimentHousehold {
  id: string; label: string; eligible: boolean; cash_krw: number; financing_need_krw: number;
  property_price_krw: number; annual_income_krw: number; other_annual_payment_krw: number;
}
export interface PolicyExperimentRequest {
  content_text: string; source_url: string | null; candidate: PolicyCandidate; reviewed: true;
  region_codes: string[]; households: ExperimentHousehold[]; effective_from: string | null;
  simulation_date: string; proposed: boolean; hypothetical: boolean;
  annual_rate_percent: number; loan_years: number; price_elasticity: number | null;
  supply_assumptions?: SupplyAssumption[];
}
export interface SupplyAssumption {
  region_code: string; housing_stock: number; project_count: number; units_per_project: number;
  residential_share_percent: number; comparator: "lt" | "lte"; delivery_fraction: number;
  horizon_months: number; price_response_coefficient: number; other_conditions_satisfied: true;
  input_basis: "user_input" | "illustrative"; source_url: string | null;
}
export interface SupplyImpact {
  region_code: string; eligible_before: boolean; eligible_after: boolean;
  planned_units: number; accelerated_units: number; stock_change_percent: number;
  horizon_months: number; price_sensitivity_percent: number;
}
export interface PolicyExperimentResult {
  scenario_id: string; text_hash: string; source_url: string | null; candidate: PolicyCandidate;
  data_status: "INCOMPLETE"; model_status: "EXPERIMENTAL"; model_version: string;
  simulation_date: string; effective_from: string | null; hypothetical: boolean; applied: boolean;
  assumptions: PolicyExperimentRequest;
  households: {id: string; label: string; eligible: boolean; financing_before_krw: number | null;
    financing_after_krw: number | null; budget_before_krw: number | null;
    budget_after_krw: number | null; budget_change_percent: number | null}[];
  regions: {code: string; name: string; assumed_target: boolean; price_sensitivity_percent: number | null;
    metric_label: string; metric_value: number | null; metric_unit: string}[];
  supply: SupplyImpact[];
  formula: string; limitations: string[];
}

export const experimentHouseholds: ExperimentHousehold[] = [
  {id:"demo_newlywed",label:"무주택 신혼부부 사례",eligible:false,cash_krw:100e6,financing_need_krw:400e6,property_price_krw:600e6,annual_income_krw:70e6,other_annual_payment_krw:0},
  {id:"demo_debtor",label:"기존 부채가 있는 실수요자 사례",eligible:false,cash_krw:200e6,financing_need_krw:600e6,property_price_krw:800e6,annual_income_krw:80e6,other_annual_payment_krw:12e6},
  {id:"demo_mover",label:"갈아타기 가구 사례",eligible:false,cash_krw:500e6,financing_need_krw:700e6,property_price_krw:1200e6,annual_income_krw:100e6,other_annual_payment_krw:0},
  {id:"demo_cash",label:"현금 비중이 높은 가구 사례",eligible:false,cash_krw:1200e6,financing_need_krw:200e6,property_price_krw:1400e6,annual_income_krw:120e6,other_annual_payment_krw:0},
];
