import { describe, expect, it } from "vitest";

import {
  formatClaimEffect,
  formatKrwEok,
  formatMedian,
  formatPercent,
  formatRange,
  getDivergingTone,
} from "./format";
import type { Claim } from "./types";

describe("formatRange", () => {
  it("keeps signs visible for directional ranges", () => {
    expect(
      formatRange({ low: -2.1, high: -0.7, unit: "percent_vs_demo_baseline" }),
    ).toBe("-2.1% ~ -0.7%");
    expect(
      formatRange({ low: 0.2, high: 0.9, unit: "percent_vs_demo_baseline" }),
    ).toBe("+0.2% ~ +0.9%");
  });
});

describe("formatMedian and getDivergingTone", () => {
  it("formats median and maps zero-centered diverging tones", () => {
    expect(
      formatMedian({
        low: -2.1,
        median: -1.4,
        high: -0.7,
        unit: "percent_vs_demo_baseline",
      }),
    ).toBe("-1.4%");
    expect(
      getDivergingTone({
        low: -2.1,
        median: -1.4,
        high: -0.7,
        unit: "percent_vs_demo_baseline",
      }),
    ).toBe("down-strong");
    expect(
      getDivergingTone({
        low: 0.2,
        median: 0.55,
        high: 0.9,
        unit: "percent_vs_demo_baseline",
      }),
    ).toBe("up-mild");
  });
});

describe("formatPercent and formatKrwEok", () => {
  it("formats a zero-to-one ratio and KRW amounts in eok", () => {
    expect(formatPercent(0.12)).toBe("12%");
    expect(formatKrwEok(600_000_000)).toBe("6.0억 원");
    expect(formatKrwEok(null)).toBe("정보 없음");
  });
});

describe("formatClaimEffect", () => {
  it("discloses unverified null coefficients instead of fabricating numbers", () => {
    const baseClaim: Claim = {
      claim_id: "CL-TEST",
      title: "테스트 주장",
      policy_type: "finance",
      target_region: "11",
      sample_period: { start: "2020-01-01", end: "2022-12-31" },
      outcome_metric: "housing_price_index",
      effect_direction: "decrease",
      effect_value: null,
      lower_bound: null,
      upper_bound: null,
      unit: null,
      horizon_months: 12,
      method: "panel",
      market_regime: "tightening",
      evidence_grade: "B",
      mechanisms: ["borrowing_capacity"],
      limitations: ["미검증"],
      source: {
        title: "보고서",
        publisher: "KDI",
        url: "https://www.kdi.re.kr",
        published_at: "2023-07-31",
      },
    };
    expect(formatClaimEffect(baseClaim)).toContain("정량 계수 미적용");
    expect(
      formatClaimEffect({
        ...baseClaim,
        effect_value: -4.3,
        unit: "percent",
      }),
    ).toBe("-4.3%");
  });
});
