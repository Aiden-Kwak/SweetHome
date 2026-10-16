import { useState } from "react";
import { resultGuidance } from "./result-guidance";
import type { GuidanceAudience } from "./result-guidance";
import type { PolicyExperimentResult } from "./policy-pipeline";
import "./result-guidance.css";

export function ResultGuidance({result, regionCode, onEdit, initialAudience = "policymaker"}: {
  result: PolicyExperimentResult; regionCode: string; onEdit: () => void;
  initialAudience?: GuidanceAudience;
}) {
  const [audience, setAudience] = useState<GuidanceAudience>(initialAudience);
  const [householdId, setHouseholdId] = useState(result.households[0]?.id ?? "");
  const financial = ["mortgage_cap", "guarantee_cap", "ltv", "dsr"].includes(result.candidate.kind);
  const guidance = resultGuidance(result, regionCode, audience, householdId);
  const region = result.regions.find(r => r.code === regionCode);
  return <section className="result-guidance" aria-labelledby="result-guidance-title">
    <p className="eyebrow">결과를 다음 판단으로</p>
    <h3 id="result-guidance-title">이 결과로 무엇을 확인하면 좋을까요?</h3>
    <div className="guidance-audience" role="group" aria-label="인사이트 대상 선택">
      <button type="button" aria-pressed={audience === "policymaker"} onClick={() => setAudience("policymaker")}>정책입안자</button>
      <button type="button" aria-pressed={audience === "homebuyer"} onClick={() => setAudience("homebuyer")}>내 집 마련 준비자</button>
    </div>
    <p className="guidance-context">{region?.name ?? "선택 지역"} / {result.simulation_date} / 같은 실험 결과에 대한 안내</p>
    {audience === "homebuyer" && financial && result.households.length > 0 && <label>안내받을 가구 사례
      <select value={result.households.some(h => h.id === householdId) ? householdId : result.households[0].id} onChange={e => setHouseholdId(e.target.value)}>
        {result.households.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
      </select>
    </label>}
    <div aria-live="polite" aria-atomic="true">
      <h4 className="guidance-headline">{guidance.title}</h4>
      <div className="guidance-columns">
        <div><h5>이번 결과에서 읽을 점</h5><p>{guidance.observation}</p></div>
        <div><h5>{audience === "policymaker" ? "정책 판단을 위한 제안" : "자금 계획을 위한 안내"}</h5><p>{guidance.interpretation}</p></div>
      </div>
      <h5>다음에 확인할 사항</h5>
      <ol>{guidance.nextSteps.map(step => <li key={step}>{step}</li>)}</ol>
    </div>
    <div className="guidance-actions">
      <button type="button" onClick={onEdit}>{audience === "policymaker" ? "정책 조건을 바꿔 비교하기" : "내 조건으로 다시 계산하기"}</button>
      {result.source_url && <a href={result.source_url} target="_blank" rel="noreferrer">정책 원문 확인 ↗</a>}
      {audience === "homebuyer" && result.candidate.kind === "guarantee_cap" && <a href="https://www.hf.go.kr/ko/sub02/sub02_01_02.do" target="_blank" rel="noreferrer">HF 전세자금보증 일반 안내 ↗</a>}
    </div>
    <small>계산 결과와 입력 조건을 설명하는 안내입니다. 개별 자격 승인, 매수 권고 또는 법률 자문을 대신하지 않습니다.</small>
  </section>;
}
