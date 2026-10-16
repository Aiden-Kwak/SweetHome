import { useEffect, useMemo, useState } from "react";

import {
  extractPolicyDocument,
  fetchClaims,
  fetchDemoScenario,
  fetchGraph,
  fetchPolicySnapshot,
  fetchScenarioSimulation,
} from "./api";
import {
  formatClaimEffect,
  formatKrwEok,
  formatMedian,
  formatPercent,
  formatRange,
  getDivergingTone,
} from "./format";
import type {
  Claim,
  CohortResult,
  ExtractionStepStatus,
  GraphResponse,
  HorizonMonths,
  MetricKey,
  PolicyRule,
  PolicySnapshot,
  RegionResult,
  ScenarioResult,
  ValueRange,
} from "./types";

interface DashboardData {
  snapshot: PolicySnapshot;
  scenario: ScenarioResult;
  claims: Claim[];
  graph: GraphResponse;
}

interface MapGeometry {
  code: string;
  shortName: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zoneLabel: string;
}

const METROPOLITAN_MAP_LAYOUT: MapGeometry[] = [
  { code: "11350", shortName: "서울 노원구", x: 350, y: 24, w: 125, h: 66, zoneLabel: "서울 동북권" },
  { code: "11440", shortName: "서울 마포구", x: 145, y: 102, w: 120, h: 68, zoneLabel: "서울 서북권" },
  { code: "11170", shortName: "서울 용산구", x: 225, y: 182, w: 115, h: 68, zoneLabel: "서울 도심권" },
  { code: "11200", shortName: "서울 성동구", x: 352, y: 112, w: 122, h: 68, zoneLabel: "서울 성동권" },
  { code: "11740", shortName: "서울 강동구", x: 515, y: 152, w: 122, h: 72, zoneLabel: "서울 동남권" },
  { code: "11650", shortName: "서울 서초구", x: 230, y: 266, w: 122, h: 76, zoneLabel: "서울 강남3구" },
  { code: "11680", shortName: "서울 강남구", x: 364, y: 256, w: 132, h: 82, zoneLabel: "서울 강남3구" },
  { code: "11710", shortName: "서울 송파구", x: 508, y: 244, w: 128, h: 82, zoneLabel: "서울 강남3구" },
  { code: "41290", shortName: "경기 과천시", x: 236, y: 362, w: 122, h: 68, zoneLabel: "경기 남부 인접" },
  { code: "41135", shortName: "성남 분당구", x: 392, y: 362, w: 138, h: 70, zoneLabel: "경기 남부 인접" },
  { code: "28185", shortName: "인천 연수구", x: 24, y: 286, w: 126, h: 76, zoneLabel: "인천 서부권" },
];

const STAGE_LABELS: Record<string, string> = {
  policy_rule: "01 정책 조문",
  mechanism: "02 작동 메커니즘",
  household_behavior: "03 가구 행동 변화",
  demand_shift: "04 수요 이동",
  regional_outcome: "05 지역 결과",
};

const CATEGORY_LABELS: Record<string, string> = {
  finance: "금융 및 대출 규제",
  land_use: "토지거래허가 및 실거주",
  tax: "세제",
  supply: "주택 공급",
  lease: "임대차 및 전세금융",
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
  tighten: "규제 강화",
  loosen: "규제 완화",
  maintain: "특례 유지",
  expire: "일몰 예정",
};

