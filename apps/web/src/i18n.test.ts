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
      .toBe("서울 강남구 selected / 5 policy changes");
  });

  it("does not rewrite policy evidence or user documents", () => {
    const source = "수도권 주택담보대출 한도를 6억 원으로 제한한다.";
    expect(translateCopy(source)).toBe(source);
  });
});
