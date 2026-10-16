import { describe, expect, it } from "vitest";
import { appendPolicyExample, policyExampleDraft } from "./policy-examples";
import type { PolicyExample } from "./types";

const example: PolicyExample = {
  id: "test-proposal", title: "검토할 개정안", title_en: "Draft for review",
  authority: "공식 기관", announced_at: "2026-09-16", effective_from: null,
  legal_status: "PROPOSED", source_url: "https://moleg.go.kr/",
  source_title: "입법예고", locator: "1. 개정이유", source_excerpt: "원문 발췌",
  summary: "확정되지 않은 개정안입니다.", summary_en: "A proposed amendment.",
  attachments: [], verified_on: "2026-10-16", review_note: "시행 여부를 확인해야 합니다.",
};

describe("policy example review drafts", () => {
  it("preserves provenance and distinguishes proposals from effective rules", () => {
    const text = policyExampleDraft(example);
    expect(text).toContain("입법예고 중인 개정안 (미확정)");
    expect(text).toContain("시행 예정일: 미확정");
    expect(text).toContain(example.source_url);
    expect(text).toContain(example.locator);
    expect(text).toContain("규칙 추출과 조건 검토 후 별도로 시뮬레이션을 실행합니다");
  });
  it("appends without overwriting the user's existing content", () => {
    const draft = "내 메모\n기존 조건을 확인해야 합니다.";
    expect(appendPolicyExample(draft, example)).toBe(draft + "\n\n---\n\n" + policyExampleDraft(example));
    expect(appendPolicyExample("", example)).toBe(policyExampleDraft(example));
  });
  it("includes scheduled dates and downloadable attachments", () => {
    const text = policyExampleDraft({...example, legal_status: "SCHEDULED", effective_from: "2026-10-19", attachments: [{format: "PDF", url: "https://www.fsc.go.kr/file.pdf"}]});
    expect(text).toContain("시행 예정일: 2026-10-19");
    expect(text).toContain("PDF 첨부: https://www.fsc.go.kr/file.pdf");
    expect(text).not.toContain("문서 상태: 입법예고");
  });
});
