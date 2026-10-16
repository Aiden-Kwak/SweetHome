import type { GraphResponse, GraphNode, GraphEdge } from "./types";

export const nodeKinds: Record<string, string> = {
  policy_package:"정책 패키지", measure:"정책 수단", policy_rule:"정책 규칙",
  legal_source:"정책 원문", mechanism:"작동 경로", market_metric:"시장 지표",
  region:"지역", household_cohort:"가구 유형", evidence:"연구 자료", claim:"연구 주장",
};
export const relations: Record<string, string> = {
  CONTAINS:"포함", IMPLEMENTS:"구체화", SUPERSEDES:"대체", DERIVED_FROM:"출처",
  ACTS_THROUGH:"작동 경로", INTERACTS_WITH:"상호작용", EXEMPTS:"예외", AMENDS:"개정",
  APPLIES_TO:"적용 대상", DIRECT_EFFECT:"직접효과 가정", AFFECTS:"영향 가정",
  SPILLOVER_EFFECT:"전이효과 가정", SPILLOVER_TO:"전이 가정", SUBSTITUTE_FOR:"대체 관계",
  SUBSTITUTES_TO:"선택지 이동", MAKES_CLAIM:"주장 제시", ABOUT:"연구 대상",
  COMPLEMENTS:"보완", CONFLICTS_WITH:"상충", CONTEXTUALIZES:"맥락 제공",
};
export type EditorNode = GraphNode & { status?: string | null };
export type EditorEdge = GraphEdge & { id: string };
export interface GraphDraft {
  version: 1;
  as_of: string;
  region_code: string;
  data_status: GraphResponse["data_status"];
  nodes: EditorNode[];
  edges: EditorEdge[];
}
export const draftKey = (graph: Pick<GraphDraft, "as_of" | "region_code">) => `policymap:graph-draft:v1:${graph.as_of}:${graph.region_code}`;
export function initialGraph(graph: GraphResponse): GraphDraft {
  return {version:1, as_of:graph.as_of, region_code:graph.region_code, data_status:graph.data_status,
    nodes:structuredClone(graph.nodes), edges:graph.edges.map((edge, index) => ({...structuredClone(edge), id:`source-edge-${index}`}))};
}
export function safeGraphUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try { const url=new URL(value); return ["https:","http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function validateDraft(value: unknown): GraphDraft {
  if (!value || typeof value !== "object") throw new Error("그래프 파일 형식이 올바르지 않습니다.");
  const g=value as GraphDraft;
  if (g.version !== 1 || typeof g.as_of !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(g.as_of) || typeof g.region_code !== "string" || !g.region_code ||
      !["COMPLETE","INCOMPLETE","CONFLICTED","DEMO_INCOMPLETE"].includes(g.data_status) ||
      !Array.isArray(g.nodes) || !Array.isArray(g.edges)) throw new Error("지원하는 그래프 편집본(v1)이 아닙니다.");
  if(g.nodes.length>500 || g.edges.length>2000) throw new Error("노드 500개, 관계 2,000개 이하의 파일을 사용해 주세요.");
  const ids=new Set<string>(); const edgeIds=new Set<string>();
  const metadataValid=(m:unknown) => m == null || (typeof m === "object" && !Array.isArray(m));
  for(const n of g.nodes) {
    if(!n || typeof n.id!=="string" || !n.id || ids.has(n.id) || typeof n.label!=="string" || !n.label.trim() || n.label.length>500 ||
      typeof n.kind!=="string" || !Object.hasOwn(nodeKinds,n.kind) || !metadataValid(n.metadata) || (n.status != null && typeof n.status!=="string"))
      throw new Error("노드의 ID, 이름 또는 유형을 확인해 주세요. ID는 중복될 수 없습니다.");
    ids.add(n.id);
  }
  for(const e of g.edges) {
    if(!e || typeof e.id!=="string" || !e.id || edgeIds.has(e.id) || !ids.has(e.source) || !ids.has(e.target) || e.source===e.target ||
      typeof e.relation!=="string" || !Object.hasOwn(relations,e.relation) || !metadataValid(e.metadata))
      throw new Error("관계의 ID, 유형과 양쪽 노드를 확인해 주세요. 자기 자신과는 연결할 수 없습니다.");
    edgeIds.add(e.id);
  }
  return structuredClone(g);
}
export function saveNode(graph:GraphDraft, node:EditorNode):GraphDraft {
  const changed={...node,label:node.label.trim(),status:"unverified",metadata:{...node.metadata,editor_status:"unverified"}};
  return validateDraft({...graph,nodes:graph.nodes.some(n=>n.id===node.id) ? graph.nodes.map(n=>n.id===node.id ? changed : n) : [...graph.nodes,changed]});
}
export function saveEdge(graph:GraphDraft, edge:EditorEdge):GraphDraft {
  if(graph.edges.some(e=>e.id!==edge.id && e.source===edge.source && e.target===edge.target && e.relation===edge.relation))
    throw new Error("같은 방향과 유형의 관계가 이미 있습니다.");
  const changed={...edge,metadata:{...edge.metadata,editor_status:"unverified"}};
  return validateDraft({...graph,edges:graph.edges.some(e=>e.id===edge.id) ? graph.edges.map(e=>e.id===edge.id ? changed : e) : [...graph.edges,changed]});
}
export function removeNode(graph:GraphDraft,id:string):GraphDraft {
  return {...graph,nodes:graph.nodes.filter(n=>n.id!==id),edges:graph.edges.filter(e=>e.source!==id&&e.target!==id)};
}
export function graphView(graph:GraphDraft, focus:string, all:boolean) {
  const ids=new Set([focus]);
  if(all) graph.nodes.forEach(n=>ids.add(n.id));
  else graph.edges.filter(e=>e.source===focus||e.target===focus).forEach(e=>{ids.add(e.source);ids.add(e.target);});
  return {nodes:graph.nodes.filter(n=>ids.has(n.id)), edges:graph.edges.filter(e=>all || e.source===focus || e.target===focus)};
}
export function graphLayout(nodes:EditorNode[],edges:EditorEdge[],focus:string,all:boolean) {
  const positions:Record<string,{x:number;y:number}>=Object.create(null);
  if(all) {
    const columns=[['policy_package','measure','legal_source'],['policy_rule'],['mechanism','claim','evidence'],['region','household_cohort','market_metric']];
    columns.forEach((kinds,col)=>nodes.filter(n=>kinds.includes(n.kind)).forEach((n,row)=>{positions[n.id]={x:30+col*280,y:50+row*112};}));
  } else {
    const incoming=new Set(edges.filter(e=>e.target===focus).map(e=>e.source));
    const outgoing=new Set(edges.filter(e=>e.source===focus).map(e=>e.target));
    const left=nodes.filter(n=>n.id!==focus&&incoming.has(n.id)&&!outgoing.has(n.id));
    const right=nodes.filter(n=>n.id!==focus&&(!incoming.has(n.id)||outgoing.has(n.id)));
    // Balance one-direction-only neighborhoods without changing relationship direction.
    if(!right.length) right.push(...left.splice(Math.ceil(left.length/2)));
    if(!left.length) left.push(...right.splice(0,Math.floor(right.length/2)));
    const count=Math.max(left.length,right.length,1);
    positions[focus]={x:310,y:50+Math.floor((count-1)/2)*112};
    left.forEach((n,i)=>{positions[n.id]={x:30,y:50+i*112};});
    right.forEach((n,i)=>{positions[n.id]={x:590,y:50+i*112};});
  }
  return {positions,width:all?1130:850,height:Math.max(500,...Object.values(positions).map(p=>p.y+140))};
}
