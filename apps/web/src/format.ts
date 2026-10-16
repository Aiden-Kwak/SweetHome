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
  return `${signed(claim.effect_value)}${unitLabel}`;
}

export function getDivergingTone(
  range: ValueRange,
): "down-strong" | "down-mild" | "neutral" | "up-mild" | "up-strong" {
  const mid =
    typeof range.median === "number"
      ? range.median
      : (range.low + range.high) / 2;
  if (mid <= -1.2) return "down-strong";
  if (mid < -0.2) return "down-mild";
  if (mid >= 0.7) return "up-strong";
  if (mid > 0.15) return "up-mild";
  return "neutral";
}
