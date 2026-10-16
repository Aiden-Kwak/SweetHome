import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fixture from "../../../data/fixtures/demo_policy-experiment-response.json";
import { experimentColor, PolicyExperimentView } from "./PolicyExperimentView";
import { emptySupply } from "./SupplyScenarioEditor";
import type { PolicyExperimentResult } from "./policy-pipeline";

const result = () => structuredClone(fixture) as PolicyExperimentResult;
const render = (data: PolicyExperimentResult) => renderToStaticMarkup(
  <PolicyExperimentView result={data} context={null} onEdit={()=>{}}/>,
);

describe("policy-specific result presentation", () => {
  it("distinguishes changes in magnitude without inventing numerical effects",()=>{
    expect(experimentColor(-1)).not.toBe(experimentColor(-0.5));
    expect(experimentColor(0)).toBe(experimentColor(null));
    expect(experimentColor(1)).not.toBe(experimentColor(-1));
  });
  it("puts recalculation and export before the map, and exposes every regional result",()=>{
    const data=result();
    const html=render(data);
    expect(html.indexOf("조건을 바꿔 다시 계산")).toBeLessThan(html.indexOf("workflow-result-hero"));
    expect(html).toContain(`${data.regions.length}개 지역 결과 비교`);
    for(const region of data.regions) expect(html).toContain(region.name);
  });
  it("shows budget changes when no purchase-price coefficient was supplied", () => {
    const data=result();
    data.assumptions.price_elasticity=null;
    data.regions=data.regions.map(r=>({...r,price_sensitivity_percent:null,
      metric_label:"구매 예산 변화",metric_value:-25}));
    const html=render(data);
    expect(html).toContain("구매 예산 변화");
    expect(html).toContain("-25%");
    expect(html).not.toContain("미산출");
    expect(html).toContain("가격 반응 계수를 설정");
  });
  it("shows a supply calculation trace instead of irrelevant loan cards", () => {
    const data=result();
    data.candidate.kind="units";
    data.households=[];
    const region=data.regions[0];
    data.assumptions.supply_assumptions=[{...emptySupply(region.code),housing_stock:100000,
      project_count:10,units_per_project:400,delivery_fraction:0.25,
      price_response_coefficient:0.5,input_basis:"illustrative"}];
    data.supply=[{region_code:region.code,eligible_before:false,eligible_after:true,
      planned_units:4000,accelerated_units:1000,stock_change_percent:1,horizon_months:12,
      price_sensitivity_percent:-0.5}];
    data.regions=[{...region,metric_value:-0.5,price_sensitivity_percent:-0.5}];
    const html=render(data);
    expect(html).toContain("공급 변화 경로");
    expect(html).toContain("4,000");
    expect(html).toContain("+1,000");
    expect(html).toContain("계산 예시 값 (지역 통계 아님)");
    expect(html).not.toContain("가구별 자금");
    expect(html).not.toContain("미산출");
    expect(html).toContain("계산 근거 및 적용 범위");
  });
  it("does not silently populate regional housing statistics", () => {
    expect(emptySupply("11680").housing_stock).toBe(0);
    expect(emptySupply("11680").price_response_coefficient).toBe(0);
    expect(emptySupply("11680").source_url).toBeNull();
  });
});
