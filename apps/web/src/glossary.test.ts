import { expect, it } from "vitest";
import { glossary } from "./glossary-data";
import { splitTerms, termsIn } from "./glossary";

it("preserves the exact original text",()=>{
  const text="LTV 50~70%, 고DSR 가구의 스트레스 DSR과 가산금리\nDTI";
  expect(splitTerms(text).map(p=>p.text).join("")).toBe(text);
  expect(splitTerms("")).toEqual([]);
});
it("matches longer and Korean aliases before embedded acronyms",()=>{
  expect(termsIn("스트레스 DSR과 DSR, 주담대, 가산 금리").map(t=>t.id)).toEqual(["stress-dsr","dsr","mortgage","spread"]);
  expect(termsIn("고DSR 실수요자").map(t=>t.id)).toEqual(["dsr"]);
  expect(termsIn("스트레스 가산금리").map(t=>t.id)).toEqual(["stress-rate"]);
});
it("does not match acronyms inside unrelated Latin identifiers",()=>{
  expect(termsIn("xDSR DSR_MODEL DTI2 FLTV")).toEqual([]);
  expect(termsIn("ltv / dti").map(t=>t.id)).toEqual(["ltv","dti"]);
});
it("explains a repeated concept only once per text block",()=>{
  expect(termsIn("DSR, DSR, 총부채원리금상환비율").map(t=>t.id)).toEqual(["dsr"]);
});
it("keeps a unique, sourced dictionary without executable URLs",()=>{
  expect(new Set(glossary.map(t=>t.id)).size).toBe(glossary.length);
  for(const term of glossary) {
    expect(term.description.length).toBeGreaterThan(20);
    expect(term.aliases.length).toBeGreaterThan(0);
    expect(new URL(term.sourceUrl).protocol).toBe("https:");
    expect(term.sourceTitle).not.toBe("");
  }
});
