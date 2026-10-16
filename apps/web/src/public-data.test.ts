import { describe, expect, it } from "vitest";
import { formatObservedPrice, formatPercent, formatPurchasingPower } from "./format";
import { boundaryPath, cohortRegions, metricRange } from "./ImpactMap";
import type { CohortResult, RegionResult } from "./types";

const region: RegionResult = { region_code:"11680", region_name:"서울 강남구", price_change:{low:-2,high:-1,unit:"percent"}, transaction_change:{low:-10,high:-5,unit:"percent"}, confidence:"low", effect_type:"direct" };

describe("public data presentation", () => {
  it("preserves reported price precision", () => {
    expect(formatObservedPrice(1_595_000_000)).toBe("15.95억 원");
    expect(formatObservedPrice(851_230_000)).toBe("8.5123억 원");
  });
  it("reads the actual backend budget contract and does not render NaN", () => {
    expect(formatPurchasingPower({low:14,high:16.4,unit:"eok_krw"})).toBe("14~16.4억");
    expect(formatPurchasingPower(null)).toBe("미확보");
    expect(formatPercent(Number.NaN)).toBe("미확보");
  });
  it("does not substitute prices for a missing loan metric", () => {
    expect(metricRange(region,"mortgage_limit_change")).toBeNull();
    expect(metricRange(region,"price_change")).toEqual(region.price_change);
  });
  it("matches cohort region names without inventing destinations", () => {
    const c: CohortResult = {cohort_id:"demo_test",label:"test",response:"test",exposure:.5,selectable_regions_before:["서울 강남구"],selectable_regions_after:["미확보 지역"]};
    expect(cohortRegions(c,[region])).toEqual({before:["11680"],after:[]});
  });
  it("renders multiple rings as independent closed SVG paths", () => {
    const path = boundaryPath({code:"a",name:"a",region_code:null,rings:[[[127,37],[127.1,37],[127,37.1]],[[127.01,37.01],[127.02,37.01],[127.01,37.02]]]});
    expect(path.match(/M/g)).toHaveLength(2);
    expect(path.match(/Z/g)).toHaveLength(2);
    expect(path).not.toContain("NaN");
  });
});
