import { useEffect, useRef, useState } from "react";
import { analyzePolicy, runPolicyExperiment } from "./api";
import { PolicyExperimentView } from "./PolicyExperimentView";
import { SupplyScenarioEditor } from "./SupplyScenarioEditor";
import { RegionPicker } from "./RegionPicker";
import { PolicyExamples } from "./PolicyExamples";
import { appendPolicyExample } from "./policy-examples";
import { experimentHouseholds, experimentRegionCode, experimentRegionName } from "./policy-pipeline";
import type { PolicyAnalysis, PolicyExperimentResult, SupplyAssumption } from "./policy-pipeline";
import type { PublicContext } from "./types";
import "./policy-workflow.css";

const today = () => new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

export function PolicyWorkflow({draft, setDraft, context, onClose, initialRegion, onResult}: {
  draft: string; setDraft: (text: string) => void; context: PublicContext | null; onClose: () => void; initialRegion?:string;
  onResult?: (result: PolicyExperimentResult | null)=>void;
}) {
  const [analysis,setAnalysis] = useState<PolicyAnalysis | null>(null);
  const [result,setResult] = useState<PolicyExperimentResult | null>(null);
  const [file,setFile] = useState<{name:string;base64:string}|null>(null);
  const [source,setSource] = useState("");
  const [engine,setEngine] = useState<"auto"|"rules"|"gemini">("auto");
  const [selected,setSelected] = useState("");
  const [regions,setRegions] = useState<string[]>(initialRegion?[initialRegion]:[]);
  const [households,setHouseholds] = useState(()=>experimentHouseholds.map(h=>({...h})));
  const [effective,setEffective] = useState("");
  const [date,setDate] = useState(today);
  const [proposed,setProposed] = useState(false);
  const [hypothetical,setHypothetical] = useState(false);
  const [reviewed,setReviewed] = useState(false);
  const [elasticity,setElasticity] = useState("");
  const [rate,setRate] = useState(4);
  const [years,setYears] = useState(30);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [supplyInputs,setSupplyInputs] = useState<SupplyAssumption[]>([]);
  const [supplyConfirmed,setSupplyConfirmed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=>{ if(root.current?.closest("dialog")?.open)root.current.scrollIntoView({block:"start"}); },[analysis,result]);
  const candidate = analysis?.candidates.find(c=>c.id===selected);
  const regionOptions = context?.boundaries.map(b=>({code:experimentRegionCode(b),name:experimentRegionName(b)})) ?? [];
  const purchase = candidate && ["mortgage_cap","ltv","dsr"].includes(candidate.kind);
  const supply = candidate && ["units","area_share"].includes(candidate.kind);
  const financial = candidate && ["mortgage_cap","guarantee_cap","ltv","dsr"].includes(candidate.kind);
  const supplyReady = !supply || (supplyConfirmed && regions.every(code=>supplyInputs.some(s=>s.region_code===code&&s.housing_stock>0&&s.units_per_project>0)));

  async function extract() {
    controller.current?.abort(); const abort = new AbortController(); controller.current=abort;
    setBusy(true);setError("");setResult(null);
    try {
      const data = await analyzePolicy({...(file?{file_base64:file.base64}:{content_text:draft}),filename:file?.name??"pasted-text.txt",source_url:source.trim()||null,engine},abort.signal);
      if(abort.signal.aborted)return;
      setAnalysis(data);setDraft(data.content_text);setFile(null);setSelected(data.candidates.find(c=>["mortgage_cap","guarantee_cap","ltv","dsr"].includes(c.kind))?.id??data.candidates[0]?.id??"");setReviewed(false);
    } catch(e) { if(!abort.signal.aborted)setError(e instanceof Error?e.message:"추출에 실패했습니다."); }
    finally { if(!abort.signal.aborted)setBusy(false); }
  }
  async function simulate() {
    if(!analysis||!candidate||!reviewed)return;
    controller.current?.abort();const abort=new AbortController();controller.current=abort;
    setBusy(true);setError("");
    try {
      const data = await runPolicyExperiment({content_text:analysis.content_text,source_url:analysis.source_url,candidate,reviewed:true,region_codes:regions,households,effective_from:effective||null,simulation_date:date,proposed,hypothetical,annual_rate_percent:rate,loan_years:years,price_elasticity:purchase&&elasticity.trim()!==""?Number(elasticity):null,supply_assumptions:supply?supplyInputs.filter(s=>regions.includes(s.region_code)):[]},abort.signal);
      if(abort.signal.aborted)return;
      setResult(data);onResult?.(data);
    } catch(e) {if(!abort.signal.aborted)setError(e instanceof Error?e.message:"계산에 실패했습니다.");}
    finally {if(!abort.signal.aborted)setBusy(false);}
  }

  function startNew() {
    if((draft||analysis||result)&&!window.confirm("현재 입력과 결과를 비우고 새 문서를 시작할까요? 필요한 결과는 JSON으로 먼저 저장하세요."))return;
    controller.current?.abort();setBusy(false);setError("");setAnalysis(null);setResult(null);onResult?.(null);
    setDraft("");setFile(null);setSource("");setSelected("");setEffective("");setProposed(false);setHypothetical(false);
    setReviewed(false);setSupplyConfirmed(false);setSupplyInputs([]);setElasticity("");
    setHouseholds(experimentHouseholds.map(h=>({...h})));setRegions(initialRegion?[initialRegion]:[]);
  }
  const step=result?3:analysis?2:1;
  const missing=[
    ...(!regions.length?["적용 지역 선택"]:[]),
    ...(!hypothetical&&(!effective||proposed)?["시행일 확인 또는 가정 실험 선택"]:[]),
    ...(supply&&!supplyReady?["공급 조건 확인"]:[]),
    ...(!reviewed?["최종 입력 확인"]:[]),
  ];
  return <div className="policy-workflow" ref={root}>
    <ol className="workflow-progress" aria-label="정책 실험 진행 단계">{["정책 문서","규칙과 조건 검토","지도와 영향 비교"].map((label,index)=><li key={label} aria-current={step===index+1?"step":undefined} className={step>=index+1?"reached":""}><span>{index+1}</span>{label}</li>)}</ol>
    <div className="workflow-session"><span>창을 닫아도 새로고침 전까지 입력과 결과가 유지됩니다.</span><button type="button" className="text-button" disabled={busy} onClick={startNew}>새 문서로 시작</button></div>
    <div className="section-heading"><div><p className="eyebrow">문서 입력 / 규칙 검토 / 조건부 실험</p><h2 id="policy-workflow-title">{result?"새 정책 시뮬레이션":analysis?"추출한 변경 규칙을 확인하세요":"바뀐 정책을 가져오세요"}</h2></div><button aria-label="정책 입력 닫기" onClick={onClose}>×</button></div>
    {!result&&<p className="muted">정책 원문의 변경 전후 값을 추출하고, 적용 조건을 확인해 지역별 영향을 비교합니다.</p>}
    {error&&<p className="error-banner" role="alert">{error}</p>}
    {busy&&<p role="status">{analysis?"입력한 조건으로 계산하고 있습니다.":"본문을 읽고 변경 전후 수치를 추출하고 있습니다."}</p>}
    {!analysis&&<fieldset disabled={busy} className="workflow-input">
      <PolicyExamples onLoad={example=>{setDraft(appendPolicyExample(draft,example));setFile(null);setSource(draft.trim()?"":example.source_url);setEffective(draft.trim()?"":example.effective_from??"");setProposed(draft.trim()||example.legal_status==="PROPOSED"?true:false);}}/>
      <label>공식 원문 URL (선택)<input type="url" value={source} onChange={e=>setSource(e.target.value)} placeholder="https://..."/></label>
      <label>파일 선택 (2MB, PDF 60쪽 이하)<input type="file" accept=".txt,.md,.pdf,.hwpx,.hwp" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;setError("");if(f.size>2_000_000){setError("2MB 이하 파일을 선택해 주세요.");return;}if(/\.hwp$/i.test(f.name)){setError("구형 HWP는 HWPX, PDF 또는 텍스트로 변환해 주세요.");return;}setBusy(true);try{const raw=await f.arrayBuffer();const bytes=new Uint8Array(raw);let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));setFile({name:f.name,base64:btoa(binary)});setEffective("");setProposed(false);}catch{setError("파일을 읽지 못했습니다.");}finally{setBusy(false);}}}/></label>
      {file&&<p role="status">{file.name}을 읽을 준비가 되었습니다. <button onClick={()=>setFile(null)}>파일 선택 취소</button></p>}
      <label>정책 본문 또는 검토 요약<textarea id="policy-draft" value={draft} disabled={!!file} onChange={e=>{setDraft(e.target.value);setEffective("");setReviewed(false);}} rows={7} placeholder="예: 수도권 주택담보대출 한도를 6억 원에서 4억 원으로 변경한다. 시행일과 예외도 함께 입력하세요."/></label>
      <label>추출 방식<select value={engine} onChange={e=>setEngine(e.target.value as typeof engine)}><option value="auto">자동 (Gemini 설정 시 사용)</option><option value="rules">규칙 기반 (명시된 수치 변경만)</option><option value="gemini">Gemini</option></select></label>
      <p className="muted">Gemini를 사용하면 입력 본문이 Google API로 전송됩니다. 비공개 자료와 개인정보를 입력하지 마세요. 스캔 PDF는 OCR이 필요합니다.</p>
      <button className="primary" disabled={busy||(!file&&!draft.trim())} onClick={()=>void extract()}>자동 조문 추출</button>
    </fieldset>}
    {analysis&&!result&&<>
      <div className="workflow-meta"><span className="badge plain">{analysis.engine==="GEMINI"?"Gemini 추출":"규칙 기반 추출"}</span><span>{analysis.candidates.length}개 수치 변경 후보</span><details><summary>문서 해시와 추출 범위</summary><code>SHA-256 {analysis.document_hash}</code><p>{analysis.filename} / {analysis.extracted_at}</p><ul>{analysis.warnings.map(w=><li key={w}>{w}</li>)}</ul></details></div>
      {!analysis.candidates.length?<p role="status">지원하는 변경 전후 수치 쌍을 찾지 못했습니다. 원문을 보완하거나 Gemini 방식으로 다시 추출해 주세요.</p>:<fieldset disabled={busy} className="workflow-review">
        <label>이번 실험에 적용할 규칙 (한 번에 하나)<select value={selected} onChange={e=>{setSelected(e.target.value);setReviewed(false);setElasticity("");setSupplyConfirmed(false);}}>{analysis.candidates.map(c=><option key={c.id} value={c.id}>{c.label}: {c.before.toLocaleString()} → {c.after.toLocaleString()} {c.unit}</option>)}</select></label>
        {candidate&&<article className="workflow-candidate"><h3>{candidate.label}</h3><p>{candidate.before.toLocaleString()} → {candidate.after.toLocaleString()} {candidate.unit}</p><blockquote>{candidate.quote}</blockquote><small>입력 본문 문자 위치 {candidate.start}~{candidate.end}. 원문의 부등호와 예외를 함께 확인해 주세요.</small>{analysis.source_url&&<p><a href={analysis.source_url} target="_blank" rel="noreferrer">입력 자료 원문 확인 ↗</a></p>}</article>}
        <div className="workflow-fields"><label>시행일 (원문 확인 후 입력)<input type="date" value={effective} onChange={e=>{setEffective(e.target.value);setReviewed(false);}}/></label><label>실험 기준일<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label></div>
        <label className="workflow-check"><input type="checkbox" checked={proposed} onChange={e=>{setProposed(e.target.checked);setReviewed(false);}}/>입법예고 또는 미확정 정책입니다.</label>
        <label className="workflow-check"><input type="checkbox" checked={hypothetical} onChange={e=>{setHypothetical(e.target.checked);setReviewed(false);}}/>시행일과 무관하게 적용되었다고 가정하여 실험합니다.</label>
        <details open><summary>적용 지역을 직접 확인하세요 ({regions.length}개 선택)</summary><p className="muted">원문에 명시된 적용 지역을 선택하세요. 지도는 통계청 SGIS 2018 경계를 사용합니다.</p><RegionPicker options={regionOptions} selected={regions} onChange={codes=>{setRegions(codes);setReviewed(false);setSupplyConfirmed(false);}}/></details>
        {supply&&<SupplyScenarioEditor kind={candidate!.kind} regions={regionOptions.filter(r=>regions.includes(r.code))} values={supplyInputs} onChange={v=>{setSupplyInputs(v);setReviewed(false);}} confirmed={supplyConfirmed} onConfirm={setSupplyConfirmed}/>}
        {financial&&<details open><summary>가구 프로필과 적용 대상을 설정하세요</summary><p>비교용으로 설정한 프로필입니다. 적용할 가구를 체크하고 실험에 맞게 금액을 수정하세요.</p><div className="workflow-household-actions"><button type="button" onClick={()=>{setHouseholds(prev=>prev.map(h=>({...h,eligible:true})));setReviewed(false);}}>모든 가구를 적용 대상으로 가정</button><button type="button" onClick={()=>{setHouseholds(prev=>prev.map(h=>({...h,eligible:false})));setReviewed(false);}}>가구 적용 해제</button><span>{households.filter(h=>h.eligible).length} / {households.length}가구 적용</span></div>{!households.some(h=>h.eligible)&&<p className="workflow-hint" role="status">적용 대상으로 선택된 가구가 없어 기존 조건을 비교합니다. 영향을 비교하려면 대상 가구를 선택하세요.</p>}{households.map((h,index)=><div className="workflow-household" key={h.id}><label className="workflow-check"><input type="checkbox" checked={h.eligible} onChange={e=>{setHouseholds(prev=>prev.map((v,i)=>i===index?{...v,eligible:e.target.checked}:v));setReviewed(false);}}/>{h.label}에 적용</label><div className="workflow-fields">{([['cash_krw','가용 현금'],['financing_need_krw','자금 수요'],['property_price_krw','주택가격'],['annual_income_krw','연소득'],['other_annual_payment_krw','기타 연간 상환액']] as const).map(([key,label])=><label key={key}>{label} (만원)<input type="number" min={0} value={h[key]/10000} onChange={e=>{setHouseholds(prev=>prev.map((v,i)=>i===index?{...v,[key]:Number(e.target.value)*10000}:v));setReviewed(false);}}/></label>)}</div></div>)}</details>}
        <div className="workflow-fields">{candidate?.kind==="dsr"&&<><label>상환 금리 (%)<input type="number" min="0" max="30" step="0.1" value={rate} onChange={e=>setRate(Number(e.target.value))}/></label><label>원리금균등 상환 기간 (년)<input type="number" min="1" max="50" value={years} onChange={e=>setYears(Number(e.target.value))}/></label></>}{purchase&&<label>가격 민감도 계수 (선택, -1~1)<input type="number" min="-1" max="1" step="0.01" value={elasticity} onChange={e=>setElasticity(e.target.value)} placeholder="빈칸이면 구매 예산 변화 비교"/><small>평균 예산 변화율에 곱할 시나리오 계수입니다. 예: 0.1이면 예산 10% 변화당 가격 민감도 1%로 비교합니다.</small></label>}</div>
        <label className="workflow-check"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>선택한 규칙, 시행 조건과 적용 대상, 입력값을 확인했습니다.</label>
        <div className="workflow-run"><p role="status">{missing.length?`실행 전 확인: ${missing.join(" / ")}`:`${regions.length}개 지역의 입력 조건을 계산할 준비가 되었습니다.`}</p><button className="primary" disabled={!reviewed||!supplyReady||!regions.length||!date||(!hypothetical&&(!effective||proposed))} onClick={()=>void simulate()}>새 정책 시뮬레이션 실행</button></div>
      </fieldset>}
      <button disabled={busy} onClick={()=>{setAnalysis(null);setReviewed(false);}}>입력으로 돌아가기</button>
    </>}
    {result&&<PolicyExperimentView result={result} context={context} onEdit={()=>{setResult(null);onResult?.(null);setReviewed(false);}}/>}
  </div>;
}
