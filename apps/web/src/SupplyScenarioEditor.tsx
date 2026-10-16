import { useEffect, useState } from "react";
import type { SupplyAssumption } from "./policy-pipeline";

export const emptySupply = (code: string): SupplyAssumption => ({
  region_code: code, housing_stock: 0, project_count: 0, units_per_project: 0,
  residential_share_percent: 0, comparator: "lt", delivery_fraction: 0,
  horizon_months: 12, price_response_coefficient: 0, other_conditions_satisfied: true,
  input_basis: "user_input", source_url: null,
});

export const recommendedSupply = (code: string, kind: string): SupplyAssumption => ({
  ...emptySupply(code), housing_stock:100000, project_count:10,
  units_per_project:kind==="units"?400:250, residential_share_percent:kind==="units"?85:95,
  delivery_fraction:0.25, price_response_coefficient:0.5, input_basis:"illustrative",
});
export function fillSupplyDefaults(values: SupplyAssumption[], codes: string[], kind: string): SupplyAssumption[] {
  const missing=codes.filter(code=>!values.some(v=>v.region_code===code));
  return missing.length?[...values,...missing.map(code=>recommendedSupply(code,kind))]:values;
}

export function SupplyScenarioEditor({regions, values, onChange, confirmed, onConfirm, kind}: {
  kind: string;
  regions: {code: string; name: string}[]; values: SupplyAssumption[];
  onChange: (values: SupplyAssumption[]) => void; confirmed: boolean; onConfirm: (v: boolean) => void;
}) {
  const [editing,setEditing]=useState(regions[0]?.code??"");
  const active=regions.find(r=>r.code===editing)??regions[0];
  useEffect(()=>{
    const next=fillSupplyDefaults(values,regions.map(r=>r.code),kind);
    if(next!==values){onChange(next);onConfirm(false);}
  },[regions,values,kind,onChange,onConfirm]);
  function update(code: string, change: Partial<SupplyAssumption>) {
    const current = values.find(v=>v.region_code===code) ?? recommendedSupply(code,kind);
    onChange([...values.filter(v=>v.region_code!==code), {...current,...change}]);
    onConfirm(false);
  }
  return <section className="workflow-supply-input">
    <h3>공급 변화가 가격에 전달되는 조건</h3>
    <p>건축허가 경로의 대상 확대가 공급 시점을 얼마나 앞당기는지 비교합니다. 주택 수와 사업 규모는 지역별로 설정하세요.</p>
    <button type="button" disabled={!regions.length} onClick={()=>{
      onChange(regions.map(r=>recommendedSupply(r.code,kind)));
      onConfirm(false);
    }}>기본 시나리오 값으로 복원</button>
    <small className="muted">시나리오 시작값을 자동 입력했습니다. 기존 주택 10만 호, 사업 10개, 사업당 {kind==="units"?400:250}세대, 12개월 내 25% 전환, 반응 계수 0.5입니다. 지역별 실측 통계가 아닌 비교용 가정이며 직접 수정할 수 있습니다.</small>
    <details className="supply-region-editor"><summary>지역별 공급 조건 수정 ({regions.length}개 지역)</summary>
    <label>수정할 지역<select value={active?.code??""} onChange={e=>setEditing(e.target.value)}>{regions.map(r=><option key={r.code} value={r.code}>{r.name}</option>)}</select></label>
    {(active?[active]:[]).map(r=>{const v=values.find(s=>s.region_code===r.code)??recommendedSupply(r.code,kind);return <div className="workflow-household" key={r.code}>
      <h4>{r.name}</h4>
      <div className="workflow-fields">
        {([
          ["housing_stock","비교 기간 말 기준 시나리오 주택 수 (호)",1,10000000,1],
          ["project_count","검토 사업 수 (개)",0,100000,1],
          ["units_per_project","사업당 세대수",1,100000,1],
          ["residential_share_percent","주거 연면적 비율 (%)",0,100,0.1],
          ["horizon_months","비교 기간 (개월)",1,120,1],
          ["delivery_fraction","기간 내 공급 전환 비율 (0~1)",0,1,0.05],
          ["price_response_coefficient","공급 1% 변화당 가격 반응 계수",0,5,0.05],
        ] as const).map(([key,label,min,max,step])=><label key={key}>{label}<input type="number" min={min} max={max} step={step} value={(key==="housing_stock"||key==="units_per_project")&&v[key]===0?"":v[key]} onChange={e=>update(r.code,{[key]:Number(e.target.value)})}/></label>)}
        <label>원문의 기준 부등호<select value={v.comparator} onChange={e=>update(r.code,{comparator:e.target.value as "lt"|"lte"})}><option value="lt">미만 (&lt;)</option><option value="lte">이하 (≤)</option></select></label>
      </div>
      <label>주택 수와 사업 자료의 출처 URL (선택)<input type="url" value={v.source_url??""} onChange={e=>update(r.code,{source_url:e.target.value||null})}/></label>
      <small className="muted">입력 출발점: {v.input_basis==="illustrative"?"계산 예시 (수정 가능)":"직접 입력"}. 계수는 시나리오 가정이며, 추정된 시장 계수와 구분합니다.</small>
    </div>;})}
    </details>
    <label className="workflow-check"><input type="checkbox" checked={confirmed} onChange={e=>onConfirm(e.target.checked)}/>선택한 기준 외의 사업 요건은 충족한다고 가정하고, 위 공급 전환 조건을 적용합니다.</label>
  </section>;
}
