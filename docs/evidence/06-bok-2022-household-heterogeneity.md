---
evidence_id: EV-BOK-2022-45
title: "금리상승 시 소비감소의 이질적 효과: 가계 특성별 미시자료를 이용한 소비제약 분석"
publisher: "한국은행"
published_at: "2022-12-07"
series: "BOK 이슈노트 제2022-45호"
source_url: "https://www.bok.or.kr/portal/bbs/P0002353/view.do?menuNo=2004&nttId=10074253"
source_type: "central_bank_issue_note"
review_status: "public_summary_reviewed"
---

# 한국은행 2022: 금리와 DSR 충격의 가구별 차이

## 서지정보

- 저자는 오태희, 이규환, 남명훈과 이재운이다.
- 한국노동패널 자료를 사용한다.
- 가구를 소득, 부채 수준과 자가 소유 여부에 따라 나누어 금리상승에 따른 소비반응을 분석한다.

## 핵심 Claim

| Claim ID | 충격과 결과 변수 | 효과 | 대상 | 잠정 등급 |
| --- | --- | --- | --- | --- |
| `CL-BOK22-DSR-CONSUMPTION-AVG` | DSR 1%p 상승과 연간 소비 | 전체 가구의 소비가 평균 0.37% 둔화했다. | 전체 표본 가구 | B |
| `CL-BOK22-DSR-CONSUMPTION-VULNERABLE` | 같은 충격과 취약가구 소비 | 고부채 저소득 가구와 고부채 비자가 가구의 감소폭이 평균보다 컸다. | 취약 차주 집단 | B |
| `CL-BOK22-DSR-CONSUMPTION-INCOME` | 같은 충격과 소득별 소비 | 저소득층보다 중소득 및 고소득층의 소비감소가 더 컸다. | 소득 집단별 가구 | B |
| `CL-BOK22-DEBT-CONSUMPTION-NONLINEAR` | 부채소득비율과 소비 | 부채소득비율이 약 200%를 넘으면 부채 증가가 소비감소 요인으로 바뀌었다. | 고부채 가구 | B |

## 해석

이 연구는 집값 계수보다 JEV 가구 행동 모형에 직접 유용하다. 같은 금리와 DSR 충격이라도 가구의 소득, 부채와 주택보유 여부에 따라 소비를 조정할 수 있는 여지가 다르다.

저소득층의 소비감소가 중소득 및 고소득층보다 작다는 결과를 충격이 작다는 뜻으로 해석하면 안 된다. 저소득층은 필수소비 비중이 높아 추가로 줄일 수 있는 소비가 적다는 설명이 함께 제시된다.

## JEV 상태와 행동에 반영할 항목

```text
state.income_band
state.debt_to_income
state.dsr
state.home_ownership
state.discretionary_consumption_share
state.liquid_assets

behavior.cut_discretionary_consumption
behavior.delay_home_purchase
behavior.reduce_target_home_price
behavior.increase_default_risk
```

## 시뮬레이션 적용 범위

- `DSR +1%p -> 소비 -0.37%`는 평균 소비반응이며 주택가격 효과가 아니다.
- 가구별 구매력과 소비조정 경로의 보조 계수로만 사용한다.
- DSR 규제 변경과 금리상승으로 발생한 DSR 변화를 구분한다.
- 가구별 차이를 평균값 하나로 대체하지 않는다.

## 한계와 추가 검증

- 소비와 DSR의 동시 결정 가능성을 확인해야 한다.
- 원문에서 표본 기간, 표본 수, 통제변수와 추정식의 강건성을 추가로 구조화해야 한다.
- 주택 구매행동은 직접 관측한 결과가 아니므로 소비반응에서 임의로 추론하지 않는다.
- 2022년 이후 대출구조와 금리 환경의 변화에 맞춘 재추정이 필요할 수 있다.

## 원문 위치

- 연구 질문과 자료: 한국은행 홈페이지 요약
- 평균 및 집단별 결과: 홈페이지 요약과 본문 결과 절
- 상세 계수와 신뢰구간: 원문 표를 추가 확인해야 한다.

