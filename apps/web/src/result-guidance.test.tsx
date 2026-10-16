import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fixture from "../../../data/fixtures/demo_policy-experiment-response.json";
import type { PolicyExperimentResult } from "./policy-pipeline";
import { resultGuidance } from "./result-guidance";
import { ResultGuidance } from "./ResultGuidance";

const sample = () => structuredClone(fixture) as PolicyExperimentResult;
const supplySample = () => {
  const r = sample(); r.candidate.kind = "units";
  r.supply = [{region_code:"11680",eligible_before:false,eligible_after:true,
    planned_units:4000,accelerated_units:1000,stock_change_percent:1,
    horizon_months:12,price_sensitivity_percent:-0.5}];
  return r;
};
describe("audience-specific result guidance", () => {
  it("uses only the selected region's returned supply values", () => {
    const r=supplySample();
    r.regions.push({...r.regions[0],code:"11110",name:"종로구"});
    r.supply.push({...r.supply[0],region_code:"11110",accelerated_units:250});
    const g=resultGuidance(r,"11110","policymaker");
    expect(g.observation).toContain("종로구");
    expect(g.observation).toContain("250세대");
    expect(g.observation).not.toContain("1,000");
  });
  it("changes supply interpretation between policymakers and buyers", () => {
    const r=supplySample();
    expect(resultGuidance(r,"11680","policymaker").interpretation).toContain("전환 비율");
    expect(resultGuidance(r,"11680","homebuyer").interpretation).toContain("매수 시점을 정하지");
  });
  it("does not describe delayed or zero supply as acceleration", () => {
    const r=supplySample();r.supply[0].accelerated_units=-1000;
    expect(resultGuidance(r,"11680","policymaker").observation).toContain("늦춰지는");
    r.supply[0].accelerated_units=0;
    expect(resultGuidance(r,"11680","policymaker").observation).toContain("변화가 없습니다");
  });
  it("does not substitute another region's supply", () => {
    expect(resultGuidance(supplySample(),"unknown","policymaker").observation).toContain("결과가 없습니다");
  });
  it("summarizes only the provided eligible household cases", () => {
    const r=sample();
    expect(resultGuidance(r,"11680","policymaker").observation).toContain("달라진 사례는 1개");
    r.households[0].eligible=false;
    const g=resultGuidance(r,"11680","policymaker");
    expect(g.observation).toContain("적용 대상은 0개");
    expect(g.nextSteps[0]).toContain("대상 가구를 선택");
  });
  it("uses a selected household rather than the regional price value", () => {
    const r=sample();
    r.households.push({...r.households[0],id:"second",label:"두 번째 가구",eligible:false,budget_before_krw:300e6,budget_after_krw:300e6,budget_change_percent:0});
    const g=resultGuidance(r,"11680","homebuyer","second");
    expect(g.title).toContain("기존 조건");
    expect(g.observation).toContain("3억 원에서 3억 원");
    expect(g.observation).not.toContain("-2.5");
  });
  it("distinguishes reduced and increased budgets", () => {
    const r=sample();
    expect(resultGuidance(r,"11680","homebuyer").title).toContain("줄어든 예산");
    r.households[0].budget_change_percent=25;
    expect(resultGuidance(r,"11680","homebuyer").title).toContain("감당할 수 있는 예산");
  });
  it("keeps rental guarantees separate from purchase funding", () => {
    const r=sample();r.candidate.kind="guarantee_cap";
    const g=resultGuidance(r,"11680","homebuyer");
    expect(g.observation).toContain("임차 예산");
    expect(g.interpretation).toContain("주택 구입자금이나 은행의 승인 대출액은 아닙니다");
  });
  it("prioritizes non-application over nominal rule changes", () => {
    const r=sample();r.applied=false;
    expect(resultGuidance(r,"11680","policymaker").title).toContain("변경 전 조건");
  });
  it("does not convert an age threshold into a price forecast", () => {
    const r=sample();r.candidate={...r.candidate,kind:"age",before:34,after:39,unit:"세"};
    const g=resultGuidance(r,"11680","homebuyer");
    expect(g.observation).toContain("34세에서 39세");
    expect(g.interpretation).toContain("가격 변화를 계산한 결과는 아닙니다");
  });
  it("handles absent household data without inventing a profile", () => {
    const r=sample();r.households=[];
    expect(resultGuidance(r,"11680","homebuyer").observation).toContain("가구 결과가 없습니다");
  });
  it("renders audience controls, household selection and relevant source link", () => {
    const r=sample();r.candidate.kind="guarantee_cap";
    const html=renderToStaticMarkup(<ResultGuidance result={r} regionCode="11680" initialAudience="homebuyer" onEdit={()=>{}}/>);
    expect(html).toContain("정책입안자");expect(html).toContain("내 집 마련 준비자");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("안내받을 가구 사례");
    expect(html).toContain("HF 전세자금보증 일반 안내");
    expect(html).toContain("내 조건으로 다시 계산하기");
  });
  it("does not mutate or recalculate the scenario", () => {
    const r=sample(), before=JSON.stringify(r);
    resultGuidance(r,"11680","policymaker");
    resultGuidance(r,"11680","homebuyer");
    expect(JSON.stringify(r)).toBe(before);
  });
});
