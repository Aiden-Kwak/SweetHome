import { useState } from "react";
import { boundaryPath, boundaryLabelPoint, boundaryViewBox } from "./ImpactMap";
import { experimentRegionCode } from "./policy-pipeline";
import type { PolicyExperimentResult } from "./policy-pipeline";
import type { PublicContext } from "./types";

const number = (v:number) => v.toLocaleString("ko-KR", {maximumFractionDigits:2});
const signed = (v:number) => `${v>0?"+":""}${number(v)}`;
const money = (v:number|null) => v==null?"-":`${number(v/1e8)}억 원`;

export function PolicyExperimentView({result, context, onEdit}: {
  result: PolicyExperimentResult; context: PublicContext|null; onEdit:()=>void;
}) {
  const [picked,setPicked]=useState(result.regions[0]?.code??"");
  const active=result.regions.find(r=>r.code===picked)??result.regions[0];
  const supply=result.supply.find(s=>s.region_code===active?.code);
  const input=result.assumptions.supply_assumptions?.find(s=>s.region_code===active?.code);
  const financial=["mortgage_cap","guarantee_cap","ltv","dsr"].includes(result.candidate.kind);
  const metric=(r:typeof active)=>r?.metric_value==null?"조건 비교":`${signed(r.metric_value)}${r.metric_unit}`;
  const price=active?.price_sensitivity_percent!=null;
  function save() {
    const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download=`${result.scenario_id}.json`;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="workflow-result">
    <div className="workflow-meta"><span className="badge plain">입력 가정 기반 시나리오</span><span>단일 규칙 비교 / 기준일 {result.simulation_date}</span></div>
    <div className="workflow-result-hero">
      <div><p className="eyebrow">{result.candidate.label}</p><h3>{result.candidate.unit==="KRW"?`${money(result.candidate.before)} → ${money(result.candidate.after)}`:`${number(result.candidate.before)} → ${number(result.candidate.after)} ${result.candidate.unit}`}</h3><p>{result.hypothetical?"정책 시행을 가정하여 비교":result.applied?"시행 후 조건 적용":"시행 전 조건 유지"}{supply?` / ${supply.horizon_months}개월 비교`:""}</p></div>
      <div><p>{active?.name} {active?.metric_label}</p><strong className="workflow-result-number">{metric(active)}</strong><small>{price?"입력 계수에 따른 민감도 (실제 가격 전망과 구분)":"선택한 정책으로 직접 계산한 변화"}</small></div>
    </div>
    <div className="workflow-result-layout"><div>
      <h3>지역별 {active?.metric_label}</h3>
      <p className="muted">선택한 지역의 조건을 비교합니다. 회색은 이번 계산 범위 밖입니다.</p>
      {context&&<svg viewBox={boundaryViewBox(context.boundaries.filter(b=>result.regions.some(r=>r.code===experimentRegionCode(b))))} className="workflow-map" aria-label={`정책 ${active?.metric_label} 지도`}>
        {context.boundaries.map(b=>{const code=experimentRegionCode(b);const impact=result.regions.find(r=>r.code===code);const value=impact?.metric_value??0;return <path key={b.code} d={boundaryPath(b)} fill={impact?(value<0?"#a8ccff":value>0?"#f6dcae":"#d7e4f4"):"#e5e8eb"} stroke="white" fillRule="evenodd" {...(impact?{role:"button",tabIndex:0,"aria-label":`${impact.name} ${metric(impact)} 선택`,"aria-pressed":code===active?.code,onClick:()=>setPicked(code),onKeyDown:(e:React.KeyboardEvent)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setPicked(code);}}}:{})}/>;})}
        <g pointerEvents="none">{context.boundaries.filter(b=>experimentRegionCode(b)===active?.code).map(b=><path key={b.code} d={boundaryPath(b)} fill="none" stroke="#1b64da" strokeWidth="3"/>)}</g>
        <g className="workflow-map-label" pointerEvents="none">{context.boundaries.filter(b=>experimentRegionCode(b)===active?.code).map(b=>{const [x,y]=boundaryLabelPoint(b);return <g key={b.code} transform={`translate(${x},${y})`}><text textAnchor="middle">{b.name}</text><text textAnchor="middle" y="20">{metric(active)}</text></g>;})}</g>
      </svg>}
      <p className="muted">파랑: 감소 / 노랑: 증가 / 옅은 파랑: 변화 없음<br/>경계: 통계청 SGIS 2018, 공공누리 제1유형</p>
      <label>지역 선택<select aria-label="지역 선택" value={active?.code??""} onChange={e=>setPicked(e.target.value)}>{result.regions.map(r=><option key={r.code} value={r.code}>{r.name}: {metric(r)}</option>)}</select></label>
      {financial&&!price&&result.candidate.kind!=="guarantee_cap"&&<button onClick={onEdit}>가격 반응 계수를 설정해 가격 비교로 확장</button>}
    </div><aside>
      {supply&&input?<>
        <h3>{active?.name} 공급 변화 경로</h3>
        <ol className="workflow-causal-steps">
          <li><small>01. 건축허가 경로 대상</small><strong>{supply.eligible_before?"대상":"대상 밖"} → {supply.eligible_after?"대상":"대상 밖"}</strong><p>사업당 {number(input.units_per_project)}세대 / 주거 연면적 {number(input.residential_share_percent)}%</p></li>
          <li><small>02. 검토 사업 규모</small><strong>{number(supply.planned_units)}세대</strong><p>{number(input.project_count)}개 사업 × {number(input.units_per_project)}세대</p></li>
          <li><small>03. {supply.horizon_months}개월 내 공급 시점 변화</small><strong>{signed(supply.accelerated_units)}세대</strong><p>전환 비율 {number(input.delivery_fraction*100)}% / 기존 주택 {number(input.housing_stock)}호 대비 {signed(supply.stock_change_percent)}%</p></li>
          <li><small>04. 가격 민감도</small><strong>{signed(supply.price_sensitivity_percent)}%</strong><p>공급 변화율에 반응 계수 {number(input.price_response_coefficient)} 적용</p></li>
        </ol>
        <p className="muted">입력 출발점: {input.input_basis==="illustrative"?"계산 예시 값 (지역 통계 아님)":"사용자 제공 값"}. 공급 시점은 기준 시나리오와 비교합니다.</p>
        {input.source_url&&<a href={input.source_url} target="_blank" rel="noreferrer">지역 입력 자료 출처</a>}
      </>:financial?<><h3>{result.candidate.kind==="guarantee_cap"?"가구별 전세보증과 임차 예산":"가구별 자금과 구매 예산"}</h3>
        <p className="muted">입력한 가구 프로필 기준</p>
        {result.households.map(h=><article key={h.id} className="workflow-household"><strong>{h.label}</strong><p className="muted">{h.eligible?"정책 적용 대상":"기존 조건 유지"}</p><p>{result.candidate.kind==="guarantee_cap"?"보증 범위":"선택 규칙 자금 상한"}<br/>{money(h.financing_before_krw)} → {money(h.financing_after_krw)}</p><p>현금 포함 예산<br/>{money(h.budget_before_krw)} → {money(h.budget_after_krw)}</p><strong>{h.budget_change_percent==null?"예산 기준값 0원":`${signed(h.budget_change_percent)}%`}</strong></article>)}
      </>:<><h3>정책 대상 기준 비교</h3><article className="workflow-household"><p>변경 전 {number(result.candidate.before)}{result.candidate.unit}</p><p>적용 후 {number(result.applied?result.candidate.after:result.candidate.before)}{result.candidate.unit}</p><strong>{active?.metric_label}: {metric(active)}</strong></article><p>지역 선택은 적용 범위를 나타냅니다. 이 화면의 지표는 정책 대상 기준입니다.</p></>}
    </aside></div>
    <article className="workflow-candidate"><h3>계산에 반영한 입력 내용과 출처</h3><blockquote>{result.candidate.quote}</blockquote>{result.source_url&&<a href={result.source_url} target="_blank" rel="noreferrer">출처 원문 확인 ↗</a>}</article>
    <details><summary>계산 근거 및 적용 범위</summary><h4>계산식</h4><p>{result.formula}</p>{price&&!supply&&<p>가격 민감도 = 가구 예산 변화율의 단순평균 × 입력 계수 {result.assumptions.price_elasticity}</p>}<ul>{result.limitations.map(l=><li key={l}>{l}</li>)}</ul><p>지도는 2018년 경계를 사용합니다. 현행 행정구역과 차이가 있을 수 있습니다.</p><p>데이터: 사용자 입력 / 모형: 민감도 실험</p><code>{result.scenario_id} / {result.model_version}</code><p>본문 SHA-256: <code>{result.text_hash}</code></p></details>
    <div className="dialog-actions"><button onClick={onEdit}>조건을 바꿔 다시 계산</button><button onClick={save}>원문과 계산 조건 JSON 저장</button></div>
  </section>;
}
