import { useEffect, useRef, useState } from "react";
import { fetchClaims, fetchDemoScenario, fetchGraph, fetchPolicySnapshot, fetchPublicContext, fetchScenarioSimulation } from "./api";
import { formatClaimEffect, formatKrwEok, formatPercent, formatRange, formatPurchasingPower } from "./format";
import { ImpactMap, metricRange, cohortRegions } from "./ImpactMap";
import { ObservedPanel } from "./ObservedPanel";
import { KnowledgeGraph } from "./KnowledgeGraph";
import { PolicyWorkflow } from "./PolicyWorkflow";
import { PolicyFactors } from "./PolicyFactors";
import { GlossaryDialog, GlossaryText, TermHints } from "./GlossaryHelp";
import type { Claim, CohortResult, GraphResponse, HorizonMonths, MetricKey, PolicyRule, PolicySnapshot, PublicContext, ScenarioResult } from "./types";

interface Dashboard { snapshot: PolicySnapshot; scenario: ScenarioResult; claims: Claim[]; graph: GraphResponse }
const horizons: HorizonMonths[] = [0, 3, 6, 12];
const metrics: { key: MetricKey; label: string }[] = [{ key:"price_change", label:"매매가격" }, { key:"transaction_change", label:"거래량" }, { key:"mortgage_limit_change", label:"대출가능액" }];
const names: Record<string,string> = { demo_rule_mortgage_cap:"주택담보대출 한도", demo_rule_land_permit:"토지거래허가와 실거주", demo_rule_stress_dsr_phase3:"스트레스 DSR", demo_rule_one_home_disposal_deadline:"기존 주택 처분 기한", demo_rule_policy_loan_exception:"실수요자 예외" };
const stages: Record<string,string> = { policy_rule:"정책 변경", mechanism:"구매력 변화", household_behavior:"가구의 선택", demand_shift:"수요의 이동", regional_outcome:"지역별 영향" };
const changes: Record<string,string> = { new:"신설", tightened:"강화", loosened:"완화", extended:"연장", expired:"종료", superseded:"대체", corrected:"정정", unchanged:"유지" };
const safeSource = (url: string) => /^https?:\/\//.test(url) && !url.includes("example.invalid");

function RuleCard({ rule, checked, disabled, onToggle }: { rule: PolicyRule; checked: boolean; disabled: boolean; onToggle: () => void }) {
  return <article className={`rule-card ${checked ? "enabled" : ""}`}>
    <div className="rule-top"><div className="rule-title"><label><input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} /><strong>{names[rule.rule_id] ?? rule.title}</strong></label><TermHints text={names[rule.rule_id] ?? rule.title}/></div><span className="badge plain">{changes[rule.change_type] ?? rule.change_type}</span></div>
    <div className="rule-diff"><div><span>변경 전</span><p><GlossaryText text={rule.previous_summary ?? "기존 규정 미확보"}/></p></div><div><span>변경 후</span><p><GlossaryText text={rule.proposed_summary ?? "변경 내용 미확보"}/></p></div></div>
    <details className="rule-detail"><summary>시행 {rule.effective_from ?? "미확인"} <span>대상과 예외 확인</span></summary><h3><GlossaryText text={rule.title}/></h3><p><b>발표일</b> {rule.announced_at ?? "미확인"} / <b>종료일</b> {rule.effective_to ?? "미정"}</p><p><b>적용 지역</b> {rule.applies_to.region_names?.join(", ") ?? rule.applies_to.region_codes.join(", ")}</p><p><b>대상 가구</b> {rule.applies_to.household_cohorts.join(", ")}</p><ul>{rule.exceptions.map(item => <li key={item}><GlossaryText text={item}/></li>)}</ul><p><GlossaryText text={rule.source.excerpt}/></p><p className="muted">{rule.source.authority} / {rule.source.locator}</p>{rule.relations?.map(rel => <p key={rel.target_rule_id}><GlossaryText text={rel.note}/></p>)}{safeSource(rule.source.url) ? <a href={rule.source.url} target="_blank" rel="noreferrer">원문 확인</a> : <p className="warning-copy">원문이 연결되지 않은 합성 규칙입니다. 법령 해석에 사용하지 마세요.</p>}</details>
  </article>;
}

