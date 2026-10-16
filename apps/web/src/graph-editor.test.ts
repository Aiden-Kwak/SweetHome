import { describe, expect, it } from "vitest";
import { draftKey, graphLayout, graphView, initialGraph, removeNode, safeGraphUrl, saveEdge, saveNode, validateDraft } from "./graph-editor";
import type { GraphResponse } from "./types";

const source:GraphResponse={as_of:"2025-06-28",region_code:"11680",data_status:"DEMO_INCOMPLETE",
  nodes:[{id:"demo_rule",kind:"policy_rule",label:"합성 정책",status:"synthetic",metadata:{effective_from:"2025-06-28"}},
    {id:"demo_mechanism",kind:"mechanism",label:"합성 경로",metadata:null},
    {id:"region:11680",kind:"region",label:"강남구"},{id:"demo_claim",kind:"claim",label:"연구 주장"}],
  edges:[{source:"demo_rule",target:"demo_mechanism",relation:"ACTS_THROUGH"},
    {source:"demo_mechanism",target:"region:11680",relation:"AFFECTS"},
    {source:"demo_claim",target:"demo_mechanism",relation:"ABOUT"}]};

describe("graph draft editor",()=>{
  it("round-trips without mutating original metadata or null fields",()=>{
    const draft=initialGraph(source);
    expect(validateDraft(JSON.parse(JSON.stringify(draft)))).toEqual(draft);
    draft.nodes[0].label="edited";
    expect(source.nodes[0].label).toBe("합성 정책");
    expect(draftKey(draft)).toContain("2025-06-28:11680");
  });
  it("updates nodes as unverified and preserves provenance",()=>{
    const draft=initialGraph(source);
    const result=saveNode(draft,{...draft.nodes[1],label:"변경한 경로",metadata:{original_url:"https://example.org/source"}});
    expect(result.nodes[1].status).toBe("unverified");
    expect(result.nodes[1].metadata?.original_url).toBe("https://example.org/source");
    expect(draft.nodes[1].label).toBe("합성 경로");
  });
  it("creates and updates edges without duplicates",()=>{
    let draft=initialGraph(source);
    draft=saveEdge(draft,{id:"demo_new",source:"demo_claim",target:"demo_rule",relation:"CONFLICTS_WITH"});
    expect(draft.edges.at(-1)?.metadata?.editor_status).toBe("unverified");
    expect(()=>saveEdge(draft,{id:"duplicate",source:"demo_claim",target:"demo_rule",relation:"CONFLICTS_WITH"})).toThrow("이미");
    expect(saveEdge(draft,{...draft.edges[3],relation:"ABOUT"}).edges).toHaveLength(4);
  });
  it("deletes incident edges only and keeps the previous graph available for undo",()=>{
    const draft=initialGraph(source), result=removeNode(draft,"demo_mechanism");
    expect(result.nodes).toHaveLength(3);expect(result.edges).toHaveLength(0);
    expect(draft.edges).toHaveLength(3);
  });
  it("rejects dangling, self and duplicate-ID edges",()=>{
    const draft=initialGraph(source);
    expect(()=>saveEdge(draft,{id:"bad",source:"demo_rule",target:"missing",relation:"ABOUT"})).toThrow();
    expect(()=>saveEdge(draft,{id:"bad",source:"demo_rule",target:"demo_rule",relation:"ABOUT"})).toThrow();
    expect(()=>validateDraft({...draft,edges:[...draft.edges,draft.edges[0]]})).toThrow();
  });
  it("rejects unsupported files, malformed nodes, blank names and duplicate node IDs",()=>{
    const draft=initialGraph(source);
    for(const value of [null,{}, {...draft,version:2},{...draft,nodes:[{id:"x",label:"",kind:"region"}]},{...draft,nodes:[...draft.nodes,draft.nodes[0]]}])
      expect(()=>validateDraft(value)).toThrow();
  });
  it("does not offer script or data URLs as source links",()=>{
    expect(safeGraphUrl("javascript:alert(1)")).toBeNull();
    expect(safeGraphUrl("data:text/html,hi")).toBeNull();
    expect(safeGraphUrl("https://example.org/source")).toBe("https://example.org/source");
  });
  it("isolates direct neighbors without drawing unrelated edges",()=>{
    const draft=initialGraph(source),view=graphView(draft,"demo_rule",false);
    expect(view.nodes).toHaveLength(2);expect(view.edges).toHaveLength(1);
    expect(graphView(draft,"demo_rule",true).nodes).toHaveLength(4);
  });
  it("lays out every visible node deterministically, including isolated nodes",()=>{
    const draft=initialGraph(source),view=graphView(draft,"demo_mechanism",false);
    for(const all of [true,false]) {
      const layout=graphLayout(view.nodes,view.edges,"demo_mechanism",all);
      expect(Object.keys(layout.positions)).toHaveLength(4);
      expect(graphLayout(view.nodes,view.edges,"demo_mechanism",all)).toEqual(layout);
    }
    expect(graphLayout([draft.nodes[0]],[],"demo_rule",false).positions.demo_rule).toBeDefined();
  });
});
