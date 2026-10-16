export interface GlossaryTerm {
  id: string;
  label: string;
  aliases: string[];
  description: string;
  sourceTitle: string;
  sourceUrl: string;
}

// Concept definitions only: these are not the current regulatory limits or model inputs.
// Official references checked on 2026-10-16. Match longer aliases before shorter ones.
export const glossary: GlossaryTerm[] = [
  {
    id: "ltv",
    label: "LTV (담보인정비율)",
    aliases: ["LTV", "담보인정비율", "주택담보인정비율"],
    description: "집의 담보가치에 비해 대출을 얼마나 받을 수 있는지 나타내는 비율입니다. 실제 한도는 선순위 대출과 임차보증금, 소득 심사 등도 함께 고려하므로 집값에 LTV만 곱한 금액과 다를 수 있습니다.",
    sourceTitle: "한국주택금융공사 보금자리론 설명서, 용어 설명",
    sourceUrl: "https://www.hf.go.kr/ko/sub04/sub04_10_01.do?articleNo=474909&mode=view",
  },
  {
    id: "dsr",
    label: "DSR (총부채원리금상환비율)",
    aliases: ["DSR", "총부채원리금상환비율"],
    description: "연소득 중 각종 대출의 원금과 이자를 갚는 데 쓰는 연간 금액의 비율입니다. 주택담보대출뿐 아니라 신용대출 등도 살펴보며, 포함되는 대출과 상환액 계산에는 제도별 예외가 있습니다.",
    sourceTitle: "금융위원회 DSR 도입 및 산정방식 안내",
    sourceUrl: "https://www.fsc.go.kr/po010101/73369",
  },
  {
    id: "dti",
    label: "DTI (총부채상환비율)",
    aliases: ["DTI", "총부채상환비율"],
    description: "연소득에 비해 주택담보대출 원금과 이자, 기타 대출 이자를 얼마나 갚는지 보는 비율입니다. 기타 대출의 원금까지 함께 보는 DSR과는 계산 범위가 다릅니다.",
    sourceTitle: "한국주택금융공사 보금자리론 설명서, DTI 용어 설명",
    sourceUrl: "https://www.hf.go.kr/ko/sub04/sub04_10_01.do?articleNo=474909&mode=view",
  },
  {
    id: "stress-dsr",
    label: "스트레스 DSR",
    aliases: ["스트레스 DSR", "스트레스DSR", "스트레스-DSR"],
    description: "앞으로 금리가 오를 가능성까지 가정해 대출 상환능력을 심사하는 방식입니다. DSR을 계산할 때 심사용 금리를 더하므로 대출 가능액이 줄 수 있지만, 이 때문에 실제 납부하는 대출금리가 오르는 것은 아닙니다.",
    sourceTitle: "금융위원회 스트레스 DSR 안내",
    sourceUrl: "https://www.fsc.go.kr/no040101?cnId=2386",
  },
  {
    id: "stress-rate",
    label: "스트레스 금리",
    aliases: ["스트레스 금리", "스트레스금리", "스트레스 가산금리", "스트레스가산금리"],
    description: "미래 금리 상승에 대비해 DSR 심사에만 더하는 금리입니다. 실제 이자에 붙는 금리가 아니며, 적용 수준은 대출 상품과 금리 유형, 시행 시점에 따라 달라집니다.",
    sourceTitle: "금융위원회 스트레스 DSR 제도 도입방안",
    sourceUrl: "https://www.fsc.go.kr/po010101/81343",
  },
  {
    id: "spread",
    label: "가산금리",
    aliases: ["가산금리", "가산 금리"],
    description: "은행이 대출의 기준이 되는 지표금리에 비용과 위험, 이익 등을 반영해 더하는 금리입니다. 일반적인 대출 가산금리는 실제 이자에 영향을 주지만, 스트레스 금리는 한도 심사용이므로 구별해야 합니다.",
    sourceTitle: "한국은행 기준금리 인하와 대출금리 변동 바로 이해하기",
    sourceUrl: "https://www.bok.or.kr/portal/bbs/B0000347/view.do?menuNo=201106&nttId=10087727",
  },
  {
    id: "base-rate",
    label: "기준금리",
    aliases: ["한국은행 기준금리", "기준금리", "기준 금리"],
    description: "한국은행이 통화정책을 운용할 때 기준으로 삼는 정책금리입니다. 개인의 대출금리와 같지는 않으며, 대출 상품의 금리를 계산할 때 쓰는 지표금리와도 구별해야 합니다.",
    sourceTitle: "한국은행 기준금리 및 여수신금리 설명",
    sourceUrl: "https://snapshot.bok.or.kr/search/%EA%B8%88%EB%A6%AC",
  },
  {
    id: "mortgage",
    label: "주택담보대출",
    aliases: ["주택담보대출", "주택 담보 대출", "주담대"],
    description: "주택을 담보로 맡기고 받는 대출입니다. 담보가치뿐 아니라 소득과 기존 부채, 상품 조건 등에 따라 대출 가능액이 달라집니다.",
    sourceTitle: "한국주택금융공사 보금자리론 설명서",
    sourceUrl: "https://www.hf.go.kr/ko/sub04/sub04_10_01.do?articleNo=474909&mode=view",
  },
  {
    id: "land-permit",
    label: "토지거래허가구역",
    aliases: ["토지거래허가구역", "토지거래 허가구역", "토지거래허가제", "토허제"],
    description: "일정한 토지 거래를 하려면 관할 지방자치단체의 허가를 받아야 하는 지정 구역입니다. 아파트의 토지 지분도 대상이 될 수 있으며, 실제 적용 여부는 지정 범위와 면적 기준, 계약 내용 등을 확인해야 합니다.",
    sourceTitle: "서울시 토지거래허가구역 지정 및 허가 기준 안내",
    sourceUrl: "https://www.seoul.go.kr/news/news_report.do?nttNo=455446",
  },
  {
    id: "residence-duty",
    label: "실거주 의무",
    aliases: ["실거주 의무", "실거주의무"],
    description: "주택을 취득한 사람이 정해진 조건에 따라 그 집에서 직접 살아야 하는 의무입니다. 토지거래허가 등 근거 제도에 따라 기간과 예외, 유예 조건이 달라지므로 모든 주택에 동일하게 적용되는 규칙은 아닙니다.",
    sourceTitle: "서울시 토지거래허가와 실거주 의무 유예 설명",
    sourceUrl: "https://www.seoul.go.kr/news/news_report.do?bbsNo=158&nttNo=466290",
  },
  {
    id: "spillover",
    label: "전이효과",
    aliases: ["전이효과", "전이 효과", "공간 전이", "풍선효과", "풍선 효과"],
    description: "한 지역의 정책이나 시장 변화가 다른 지역의 수요와 가격에도 영향을 미치는 현상입니다. 규제 밖의 지역으로 수요가 이동하는 풍선효과가 한 예이며, 항상 발생하거나 가격 상승으로 이어지는 것은 아닙니다. 이 화면의 전이 경로는 합성 시나리오의 가정입니다.",
    sourceTitle: "KDI 주택시장과 규제, 토지거래허가제의 공간적 영향",
    sourceUrl: "https://www.kdi.re.kr/research/reportView?pub_no=18385",
  },
  {
    id: "policy-mortgage",
    label: "정책모기지",
    aliases: ["정책모기지", "정책 모기지"],
    description: "주거 안정 등 정책 목적에 따라 공급하는 주택담보대출입니다. 보금자리론과 디딤돌대출 등이 해당하며, 소득과 주택가격, 금리 및 한도 조건은 상품과 신청 시점별로 다릅니다.",
    sourceTitle: "한국주택금융공사 정책모기지 안내",
    sourceUrl: "https://hf.go.kr/_custom/hf/_common/board/index/21.do?articleNo=498618&mode=view",
  },
];
