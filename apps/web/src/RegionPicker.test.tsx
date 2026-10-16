import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RegionPicker, toggleRegionGroup } from "./RegionPicker";
import { fillSupplyDefaults, recommendedSupply, SupplyScenarioEditor } from "./SupplyScenarioEditor";

describe("region selection controls",()=>{
  it("selects a whole group without duplicating or losing other selections",()=>{
    expect(toggleRegionGroup(["a","outside"],["a","b"],true)).toEqual(["a","outside","b"]);
    expect(toggleRegionGroup(["a","outside","b"],["a","b"],false)).toEqual(["outside"]);
  });
  it("provides full selection, Seoul shortcut and clear controls",()=>{
    const html=renderToStaticMarkup(<RegionPicker options={[{code:"11110",name:"서울 종로구"},{code:"x",name:"경기 과천시"}]} selected={["11110"]} onChange={()=>{}}/>);
    expect(html).toContain("전체 선택 (2개 지역)");
    expect(html).toContain("서울 25개 구 선택");
    expect(html).toContain("모두 해제");
    expect(html).toContain("경기 전체 선택");
  });
});
describe("supply starting values",()=>{
  it("fills both supply policy kinds with explicit illustrative defaults",()=>{
    expect(recommendedSupply("11110","units")).toMatchObject({housing_stock:100000,project_count:10,units_per_project:400,residential_share_percent:85,delivery_fraction:0.25,price_response_coefficient:0.5,input_basis:"illustrative"});
    expect(recommendedSupply("11110","area_share")).toMatchObject({units_per_project:250,residential_share_percent:95});
  });
  it("adds new regions without overwriting edits or repeatedly changing state",()=>{
    const edited={...recommendedSupply("11110","units"),housing_stock:150000};
    const filled=fillSupplyDefaults([edited],["11110","11140"],"units");
    expect(filled).toHaveLength(2);
    expect(filled[0]).toBe(edited);
    expect(filled[1].housing_stock).toBe(100000);
    expect(fillSupplyDefaults(filled,["11110","11140"],"units")).toBe(filled);
  });
  it("renders starting values immediately, including before effect initialization",()=>{
    const html=renderToStaticMarkup(<SupplyScenarioEditor kind="units" regions={[{code:"11110",name:"서울 종로구"}]} values={[]} onChange={()=>{}} confirmed={false} onConfirm={()=>{}}/>);
    expect(html).toContain('value="100000"');
    expect(html).toContain('value="400"');
    expect(html).toContain("기본 시나리오 값으로 복원");
    expect(html).not.toContain('value="" min="1"');
  });
});
