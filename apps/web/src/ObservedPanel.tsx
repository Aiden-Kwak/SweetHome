import { useState } from "react";
import { formatObservedPrice } from "./format";
import type { PublicContext } from "./types";

export function ObservedPanel({ context, regionCode, regionName }: { context: PublicContext; regionCode: string; regionName: string }) {
  const [area, setArea] = useState<"all" | "84">("all");
  const [includeCanceled, setIncludeCanceled] = useState(false);
  const scoped = context.transactions.filter(t => t.region_code === regionCode);
  const rows = scoped.filter(t => (includeCanceled || !t.canceled_at) && (area === "all" || (t.area_m2 >= 80 && t.area_m2 < 90)));
  return <section className="observed-panel panel" id="observations" aria-labelledby="observed-title">
    <div className="section-heading"><div><span className="eyebrow">실제 관측 자료</span><h2 id="observed-title">{regionName}에서는 얼마에 거래됐을까?</h2></div><span className="badge observed">서울시 공식 실거래</span></div>
    <p className="section-description">2025년 6월 26~27일 아파트 계약 표본입니다. 시뮬레이션과 독립된 참고 자료이며 미래 가격을 뜻하지 않습니다.</p>
    <div className="observation-controls"><div className="segments" aria-label="면적 선택"><button aria-pressed={area === "all"} onClick={() => setArea("all")}>전체 면적</button><button aria-pressed={area === "84"} onClick={() => setArea("84")}>80~90㎡</button></div><label className="check-label"><input type="checkbox" checked={includeCanceled} onChange={e => setIncludeCanceled(e.target.checked)} />취소 신고 포함</label><span className="muted">조회 표본 {scoped.length}건 중 {rows.length}건 표시</span></div>
    {rows.length ? <div className="table-scroll"><table className="observation-table"><caption className="sr-only">단지별 실제 계약 금액. 서로 다른 면적과 층을 단순 비교하지 마세요.</caption><thead><tr><th>단지 / 법정동</th><th>계약일</th><th>전용면적 / 층</th><th>신고 거래금액</th><th>신고 상태</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className={row.canceled_at ? "canceled" : ""}><th scope="row"><strong>{row.building_name}</strong><small>{row.neighborhood}</small></th><td>{row.contract_date}</td><td>{row.area_m2.toLocaleString("ko-KR",{maximumFractionDigits:3})}㎡ / {row.floor}층</td><td className="transaction-price">{formatObservedPrice(row.price_krw)}</td><td><span className={`badge ${row.canceled_at ? "warning" : "plain"}`}>{row.canceled_at ? `취소 ${row.canceled_at}` : "취소일 없음"}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>{scoped.length ? "선택 조건에 맞는 거래가 없습니다." : "이 지역의 거래 표본은 아직 수집하지 않았습니다."}</strong><p>강남구, 성동구, 마포구의 공식 API 표본을 먼저 연결했습니다. 값이 없을 때 합성 거래로 채우지 않습니다.</p></div>}
    <details className="source-details"><summary>수집 범위와 원자료 확인</summary><p>{context.sampling_note}</p><p>조회 시각: {new Date(context.retrieved_at).toLocaleString("ko-KR")} / {context.transaction_source.license}</p><ul>{context.limitations.slice(0,3).map(note => <li key={note}>{note}</li>)}</ul><a href={context.transaction_source.url} target="_blank" rel="noreferrer">{context.transaction_source.publisher} 데이터 설명 보기</a><div className="query-list">{context.queries.filter(q => q.region_code === regionCode).map(q => <div key={q.source_url}><span>{q.contract_date}: 응답 전체 {q.total_matching}건 중 첫 {q.returned}건</span><code title={q.sha256}>SHA-256 {q.sha256.slice(0,16)}…</code></div>)}</div></details>
  </section>;
}
