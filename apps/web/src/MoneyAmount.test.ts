import { describe, expect, it } from "vitest";
import { formatCompactMoney, formatCompactRange, formatKrW } from "./MoneyAmount";

describe("compact money display", () => {
  it("shortens large values while retaining an exact KRW formatter", () => {
    expect(formatCompactRange(1_650_000_000, 1_950_000_000, "KRW"))
      .toBe("KRW 1.65B–1.95B");
    expect(formatCompactMoney(350_000_000, "KRW")).toBe("KRW 350M");
    expect(formatKrW(1_650_000_000)).toBe("KRW 1,650,000,000");
  });
});
