import type { PolicyExample } from "./types";
import { savedLocale, translateCopy, type Locale } from "./i18n";

const draftLocale = (): Locale => typeof window === "undefined" ? "ko" : savedLocale();

// Review text only: never converts an announcement into executable policy rules.
export function policyExampleDraft(example: PolicyExample, locale: Locale = draftLocale()): string {
  if (locale === "en") return [
    `# ${example.title_en || translateCopy(example.title)}`,
    "[Review summary based on an official source; not the full document or an extracted executable rule.]",
    `Announcing authority: ${translateCopy(example.authority)}`,
    `Announcement date: ${example.announced_at}`,
    `Document status: ${example.legal_status === "PROPOSED" ? "Proposed amendment (not final)" : "Scheduled to take effect"}`,
    `Expected effective date: ${example.effective_from ?? "Not confirmed"}`,
    `Source checked: ${example.verified_on}`,
    "", example.summary_en || translateCopy(example.summary), "",
    `Source: ${translateCopy(example.source_title)}`,
    `Official URL: ${example.source_url}`,
    `Location in source: ${translateCopy(example.locator)}`,
    `Short excerpt (display translation): ${translateCopy(example.source_excerpt)}`,
    ...example.attachments.map(file => `${file.format} attachment: ${file.url}`),
    "", `Review scope: ${translateCopy(example.review_note)}`,
    "Importing a document does not change the map or household results. Extract a rule, review its conditions, then run a separate simulation.",
  ].join("\n");
  return [
    `# ${example.title}`,
    "[공식 자료 기반 검토 요약: 원문 전문이나 추출 완료된 규칙이 아닙니다.]",
    `발표 기관: ${example.authority}`,
    `발표일: ${example.announced_at}`,
    `문서 상태: ${example.legal_status === "PROPOSED" ? "입법예고 중인 개정안 (미확정)" : "시행 예정"}`,
    `시행 예정일: ${example.effective_from ?? "미확정"}`,
    `확인일: ${example.verified_on}`,
    "", example.summary, "",
    `출처: ${example.source_title}`,
    `원문: ${example.source_url}`,
    `확인 위치: ${example.locator}`,
    `짧은 원문 발췌: ${example.source_excerpt}`,
    ...example.attachments.map(file => `${file.format} 첨부: ${file.url}`),
    "", `검토 범위: ${example.review_note}`,
    "입력 단계에서는 지도와 가구 결과를 변경하지 않습니다. 규칙 추출과 조건 검토 후 별도로 시뮬레이션을 실행합니다.",
  ].join("\n");
}

export function appendPolicyExample(draft: string, example: PolicyExample, locale: Locale = draftLocale()): string {
  return `${draft}${draft.trim() ? "\n\n---\n\n" : ""}${policyExampleDraft(example, locale)}`;
}
