# PolicyMap

PolicyMap은 한국 부동산 정책을 시간 기반 지식 그래프로 구성하고, 정책 변경이 지역과 가구 유형에 미치는 경로를 설명하는 해커톤 프로젝트입니다.

현재 저장소는 개발 하네스입니다. 포함된 정책과 결과 데이터는 합성된 데모 자료이며 실제 가격 예측이나 투자 판단에 사용할 수 없습니다.

2026년 10월 16일에 실제 행정경계와 서울시 실거래 표본 30건을 연결했습니다. 관측 자료는 합성 예측과 구분되어 있으며 [변경 내용과 인수인계](docs/UI_DATA_HANDOFF.md), [공개 자료 출처](data/public/README.md)에서 범위와 한계를 확인할 수 있습니다.

## 빠른 시작

필요한 도구는 Node.js 20 이상, Python 3.12 이상, `uv`, Docker입니다.

```bash
make setup
make dev
```

실행 후 다음 주소를 사용합니다.

- 웹: http://localhost:5173
- API 문서: http://localhost:8000/docs
- 상태 확인: http://localhost:8000/health

종료하려면 각 터미널에서 `Ctrl+C`를 누릅니다.

## 검증 명령

```bash
make check
make test
make build
```

- `make check`: Python 린트, 백엔드와 프런트엔드 테스트, TypeScript 검사, 웹 빌드와 fixture 검증을 실행합니다.
- `make test`: 백엔드와 프런트엔드 테스트를 실행합니다.
- `make build`: 배포 가능한 웹과 컨테이너 이미지를 빌드합니다. 실행 중인 Docker 데몬이 필요합니다.

## 저장소 구조

```text
.
├── GEMINI.md                 Antigravity 상시 프로젝트 규칙
├── .agents/
│   ├── rules/                파일 유형별 개발 규칙
│   └── skills/               반복 작업용 Antigravity 스킬
├── apps/web/                 React 사용자 인터페이스
├── services/api/             FastAPI와 데모 시뮬레이션 오케스트레이션
├── packages/contracts/       정책, 근거, 시나리오 JSON Schema
├── data/fixtures/            합성 데모 데이터
├── docs/                     제품 및 기술 문서
├── infra/cloudrun/           Google Cloud 배포 골격
└── scripts/                  로컬 검증과 개발 스크립트
```

## Antigravity에서 시작하기

1. Antigravity에서 새 프로젝트를 만듭니다.
2. 이 저장소 폴더를 프로젝트에 추가합니다.
3. 첫 작업은 `/start-task`를 호출하거나 다음과 같이 요청합니다.

```text
GEMINI.md와 docs/PRODUCT_SPEC.md를 읽고, 현재 하네스의 상태를 확인한 다음 첫 번째 실제 정책 수집 기능을 구현해줘.
```

Antigravity는 루트의 `GEMINI.md`, `.agents/rules/`, `.agents/skills/`를 자동으로 인식합니다.

## 환경 변수

`.env.example`을 참고해 `.env.local`을 만듭니다. 비밀값은 저장소에 커밋하지 않습니다.

```bash
cp .env.example .env.local
```

기본 하네스는 Gemini 키가 없어도 합성 데이터로 실행됩니다. 실제 모델 호출을 연결할 때만 관련 값을 설정합니다.

## 중요한 제한

- 현재 정책 스냅샷의 상태는 `DEMO_INCOMPLETE`입니다.
- 가격 범위와 가구 반응은 인터페이스 검증용 합성 데이터입니다.
- 실제 정책 원문 수집, 전체 정책 완전성 감사와 백테스트는 아직 구현하지 않았습니다.
- 실제 수치를 표시하려면 제품 기획서의 출시 조건을 먼저 충족해야 합니다.

## 문서

- [실제 정책 문서 추출과 조건부 시뮬레이션](docs/POLICY_PIPELINE.md)

- [금융 용어 사전과 빠른 도움말](docs/GLOSSARY.md)
- [지식 그래프 탐색과 노코드 편집](docs/GRAPH_EDITOR.md)
- [제품 기획](docs/PRODUCT_SPEC.md)
- [시스템 아키텍처](docs/ARCHITECTURE.md)
- [데이터 모델](docs/DATA_MODEL.md)
- [정책효과 근거 자료실](docs/evidence/README.md)
- [개발 백로그](docs/BACKLOG.md)
- [데모 안내](docs/DEMO.md)
- [최종 발표 시연 기획](docs/FINAL_DEMO.md)
- [의사결정 기록](docs/DECISIONS.md)
