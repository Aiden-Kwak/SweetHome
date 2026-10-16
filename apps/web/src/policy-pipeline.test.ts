import { describe, it, expect } from "vitest";
import { experimentRegionCode, experimentRegionName, experimentHouseholds } from "./policy-pipeline";
import type { Boundary } from "./types";

describe("policy experiment inputs", () => {
  it("does not confuse KOSTAT and national codes that share the same digits", () => {
    const seongdong: Boundary = {code:"11040",region_code:"11200",name:"성동구",rings:[]};
    const dongjak: Boundary = {code:"11200",region_code:null,name:"동작구",rings:[]};
    expect(experimentRegionCode(seongdong)).toBe("11200");
    expect(experimentRegionCode(dongjak)).toBe("kostat:11200");
    expect(experimentRegionName(seongdong)).toBe("서울 성동구");
    expect(experimentRegionName({code:"23010",region_code:null,name:"중구",rings:[]})).toBe("인천 중구");
  });
  it("uses explicit fictional households without assuming legal eligibility", () => {
    expect(experimentHouseholds).toHaveLength(4);
    expect(experimentHouseholds.every(h=>h.id.startsWith("demo_")&&!h.eligible)).toBe(true);
    expect(new Set(experimentHouseholds.map(h=>h.id)).size).toBe(4);
  });
});
