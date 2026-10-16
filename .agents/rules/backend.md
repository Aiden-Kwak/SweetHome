---
trigger: glob
globs: "services/api/**/*.py"
description: "FastAPI, Python, validation, provenance, and simulation safety rules."
---

# Backend rules

- Validate every external input with Pydantic.
- Return explicit `data_status`, `model_status`, version, and limitations metadata.
- Keep route functions thin. Put repository and scenario logic in separate modules.
- Do not use floating-point output without units and an explanation of its source.
- Reject unsupported regions or scenarios instead of silently substituting a fixture.
- Use timezone-aware dates and ISO 8601 at API boundaries.
- Keep calculations deterministic unless a seed is accepted and recorded.
- Never call a model inside a unit test.
- Any model-generated extraction must retain the source locator and extraction confidence.
- Raise structured API errors without exposing secrets or internal file paths.
