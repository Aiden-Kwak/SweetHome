# Cloud Run 배포 골격

## 이미지 빌드

```bash
make setup
make build
```

## 행사 계정에서 필요한 값

- Google Cloud 프로젝트 ID
- Artifact Registry 저장소
- 허용된 리전
- 웹에서 접근할 API Cloud Run URL
- Gemini 및 데이터 서비스 사용 권한

행사 계정을 받기 전에는 프로젝트 ID나 키를 저장소에 넣지 않는다.

## 권장 배포 순서

1. API 이미지를 Artifact Registry에 올리고 Cloud Run에 배포한다.
2. API URL을 `VITE_API_URL` 빌드 인수로 설정하여 웹 이미지를 빌드한다.
3. 웹 이미지를 Cloud Run에 배포한다.
4. API의 `POLICYMAP_ALLOWED_ORIGINS`에 웹 URL을 설정한다.
5. `/health`, `/docs`와 웹의 데모 경로를 확인한다.

실제 `gcloud` 명령은 행사 프로젝트와 리전이 정해진 뒤 추가한다. 사용자별 프로젝트 ID가 코드나 문서에 남지 않도록 한다.
