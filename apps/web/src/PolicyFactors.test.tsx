import { describe,it,expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import snapshotFixture from "../../../data/fixtures/policy_snapshot.json";
import scenarioFixture from "../../../data/fixtures/scenario_result.json";
import { PolicyFactors } from "./PolicyFactors";
import type { PolicySnapshot,ScenarioResult } from "./types";

const snapshot=snapshotFixture as unknown as PolicySnapshot;
const scenario=scenarioFixture as ScenarioResult;
function render(index=2,selectedRules=snapshot.rules.map(r=>r.rule_id),regionCode="11680") {
  return renderToStaticMarkup(<PolicyFactors snapshot={snapshot} cohorts={scenario.cohorts}
    cohort={scenario.cohorts[index]} selectedRules={selectedRules} regionCode={regionCode}
    regionName="선택 지역" onCohortChange={()=>{}} busy={false}/>);
}
describe("policy factors overview",()=>{
  it("displays the snapshot date, lending comparison, restrictions and sources",()=>{
    const html=render();
    expect(html).toContain("2025-06-28 스냅샷 기준");
    expect(html).toContain("KRW 850M");
    expect(html).toContain("KRW 600M");
    expect(html).toContain("LTV (담보인정비율) 용어 설명");
    expect(html).toContain("DSR (총부채원리금상환비율) 용어 설명");
    expect(html).toContain("토지거래허가");
    expect(html).toContain("선택 정책을 반영한 합성 계산값");
    expect(html).not.toContain('href="https://example.invalid');
  });
  it("follows the cohort result supplied by the simulation",()=>{
    expect(render(0)).toContain("KRW 480M");
    expect(render(1)).toContain("KRW 560M");
  });
  it("separates scenario inclusion from region membership",()=>{
    const html=render(2,[],"unknown-region");
    expect(html).toContain("비교에서 제외");
    expect(html).toContain("다른 지역의 규칙");
    expect(html).not.toContain('class="factor-scope">지역 목록에 포함');
  });
});