const VERIFICATION_LABELS: Record<string, string> = {
  verified: "검증 완료",
  needs_review: "검토 필요",
  synthetic: "합성 규칙",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const RELATION_LABELS: Record<string, string> = {
  SUPERSEDES: "기존 대체",
  EXEMPTS: "예외 특례",
  AMENDS: "일부 개정",
  INTERACTS_WITH: "상호 결합",
  COMPLEMENTS: "보완 근거",
  CONTEXTUALIZES: "맥락 보강",
  CONFLICTS_WITH: "상충 근거",
};

const DIRECTION_LABELS: Record<string, string> = {
  decrease: "하방 압력 (감소)",
  increase: "상방 압력 (증가)",
  mixed: "혼재 (조건부)",
  neutral: "중립 (무유의)",
};

const STATUS_LABELS: Record<string, string> = {
  DEMO_INCOMPLETE: "데모 부분 적재",
  INCOMPLETE: "미완전 스냅샷",
  COMPLETE: "완전 적재",
  PARTIAL: "부분 확보",
  SYNTHETIC_FIXTURE: "합성 픽스처 모형",
  CALIBRATED_SIMULATION: "보정 시뮬레이션",
  VERIFIED_SNAPSHOT_CACHE: "오프라인 검증 스냅샷 캐시",
};

const HORIZON_CLASS_LABELS: Record<string, string> = {
  IMMEDIATE: "발표 직후",
  SHORT_RUN: "단기",
  MEDIUM_RUN: "중기",
  LONG_RUN: "장기 균형",
};


const HORIZON_OPTIONS: { value: HorizonMonths; label: string }[] = [
  { value: 0, label: "발표 직후 (0개월)" },
  { value: 3, label: "3개월 후" },
  { value: 6, label: "6개월 후" },
  { value: 12, label: "12개월 후" },
];

const METRIC_OPTIONS: { value: MetricKey; label: string; unitHint: string }[] = [
  { value: "price_change", label: "매매가격 변화 범위", unitHint: "기준 시나리오 대비 %" },
  { value: "transaction_change", label: "거래량 변화 범위", unitHint: "기준 시나리오 대비 %" },
  { value: "mortgage_limit_change", label: "대출가능액 변화 범위", unitHint: "차주 평균 한도 변화 %" },
];

function getMetricRange(region: RegionResult, metric: MetricKey): ValueRange {
  if (metric === "transaction_change") return region.transaction_change;
  if (metric === "mortgage_limit_change" && region.mortgage_limit_change) {
    return region.mortgage_limit_change;
  }
  return region.price_change;
}

function LoadingState() {
  return (
    <main className="center-state" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>정책 스냅샷, 시뮬레이션 경로, KDI 및 한국은행 연구 근거를 불러오고 있습니다.</p>
    </main>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="center-state error-state" role="alert">
      <p className="eyebrow">데이터를 불러오지 못했습니다</p>
      <h1>API 실행 상태를 확인해 주세요.</h1>
      <p>{message}</p>
      <div className="ingestion-actions" style={{ justifyContent: "center" }}>
        <button
          type="button"
          className="action-btn primary"
          onClick={onRetry}
        >
          화면으로 돌아가기 / 다시 불러오기
        </button>
      </div>
      <code>make dev</code>
    </main>
  );
}

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Interactive workbench state (all calculations come from backend API)
  const [horizonMonths, setHorizonMonths] = useState<HorizonMonths>(6);
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([
    "demo_rule_mortgage_cap",
    "demo_rule_land_permit",
    "demo_rule_stress_dsr_phase3",
    "demo_rule_one_home_disposal_deadline",
    "demo_rule_policy_loan_exception",
  ]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Policy ingestion & diff state
  const [showIngestionPanel, setShowIngestionPanel] = useState<boolean>(false);
  const [ingestionType, setIngestionType] = useState<"sample" | "text" | "hwpx" | "hwp">("sample");
  const [customPolicyText, setCustomPolicyText] = useState<string>(
    "수도권 주택담보대출 최대한도 6억 원 신설, 서울 강남3구 및 주요 권역 토지거래허가구역 실거주 2년 의무 부과, 3단계 스트레스 DSR 가산금리 1.50%p 적용",
  );
  const [extractionSteps, setExtractionSteps] = useState<ExtractionStepStatus[]>([]);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [showAllRules, setShowAllRules] = useState<boolean>(false);
  const [expandedSourceRuleId, setExpandedSourceRuleId] = useState<string | null>(null);
  const [showMacroPopover, setShowMacroPopover] = useState<boolean>(false);

  // Map, Cohort, and Causal/Evidence synchronized selection state
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("price_change");
  const [mapViewMode, setMapViewMode] = useState<"map" | "table">("map");
  const [selectedRegionCode, setSelectedRegionCode] = useState<string>("11680");
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(
    "demo_cohort_one_home_mover",
  );
  const [selectedCausalNodeId, setSelectedCausalNodeId] = useState<string | null>(null);
  const [evidenceFilterMode, setEvidenceFilterMode] = useState<
    "contextual" | "conflicts" | "all"
  >("contextual");

  function loadInitialDashboard() {
    setError(null);
    Promise.all([
      fetchPolicySnapshot(),
      fetchDemoScenario(),
      fetchClaims(),
      fetchGraph(),
    ])
      .then(([snapshot, scenario, claims, graph]) => {
        setData({ snapshot, scenario, claims, graph });
        setSelectedRuleIds(snapshot.rules.map((r) => r.rule_id));
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : "알 수 없는 오류가 발생했습니다.",
        );
      });
  }

  useEffect(() => {
    loadInitialDashboard();
  }, []);

  async function handleRunSimulation(
    nextHorizon: HorizonMonths,
    nextRuleIds: string[],
  ) {
    if (!data || nextRuleIds.length === 0) return;
    setError(null);
    setIsSimulating(true);
    try {
      const updatedScenario = await fetchScenarioSimulation({
        baselineDate: data.snapshot.as_of,
        regionCode: data.snapshot.region.code,
        horizonMonths: nextHorizon,
        changeIds: nextRuleIds,
      });
      setData((prev) => (prev ? { ...prev, scenario: updatedScenario } : prev));
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "시뮬레이션 재계산 중 오류가 발생했습니다.",
      );
    } finally {
      setIsSimulating(false);
    }
  }

  function handleHorizonChange(nextHorizon: HorizonMonths) {
    setHorizonMonths(nextHorizon);
    void handleRunSimulation(nextHorizon, selectedRuleIds);
  }

  function handleToggleRule(ruleId: string) {
    const exists = selectedRuleIds.includes(ruleId);
    if (exists && selectedRuleIds.length === 1) {
      return; // Keep at least 1 active rule for simulation
    }
    const nextRuleIds = exists
      ? selectedRuleIds.filter((id) => id !== ruleId)
      : [...selectedRuleIds, ruleId];
    setSelectedRuleIds(nextRuleIds);
    void handleRunSimulation(horizonMonths, nextRuleIds);
  }

  async function handleExtractPolicy(mode: "sample" | "text" | "hwpx" | "hwp") {
    setError(null);
    setIngestionType(mode);
    setIsExtracting(true);
    try {
      const filenameMap = {
        sample: "20250627_수도권_가계부채_관리방안_검증샘플.pdf",
        text: "사용자_직접입력_정책조문.txt",
        hwpx: "20250627_금융위_가계부채관리방안_보도자료.hwpx",
        hwp: "20250627_구형한글_보도자료.hwp",
      };
      const response = await extractPolicyDocument({
        input_type: mode,
        title: "2025년 6월 수도권 가계부채 관리방안 및 토지거래허가구역 확대",
        filename: filenameMap[mode],
        content_text: customPolicyText,
        as_of: "2025-06-28",
        region_code: "11680",
      });
      setExtractionSteps(response.extraction_steps);
      setFallbackMessage(response.fallback_message ?? null);
      setData((prev) =>
        prev ? { ...prev, snapshot: response.snapshot } : prev,
      );
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "정책 문서 추출 중 오류가 발생했습니다.",
      );
    } finally {
      setIsExtracting(false);
    }
  }

  const sortedRules = useMemo(() => {
    if (!data) return [];
    return [...data.snapshot.rules].sort(
      (a, b) => (a.impact_priority ?? 99) - (b.impact_priority ?? 99),
    );
  }, [data]);

  const topThreeRules = useMemo(() => sortedRules.slice(0, 3), [sortedRules]);
  const extraRules = useMemo(() => sortedRules.slice(3), [sortedRules]);

  const selectedRegion = useMemo<RegionResult | null>(() => {
    if (!data) return null;
    return (
      data.scenario.regions.find((r) => r.region_code === selectedRegionCode) ??
      data.scenario.regions[0] ??
      null
    );
  }, [data, selectedRegionCode]);

  const selectedCohort = useMemo<CohortResult | null>(() => {
    if (!data || !selectedCohortId) return null;
    return (
      data.scenario.cohorts.find((c) => c.cohort_id === selectedCohortId) ?? null
    );
  }, [data, selectedCohortId]);

  const activeCausalChain = useMemo(() => {
    if (!data || !selectedRegion) return [];
    const chains = data.scenario.structured_causal_chains ?? {};
    return chains[selectedRegion.region_code] ?? [];
  }, [data, selectedRegion]);

  const selectedCausalNode = useMemo(() => {
    if (!selectedCausalNodeId) return null;
    return (
      activeCausalChain.find((node) => node.node_id === selectedCausalNodeId) ??
      null
    );
  }, [activeCausalChain, selectedCausalNodeId]);

  const filteredClaims = useMemo<Claim[]>(() => {
    if (!data) return [];
    if (evidenceFilterMode === "all") {
      return data.claims;
    }
    if (evidenceFilterMode === "conflicts") {
      return data.claims.filter((claim) =>
        (claim.related_claims ?? []).some(
          (rel) => rel.relation === "CONFLICTS_WITH",
        ),
      );
    }
    // Contextual: claims linked to the selected causal node or selected region
    const targetIds = new Set<string>();
    if (selectedCausalNode?.claim_ids?.length) {
      for (const id of selectedCausalNode.claim_ids) targetIds.add(id);
    } else if (selectedRegion?.supporting_claim_ids?.length) {
      for (const id of selectedRegion.supporting_claim_ids) targetIds.add(id);
    }
    // Also include claims that contextualize or conflict with those claims
    const baseClaims = data.claims.filter((c) => targetIds.has(c.claim_id));
    for (const bc of baseClaims) {
      for (const rel of bc.related_claims ?? []) {
        targetIds.add(rel.claim_id);
      }
    }
    for (const c of data.claims) {
      for (const rel of c.related_claims ?? []) {
        if (targetIds.has(rel.claim_id)) {
          targetIds.add(c.claim_id);
        }
      }
    }
    const matched = data.claims.filter((c) => targetIds.has(c.claim_id));
    return matched.length > 0 ? matched : data.claims.slice(0, 6);
  }, [data, evidenceFilterMode, selectedCausalNode, selectedRegion]);

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          if (data) {
            setError(null);
          } else {
            loadInitialDashboard();
          }
        }}
      />
    );
  }
  if (!data || !selectedRegion) return <LoadingState />;

  const { snapshot, scenario, claims, graph } = data;
  const regionMap = new Map(scenario.regions.map((r) => [r.region_code, r]));
  const claimMap = new Map(claims.map((c) => [c.claim_id, c]));

  return (
    <div className="app-shell">
      {/* Persistent Top Policy Bar (Scene 1 & Global Controls) */}
      <header className="top-policy-bar" id="top">
        <div className="top-bar-primary">
          <div className="brand-cluster">
            <a className="brand" href="#top" aria-label="PolicyMap 처음으로">
              PolicyMap
            </a>
            <span className="package-pill">
              {snapshot.package_title ??
                "2025년 6월 수도권 가계부채 관리방안 및 토지거래허가 확대"}
            </span>
          </div>

          <div className="top-bar-controls">
            <div className="control-group" role="group" aria-label="분석 시점 선택">
              <span className="control-label">기준일 {snapshot.as_of}</span>
              <div className="segmented-buttons">
                {HORIZON_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={
                      horizonMonths === opt.value ? "seg-btn active" : "seg-btn"
                    }
                    onClick={() => handleHorizonChange(opt.value)}
                    aria-pressed={horizonMonths === opt.value}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className={
                showIngestionPanel
                  ? "action-btn secondary active"
                  : "action-btn secondary"
              }
              onClick={() => setShowIngestionPanel((prev) => !prev)}
              aria-expanded={showIngestionPanel}
            >
              정책 문서 입력 및 추출 점검
            </button>

            <button
              type="button"
              className="action-btn ghost"
              onClick={() => setShowMacroPopover((prev) => !prev)}
              aria-expanded={showMacroPopover}
            >
              거시 전제 (금리 {snapshot.macro_context?.base_rate_pct ?? 2.5}%)
            </button>
          </div>
        </div>

        {/* 4 Independent Trust Badges & Mandatory Demo Disclaimer */}
        <div className="trust-strip" aria-live="polite">
          <div className="trust-badges">
            <span className="trust-badge warning">
              정책 완전성:{" "}
              {STATUS_LABELS[
                scenario.trust_dimensions?.policy_completeness ??
                  snapshot.coverage.status
              ] ??
                (scenario.trust_dimensions?.policy_completeness ??
                  snapshot.coverage.status)}{" "}
              ({formatPercent(snapshot.coverage.policy_coverage)})
            </span>
            <span className="trust-badge warning">
              효과 근거 완전성: {formatPercent(snapshot.coverage.evidence_coverage)} (
              {STATUS_LABELS[
                scenario.trust_dimensions?.evidence_fitness ?? "PARTIAL"
              ] ??
                (scenario.trust_dimensions?.evidence_fitness ?? "PARTIAL")}
              )
            </span>
            <span className="trust-badge synthetic">
              모형 상태:{" "}
              {STATUS_LABELS[scenario.model_status] ?? scenario.model_status} (
              {scenario.model_version})
            </span>
            <span className="trust-badge cache">
              캐시 상태:{" "}
              {STATUS_LABELS[
                scenario.cache_status ?? "VERIFIED_SNAPSHOT_CACHE"
              ] ??
                (scenario.cache_status ?? "VERIFIED_SNAPSHOT_CACHE")}
            </span>
          </div>
          <p className="disclaimer-inline">
            합성 데모 경고: 이 화면의 수치는 인터페이스 검증용 합성 범위이며 실제 주택가격 예측이나 투자 자문이 아닙니다.
          </p>
        </div>

        {showMacroPopover && (
          <div className="macro-popover" role="region" aria-label="거시경제 및 통화정책 전제">
            <div className="macro-popover-grid">
              <div>
                <strong>기준금리 가정</strong>
                <p>연 {snapshot.macro_context?.base_rate_pct ?? 2.50}% (한국은행 2025년 상반기 인하 국면 기준)</p>
              </div>
              <div>
                <strong>수도권 스트레스 DSR 가산금리</strong>
                <p>+{snapshot.macro_context?.stress_rate_capital_pct ?? 1.50}%p (3단계 스트레스 금리 반영)</p>
              </div>
              <div>
                <strong>통화정책 및 거시건전성 조합 유의사항</strong>
                <p>
                  {snapshot.macro_context?.Data_source_note ??
                    "금리 인하기에는 차입 비용 하락 기대가 대출 한도 규제의 가격 억제 효과를 일부 상쇄할 수 있습니다 (EV-BOK-2025-26 근거)."}
                </p>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="workspace-container">
        {/* Scene 1: Collapsible Policy Document Ingestion & 4-Step Pipeline Drawer */}
        {showIngestionPanel && (
          <section
            className="ingestion-panel"
            aria-labelledby="ingestion-heading"
          >
            <div className="panel-header">
              <div>
                <p className="eyebrow">Scene 1. 정책 원문 입력 및 구조화 파이프라인</p>
                <h2 id="ingestion-heading">
                  보도자료, PDF, HWPX, HWP 정책 문서 추출 및 스냅샷 대조
                </h2>
              </div>
              <span className="cache-tag">
                오프라인 검증 스냅샷 캐시 연동 ({snapshot.document_provenance?.source_hash ?? "sha256:verified"})
              </span>
            </div>

            <div className="ingestion-grid">
              <div className="ingestion-controls">
                <p className="helper-text">
                  정책 발표 원문 텍스트를 붙여넣거나 문서 포맷별 파서 동작(HWPX 표준 XML 추출 및 구형 HWP 텍스트 폴백 경고)을 즉시 검증할 수 있습니다.
                </p>
                <div className="format-buttons" role="group" aria-label="문서 입력 방식 선택">
                  <button
                    type="button"
                    className={ingestionType === "sample" ? "fmt-btn active" : "fmt-btn"}
                    onClick={() => void handleExtractPolicy("sample")}
                    disabled={isExtracting}
                  >
                    검증된 기본 샘플 (PDF)
                  </button>
                  <button
                    type="button"
                    className={ingestionType === "hwpx" ? "fmt-btn active" : "fmt-btn"}
                    onClick={() => void handleExtractPolicy("hwpx")}
                    disabled={isExtracting}
                  >
                    보도자료 HWPX 파싱 실행
                  </button>
                  <button
                    type="button"
                    className={ingestionType === "hwp" ? "fmt-btn active" : "fmt-btn"}
                    onClick={() => void handleExtractPolicy("hwp")}
                    disabled={isExtracting}
                  >
                    구형 HWP 업로드 (폴백 점검)
                  </button>
                  <button
                    type="button"
                    className={ingestionType === "text" ? "fmt-btn active" : "fmt-btn"}
                    onClick={() => void handleExtractPolicy("text")}
                    disabled={isExtracting}
                  >
                    직접 입력 텍스트 추출
                  </button>
                </div>

                <label htmlFor="policy-raw-input" className="sr-only">
                  정책 원문 텍스트 입력
                </label>
                <textarea
                  id="policy-raw-input"
                  rows={3}
                  value={customPolicyText}
                  onChange={(e) => setCustomPolicyText(e.target.value)}
                />
              </div>

              <div className="ingestion-status-box" aria-live="polite">
                <h3>4단계 정책 추출 및 매칭 상태</h3>
                {fallbackMessage && (
                  <div className="fallback-alert" role="alert">
                    <strong>HWP 파서 제한 및 명시적 폴백 안내:</strong> {fallbackMessage}
                  </div>
                )}
                <ol className="extraction-step-list">
                  {(extractionSteps.length > 0
                    ? extractionSteps
                    : [
                        {
                          step: 1,
                          label: "텍스트 추출",
                          status: "completed" as const,
                          detail: "공식 보도자료 원문 및 표 구조에서 텍스트를 추출했습니다.",
                        },
                        {
                          step: 2,
                          label: "정책 조문 후보 분리",
                          status: "completed" as const,
                          detail: "대상 지역, 차주 요건, 시행일, 수치 파라미터 기준으로 5개 원자적 규칙을 분리했습니다.",
                        },
                        {
                          step: 3,
                          label: "기존 정책 스냅샷 매칭",
                          status: "completed" as const,
                          detail: "기준일(2025-06-28) 활성 정책 스냅샷과 대조하여 대체(SUPERSEDES) 및 예외(EXEMPTS) 관계를 연결했습니다.",
                        },
                        {
                          step: 4,
                          label: "시뮬레이션 규칙 생성",
                          status: "completed" as const,
                          detail: "JEV 가구 상태 공간 및 수도권 공간 전이 시뮬레이션 입력 파라미터를 생성했습니다.",
                        },
                      ]
                  ).map((step) => (
                    <li
                      key={step.step}
                      className={
                        step.status === "fallback_warning"
                          ? "step-item warning"
                          : "step-item completed"
                      }
                    >
                      <div className="step-header">
                        <span className="step-num">단계 0{step.step}</span>
                        <strong>{step.label}</strong>
                        <span className="step-badge">
                          {step.status === "fallback_warning" ? "폴백 적용됨" : "완료"}
                        </span>
                      </div>
                      <p>{step.detail}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        )}

        {/* Scene 2: Policy Diff Workbench (Top 3 rules visible by default, remaining 2 collapsible) */}
        <section className="diff-workbench" aria-labelledby="diff-heading">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Scene 2. 기존 정책 대비 변경점 (Before / After Diff)</p>
              <h2 id="diff-heading">
                핵심 정책 규칙 {sortedRules.length}건 중 상위 3건 요약 및 시뮬레이션 조합
              </h2>
            </div>
            <div className="diff-header-actions">
              <span className="selection-count" aria-live="polite">
                활성 규칙 {selectedRuleIds.length} / {sortedRules.length}건 반영 중
                {isSimulating ? " (재계산 중...)" : ""}
              </span>
              {extraRules.length > 0 && (
                <button
                  type="button"
                  className="action-btn ghost"
                  onClick={() => setShowAllRules((prev) => !prev)}
                  aria-expanded={showAllRules}
                >
                  {showAllRules
                    ? "나머지 정책 규칙 접기"
                    : `나머지 정책 규칙 ${extraRules.length}건 더 보기`}
                </button>
              )}
            </div>
          </div>

          <div className="diff-cards-grid">
            {(showAllRules ? sortedRules : topThreeRules).map((rule: PolicyRule) => {
              const isChecked = selectedRuleIds.includes(rule.rule_id);
              const isSourceOpen = expandedSourceRuleId === rule.rule_id;
              return (
                <article
                  key={rule.rule_id}
                  className={
                    isChecked ? "diff-card active-rule" : "diff-card muted-rule"
                  }
                >
                  <div className="diff-card-top">
                    <label className="rule-checkbox-label">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleRule(rule.rule_id)}
                      />
                      <span className="rule-priority">
                        우선순위{" "}
                        {PRIORITY_LABELS[rule.impact_priority ?? ""] ??
                          (rule.impact_priority ?? "-")}
                      </span>
                      <span className="rule-category">
                        {CATEGORY_LABELS[rule.category] ?? rule.category}
                      </span>
                    </label>
                    <div className="rule-badges">
                      <span className={`change-badge ${rule.change_type}`}>
                        {CHANGE_TYPE_LABELS[rule.change_type] ?? rule.change_type}
                      </span>
                      <span className="verify-badge">
                        {VERIFICATION_LABELS[rule.verification_status] ??
                          rule.verification_status}
                      </span>
                    </div>
                  </div>

                  <h3 className="diff-card-title">{rule.title}</h3>

                  <div className="before-after-box">
                    <div className="ba-cell before">
                      <span className="ba-label">기존 규정 (Before)</span>
                      <p>{rule.previous_summary ?? "기존 규정 요약 정보 없음"}</p>
                    </div>
                    <div className="ba-cell after">
                      <span className="ba-label">개정 및 시행안 (After)</span>
                      <p>{rule.proposed_summary ?? "개정 규정 요약 정보 없음"}</p>
                    </div>
                  </div>

                  <dl className="temporal-meta">
                    <div>
                      <dt>발표일</dt>
                      <dd>{rule.announced_at ?? "미정"}</dd>
                    </div>
                    <div>
                      <dt>시행일</dt>
                      <dd>{rule.effective_from}</dd>
                    </div>
                    <div>
                      <dt>경과조치</dt>
                      <dd>
                        {rule.grace_period_from && rule.grace_period_to
                          ? `${rule.grace_period_from} ~ ${rule.grace_period_to}`
                          : "해당 없음"}
                      </dd>
                    </div>
                    <div>
                      <dt>만료일</dt>
                      <dd>{rule.effective_to ?? "상시 시행"}</dd>
                    </div>
                  </dl>

                  {rule.relations && rule.relations.length > 0 && (
                    <div className="rule-relations">
                      {rule.relations.map((rel) => (
                        <span
                          key={`${rule.rule_id}-${rel.target_rule_id}`}
                          className="relation-chip"
                        >
                          [{RELATION_LABELS[rel.relation] ?? rel.relation}]{" "}
                          {rel.target_title}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="diff-card-footer">
                    <button
                      type="button"
                      className="text-link-btn"
                      onClick={() =>
                        setExpandedSourceRuleId(
                          isSourceOpen ? null : rule.rule_id,
                        )
                      }
                      aria-expanded={isSourceOpen}
                    >
                      {isSourceOpen ? "원문 발췌 닫기" : "공식 출처 및 원문 발췌 보기"}
                    </button>
                    <a
                      href={rule.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="source-ext-link"
                    >
                      {rule.source.publisher} ({rule.source.published_at})
                    </a>
                  </div>

                  {isSourceOpen && (
                    <blockquote className="source-excerpt-box">
                      <p>{rule.source.excerpt}</p>
                      <footer>
                        위치: {rule.source.locator ?? "본문"} | 문서명: {rule.source.title}
                      </footer>
                    </blockquote>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* Main Center Workspace: Scene 3 (60% Map Panel) + Scene 4 (28% JEV Cohort Panel) */}
        <div className="main-analysis-grid">
          {/* Scene 3: Metropolitan Spatial Impact Map */}
          <section
            className="map-panel"
            aria-labelledby="map-panel-heading"
          >
            <div className="panel-header">
              <div>
                <p className="eyebrow">
                  Scene 3. 수도권 직접효과 및 풍선효과 공간 분포 ({horizonMonths === 0 ? "발표 직후" : `${horizonMonths}개월 후`})
                </p>
                <h2 id="map-panel-heading">
                  수도권 11개 핵심 권역 정책 영향 지도
                </h2>
              </div>

              <div className="map-toolbar">
                <div className="segmented-buttons" role="group" aria-label="지표 선택">
                  {METRIC_OPTIONS.map((metric) => (
                    <button
                      key={metric.value}
                      type="button"
                      className={
                        selectedMetric === metric.value
                          ? "seg-btn active"
                          : "seg-btn"
                      }
                      onClick={() => setSelectedMetric(metric.value)}
                      aria-pressed={selectedMetric === metric.value}
                    >
                      {metric.label}
                    </button>
                  ))}
                </div>

                <div className="segmented-buttons" role="group" aria-label="표시 방식 전환">
                  <button
                    type="button"
                    className={mapViewMode === "map" ? "seg-btn active" : "seg-btn"}
                    onClick={() => setMapViewMode("map")}
                    aria-pressed={mapViewMode === "map"}
                  >
                    지도 보기
                  </button>
                  <button
                    type="button"
                    className={mapViewMode === "table" ? "seg-btn active" : "seg-btn"}
                    onClick={() => setMapViewMode("table")}
                    aria-pressed={mapViewMode === "table"}
                  >
                    표로 보기 (접근성)
                  </button>
                </div>
              </div>
            </div>

            {/* Legend: Zero-centered diverging color scale & Non-color pattern distinction */}
            <div className="map-legend-bar" aria-label="지도 범례">
              <div className="legend-scale">
                <span className="legend-title">0 기준 발산형 스케일:</span>
                <span className="scale-chip down-strong">강한 하방 (-1.2% 이하)</span>
                <span className="scale-chip down-mild">완만한 하방 (-1.2% ~ -0.2%)</span>
                <span className="scale-chip neutral">보합권 (-0.2% ~ +0.15%)</span>
                <span className="scale-chip up-mild">완만한 상방 (+0.15% ~ +0.7%)</span>
                <span className="scale-chip up-strong">강한 전이 상방 (+0.7% 이상)</span>
              </div>
              <div className="legend-patterns">
                <span className="pattern-key direct">실선 굵은 테두리: 직접 규제 권역</span>
                <span className="pattern-key spillover">점선 테두리 및 화살표: 수요 전이(풍선효과) 권역</span>
              </div>
            </div>

            {mapViewMode === "map" ? (
              <div className="svg-map-wrapper">
                <svg
                  viewBox="0 0 660 456"
                  className="metropolitan-svg"
                  role="img"
                  aria-label="수도권 11개 주요 시군구 정책 영향 모식도"
                >
                  <defs>
                    <marker
                      id="spillover-arrow"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#b45309" />
                    </marker>
                  </defs>

                  {/* Background zone labels */}
                  <rect
                    x="12"
                    y="12"
                    width="636"
                    height="332"
                    rx="18"
                    fill="#f8fafc"
                    stroke="#cbd5e1"
                  />
                  <text x="28" y="38" className="map-bg-label">
                    서울특별시 권역 및 인천 서부권
                  </text>
                  <rect
                    x="12"
                    y="350"
                    width="636"
                    height="94"
                    rx="18"
                    fill="#f1f5f9"
                    stroke="#cbd5e1"
                  />
                  <text x="28" y="376" className="map-bg-label">
                    경기 남부 인접 대체 권역 (과천 및 분당)
                  </text>

                  {/* Han River schematic path */}
                  <path
                    d="M 140 175 Q 290 205, 420 195 T 640 140"
                    fill="none"
                    stroke="#bae6fd"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />

                  {/* Spillover arrows from Direct zones (Gangnam/Seocho/Songpa) to Spillover zones */}
                  <path
                    d="M 415 256 L 415 184"
                    className="spillover-flow-line"
                    markerEnd="url(#spillover-arrow)"
                  />
                  <path
                    d="M 364 275 L 255 172"
                    className="spillover-flow-line"
                    markerEnd="url(#spillover-arrow)"
                  />
                  <path
                    d="M 555 244 L 568 226"
                    className="spillover-flow-line"
                    markerEnd="url(#spillover-arrow)"
                  />
                  <path
                    d="M 285 342 L 292 360"
                    className="spillover-flow-line"
                    markerEnd="url(#spillover-arrow)"
                  />
                  <path
                    d="M 435 338 L 452 360"
                    className="spillover-flow-line"
                    markerEnd="url(#spillover-arrow)"
                  />

                  {METROPOLITAN_MAP_LAYOUT.map((geo) => {
                    const region = regionMap.get(geo.code);
                    if (!region) return null;
                    const metricRange = getMetricRange(region, selectedMetric);
                    const tone = getDivergingTone(metricRange);
                    const isSelected = selectedRegion.region_code === region.region_code;
                    const isCohortTarget =
                      selectedCohort?.target_region_codes?.includes(region.region_code) ??
                      false;
                    const isCohortSubstitute =
                      selectedCohort?.substitute_region_codes?.includes(
                        region.region_code,
                      ) ?? false;

                    return (
                      <g
                        key={geo.code}
                        transform={`translate(${geo.x}, ${geo.y})`}
                        className={[
                          "map-region-node",
                          `tone-${tone}`,
                          `effect-${region.effect_type}`,
                          isSelected ? "is-selected" : "",
                          isCohortTarget ? "cohort-target-ring" : "",
                          isCohortSubstitute ? "cohort-substitute-ring" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        aria-label={`${region.region_name}, ${
                          region.effect_type === "direct" ? "직접효과" : "전이효과"
                        }, ${formatRange(metricRange)}`}
                        onClick={() => {
                          setSelectedRegionCode(region.region_code);
                          setSelectedCausalNodeId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedRegionCode(region.region_code);
                            setSelectedCausalNodeId(null);
                          }
                        }}
                      >
                        <rect
                          width={geo.w}
                          height={geo.h}
                          rx="12"
                          className="region-box"
                        />
                        <text x="10" y="20" className="region-node-title">
                          {geo.shortName}
                        </text>
                        <text x="10" y="36" className="region-node-badge">
                          {region.effect_type === "direct" ? "[직접규제]" : "[전이유입]"}
                        </text>
                        <text x="10" y="56" className="region-node-range">
                          {formatRange(metricRange)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="accessible-table-wrapper">
                <table className="region-comparison-table">
                  <caption>
                    수도권 11개 시군구 정책 효과 비교표 (기준일 {snapshot.as_of}, {horizonMonths}개월 시점)
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">지역명</th>
                      <th scope="col">효과 구분</th>
                      <th scope="col">매매가격 범위 (중앙값)</th>
                      <th scope="col">거래량 범위 (중앙값)</th>
                      <th scope="col">대출가능액 범위</th>
                      <th scope="col">핵심 작동 메커니즘</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenario.regions.map((region) => {
                      const isSelected =
                        region.region_code === selectedRegion.region_code;
                      return (
                        <tr
                          key={region.region_code}
                          className={isSelected ? "selected-row" : ""}
                          onClick={() => {
                            setSelectedRegionCode(region.region_code);
                            setSelectedCausalNodeId(null);
                          }}
                        >
                          <th scope="row">
                            <button
                              type="button"
                              className="table-region-btn"
                              onClick={() => {
                                setSelectedRegionCode(region.region_code);
                                setSelectedCausalNodeId(null);
                              }}
                            >
                              {region.region_name}
                            </button>
                          </th>
                          <td>
                            <span className={`effect-pill ${region.effect_type}`}>
                              {region.effect_type === "direct" ? "직접효과" : "전이효과"}
                            </span>
                          </td>
                          <td className="num-cell">
                            {formatRange(region.price_change)} ({formatMedian(region.price_change)})
                          </td>
                          <td className="num-cell">
                            {formatRange(region.transaction_change)} ({formatMedian(region.transaction_change)})
                          </td>
                          <td className="num-cell">
                            {region.mortgage_limit_change
                              ? formatRange(region.mortgage_limit_change)
                              : "-"}
                          </td>
                          <td>{region.primary_mechanism ?? "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Selected Region Focus Summary Strip */}
            <div className="selected-region-spotlight" aria-live="polite">
              <div className="spotlight-header">
                <div>
                  <span className={`effect-pill ${selectedRegion.effect_type}`}>
                    {selectedRegion.effect_type === "direct"
                      ? "직접 규제 대상 권역"
                      : "풍선효과 및 대체 수요 유입 권역"}
                  </span>
                  <h3>
                    {selectedRegion.region_name} ({horizonMonths === 0 ? "발표 직후" : `${horizonMonths}개월 후`} 시나리오)
                  </h3>
                </div>
                <span className="confidence-pill">
                  모형 신뢰도: {selectedRegion.confidence === "low" ? "낮음 (합성 범위)" : selectedRegion.confidence}
                </span>
              </div>

              <p className="spotlight-mechanism">
                작동 메커니즘: {selectedRegion.primary_mechanism ?? "차입 한도 및 실거주 요건 변화"}
              </p>

              <div className="spotlight-metrics-grid">
                <div className="metric-card">
                  <span>매매가격 변화 범위 (80% 구간 포함)</span>
                  <strong>{formatRange(selectedRegion.price_change)}</strong>
                  <small>
                    중앙값 {formatMedian(selectedRegion.price_change)} | 80% 구간{" "}
                    {selectedRegion.price_change.ci80_low ?? selectedRegion.price_change.low}% ~{" "}
                    {selectedRegion.price_change.ci80_high ?? selectedRegion.price_change.high}%
                  </small>
                </div>
                <div className="metric-card">
                  <span>거래량 변화 범위</span>
                  <strong>{formatRange(selectedRegion.transaction_change)}</strong>
                  <small>
                    중앙값 {formatMedian(selectedRegion.transaction_change)} | 거래량이 가격보다 먼저 반응
                  </small>
                </div>
                <div className="metric-card">
                  <span>평균 대출가능액 변화 범위</span>
                  <strong>
                    {selectedRegion.mortgage_limit_change
                      ? formatRange(selectedRegion.mortgage_limit_change)
                      : "변동 없음"}
                  </strong>
                  <small>주담대 6억 상한 및 스트레스 DSR 3단계 합산</small>
                </div>
              </div>
            </div>
          </section>

          {/* Scene 4: JEV Household Cohort Panel (28% Right Column) */}
          <aside
            className="cohort-panel"
            aria-labelledby="cohort-panel-heading"
          >
            <div className="panel-header">
              <div>
                <p className="eyebrow">Scene 4. JEV 대표 가구 코호트 반응</p>
                <h2 id="cohort-panel-heading">가구 유형별 예산 제약 및 이동</h2>
              </div>
            </div>
            <p className="helper-text">
              코호트 카드를 선택하면 해당 가구의 기존 목표 권역(파란 테두리)과 정책 시행 후 이동하는 대체 권역(주황 점선)이 지도에 함께 표시됩니다.
            </p>

            <div className="cohort-cards-stack">
              {scenario.cohorts.map((cohort) => {
                const isSelected = cohort.cohort_id === selectedCohortId;
                const isLinkedToRegion =
                  selectedRegion.related_cohort_ids?.includes(cohort.cohort_id) ??
                  false;
                const probAfter = cohort.action_probabilities_after;

                return (
                  <article
                    key={cohort.cohort_id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    className={[
                      "jev-cohort-card",
                      isSelected ? "selected" : "",
                      isLinkedToRegion ? "linked-to-region" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() =>
                      setSelectedCohortId(
                        isSelected ? null : cohort.cohort_id,
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedCohortId(
                          isSelected ? null : cohort.cohort_id,
                        );
                      }
                    }}
                  >
                    <div className="jev-card-header">
                      <div>
                        <h3>{cohort.label}</h3>
                        {cohort.description && (
                          <p className="jev-desc">{cohort.description}</p>
                        )}
                      </div>
                      <div className="exposure-badge">
                        <span>노출도</span>
                        <strong>{formatPercent(cohort.exposure)}</strong>
                      </div>
                    </div>

                    {/* Metric 1 & 2: Max Loan & Effective Budget Before -> After */}
                    <div className="jev-finance-grid">
                      <div>
                        <span>최대 대출 가능액</span>
                        <strong>
                          {formatKrwEok(cohort.max_loan_before_krw)} {"->"}{" "}
                          {formatKrwEok(cohort.max_loan_after_krw)}
                        </strong>
                      </div>
                      <div>
                        <span>유효 매수 예산</span>
                        <strong>
                          {formatKrwEok(cohort.budget_before_krw)} {"->"}{" "}
                          {formatKrwEok(cohort.budget_after_krw)}
                        </strong>
                      </div>
                    </div>

                    {/* Metric 3: Action Probability Distribution After Policy */}
                    {probAfter && (
                      <div className="jev-prob-block">
                        <div className="prob-labels">
                          <span>기존 목표지 매수 {formatPercent(probAfter.buy_target)}</span>
                          <span>대체지 이동 {formatPercent(probAfter.buy_substitute)}</span>
                          <span>보류/전세 {formatPercent(probAfter.delay_or_jeonse)}</span>
                        </div>
                        <div
                          className="prob-stacked-bar"
                          aria-label="정책 후 가구 행동 확률 분포"
                        >
                          <span
                            className="prob-seg target"
                            style={{ width: formatPercent(probAfter.buy_target) }}
                          />
                          <span
                            className="prob-seg substitute"
                            style={{ width: formatPercent(probAfter.buy_substitute) }}
                          />
                          <span
                            className="prob-seg delay"
                            style={{ width: formatPercent(probAfter.delay_or_jeonse) }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Metric 4: Selectable Regions Shift */}
                    {cohort.selectable_regions_after &&
                      cohort.selectable_regions_after.length > 0 && (
                        <div className="jev-region-shift">
                          <span className="shift-caption">정책 후 주요 탐색 권역:</span>
                          <div className="shift-chips">
                            {cohort.selectable_regions_after.map((name) => (
                              <span key={name} className="region-mini-chip">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    <p className="jev-response-copy">{cohort.response}</p>
                  </article>
                );
              })}
            </div>
          </aside>
        </div>

        {/* Scene 5: Bottom Causal Path & Evidence Inspector (25% Bottom Workbench) */}
        <section
          className="causal-evidence-workbench"
          aria-labelledby="causal-evidence-heading"
        >
          <div className="panel-header">
            <div>
              <p className="eyebrow">
                Scene 5. 인과 경로 및 KDI, 한국은행 실증 연구 근거 검증 패널
              </p>
              <h2 id="causal-evidence-heading">
                {selectedRegion.region_name} 5단계 작동 경로 및 연결 연구 주장 (Claim)
              </h2>
            </div>

            <div className="kg-summary-pill">
              지식그래프 노드 {graph.nodes.length}개 / 관계 엣지 {graph.edges.length}개 실시간 연동
            </div>
          </div>

          {/* 5-Stage Structured Causal Chain */}
          <div
            className="structured-chain-row"
            role="list"
            aria-label="5단계 정책 파급 경로"
          >
            {activeCausalChain.map((node) => {
              const isNodeSelected = selectedCausalNodeId === node.node_id;
              return (
                <div
                  key={node.node_id}
                  role="listitem"
                  className={[
                    "causal-stage-card",
                    node.is_uncertain ? "uncertain-node" : "deterministic-node",
                    isNodeSelected ? "selected-node" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    type="button"
                    className="causal-node-btn"
                    onClick={() =>
                      setSelectedCausalNodeId(
                        isNodeSelected ? null : node.node_id,
                      )
                    }
                    aria-pressed={isNodeSelected}
                  >
                    <div className="stage-top">
                      <span className="stage-label">
                        {STAGE_LABELS[node.stage] ?? node.stage}
                      </span>
                      <span
                        className={
                          node.is_uncertain
                            ? "certainty-tag uncertain"
                            : "certainty-tag certain"
                        }
                      >
                        {node.is_uncertain ? "모형 추정 (불확실성 포함)" : "규칙 확정"}
                      </span>
                    </div>
                    <strong>{node.label}</strong>
                    <p>{node.detail}</p>
                    {node.claim_ids && node.claim_ids.length > 0 && (
                      <span className="linked-claims-count">
                        연결된 실증 Claim {node.claim_ids.length}건 필터링
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Evidence Filter Tabs */}
          <div className="evidence-inspector-header">
            <div className="segmented-buttons" role="group" aria-label="근거 필터 선택">
              <button
                type="button"
                className={
                  evidenceFilterMode === "contextual" ? "seg-btn active" : "seg-btn"
                }
                onClick={() => setEvidenceFilterMode("contextual")}
              >
                선택 지역 및 경로 연결 근거 ({filteredClaims.length}건)
              </button>
              <button
                type="button"
                className={
                  evidenceFilterMode === "conflicts" ? "seg-btn active" : "seg-btn"
                }
                onClick={() => setEvidenceFilterMode("conflicts")}
              >
                상충 연구 비교 (단기 실증 vs 장기 구조모형)
              </button>
              <button
                type="button"
                className={
                  evidenceFilterMode === "all" ? "seg-btn active" : "seg-btn"
                }
                onClick={() => setEvidenceFilterMode("all")}
              >
                전체 KDI 및 한국은행 연구 주장 ({claims.length}건)
              </button>
            </div>

            {selectedCausalNode && (
              <button
                type="button"
                className="text-link-btn"
                onClick={() => setSelectedCausalNodeId(null)}
              >
                단계 필터 해제 ({selectedCausalNode.label})
              </button>
            )}
          </div>

          {/* Evidence Claim Cards Grid */}
          <div className="claims-grid">
            {filteredClaims.map((claim) => {
              const conflicts = (claim.related_claims ?? []).filter(
                (rel) => rel.relation === "CONFLICTS_WITH",
              );
              const complements = (claim.related_claims ?? []).filter(
                (rel) => rel.relation !== "CONFLICTS_WITH",
              );

              return (
                <article key={claim.claim_id} className="claim-card">
                  <div className="claim-card-top">
                    <div className="claim-badges">
                      <span className={`grade-badge grade-${claim.evidence_grade}`}>
                        근거 등급 {claim.evidence_grade}
                      </span>
                      <span
                        className={`match-badge ${claim.scenario_match ?? "PARTIAL_MATCH"}`}
                      >
                        {claim.scenario_match === "MATCHED"
                          ? "시나리오 직접 대응"
                          : claim.scenario_match === "MISMATCH"
                            ? "여건 불일치 주의"
                            : "부분 대응"}
                      </span>
                      <span className="horizon-badge">
                        시차 {claim.horizon_months}개월 (
                        {HORIZON_CLASS_LABELS[claim.horizon_class ?? ""] ??
                          (claim.horizon_class ?? "단기/중기")}
                        )
                      </span>
                    </div>
                    <span className="claim-id-code">{claim.claim_id}</span>
                  </div>

                  <h3 className="claim-title">{claim.title}</h3>

                  <div className="claim-effect-row">
                    <div>
                      <span className="effect-label">보고된 효과 크기</span>
                      <strong
                        className={
                          claim.effect_value === null
                            ? "effect-null"
                            : "effect-num"
                        }
                      >
                        {formatClaimEffect(claim)}
                      </strong>
                    </div>
                    <div>
                      <span className="effect-label">방향성 및 정량 후보 여부</span>
                      <p>
                        방향:{" "}
                        {DIRECTION_LABELS[claim.effect_direction] ??
                          claim.effect_direction}{" "}
                        |{" "}
                        {claim.is_quantitative_candidate
                          ? "정량 시뮬레이션 참조 계수"
                          : "정성 경로 및 방향성 근거 (계수 미적용)"}
                      </p>
                    </div>
                  </div>

                  <dl className="claim-meta-dl">
                    <div>
                      <dt>분석 방법 및 국면</dt>
                      <dd>
                        {claim.method} ({claim.market_regime})
                      </dd>
                    </div>
                    <div>
                      <dt>표본 기간 및 지역</dt>
                      <dd>
                        {claim.sample_period.start} ~ {claim.sample_period.end} | 대상:{" "}
                        {claim.target_region}
                      </dd>
                    </div>
                  </dl>

                  {/* Explicit Conflicting Research Preservation Box */}
                  {conflicts.length > 0 && (
                    <div className="conflict-comparison-box" role="note">
                      <strong>상충 연구 병렬 보존 (평균 합산 금지 원칙 적용):</strong>
                      {conflicts.map((conf) => {
                        const targetClaim = claimMap.get(conf.claim_id);
                        return (
                          <p key={conf.claim_id}>
                            반대/대조 주장 [{conf.claim_id}
                            {targetClaim ? `: ${targetClaim.title}` : ""}]: {conf.reason}
                          </p>
                        );
                      })}
                    </div>
                  )}

                  {complements.length > 0 && (
                    <div className="complement-box">
                      {complements.map((comp) => (
                        <p key={comp.claim_id}>
                          [{RELATION_LABELS[comp.relation] ?? comp.relation}:{" "}
                          {comp.claim_id}] {comp.reason}
                        </p>
                      ))}
                    </div>
                  )}

                  <ul className="claim-limitations">
                    {claim.limitations.map((lim) => (
                      <li key={lim}>{lim}</li>
                    ))}
                  </ul>

                  <footer className="claim-source-footer">
                    <div>
                      <strong>{claim.source.publisher}</strong> | {claim.source.title} (
                      {claim.source.published_at})
                      {claim.source.locator ? ` - ${claim.source.locator}` : ""}
                    </div>
                    <a
                      href={claim.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="source-ext-link"
                    >
                      원문 출처 열기
                    </a>
                  </footer>
                </article>
              );
            })}
          </div>

          {/* Global Limitations & Assumptions Disclosure */}
          <div className="limitations-disclosure">
            <h3>시뮬레이션 한계 및 미검증 데이터 명시적 고지</h3>
            <ul>
              {scenario.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <div>
          <strong>PolicyMap</strong>
          <p>
            한국 부동산 정책 시계열 지식그래프 및 가구, 공간 파급 시뮬레이션 프로토타입
          </p>
        </div>
        <div className="footer-meta">
          <span>데이터 버전: {scenario.data_version ?? "demo_v2025.06.28"}</span>
          <span>모형 버전: {scenario.model_version}</span>
          <span>투자 권유 해당 여부: 해당 없음 (is_investment_advice: false)</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
