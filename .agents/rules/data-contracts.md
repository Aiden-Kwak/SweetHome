---
trigger: glob
globs: "packages/contracts/**/*.json, data/**/*.json"
description: "Schema, fixture, identifier, provenance, and synthetic-data requirements."
---

# Data contract rules

- Validate JSON after every contract or fixture change.
- Keep identifiers stable and machine-readable.
- Prefix every synthetic record identifier with `demo_`.
- Use ISO 8601 dates and explicit units.
- Do not omit an unknown field to imply certainty. Use `null` plus a status or limitation when the contract permits it.
- A policy rule requires an official source URL, source title, and source excerpt or locator.
- A Claim requires method, sample scope, outcome, horizon, evidence grade, and limitations.
- Contract changes must update matching Python models, TypeScript types, fixtures, and tests.
- Do not commit scraped copyrighted report bodies. Store permitted excerpts, metadata, hashes, and source links.
