import { useRef, useState } from "react";
import type { Claim, GraphResponse, PolicySnapshot } from "./types";
import { draftKey, graphLayout, graphView, initialGraph, nodeKinds, relations, removeNode, safeGraphUrl, saveEdge, saveNode, validateDraft } from "./graph-editor";
import type { EditorEdge, EditorNode, GraphDraft } from "./graph-editor";
import "./knowledge-graph.css";
import { GlossaryText } from "./GlossaryHelp";

type Selection = {kind:"node";id:string} | {kind:"edge";id:string};
const valueText=(value:unknown) => typeof value === "string" ? value : "";
const short=(text:string,max=30) => text.length>max ? `${text.slice(0,max)}…` : text;
const kindClass=(kind:string) => ["policy_package","measure","policy_rule","legal_source"].includes(kind)?"policy": ["claim","evidence"].includes(kind)?"research":kind==="region"?"region":kind==="household_cohort"?"household":"mechanism";

export function KnowledgeGraph({source,snapshot,claims,regionCode}:{source:GraphResponse;snapshot:PolicySnapshot;claims:Claim[];regionCode:string}) {
  const [loaded] = useState(() => {
    try {const saved=localStorage.getItem(draftKey(source));return {graph:saved ? validateDraft(JSON.parse(saved)) : initialGraph(source),note:saved?"이 브라우저에 저장한 편집본을 불러왔습니다.":"API 원본을 표시합니다. 수정하면 이 브라우저에 자동 저장됩니다."};}
    catch {return {graph:initialGraph(source),note:"저장된 편집본을 읽지 못했습니다. API 원본을 표시합니다. 다음 수정부터 새 편집본으로 저장됩니다."};}
  });
  const [graph,setGraph]=useState<GraphDraft>(loaded.graph);
  const defaultId=loaded.graph.nodes.find(n=>n.id===`region:${regionCode}`)?.id ?? loaded.graph.nodes[0]?.id ?? "";
  const [focus,setFocus]=useState(defaultId);
  const [selection,setSelection]=useState<Selection>({kind:"node",id:defaultId});
  const [all,setAll]=useState(false);
  const [search,setSearch]=useState("");
  const [kind,setKind]=useState("");
  const [notice,setNotice]=useState(loaded.note);
  const [error,setError]=useState("");
  const [past,setPast]=useState<GraphDraft[]>([]);
  const [future,setFuture]=useState<GraphDraft[]>([]);
  const [scale,setScale]=useState(.8);
  const upload=useRef<HTMLInputElement>(null);
  const viewport=useRef<HTMLDivElement>(null);
  const shown=graphView(graph,focus,all);
  const layout=graphLayout(shown.nodes,shown.edges,focus,all);
  const filtered=graph.nodes.filter(n=>(!kind||n.kind===kind)&&`${n.label} ${n.id}`.toLowerCase().includes(search.toLowerCase()));
  const orphanCount=graph.nodes.filter(n=>!graph.edges.some(e=>e.source===n.id||e.target===n.id)).length;
  const modified=graph.nodes.filter(n=>n.metadata?.editor_status==="unverified").length+graph.edges.filter(e=>e.metadata?.editor_status==="unverified").length;
  const selectedNode=selection.kind==="node"?graph.nodes.find(n=>n.id===selection.id):undefined;
  const selectedEdge=selection.kind==="edge"?graph.edges.find(e=>e.id===selection.id):undefined;
  const connected=selectedNode?graph.edges.filter(e=>e.source===selectedNode.id||e.target===selectedNode.id):[];

  function persist(next:GraphDraft) {
    setGraph(next);setError("");
    try {localStorage.setItem(draftKey(source),JSON.stringify(next));setNotice("이 브라우저에 편집본을 저장했습니다. 원본과 시뮬레이션은 변경하지 않았습니다.");}
    catch {setError("브라우저 저장에 실패했습니다. 화면에는 변경이 남아 있습니다. 내보내기로 파일을 보관해 주세요.");}
  }
  function commit(next:GraphDraft) {setPast(p=>[...p.slice(-29),graph]);setFuture([]);persist(next);}
  function selectNode(id:string,recenter=false) {setSelection({kind:"node",id});if(recenter){setFocus(id);setAll(false);viewport.current?.scrollTo(0,0);}setError("");}
  function undo() {const prev=past.at(-1);if(prev){setFuture(f=>[graph,...f]);setPast(p=>p.slice(0,-1));persist(prev);if(!prev.nodes.some(n=>n.id===focus))setFocus(prev.nodes[0]?.id??"");}}
  function redo() {const next=future[0];if(next){setPast(p=>[...p,graph]);setFuture(f=>f.slice(1));persist(next);}}
  function exportGraph() {
    const url=URL.createObjectURL(new Blob([JSON.stringify(graph,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download=`sweethome-graph-draft-${graph.as_of}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice("편집본 파일을 내보냈습니다. 다른 환경에서는 가져오기로 열 수 있습니다.");
  }
  const rule=selectedNode && snapshot.rules.find(r=>r.rule_id===selectedNode.id||`legal_source:${r.rule_id}`===selectedNode.id);
  const claim=selectedNode && claims.find(c=>c.claim_id===selectedNode.id||c.evidence_id===selectedNode.id);
  const originalSource=rule?.source ?? claim?.source;
  const originalUrl=safeGraphUrl(originalSource?.url);

  return <section className="kg-workspace" aria-label="지식 그래프 편집기">
    <div className="page-intro"><div><p className="eyebrow">KNOWLEDGE GRAPH / NO-CODE EDITOR</p><h1>정책의 연결을 살펴보고, 직접 수정하세요.</h1><p>정책부터 지역, 가구, 연구 근거까지. 연결을 선택하면 그 의미와 출처를 확인할 수 있습니다.</p></div><button className="primary" onClick={()=>{try{const node:EditorNode={id:`demo_draft_${crypto.randomUUID()}`,kind:"mechanism",label:"새 노드",status:"unverified"};commit(saveNode(graph,node));selectNode(node.id,true);}catch(e){setError((e as Error).message);}}}>＋ 노드 추가</button></div>
    <div className="kg-summary"><span><strong>{graph.nodes.length}</strong> 노드</span><span><strong>{graph.edges.length}</strong> 관계</span><span><strong>{orphanCount}</strong> 연결 없는 노드</span><span><strong>{modified}</strong> 미검증 편집 항목</span><span className="badge warning">전체 정책 미포함</span></div>
    <div className="kg-disclaimer"><strong>검토용 편집본</strong><p>합성 정책과 연구 근거가 섞인 불완전한 그래프입니다. 연결은 인과관계의 검증을 뜻하지 않습니다. 수정 내용은 이 브라우저에만 저장되며, 서버 원장과 가격 시뮬레이션에는 반영되지 않습니다.</p><small>기준일 {source.as_of} / 원본 상태 {source.data_status}</small></div>
    <div className="kg-actions"><div><button onClick={undo} disabled={!past.length}>실행 취소</button><button onClick={redo} disabled={!future.length}>다시 실행</button></div><div><button onClick={()=>upload.current?.click()}>가져오기</button><button onClick={exportGraph}>내보내기</button><button onClick={()=>{if(window.confirm("현재 편집본을 API 원본으로 되돌릴까요? 실행 취소로 복구할 수 있습니다.")){commit(initialGraph(source));selectNode(source.nodes.find(n=>n.id===`region:${regionCode}`)?.id??source.nodes[0]?.id??"",true);}}}>원본으로 되돌리기</button></div></div>
    <input ref={upload} type="file" accept=".json,application/json" className="sr-only" aria-label="그래프 편집본 파일" onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;try{if(file.size>2_000_000)throw new Error("2MB 이하의 파일을 선택해 주세요.");const next=validateDraft(JSON.parse(await file.text()));if(next.as_of!==source.as_of||next.region_code!==source.region_code)throw new Error("현재 기준일과 지역이 같은 편집본을 선택해 주세요.");if(!window.confirm("파일의 내용으로 현재 편집본을 교체할까요? 실행 취소로 복구할 수 있습니다."))return;commit(next);selectNode(next.nodes[0]?.id??"",true);}catch(reason){setError(reason instanceof Error?reason.message:"파일을 읽지 못했습니다.");}}}/>
    <p className="kg-save-state" role="status">{notice}</p>{error&&<p role="alert" className="error-banner">{error}</p>}
    <div className="kg-editor">
      <aside className="kg-library" aria-label="노드 목록"><h2>노드 탐색</h2><input aria-label="노드 검색" type="search" placeholder="이름 또는 ID 검색" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="노드 유형 필터" value={kind} onChange={e=>setKind(e.target.value)}><option value="">모든 유형</option>{Object.entries(nodeKinds).map(([k,label])=><option key={k} value={k}>{label}</option>)}</select><p className="muted">{filtered.length}개 / 선택하면 주변 연결을 표시합니다.</p><div className="kg-node-list">{filtered.map(n=><button key={n.id} className={selection.kind==="node"&&selection.id===n.id?"active":""} onClick={()=>selectNode(n.id,true)} aria-pressed={selection.kind==="node"&&selection.id===n.id}><small>{nodeKinds[n.kind]}</small><span>{n.label}</span></button>)}{!filtered.length&&<p className="empty-state">일치하는 노드가 없습니다.</p>}</div></aside>
      <div className="kg-map"><div className="kg-map-toolbar"><div className="segments"><button aria-pressed={!all} onClick={()=>setAll(false)}>선택 노드 주변</button><button aria-pressed={all} onClick={()=>setAll(true)}>전체 그래프</button></div><div><button aria-label="그래프 축소" onClick={()=>setScale(s=>Math.max(.4,Math.round((s-.1)*10)/10))}>−</button><span>{Math.round(scale*100)}%</span><button aria-label="그래프 확대" onClick={()=>setScale(s=>Math.min(1.5,Math.round((s+.1)*10)/10))}>＋</button></div></div>
        <div className="kg-legend"><span className="policy">정책</span><span className="mechanism">작동 경로와 지표</span><span className="region">지역</span><span className="household">가구</span><span className="research">연구</span><span>점선: 상충 또는 편집 가설</span></div>
        <div className="kg-viewport" ref={viewport} tabIndex={0} aria-label="그래프 캔버스. 스크롤로 이동할 수 있습니다."><div style={{width:layout.width*scale,height:layout.height*scale}}><div className="kg-canvas" style={{width:layout.width,height:layout.height,transform:`scale(${scale})`}}>
          <svg width={layout.width} height={layout.height} className="kg-lines" aria-label="노드 간 관계">
            <defs><marker id="kg-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#92a6bd"/></marker><marker id="kg-arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#246be9"/></marker></defs>
            {shown.edges.map((edge,index)=>{const s=layout.positions[edge.source],t=layout.positions[edge.target];if(!s||!t)return null;const right=t.x>s.x;const x1=s.x+(right?230:0),x2=t.x+(right?0:230);const y1=s.y+42,y2=t.y+42;const bend=(right?1:-1)*(60+(index%3)*12);const d=`M${x1},${y1} C${x1+bend},${y1} ${x2-bend},${y2} ${x2},${y2}`;const active=selection.kind==="edge"?selection.id===edge.id:edge.source===selection.id||edge.target===selection.id;return <g key={edge.id} className={`kg-edge ${active?"active":""} ${edge.relation==="CONFLICTS_WITH"||edge.metadata?.editor_status==="unverified"?"uncertain":""}`}><path d={d} markerEnd={active?"url(#kg-arrow-active)":"url(#kg-arrow)"}/><path className="kg-edge-hit" d={d} role="button" tabIndex={0} aria-label={`${graph.nodes.find(n=>n.id===edge.source)?.label} → ${relations[edge.relation]} → ${graph.nodes.find(n=>n.id===edge.target)?.label}`} onClick={()=>setSelection({kind:"edge",id:edge.id})} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelection({kind:"edge",id:edge.id});}}}><title>{relations[edge.relation]}</title></path>{selection.kind==="edge"&&selection.id===edge.id&&<text x={(x1+x2)/2} y={(y1+y2)/2-8} textAnchor="middle">{relations[edge.relation]}</text>}</g>;})}
          </svg>
          {shown.nodes.map(n=>{const p=layout.positions[n.id];return <button key={n.id} className={`kg-node ${kindClass(n.kind)} ${selection.kind==="node"&&selection.id===n.id?"selected":""} ${focus===n.id?"center":""}`} style={{left:p.x,top:p.y}} onClick={()=>selectNode(n.id)} aria-pressed={selection.kind==="node"&&selection.id===n.id} title={n.label}><small>{nodeKinds[n.kind]}{n.metadata?.editor_status==="unverified"?" / 미검증 편집":""}</small><strong>{short(n.label,45)}</strong></button>;})}
          {!shown.nodes.length&&<p className="empty-state">노드를 추가하거나 왼쪽 목록에서 선택해 주세요.</p>}
        </div></div></div><div className="kg-canvas-footer">표시 중: 노드 {shown.nodes.length}개, 관계 {shown.edges.length}개 / 화살표는 관계의 방향입니다.</div>
      </div>
      <aside className="kg-inspector" aria-label="선택 항목 편집"><div className="kg-inspector-heading"><p className="eyebrow">NO-CODE</p><h2>{selectedEdge?"관계 편집":"노드 편집"}</h2></div>
        {selectedNode&&<p className="kg-term-context"><GlossaryText text={selectedNode.label}/></p>}
        {selectedNode&&<><NodeForm key={`${selectedNode.id}:${JSON.stringify(selectedNode)}`} node={selectedNode} onSave={node=>{try{commit(saveNode(graph,node));}catch(e){setError((e as Error).message);}}}/>
          <div className="kg-detail-actions"><button onClick={()=>{setFocus(selectedNode.id);setAll(false);viewport.current?.scrollTo(0,0);}}>이 노드 중심으로 보기</button><button onClick={()=>{const target=graph.nodes.find(n=>n.id!==selectedNode.id);if(!target){setError("연결하려면 노드를 하나 더 추가해 주세요.");return;}setFocus(selectedNode.id);setSelection({kind:"edge",id:"new"});}}>＋ 관계 추가</button></div>
          {originalSource&&<div className="kg-original"><strong>API 원본 출처 (읽기 전용)</strong><p>{originalSource.title}</p><p>{originalSource.locator}</p>{originalUrl&&!originalUrl.includes("example.invalid")?<a href={originalUrl} target="_blank" rel="noreferrer">원문 확인</a>:<span className="warning-copy">실제 원문이 연결되지 않았습니다.</span>}</div>}
          <details className="kg-metadata"><summary>원본 속성과 식별자</summary><p>{selectedNode.id}</p><p>원본 또는 편집 상태: {selectedNode.status??"미지정"}</p><pre>{JSON.stringify(selectedNode.metadata??{},null,2)}</pre></details>
          <h3 className="kg-related-title">연결된 관계 {connected.length}개</h3><div className="kg-related">{connected.map(e=><button key={e.id} onClick={()=>setSelection({kind:"edge",id:e.id})}><small>{e.source===selectedNode.id?"나가는 관계":"들어오는 관계"} / {relations[e.relation]}</small><span>{graph.nodes.find(n=>n.id===(e.source===selectedNode.id?e.target:e.source))?.label}</span></button>)}{!connected.length&&<p className="muted">연결이 없는 노드입니다. 관계를 추가해 주세요.</p>}</div>
          <button className="kg-delete" onClick={()=>{if(window.confirm(`이 노드와 연결된 관계 ${connected.length}개를 편집본에서 삭제할까요? 실행 취소로 복구할 수 있습니다.`)){const next=removeNode(graph,selectedNode.id);commit(next);selectNode(next.nodes[0]?.id??"",true);}}}>노드와 연결 삭제</button></>}
        {(selectedEdge||selection.kind==="edge"&&selection.id==="new")&&<EdgeForm key={`${selection.id}:${JSON.stringify(selectedEdge)}`} edge={selectedEdge??{id:`demo_edge_${crypto.randomUUID()}`,source:focus,target:graph.nodes.find(n=>n.id!==focus)?.id??"",relation:"AFFECTS"}} nodes={graph.nodes} onSave={edge=>{try{commit(saveEdge(graph,edge));setSelection({kind:"edge",id:edge.id});}catch(e){setError((e as Error).message);}}} onDelete={selectedEdge?()=>{if(window.confirm("이 관계를 편집본에서 삭제할까요?")){commit({...graph,edges:graph.edges.filter(e=>e.id!==selectedEdge.id)});selectNode(selectedEdge.source);}}:undefined}/ >}
        {!selectedNode&&!selectedEdge&&!(selection.kind==="edge"&&selection.id==="new")&&<p className="empty-state">노드 또는 연결선을 선택해 주세요.</p>}
      </aside>
    </div>
  </section>;
}

function NodeForm({node,onSave}:{node:EditorNode;onSave:(node:EditorNode)=>void}) {
  const [label,setLabel]=useState(node.label),[kind,setKind]=useState(node.kind);
  const [note,setNote]=useState(valueText(node.metadata?.editor_note));
  const [url,setUrl]=useState(valueText(node.metadata?.editor_source_url));
  const [locator,setLocator]=useState(valueText(node.metadata?.editor_source_locator));
  const [error,setError]=useState("");
  return <form className="kg-form" onSubmit={e=>{e.preventDefault();if(url&&!safeGraphUrl(url)){setError("출처는 http 또는 https 주소로 입력해 주세요.");return;}if(kind==="policy_rule"&&(!safeGraphUrl(url)||!locator.trim())){setError("정책 규칙을 수정하려면 출처 URL과 원문 위치 또는 발췌문을 입력해 주세요. 공식 출처 여부는 별도로 검토해야 합니다.");return;}setError("");onSave({...node,label,kind,metadata:{...node.metadata,editor_note:note,editor_source_url:url,editor_source_locator:locator}});}}>
    <label>노드 이름<input required maxLength={500} value={label} onChange={e=>setLabel(e.target.value)}/></label><label>노드 유형<select value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries(nodeKinds).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label><label>검토 메모<textarea rows={3} maxLength={5000} value={note} onChange={e=>setNote(e.target.value)} placeholder="이 연결의 근거와 확인할 내용을 적어 주세요."/></label><label>검토용 출처 URL<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/></label><label>원문 위치 또는 발췌문<textarea rows={2} maxLength={5000} value={locator} onChange={e=>setLocator(e.target.value)} placeholder="페이지, 조항 또는 원문 문장"/></label><p className="muted">수정한 항목은 미검증 상태로 저장됩니다. 원본의 검증 상태를 승계하지 않습니다.</p>{error&&<p role="alert" className="warning-copy">{error}</p>}<button type="submit" className="primary">노드 변경 저장</button>
  </form>;
}
function EdgeForm({edge,nodes,onSave,onDelete}:{edge:EditorEdge;nodes:EditorNode[];onSave:(edge:EditorEdge)=>void;onDelete?:()=>void}) {
  const [source,setSource]=useState(edge.source),[target,setTarget]=useState(edge.target),[relation,setRelation]=useState(edge.relation),[note,setNote]=useState(valueText(edge.metadata?.editor_note));
  return <form className="kg-form" onSubmit={e=>{e.preventDefault();onSave({...edge,source,target,relation,metadata:{...edge.metadata,editor_note:note}});}}>
    <label>시작 노드<select aria-label="시작 노드" required value={source} onChange={e=>setSource(e.target.value)}>{nodes.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label>
    <label>관계 유형<select aria-label="관계 유형" value={relation} onChange={e=>setRelation(e.target.value)}>{Object.entries(relations).map(([key,name])=><option key={key} value={key}>{name} ({key})</option>)}</select></label>
    <label>도착 노드<select aria-label="도착 노드" required value={target} onChange={e=>setTarget(e.target.value)}>{nodes.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label>
    <label>관계 검토 메모<textarea rows={4} maxLength={5000} value={note} onChange={e=>setNote(e.target.value)}/></label><p className="muted">시작 노드에서 도착 노드로 연결됩니다. 새 연결과 수정한 연결은 미검증 가설입니다.</p><button className="primary" type="submit">관계 변경 저장</button>{onDelete&&<button className="kg-delete" type="button" onClick={onDelete}>관계 삭제</button>}<details className="kg-metadata"><summary>기존 관계 속성</summary><pre>{JSON.stringify(edge.metadata??{},null,2)}</pre></details>
  </form>;
}
