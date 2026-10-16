import { describe, expect, it } from "vitest";
import { translateCopy } from "./i18n";

describe("interface translations", () => {
  it("translates known interface text", () => {
    expect(translateCopy("정책 시뮬레이션")).toBe("Policy simulation");
    expect(translateCopy("  바뀐 정책을 가져오세요 ")).toBe("  Import a policy change ");
  });

  it("translates dynamic interface counts", () => {
    expect(translateCopy("전체 5개 보기")).toBe("Show all 5");
    expect(translateCopy("서울 강남구 선택 / 5개 변경 규칙 선택"))
      .toBe("Seoul Gangnam selected / 5 policy changes");
  });

  it("translates dynamic household assumptions and evidence metadata", () => {
    expect(translateCopy("순자산 9.2억 원(기존 주택 매각 대금 포함), 연소득 1억 4,000만 원 기준 / 적용 변경 규칙 2개, 기간 계수 1.00, 합성 민감도 가중치 1.00. 규칙별 독립 효과를 측정한 값은 아닙니다."))
      .toContain("2 selected policy changes");
    expect(translateCopy("선택한 변경 규칙 2개가 이 가구에 적용됩니다. 6개월 기준 합성 예시 변화량의 100%를 선택한 정책과 기간의 민감도로 반영했습니다."))
      .toContain("2 selected policy changes apply to this household");
    expect(translateCopy("summary_verified_pdf_tables_pending")).toBe("Summary verified; PDF tables pending");
    expect(translateCopy("서울 노원구 대체 수요 유입 (공간 전이 효과)"))
      .toBe("Seoul Nowon substitute-demand inflow (spatial spillover effect)");
    expect(translateCopy("한국은행")).toBe("Bank of Korea");
    expect(translateCopy("원문 표의 대출 유형 간 대체 탄력성 확인 전까지 정량 수치는 null로 유지하고 지식그래프의 SUBSTITUTES_TO 경로 근거로 사용합니다."))
      .toContain("Quantitative values remain null");
  });

  it("does not rewrite policy evidence or user documents", () => {
    const source = "수도권 주택담보대출 한도를 6억 원으로 제한한다.";
    expect(translateCopy(source)).toBe(source);
  });
});
