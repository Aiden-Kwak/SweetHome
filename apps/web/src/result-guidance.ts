import type { PolicyExperimentResult } from "./policy-pipeline";

export type GuidanceAudience = "policymaker" | "homebuyer";
export interface ResultGuidanceText {
  title: string;
  observation: string;
  interpretation: string;
  nextSteps: string[];
}
const n = (v: number) => v.toLocaleString("ko-KR", {maximumFractionDigits: 2});
const won = (v: number | null) => v == null ? "계산값 없음" : `${n(v / 1e8)}억 원`;

// Presentation only: reuse server results; never estimate effects or eligibility.
export function resultGuidance(result: PolicyExperimentResult, regionCode: string,
  audience: GuidanceAudience, householdId?: string): ResultGuidanceText {
  const region = result.regions.find(r => r.code === regionCode);
  const supply = result.supply.find(s => s.region_code === regionCode);
  const household = result.households.find(h => h.id === householdId) ?? result.households[0];
  const policy = audience === "policymaker";
  const kind = result.candidate.kind;
  const timing = result.hypothetical
    ? "정책 시행을 가정한 비교입니다. 최종 조문과 실제 시행일을 확인하세요."
    : `실험 기준일은 ${result.simulation_date}입니다. 계약과 신청 시점에 적용되는 규정을 확인하세요.`;
  if (!result.applied) return {
    title: "이번 기준일에는 변경 전 조건을 유지합니다",
    observation: "새 규칙이 적용되지 않은 계산이므로, 변화가 없다는 결과를 정책 효과가 없다는 뜻으로 읽지 마세요.",
    interpretation: policy ? "시행 시점과 경과규정을 나누어 비교하면 전환기에 영향을 받는 대상을 검토할 수 있습니다." : "발표일과 시행일을 구분하고, 자신의 계약 및 신청 날짜를 먼저 확인하세요.",
    nextSteps: ["시행 이후 기준일 또는 시행을 가정한 조건으로 다시 비교하세요.", timing],
  };
  if (kind === "units" || kind === "area_share") {
    if (!supply || !region) return {
      title: "지역의 공급 계산부터 확인하세요", observation: "선택한 지역에 연결된 공급 결과가 없습니다.",
      interpretation: "다른 지역의 계산값을 이 지역에 대신 적용하지 않습니다.",
      nextSteps: ["적용 지역과 공급 조건을 입력해 다시 계산하세요.", timing],
    };
    const direction = supply.accelerated_units > 0 ? "앞당겨지는" : "늦춰지는";
    const change = supply.accelerated_units === 0
      ? "현재 입력에서는 공급 시점 변화가 없습니다."
      : `${region.name}에서는 ${supply.horizon_months}개월 내 공급 시점이 ${direction} 물량이 ${n(Math.abs(supply.accelerated_units))}세대입니다.`;
    return {
      title: policy ? (supply.accelerated_units === 0 ? "기준 변경이 실제 사업에 닿는지 확인하세요" : "허가 기준과 실제 공급 시점을 함께 검토하세요") : "정책 발표와 실제 입주 기회를 나누어 보세요",
      observation: `${change} 건축허가 경로는 ${supply.eligible_before ? "대상" : "대상 밖"}에서 ${supply.eligible_after ? "대상" : "대상 밖"}으로 비교됩니다.`,
      interpretation: policy
        ? "규칙 변경만으로 공급을 보장하지는 않습니다. 사업 수와 기간 내 전환 비율을 바꾸어도 결과 방향이 유지되는지 비교하고, 인허가 및 착공 지연 요인을 점검하세요."
        : "이 결과는 입력한 사업의 공급 시점 비교입니다. 실제 분양 물량이나 입주일이 확정됐다는 뜻은 아니며, 가격 민감도만으로 매수 시점을 정하지 마세요.",
      nextSteps: policy
        ? ["지역별 사업 수와 주택 수를 확인한 자료로 바꾸어 대안을 비교하세요.", "사업 전환 비율을 낮춘 조건도 재계산하고, 시행 후 인허가, 착공, 준공 실적을 각각 관찰하세요.", timing]
        : ["관심 단지의 모집공고, 분양 일정과 입주 예정일을 별도로 확인하세요.", "희망 입주 시기와 준비 가능한 현금, 대출 상담 결과를 함께 정리하세요.", timing],
    };
  }
  if (["mortgage_cap", "guarantee_cap", "ltv", "dsr"].includes(kind)) {
    const rental = kind === "guarantee_cap";
    const eligible = result.households.filter(h => h.eligible);
    const affected = eligible.filter(h => h.budget_before_krw !== h.budget_after_krw);
    if (policy) return {
      title: affected.length ? "평균보다 가구별 차이를 먼저 보세요" : "현재 사례에 변화가 없는 이유를 확인하세요",
      observation: `입력한 ${result.households.length}개 사례 중 적용 대상은 ${eligible.length}개이며, ${rental ? "임차" : "구매"} 예산이 달라진 사례는 ${affected.length}개입니다.`,
      interpretation: rental
        ? "전세보증 조건의 변화입니다. 매매가격 효과와 구분해 임차인의 자금 접근성과 지원 대상 밖의 가구를 비교하세요."
        : "지역 지도는 입력한 가구 사례의 계산을 사용합니다. 지역 주민 전체의 효과로 확대하지 말고, 현금과 부채 조건이 다른 가구의 차이를 검토하세요.",
      nextSteps: [eligible.length ? "적용 대상과 제외 대상을 나누고, 필요한 예외 및 경과규정을 검토하세요." : "대상 가구를 선택한 뒤 다시 계산하세요. 현재는 모든 가구의 기존 조건을 유지합니다.", "가구의 현금, 소득과 기존 부채를 바꾼 대안을 비교하세요. 다른 규제와의 결합 심사도 별도로 검토하세요.", timing],
    };
    if (!household) return {
      title: "내 조건에 맞는 가구 사례를 추가하세요", observation: "비교할 가구 결과가 없습니다.",
      interpretation: "지역 평균을 개인의 대출 가능액으로 사용하지 마세요.",
      nextSteps: ["가구의 현금, 소득과 부채를 입력하고 적용 대상을 확인하세요.", timing],
    };
    const down = (household.budget_change_percent ?? 0) < 0;
    const up = (household.budget_change_percent ?? 0) > 0;
    return {
      title: !household.eligible ? "선택한 사례는 기존 조건을 유지합니다" : down ? "줄어든 예산에 맞춰 자금 계획을 다시 확인하세요" : up ? "늘어난 한도와 감당할 수 있는 예산은 다릅니다" : "한도가 바뀌어도 내 예산은 같을 수 있습니다",
      observation: `${household.label}의 ${rental ? "임차" : "구매"} 예산은 ${won(household.budget_before_krw)}에서 ${won(household.budget_after_krw)}으로 비교됩니다. ${household.eligible ? "입력에서 적용 대상으로 선택한 사례입니다." : "입력에서 적용 대상이 아닌 것으로 설정했습니다. 실제 자격 판정은 아닙니다."}`,
      interpretation: rental
        ? "전세자금 보증 범위와 현금을 더한 비교값이지, 주택 구입자금이나 은행의 승인 대출액은 아닙니다. 보증 요건과 금융기관 심사를 따로 확인하세요."
        : "선택한 한 가지 규칙과 입력한 현금을 반영한 비교입니다. 계약 전에는 금융기관에서 LTV, DSR 등 적용 규정과 실제 대출 가능액을 함께 확인하세요.",
      nextSteps: ["예시 가구의 현금, 소득과 기존 부채를 자신의 조건으로 바꾸어 다시 계산하세요.", rental ? "취급 금융기관에 보증 대상, 보증 범위와 실제 전세대출 가능액을 확인하세요." : "예상 월 상환액, 취득 관련 비용과 비상자금을 포함해 감당할 수 있는 예산을 정하세요.", timing],
    };
  }
  return {
    title: policy ? "대상 기준의 변화와 지원 효과를 구분하세요" : "변경된 기준이 내 자격에 해당하는지 확인하세요",
    observation: `${result.candidate.label}이 ${n(result.candidate.before)}${result.candidate.unit}에서 ${n(result.candidate.after)}${result.candidate.unit}으로 바뀌는 조건입니다.`,
    interpretation: "대상 기준을 비교한 결과이며, 지원 대상자 수나 가격 변화를 계산한 결과는 아닙니다.",
    nextSteps: policy ? ["변경 구간에 해당하는 인구와 다른 자격 요건을 함께 확인하세요.", "실제 신청과 승인 현황으로 지원 대상의 변화를 점검하세요.", timing] : ["연령뿐 아니라 소득, 주택 보유 여부와 신청일 요건도 공식 원문에서 확인하세요.", "실제 자금 계획은 해당 대출 또는 보증 조건으로 별도 비교하세요.", timing],
  };
}