function CohortCard({ cohort, selected, linked, onSelect }: { cohort: CohortResult; selected: boolean; linked: boolean; onSelect: () => void }) {
  const p = cohort.action_probabilities_after;
  return <article className={`household ${selected ? "active" : ""}`}>
    <button className="household-select" onClick={onSelect} aria-expanded={selected}><span className="household-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0114 0v3"/></svg></span><span><strong>{cohort.label.replace(/\s*\(합성.*\)/, "")}</strong><small>{linked ? "선택 지역과 관련된 가구" : "다른 가구와 비교하기"}</small></span><span className="chevron">{selected ? "−" : "+"}</span></button>
    {cohort.label.includes("DSR")&&<div className="household-terms"><GlossaryText text="DSR"/>의 의미를 확인하세요.</div>}
    {selected && <div className="household-body"><p className="muted"><GlossaryText text={cohort.assumptions}/></p><div className="budget-comparison"><span>매수 예산</span><div><span>{formatPurchasingPower(cohort.purchasing_power_before)}</span><span aria-label="변경 후">→</span><strong>{formatPurchasingPower(cohort.purchasing_power_after)}</strong></div></div><div className="loan-line"><span>최대 대출</span><b>{formatKrwEok(cohort.max_loan_before_krw)} → {formatKrwEok(cohort.max_loan_after_krw)}</b></div>
      {p && <div className="behavior"><p>정책 이후 행동 비중 <span>합성 가정</span></p><div className="behavior-bar" aria-label={`매수 ${formatPercent(p.buy)}, 매도 ${formatPercent(p.sell)}, 임대 ${formatPercent(p.lease)}, 증여 ${formatPercent(p.gift)}, 관망 ${formatPercent(p.wait)}`}><i style={{width:formatPercent(p.buy)}}/><i style={{width:formatPercent(p.sell)}}/><i style={{width:formatPercent(p.lease)}}/><i style={{width:formatPercent(p.gift)}}/><i style={{width:formatPercent(p.wait)}}/></div><div className="behavior-legend"><span>매수 {formatPercent(p.buy)}</span><span>매도 {formatPercent(p.sell)}</span><span>임대 {formatPercent(p.lease)}</span><span>증여 {formatPercent(p.gift)}</span><span>관망 {formatPercent(p.wait)}</span></div></div>}
      <p className="cohort-response"><GlossaryText text={cohort.response}/></p><div className="region-tags">{cohort.selectable_regions_after?.map(name => <span key={name}>{name}</span>)}</div>
    </div>}
  </article>;
}

