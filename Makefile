.PHONY: setup dev dev-api dev-web check test build clean

setup:
	npm install
	uv sync --project services/api --dev

dev:
	./scripts/dev.sh

dev-api:
	uv run --project services/api uvicorn policymap_api.main:app --reload --reload-dir services/api/src --host 0.0.0.0 --port 8000

dev-web:
	npm run dev:web

check:
	uv run --project services/api ruff check services/api
	uv run --project services/api pytest services/api/tests
	npm run check:web
	npm run test:web
	npm run build:web
	./scripts/validate-fixtures.sh

test:
	uv run --project services/api pytest services/api/tests
	npm run test:web

build:
	npm run build:web
	docker build -f infra/cloudrun/api.Dockerfile -t policymap-api:local .
	docker build -f infra/cloudrun/web.Dockerfile -t policymap-web:local .

clean:
	rm -rf apps/web/dist apps/web/.vite services/api/.pytest_cache services/api/.ruff_cache
