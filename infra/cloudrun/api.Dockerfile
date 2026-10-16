FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

COPY services/api ./services/api
COPY data/fixtures ./data/fixtures
COPY data/public ./data/public
RUN uv sync --project services/api --frozen --no-dev

ENV POLICYMAP_ENV=production
ENV POLICYMAP_FIXTURE_DIR=/app/data/fixtures
ENV PORT=8080

EXPOSE 8080

CMD ["uv", "run", "--project", "services/api", "--no-dev", "uvicorn", "policymap_api.main:app", "--host", "0.0.0.0", "--port", "8080"]
