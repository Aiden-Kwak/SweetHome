import { GlossaryText } from "./GlossaryHelp";
import { formatKrwEok } from "./format";
import type { CohortResult, PolicyRule, PolicySnapshot } from "./types";
import "./policy-factors.css";

const labels: Record<string,string> = {
  demo_rule_mortgage_cap: "주택담보대출 한도",
  demo_rule_land_permit: "토지거래허가 / 실거주",
  demo_rule_stress_dsr_phase3: "스트레스 DSR / 가산금리",
  demo_rule_one_home_disposal_deadline: "기존 주택 처분 / 전입",
  demo_rule_policy_loan_exception: "정책대출 / 실수요자 예외",
};
const safeSource = (url:string) => /^https?:\/\//.test(url)&&!url.includes("example.invalid");

function SourceDetails({rule}:{rule:PolicyRule}) {
  return <details className="factor-source"><summary>대상과 근거</summary>
    <p>{rule.source.authority}</p><p>{rule.source.locator}</p>
    {rule.source.excerpt&&<blockquote>{rule.source.excerpt}</blockquote>}
    <p>대상: {rule.applies_to.region_names?.join(", ")||rule.applies_to.region_codes.join(", ")}</p>
    {rule.exceptions.length>0&&<ul>{rule.exceptions.map(e=><li key={e}>{e}</li>)}</ul>}
    {safeSource(rule.source.url)&&<a href={rule.source.url} target="_blank" rel="noreferrer">출처 열기</a>}
  </details>;
}

export function PolicyFactors({snapshot,cohorts,cohort,selectedRules,regionCode,regionName,onCohortChange,busy}: {
  snapshot:PolicySnapshot; cohorts:CohortResult[]; cohort:CohortResult|null;
  selectedRules:string[]; regionCode:string; regionName:string;
  onCohortChange:(cohort:CohortResult)=>void; busy:boolean;
}) {
  const rules=[...snapshot.rules].sort((a,b)=>(a.impact_priority??99)-(b.impact_priority??99));
  const reference=rules.find(r=>r.rule_id==="demo_rule_mortgage_cap" && /LTV|DSR/.test(r.previous_summary??""));
  return <section className="policy-factors panel" aria-labelledby="factors-title" aria-busy={busy}>
    <div className="section-heading"><div><p className="eyebrow">대출부터 거래 허가까지 한눈에</p><h2 id="factors-title">주요 규제와 허가 조건</h2></div><span className="badge plain">{snapshot.as_of} 스냅샷 기준</span></div>
    <div className="factors-context"><p>{regionName} 선택 / {selectedRules.length}개 변경 규칙 선택</p><label htmlFor="factor-cohort">비교 가구</label><select id="factor-cohort" value={cohort?.cohort_id??""} onChange={e=>{const next=cohorts.find(c=>c.cohort_id===e.target.value);if(next)onCohortChange(next);}}>
      {!cohort&&<option value="">가구 선택</option>}{cohorts.map(c=><option key={c.cohort_id} value={c.cohort_id}>{c.label}</option>)}
    </select></div>
    <div className="factor-table-scroll" tabIndex={0} role="region" aria-label="주요 규제 비교표, 작은 화면에서는 좌우로 이동">
      <table className="factor-table"><caption className="sr-only">선택 시나리오의 대출과 규제 조건 비교</caption><thead><tr><th scope="col">주요 요인</th><th scope="col">변경 전</th><th scope="col">변경 후</th><th scope="col">범위와 근거</th></tr></thead><tbody>
        {cohort&&<tr className="factor-household"><th scope="row">가구 대출 금액<small>선택 가구의 비교값</small></th><td><strong>{formatKrwEok(cohort.max_loan_before_krw)}</strong></td><td><strong>{formatKrwEok(cohort.max_loan_after_krw)}</strong></td><td><small>가구 프로필의 고정 비교값</small><details className="factor-source"><summary>가구 조건</summary><p>{cohort.label}</p><p>{cohort.assumptions}</p><p>정책 선택과 별도로 제공되는 합성 가구 값이며 실제 대출 승인액과 구분합니다.</p></details></td></tr>}
        {reference&&<tr><th scope="row"><GlossaryText text="LTV / DSR"/><small>대출 규칙의 참조 기준</small></th><td colSpan={2}><span className="factor-reference-label">기준 정책에 기재된 조건</span><p><GlossaryText text={reference.previous_summary}/></p></td><td><small>개별 변경값과 구분하는 기준 문구</small><SourceDetails rule={reference}/></td></tr>}
        {rules.map(rule=><tr key={rule.rule_id} className={selectedRules.includes(rule.rule_id)?"":"factor-excluded"}>
          <th scope="row"><GlossaryText text={labels[rule.rule_id]??rule.title}/><small>{selectedRules.includes(rule.rule_id)?"변경 규칙 선택됨":"비교에서 제외"}</small></th>
          <td><GlossaryText text={rule.previous_summary??"기준 정책 상세 참조"}/></td>
          <td><GlossaryText text={rule.proposed_summary??"변경 정책 상세 참조"}/></td>
          <td><span className="factor-scope">{rule.applies_to.region_codes.includes(regionCode)?"지역 목록에 포함":"다른 지역의 규칙"}</span><small>시행 {rule.effective_from}</small><SourceDetails rule={rule}/></td>
        </tr>)}
        {rules.length===0&&<tr><td colSpan={4}>정책 문서를 추가하면 추출한 규칙을 비교할 수 있습니다.</td></tr>}
      </tbody></table>
    </div>
    <p className="factor-footnote">{snapshot.coverage.status==="DEMO_INCOMPLETE"?"시나리오에 등록된 합성 정책과 가구 비교값입니다. ":""}시행일과 대상 조건을 함께 확인하세요. 지역 목록 포함은 개별 물건의 허가 대상 판정과 구분됩니다.</p>
  </section>;
}
