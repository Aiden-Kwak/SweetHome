import type {
  Claim,
  GraphResponse,
  HorizonMonths,
  PolicyExtractRequest,
  PolicyExtractResponse,
  PolicySnapshot,
  ScenarioResult,
} from "./types";

const DEFAULT_API_URL =
  typeof window !== "undefined" && window.location.port === "5174"
    ? "http://localhost:8001"
    : "http://localhost:8000";

const API_URL =
  import.meta.env.VITE_API_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  DEFAULT_API_URL;

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: { message?: string } }
      | null;
    throw new Error(
      payload?.detail?.message ?? `API 요청이 실패했습니다. (${response.status})`,
    );
  }
  return (await response.json()) as T;
}

export async function fetchPolicySnapshot(
  asOf = "2025-06-28",
  regionCode = "11680",
): Promise<PolicySnapshot> {
  const url = new URL("/api/v1/policy-state", API_URL);
  url.searchParams.set("date", asOf);
  url.searchParams.set("region_code", regionCode);
  return parseResponse<PolicySnapshot>(await fetch(url));
}

export async function fetchScenarioSimulation(params: {
  baselineDate?: string;
  regionCode?: string;
  horizonMonths: HorizonMonths;
  changeIds: string[];
}): Promise<ScenarioResult> {
  return parseResponse<ScenarioResult>(
    await fetch(`${API_URL}/api/v1/scenarios/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseline_date: params.baselineDate ?? "2025-06-28",
        region_code: params.regionCode ?? "11680",
        horizon_months: params.horizonMonths,
        change_ids: params.changeIds,
        allow_demo: true,
      }),
    }),
  );
}

export async function fetchDemoScenario(): Promise<ScenarioResult> {
  return fetchScenarioSimulation({
    baselineDate: "2025-06-28",
    regionCode: "11680",
    horizonMonths: 6,
    changeIds: [
      "demo_rule_mortgage_cap",
      "demo_rule_land_permit",
      "demo_rule_stress_dsr_phase3",
      "demo_rule_one_home_disposal_deadline",
      "demo_rule_policy_loan_exception",
    ],
  });
}

export async function fetchClaims(): Promise<Claim[]> {
  const url = new URL("/api/v1/claims", API_URL);
  return parseResponse<Claim[]>(await fetch(url));
}

export async function extractPolicyDocument(
  request: PolicyExtractRequest,
): Promise<PolicyExtractResponse> {
  return parseResponse<PolicyExtractResponse>(
    await fetch(`${API_URL}/api/v1/policies/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }),
  );
}

export async function fetchGraph(
  asOf = "2025-06-28",
  regionCode = "11680",
): Promise<GraphResponse> {
  const url = new URL("/api/v1/graph", API_URL);
  url.searchParams.set("date", asOf);
  url.searchParams.set("region_code", regionCode);
  return parseResponse<GraphResponse>(await fetch(url));
}