export default function Workbench() {
  const [page,setPage] = useState<"simulation" | "graph">("simulation");
  const [data,setData] = useState<Dashboard | null>(null);
  const [context,setContext] = useState<PublicContext | null>(null);
  const [contextError,setContextError] = useState(false);
  const [error,setError] = useState<string | null>(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [horizon,setHorizon] = useState<HorizonMonths>(6);
  const [rules,setRules] = useState<string[]>([]);
  const [regionCode,setRegionCode] = useState("11680");
  const [cohortId,setCohortId] = useState("demo_cohort_one_home_mover");
  const [metric,setMetric] = useState<MetricKey>("price_change");
  const [showAll,setShowAll] = useState(false);
  const [view,setView] = useState<"map" | "table">("map");
  const [evidence,setEvidence] = useState<"linked" | "conflicts" | "all">("linked");
  const [nodeId,setNodeId] = useState<string | null>(null);
  const [inputOpen,setInputOpen] = useState(false);
  const [draft,setDraft] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef(0);
  const loadId = useRef(0);

  async function load() {
    const id = ++loadId.current;
    setLoading(true); setError(null); setContextError(false);
    const publicPromise = fetchPublicContext().then(result => { if (id === loadId.current) setContext(result); }).catch(() => { if (id === loadId.current) setContextError(true); });
    try {
      const [snapshot,scenario,claims,graph] = await Promise.all([fetchPolicySnapshot(), fetchDemoScenario(), fetchClaims(), fetchGraph()]);
      if (id !== loadId.current) return;
      setData({snapshot,scenario,claims,graph}); setRules(snapshot.rules.map(r => r.rule_id));
    } catch (reason) { if (id === loadId.current) setError(reason instanceof Error ? reason.message : "데이터를 불러오지 못했습니다."); }
    finally { if (id === loadId.current) setLoading(false); }
    await publicPromise;
  }
  useEffect(() => { void load(); return () => { loadId.current++; requestId.current++; }; }, []);
  useEffect(() => { if (inputOpen) dialog.current?.showModal(); else dialog.current?.close(); }, [inputOpen]);

  async function simulate(nextHorizon: HorizonMonths, nextRules: string[]) {
    if (!data || !nextRules.length) return;
    const id = ++requestId.current;
    setBusy(true); setError(null);
    try {
      const scenario = await fetchScenarioSimulation({ baselineDate:data.snapshot.as_of, regionCode:data.snapshot.region.code, horizonMonths:nextHorizon, changeIds:nextRules });
      if (id !== requestId.current) return;
      // Commit controls and result together. A failed request leaves the previous scenario intact.
      setData(previous => previous ? {...previous,scenario} : previous); setHorizon(nextHorizon); setRules(nextRules);
    } catch (reason) { if (id === requestId.current) setError(reason instanceof Error ? reason.message : "재계산에 실패했습니다. 이전 결과를 유지합니다."); }
    finally { if (id === requestId.current) setBusy(false); }
  }

  function selectRegion(code: string) {
    setRegionCode(code); setNodeId(null);
    const region = data?.scenario.regions.find(r => r.region_code === code);
    if (region?.related_cohort_ids?.length && !region.related_cohort_ids.includes(cohortId)) setCohortId(region.related_cohort_ids[0]);
  }
  function selectCohort(cohort: CohortResult) {
    setCohortId(cohort.cohort_id);
    const selectedCodes = cohortRegions(cohort, data?.scenario.regions ?? []);
    if (![...selectedCodes.before, ...selectedCodes.after].includes(regionCode)) {
      const target = selectedCodes.before[0];
      if (target) { setRegionCode(target); setNodeId(null); }
    }
  }

  if (!data) return <main className="load-state"><div className="brand-mark">P</div><h1>{loading ? "정책과 지역을 연결하고 있어요" : "자료를 불러오지 못했습니다"}</h1><p>{error ?? "정책 비교, 가구 반응, 공식 관측 자료를 준비합니다."}</p>{!loading && <button className="primary" onClick={() => void load()}>다시 불러오기</button>}</main>;
  const {snapshot,scenario,claims,graph} = data;
  const region = scenario.regions.find(r => r.region_code === regionCode) ?? scenario.regions[0];
  const cohort = scenario.cohorts.find(c => c.cohort_id === cohortId) ?? null;
  const sortedRules = [...snapshot.rules].sort((a,b) => (a.impact_priority ?? 99) - (b.impact_priority ?? 99));
  const chain = scenario.structured_causal_chains?.[region.region_code] ?? [];
  const node = chain.find(n => n.node_id === nodeId);
  const linkedIds = new Set(node?.claim_ids ?? region.supporting_claim_ids ?? []);
  claims.filter(c => linkedIds.has(c.claim_id)).forEach(c => c.related_claims?.forEach(rel => linkedIds.add(rel.claim_id)));
  const realClaims = claims.filter(c => c.source.source_type !== "synthetic");
  const shownClaims = realClaims.filter(c => evidence === "all" || (evidence === "conflicts" ? c.related_claims?.some(rel => rel.relation === "CONFLICTS_WITH") : linkedIds.has(c.claim_id)));
  const research = realClaims.filter(c => ["CL-KDI23-LTP-VOLUME-DIRECT","CL-KDI23-LTP-PRICE-DIRECT","CL-KDI23-LTP-PRICE-SPILLOVER"].includes(c.claim_id));
  const range = metricRange(region,metric);
  return <div className="app-shell">
    <a href="#workspace" className="skip-link">분석 화면으로 이동</a>
    <header className="app-nav"><a className="brand" href="#top" onClick={()=>setPage("simulation")}><span className="brand-mark" aria-hidden="true">P</span>PolicyMap<span className="brand-caption">정책을 바꾸기 전에</span></a><nav aria-label="주요 메뉴"><button className={page==="simulation"?"current":""} aria-pressed={page==="simulation"} onClick={()=>setPage("simulation")}>정책 시뮬레이션</button><button className={page==="graph"?"current":""} aria-pressed={page==="graph"} onClick={()=>setPage("graph")}>지식 그래프</button><GlossaryDialog/><a href="#observations" onClick={()=>setPage("simulation")}>실거래 자료</a><a href="#evidence" onClick={()=>setPage("simulation")}>연구 근거</a></nav><span className="badge plain">연구용 프로토타입</span></header>
    {page==="graph"&&<main className="workspace"><KnowledgeGraph source={graph} snapshot={snapshot} claims={claims} regionCode={region.region_code}/></main>}
    <main id="top" className="workspace" hidden={page!=="simulation"}>
      <section className="page-intro"><div><p className="eyebrow">정책 사전 영향평가</p><h1>하나의 정책, 서로 다른 우리 동네.</h1><p>규제를 바꾸면 어디에, 누구에게 영향이 이어질까요?</p></div><button className="primary" onClick={() => setInputOpen(true)}><span aria-hidden="true">＋</span> 정책 문서 검토</button></section>
      <div className="scenario-context"><div><span className="badge plain">2025.06 역사적 사례</span><strong>수도권 대출 규제와 토지거래허가 조합</strong><span className="muted">기준일 {snapshot.as_of}</span></div><details><summary>데이터 상태 확인</summary><p>정책은 합성 규칙 {snapshot.rules.length}건이며 전체 정책을 망라하지 않습니다. 화면의 가격과 가구 행동은 {scenario.model_version} 모형의 합성 예시입니다.</p><p>세금, 공급, 임대차 등의 정책 연결이 미완료되어 실제 전망은 제공하지 않습니다. 기존 완전성 백분율도 검증된 지표가 아니므로 표시하지 않습니다.</p><code>{scenario.data_status} / {scenario.model_status}</code></details></div>
      <PolicyFactors snapshot={snapshot} cohorts={scenario.cohorts} cohort={cohort} selectedRules={rules} regionCode={region.region_code} regionName={region.region_name} onCohortChange={selectCohort} busy={busy}/>
      <section className="policy-section" aria-labelledby="policy-title"><div className="section-heading compact"><h2 id="policy-title">무엇이 바뀌나요?</h2><div><span className="muted">{rules.length}개 규칙 선택 / 원문 대조 전</span><button className="text-button" onClick={() => setShowAll(!showAll)}>{showAll ? "핵심 3개만" : `전체 ${snapshot.rules.length}개 보기`}</button></div></div><div className="glossary-quick"><strong>자주 쓰는 용어</strong>{["LTV","DSR","DTI","가산금리"].map(term=><span key={term}><GlossaryText text={term}/></span>)}</div><div className="policy-grid">{(showAll ? sortedRules : sortedRules.slice(0,3)).map(rule => <RuleCard key={rule.rule_id} rule={rule} checked={rules.includes(rule.rule_id)} disabled={busy || (rules.length === 1 && rules.includes(rule.rule_id))} onToggle={() => void simulate(horizon,rules.includes(rule.rule_id) ? rules.filter(id => id !== rule.rule_id) : [...rules,rule.rule_id])} />)}</div></section>
      <div className="simulation-notice" role="note"><span className="badge warning">합성 시뮬레이션</span><p>가격 변화와 가구 반응은 검증 전 가정입니다. <strong>실제 실거래 자료는 아래에서 별도로 확인할 수 있습니다.</strong></p><a href="#observations">관측 자료 보기</a></div>
      {error && <div className="error-banner" role="alert">{error} 이전 시나리오를 유지합니다.<button onClick={() => setError(null)}>닫기</button></div>}
      <section id="workspace" className="analysis-layout" aria-busy={busy}>
        <div className="map-panel panel"><div className="section-heading"><div><p className="eyebrow">어디로 영향이 이어질까요?</p><h2>수도권 영향 지도</h2></div><div className="segments" aria-label="시뮬레이션 시점">{horizons.map(value => <button key={value} disabled={busy} aria-pressed={horizon === value} onClick={() => void simulate(value,rules)}>{value === 0 ? "발표 직후" : `${value}개월`}</button>)}</div></div><div className="map-toolbar"><div className="metric-tabs" aria-label="지도 지표">{metrics.map(m => <button key={m.key} aria-pressed={metric === m.key} onClick={() => setMetric(m.key)}>{m.label}</button>)}</div><button className="text-button" onClick={() => setView(view === "map" ? "table" : "map")}>{view === "map" ? "표로 보기" : "지도 보기"}</button></div>
          {view === "map" ? <ImpactMap context={context} regions={scenario.regions} selected={region.region_code} metric={metric} cohort={cohort} onSelect={selectRegion} /> : <div className="table-scroll region-table"><table><thead><tr><th>지역</th><th>효과 가정</th><th>{metrics.find(m => m.key === metric)?.label} 변화 범위</th></tr></thead><tbody>{scenario.regions.map(r => <tr key={r.region_code} className={r.region_code === region.region_code ? "selected-row" : ""}><th><button onClick={() => selectRegion(r.region_code)}>{r.region_name}</button></th><td>{r.effect_type === "direct" ? "직접" : r.effect_type === "spillover" ? "전이" : "기준"}</td><td>{metricRange(r,metric) ? formatRange(metricRange(r,metric)!) : "미확보"}</td></tr>)}</tbody></table></div>}
          <div className="region-selector"><label htmlFor="region-select">선택 지역</label><select id="region-select" value={region.region_code} onChange={e => selectRegion(e.target.value)}>{scenario.regions.map(r => <option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}</select><span className="muted">{busy ? "다시 계산하고 있어요…" : `${horizon === 0 ? "발표 직후" : `${horizon}개월 후`} / 합성 범위`}</span></div>
          <div className="region-spotlight"><div><span className="badge plain">{region.effect_type === "direct" ? "직접 영향 가정" : "수요 전이 가정"}</span><h3>{region.region_name}</h3><p><GlossaryText text={region.primary_mechanism}/></p></div><div className="spotlight-number"><span>{metrics.find(m => m.key === metric)?.label} 변화</span><strong>{range ? formatRange(range) : "미확보"}</strong><small>합성 기준 대비 / 통계적 신뢰구간 아님</small></div></div>
          <p className="technical-status">{scenario.data_status} / {scenario.model_status} / {snapshot.as_of} 기준</p>
        </div>
        <aside className="household-panel panel"><div className="section-heading"><div><p className="eyebrow">누구의 선택이 달라질까요?</p><h2>가구별 영향</h2></div><span className="badge plain">JEV 가구 유형</span></div><p className="section-description">가구를 선택하면 지도에 기존 선택지와 새 선택지의 관계를 표시합니다.</p><div className="household-list">{scenario.cohorts.map(c => <CohortCard key={c.cohort_id} cohort={c} selected={cohort?.cohort_id === c.cohort_id} linked={region.related_cohort_ids?.includes(c.cohort_id) ?? false} onSelect={() => selectCohort(c)} />)}</div><div className="household-note">가구 예산과 행동 비중은 고정된 합성 예시이며 정책 선택에 따라 재계산되지 않습니다. 실측 조사나 검증된 에이전트의 예측이 아닙니다.</div><p className="technical-status">{scenario.model_status} / 동일 시나리오</p></aside>
      </section>
      <section className="causal-panel panel"><div className="section-heading"><div><p className="eyebrow">숫자보다 중요한, 변화의 이유</p><h2>{region.region_name}에 영향을 주는 경로</h2></div><span className="muted">지식그래프 {graph.nodes.length}개 노드 연결</span></div><div className="causal-chain">{chain.map((n,index) => <button key={n.node_id} className={nodeId === n.node_id ? "active" : ""} aria-pressed={nodeId === n.node_id} onClick={() => {setNodeId(nodeId === n.node_id ? null : n.node_id);setEvidence("linked");}}><span className="stage-index">0{index+1} <span>{stages[n.stage]}</span></span><strong>{n.label}</strong><small>{n.is_uncertain ? "불확실한 연결" : "데모에 정의된 연결"}</small></button>)}</div>{node && <div className="node-detail"><strong><GlossaryText text={node.label}/></strong><p><GlossaryText text={node.detail}/></p><p className="muted">참조 필드: {node.data_fields?.join(", ") ?? "없음"}. 아래 연구 근거가 선택한 단계에 맞춰 필터링됩니다.</p></div>}<p className="muted footnote">연결은 설명 가설입니다. 정책을 제외해도 일부 기본 경로는 남는 데모 모형이므로 인과적 검증 결과로 해석하지 마세요.</p></section>
      {context ? <ObservedPanel context={context} regionCode={region.region_code} regionName={region.region_name} /> : <section className="panel" id="observations"><h2>실제 관측 자료</h2><p>{contextError ? "공공데이터를 불러오지 못했습니다. 합성 자료로 대체하지 않습니다." : "공공데이터를 불러오는 중입니다."}</p>{contextError && <button onClick={() => {setContextError(false);void fetchPublicContext().then(setContext).catch(() => setContextError(true));}}>관측 자료 다시 불러오기</button>}</section>}
      <section className="evidence-panel panel" id="evidence"><div className="section-heading"><div><p className="eyebrow">과거에는 어떤 일이 있었을까요?</p><h2>연구에서 확인한 정책의 두 얼굴</h2></div><a href="https://www.kdi.re.kr/research/reportView?pub_no=18385" target="_blank" rel="noreferrer">KDI 원문 확인 ↗</a></div><p className="section-description">KDI 「주택시장과 규제」(2023)의 2020년 잠실, 삼성, 대치, 청담 사례입니다. 현재 지도에 표시한 예측값이 아닙니다.</p><div className="research-stats">{research.map(c => <div key={c.claim_id}><span>{c.claim_id.endsWith("SPILLOVER") ? "인접 비규제 주택 가격" : c.outcome_metric === "transaction_volume" ? "지정 지역 거래량" : "지정 지역 가격"}</span><strong className={c.effect_direction === "increase" ? "up" : "down"}>{formatClaimEffect(c)}</strong><small>{c.claim_id.endsWith("SPILLOVER") ? "원거리 비규제 주택 대비" : "비규제 주택과 비교한 연구 추정치"}</small></div>)}</div><p className="research-caution">지역, 기간과 규제 방식이 다른 연구의 효과를 새 정책에 그대로 적용할 수 없습니다. 원문 요약의 수치는 확인했으며, 회귀표와 표준오차 검증은 별도로 필요합니다.</p>
        <div className="evidence-controls"><h3>연결 근거 더 살펴보기</h3><div className="segments" aria-label="연구 근거 필터">{(["linked","conflicts","all"] as const).map(mode => <button key={mode} aria-pressed={evidence === mode} onClick={() => setEvidence(mode)}>{mode === "linked" ? "선택 경로" : mode === "conflicts" ? "상충 연구" : "전체 연구"}</button>)}</div></div><div className="evidence-list">{shownClaims.length ? shownClaims.map(c => <details key={c.claim_id} className="evidence-row"><summary><span><small>{c.source.publisher} / {c.source.published_at}</small><strong>{c.title}</strong></span><span>{c.effect_value === null ? "정성 근거" : formatClaimEffect(c)}</span></summary><div className="evidence-body"><p><GlossaryText text={c.title}/></p><p>방법: {c.method} / 표본: {c.sample_period.start} ~ {c.sample_period.end} / 대상 지역: {c.target_region}</p><p>원문 확인 상태: {c.source.review_status ?? "미확인"}. 다른 시기의 정책과 직접 대응한다고 보장하지 않습니다.</p>{c.related_claims?.filter(rel => rel.relation === "CONFLICTS_WITH").map(rel => <p className="conflict-note" key={rel.claim_id}>상충 근거: {rel.reason} ({rel.claim_id})</p>)}<ul>{c.limitations.map(l => <li key={l}><GlossaryText text={l}/></li>)}</ul><a href={c.source.url} target="_blank" rel="noreferrer">{c.source.title} 원문 보기</a></div></details>) : <p className="empty-state">선택한 경로에 연결된 연구가 없습니다. 전체 연구에서 확인해 주세요.</p>}</div>
      </section>
      <details className="limitations panel"><summary>시뮬레이션의 전제와 아직 해결하지 못한 부분</summary><ul>{scenario.limitations.map(l => <li key={l}><GlossaryText text={l}/></li>)}</ul><p>GTX와 지하철은 개통 단계와 기준 시점이 확인된 자료를 연결한 뒤 추가합니다. 현재 지도에는 교통 호재나 이동시간을 가정해서 넣지 않았습니다.</p><code>scenario_id: {scenario.scenario_id}</code></details>
      <footer className="app-footer"><strong>PolicyMap</strong><span>정책의 의도와 생활의 변화를 함께 봅니다.</span><span>관측 자료와 합성 시나리오를 분리한 연구용 화면</span></footer>
    </main>
    <dialog ref={dialog} className="policy-dialog" aria-labelledby="policy-workflow-title" onCancel={() => setInputOpen(false)} onClose={() => setInputOpen(false)}>{inputOpen&&<PolicyWorkflow draft={draft} setDraft={setDraft} context={context} onClose={()=>setInputOpen(false)}/>}</dialog>
  </div>;
}
