import type { ValueRange } from "./types";
import "./money-amount.css";

export const KRW_PER_USD = 1350;

export function formatKrW(value: number): string {
  return `KRW ${Math.round(value).toLocaleString("en-US")}`;
}

export function formatUsdAtFixedRate(value: number): string {
  return `USD ${Math.round(value / KRW_PER_USD).toLocaleString("en-US")}`;
}

function compact(value: number): string {
  const magnitude = Math.abs(value);
  const unit = magnitude >= 1_000_000_000 ? [1_000_000_000, "B"]
    : magnitude >= 1_000_000 ? [1_000_000, "M"]
    : magnitude >= 1_000 ? [1_000, "K"] : [1, ""];
  const scaled = value / Number(unit[0]);
  return `${Number(scaled.toFixed(2)).toLocaleString("en-US")}${unit[1]}`;
}

export function formatCompactMoney(value: number, currency: "KRW" | "USD"): string {
  return `${currency} ${compact(value)}`;
}

export function formatCompactRange(low: number, high: number, currency: "KRW" | "USD"): string {
  return `${currency} ${compact(low)}–${compact(high)}`;
}

export function MoneyAmount({ value }: { value: number | null | undefined }) {
  if (value == null || !Number.isFinite(value)) return <span>—</span>;
  return <span className="money-amount" tabIndex={0} title={formatKrW(value)} aria-label={formatKrW(value)}>
    <span>{formatCompactMoney(value, "KRW")}</span>
    <small title="시연용 환율: 1 USD = 1,350 KRW">≈ {formatCompactMoney(value / KRW_PER_USD, "USD")}</small>
  </span>;
}

export function MoneyRange({ range }: { range: ValueRange | null | undefined }) {
  if (!range || range.unit !== "eok_krw") return <span>—</span>;
  const low = range.low * 100_000_000;
  const high = range.high * 100_000_000;
  const exact = `${formatKrW(low)}–${formatKrW(high)}`;
  return <span className="money-amount" tabIndex={0} title={exact} aria-label={exact}>
    <span>{formatCompactRange(low, high, "KRW")}</span>
    <small title="시연용 환율: 1 USD = 1,350 KRW">≈ {formatCompactRange(low / KRW_PER_USD, high / KRW_PER_USD, "USD")}</small>
  </span>;
}

export function ExchangeRateNote() {
  return <small className="exchange-rate-note">달러 환산은 시연용 고정 환율 1 USD = 1,350 KRW를 사용합니다.</small>;
}
