# 웹 발표자료

화면 오른쪽 아래의 `Presentation / 발표자료` 버튼을 누르면 `/pitch/index.html`이 새 탭으로 열립니다. 기존 시뮬레이터의 입력과 선택 상태는 유지됩니다.

## 사용법

- 좌우 방향키, Page Up과 Page Down 또는 화면의 버튼으로 이동합니다.
- Home과 End는 첫 장과 마지막 장으로 이동합니다.
- F 또는 전체화면 버튼으로 발표 모드를 시작합니다. Esc로 종료합니다.
- 아래 목차에서 특정 슬라이드를 선택할 수 있습니다.
- `#slide-7`처럼 주소에 슬라이드 번호를 붙이면 해당 장으로 바로 이동합니다.
- 원문 텍스트와 발표자 노트를 펼치면 출처 링크를 확인할 수 있습니다.
- 원본 PPTX를 내려받을 수 있습니다.

## 변환 방식과 범위

현재 `SweetHome_final_pitch_v3_EN.pptx`의 16장을 사용합니다. 같은 PPTX의 PDF 내보내기에서 만든 SVG로 본문을 표시해 글자와 도형이 확대해도 선명하게 보입니다. 목차는 가벼운 PNG 미리보기를 사용합니다. 삽입 사진과 캡처의 화질은 원본 해상도에 따릅니다. 슬라이드 본문과 발표자 노트는 PPTX의 실제 슬라이드 순서와 관계 정보를 따라 추출합니다. 웹에서 편집 가능한 HTML 슬라이드로 재작성한 것은 아닙니다.

이 페이지는 기존 발표자료의 변환본이며, 정책 사실이나 연구 결과를 새로 검증한 자료는 아닙니다. 제품 콘셉트와 예시 화면을 실제 구현 상태와 혼동하지 않도록 페이지에 안내를 표시합니다.

## 다시 내보내기

원본 PPTX와 해당 원본의 렌더링 이미지가 모두 갱신된 상태에서 실행합니다. PPTX만 바꾸면 이미지와 본문이 달라질 수 있으므로 두 산출물을 함께 갱신해야 합니다.

```bash
python3 scripts/export-pitch-web.py --source /absolute/path/SweetHome_final_pitch_v3_EN.pptx --previews /absolute/path/rendered-slides --pdf /absolute/path/matching-export.pdf
node --test scripts/pitch-web.test.mjs
```

페이지는 `apps/web/public/pitch/`에 있으며 Vite 빌드에 함께 포함됩니다. 별도 API나 외부 CDN은 필요하지 않습니다. 버튼은 `PitchLauncher.tsx`에서 독립적으로 관리합니다.

다운로드는 `deck.json`의 원본 파일을 가리킵니다. 슬라이드 이미지에는 PPTX 해시를 붙여 이전 버전의 캐시와 구분합니다. 웹 페이지가 이미 열려 있다면 새로고침해 최신 자료를 불러옵니다.
