import type { Claim, ValueRange } from "./types";

function signed(value: number): string {
  if (value > 0) return `+${value.toFixed(1)}`;
  return value.toFixed(1);
}

export function formatRange(range: ValueRange): string {
  return `${signed(range.low)}% ~ ${signed(range.high)}%`;
}

export function formatMedian(range: ValueRange): string {
  const med =
    typeof range.median === "number"
      ? range.median
      : (range.low + range.high) / 2;
  return `${signed(med)}%`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "미확보";
  return `${Math.round(value * 100)}%`;
}

export function formatKrwEok(amountKrw: number | null | undefined): string {
  if (typeof amountKrw !== "number" || Number.isNaN(amountKrw)) {
    return "정보 없음";
  }
  const eok = amountKrw / 100_000_000;
  return `${eok.toFixed(1)}억 원`;
}

export function formatClaimEffect(claim: Claim): string {
  if (claim.effect_value === null) {
    return "정량 계수 미적용 (방향 및 메커니즘 참조)";
  }
  const unitLabel =
    claim.unit === "percent"
      ? "%"
      : claim.unit === "percent_point"
        ? "%p"
        : claim.unit ?? "";
  const value = claim.effect_value;
  return `${value > 0 ? "+" : ""}${value.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}${unitLabel}`;
}

export function formatPurchasingPower(range: ValueRange | null | undefined): string {
  if (!range || range.unit !== "eok_krw") return "미확보";
  return `${range.low.toLocaleString("ko-KR")}~${range.high.toLocaleString("ko-KR")}억`;
}

export function formatObservedPrice(amountKrw: number): string {
  return `${(amountKrw / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 4 })}억 원`;
}

export function getDivergingTone(
  range: ValueRange,
  strongThreshold = 1,
): "down-strong" | "down-mild" | "neutral" | "up-mild" | "up-strong" {
  const mid =
    typeof range.median === "number"
      ? range.median
      : (range.low + range.high) / 2;
  if (mid <= -strongThreshold) return "down-strong";
  if (mid < -strongThreshold * 0.2) return "down-mild";
  if (mid >= strongThreshold) return "up-strong";
  if (mid > strongThreshold * 0.2) return "up-mild";
  return "neutral";
}
