"""Validate development fixtures against the shared JSON Schemas."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource


REPO_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = REPO_ROOT / "packages" / "contracts"
FIXTURE_DIR = REPO_ROOT / "data" / "fixtures"


def read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def build_registry() -> Registry:
    registry = Registry()
    for schema_path in sorted(SCHEMA_DIR.glob("*.schema.json")):
        schema = read_json(schema_path)
        resource = Resource.from_contents(schema)
        registry = registry.with_resource(schema["$id"], resource)
    return registry


def validate(instance: Any, schema_name: str, label: str, registry: Registry) -> list[str]:
    schema = read_json(SCHEMA_DIR / schema_name)
    validator = Draft202012Validator(
        schema,
        registry=registry,
        format_checker=FormatChecker(),
    )
    return [
        f"{label} at {'/'.join(str(item) for item in error.absolute_path) or '<root>'}: "
        f"{error.message}"
        for error in sorted(validator.iter_errors(instance), key=lambda error: list(error.path))
    ]


def main() -> int:
    registry = build_registry()
    checks: list[tuple[Any, str, str]] = [
        (
            read_json(REPO_ROOT / "data" / "public" / "context.json"),
            "public-context.schema.json",
            "public/context.json",
        ),
        (
            read_json(FIXTURE_DIR / "policy_snapshot.json"),
            "policy-snapshot.schema.json",
            "policy_snapshot.json",
        ),
        (
            read_json(FIXTURE_DIR / "scenario_result.json"),
            "scenario-result.schema.json",
            "scenario_result.json",
        ),
    ]

    for name in [
        "policy-analysis-request", "policy-analysis-response",
        "policy-experiment-request", "policy-experiment-response",
    ]:
        checks.append((
            read_json(FIXTURE_DIR / f"demo_{name}.json"),
            f"{name}.schema.json", f"demo_{name}.json",
        ))
    examples = read_json(REPO_ROOT / "data" / "public" / "policy-examples.json")
    checks.extend(
        (example, "policy-example.schema.json", f"policy-examples.json[{index}]")
        for index, example in enumerate(examples)
    )
    claims = read_json(FIXTURE_DIR / "claims.json")
    checks.extend(
        (claim, "claim.schema.json", f"claims.json[{index}]")
        for index, claim in enumerate(claims)
    )

    errors: list[str] = []
    for instance, schema_name, label in checks:
        errors.extend(validate(instance, schema_name, label, registry))

    if errors:
        print("Fixture validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Validated {len(checks)} fixture document(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
