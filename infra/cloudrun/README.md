# Cloud Run 배포

웹과 API를 별도 서비스로 배포한다. API에서만 Gemini를 호출하며, API 키는 Secret Manager에서 실행 시 주입한다. 아래 명령은 저장소 루트에서 실행한다. 행사 프로젝트 ID와 계정은 파일에 기록하지 않는다.

## 사전 준비

- Cloud Build, Cloud Run, Artifact Registry와 Secret Manager를 사용할 수 있어야 한다.
- Artifact Registry에 Docker 저장소 `cloud-run-source-deploy`가 있어야 한다.
- `GEMINI_API_KEY` 시크릿과 실행 서비스 계정의 해당 시크릿 접근 권한이 필요하다.
- 선택한 모델을 해당 키로 실제 호출할 수 있어야 한다. 행사에서는 `gemini-4-argon` 호출을 확인했다.
- 소스 업로드용 버킷이 없으면 생성하거나 접근 가능한 버킷을 지정한다.

```bash
export CLOUD_PROJECT="YOUR_PROJECT_ID"
export CLOUD_REGION="asia-northeast3"
export RUNTIME_SERVICE_ACCOUNT="YOUR_RUNTIME_SERVICE_ACCOUNT"
export GEMINI_MODEL="gemini-4-argon"
export IMAGE_TAG="YOUR_UNIQUE_RELEASE_TAG"
export IMAGE_BASE="${CLOUD_REGION}-docker.pkg.dev/${CLOUD_PROJECT}/cloud-run-source-deploy"
export SOURCE_BUCKET="gs://run-sources-${CLOUD_PROJECT}-${CLOUD_REGION}/sweethome"
```

## API 빌드와 배포

```bash
make check
gcloud meta list-files-for-upload
gcloud builds submit . --project="$CLOUD_PROJECT" --region="$CLOUD_REGION" \
  --gcs-source-staging-dir="$SOURCE_BUCKET" \
  --config=infra/cloudrun/build-api.yaml \
  --substitutions="_IMAGE=${IMAGE_BASE}/sweethome-api:${IMAGE_TAG}"

gcloud run deploy sweethome-api --project="$CLOUD_PROJECT" --region="$CLOUD_REGION" \
  --image="${IMAGE_BASE}/sweethome-api:${IMAGE_TAG}" \
  --service-account="$RUNTIME_SERVICE_ACCOUNT" --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --set-env-vars="GEMINI_MODEL=${GEMINI_MODEL},POLICYMAP_ENV=hackathon" \
  --port=8080 --memory=512Mi --cpu=1 --concurrency=8 \
  --max-instances=2 --min-instances=0 --timeout=120

export API_URL="$(gcloud run services describe sweethome-api \
  --project="$CLOUD_PROJECT" --region="$CLOUD_REGION" --format='value(status.url)')"
```

## 웹 빌드와 배포

`VITE_API_URL`은 실행 시가 아니라 웹 이미지 빌드 시 반영한다. API 주소가 바뀌면 웹도 다시 빌드한다.

```bash
gcloud builds submit . --project="$CLOUD_PROJECT" --region="$CLOUD_REGION" \
  --gcs-source-staging-dir="$SOURCE_BUCKET" \
  --config=infra/cloudrun/build-web.yaml \
  --substitutions="_IMAGE=${IMAGE_BASE}/sweethome-web:${IMAGE_TAG},_API_URL=${API_URL}"

gcloud run deploy sweethome --project="$CLOUD_PROJECT" --region="$CLOUD_REGION" \
  --image="${IMAGE_BASE}/sweethome-web:${IMAGE_TAG}" --allow-unauthenticated \
  --port=8080 --memory=256Mi --cpu=1 --max-instances=2 --min-instances=0

export WEB_URL="$(gcloud run services describe sweethome \
  --project="$CLOUD_PROJECT" --region="$CLOUD_REGION" --format='value(status.url)')"

gcloud run services update sweethome-api --project="$CLOUD_PROJECT" --region="$CLOUD_REGION" \
  --update-env-vars="POLICYMAP_ALLOWED_ORIGINS=${WEB_URL}"
curl --fail "${API_URL}/health"
curl --fail "${WEB_URL}/health"
```

## 확인과 운영 범위

1. 공개 웹에서 공식 요약을 불러와 자동 추출을 실행한다. 응답의 `engine`이 `GEMINI`인지 확인한다.
2. 원문 인용과 변경 전후 수치를 확인하고 서울 25개 구를 선택한다.
3. 조건부 공급 계산 후 한 지역의 사업 수를 바꾸어 재계산한다.
4. 가구 보증 한도 실험, JSON 저장, 그래프와 발표 화면도 확인한다.

`.gcloudignore`는 앱, 공개 데이터와 배포 설정만 업로드하도록 제한한다. 키, 로컬 환경 파일, 의존성 폴더와 작업 산출물을 업로드하지 않는다. `.dockerignore`도 이미지 빌드 단계에서 별도로 적용한다.

공개 데모용 서비스다. CORS는 인증이나 과금 한도 장치가 아니다. 최대 인스턴스 수는 2개로 제한했지만, 장기 공개 운영에는 사용자 인증, 요청 제한과 예산 알림을 추가해야 한다. `/health`의 `fixture_mode: true`는 기존 시연 데이터가 포함된다는 뜻이며, 새 문서의 Gemini 추출 여부는 분석 응답에서 별도로 확인한다.

참고: [Cloud Run 시크릿 설정](https://docs.cloud.google.com/run/docs/configuring/services/secrets), [Gemini 콘텐츠 생성 API](https://ai.google.dev/api/generate-content).
