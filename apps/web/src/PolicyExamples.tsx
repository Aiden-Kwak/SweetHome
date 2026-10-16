import { useEffect, useState } from "react";
import { fetchPolicyExamples } from "./api";
import type { PolicyExample } from "./types";
import "./policy-examples.css";

export function PolicyExamples({ onLoad }: { onLoad: (example: PolicyExample) => void }) {
  const [examples, setExamples] = useState<PolicyExample[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void fetchPolicyExamples(controller.signal).then(rows => {
      if (!controller.signal.aborted) { setExamples(rows); setStatus("ready"); }
    }).catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, [attempt]);

  return <section className="policy-examples" aria-labelledby="policy-examples-title">
    <h3 id="policy-examples-title">최근 공식 자료로 시작해 보세요</h3>
    <p className="muted">선별한 자료의 검토 요약입니다. 전체 정책 목록이 아니며, 원문과 시행 조건을 확인한 뒤 사용해 주세요.</p>
    {status === "loading" && <p role="status">공식 자료 예시를 불러오는 중입니다.</p>}
    {status === "error" && <div role="alert"><p>예시를 불러오지 못했습니다. 아래 입력란에 직접 붙여넣을 수 있습니다.</p><button onClick={() => setAttempt(n => n + 1)}>예시 다시 불러오기</button></div>}
    {status === "ready" && !examples.length && <p role="status">등록된 예시가 없습니다. 아래 입력란에 직접 붙여넣어 주세요.</p>}
    {status === "ready" && <div className="policy-example-list">{examples.map(example => <article className="policy-example" key={example.id}>
      <div className="policy-example-meta"><span className={`badge ${example.legal_status === "PROPOSED" ? "warning" : "plain"}`}>{example.legal_status === "PROPOSED" ? "입법예고 (미확정)" : "시행 예정"}</span><span>{example.authority} / 발표 {example.announced_at}</span></div>
      <h4>{example.title}</h4>
      <p className="policy-example-summary">{example.summary}</p>
      <p className="policy-example-date">시행 예정일: {example.effective_from ?? "미확정"} / 자료 확인일: {example.verified_on}</p>
      <details><summary>출처와 확인 범위</summary><p>{example.source_title}</p><p>{example.locator}</p><p>{example.review_note}</p></details>
      <div className="policy-example-actions"><div><a href={example.source_url} target="_blank" rel="noreferrer">공식 원문 ↗</a>{example.attachments.map(file => <a key={file.format} href={file.url} target="_blank" rel="noreferrer">{file.format} ↗</a>)}</div><button type="button" onClick={() => onLoad(example)} aria-label={`${example.title} 검토 요약 추가`}>검토 요약 추가</button></div>
    </article>)}</div>}
  </section>;
}
