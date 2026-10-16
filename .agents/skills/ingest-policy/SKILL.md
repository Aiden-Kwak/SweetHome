---
name: ingest-policy
description: Ingests an official Korean housing-policy document into atomic, temporal, source-linked PolicyMap rules. Use when adding, updating, or reviewing policy data.
---

# Ingest an official policy

## Required inputs

- Official source URL or local official document
- Issuing institution
- Publication or announcement date
- Requested analysis scope

## Procedure

1. Preserve the source metadata, retrieval time, and content hash.
2. Determine whether the document is a policy package, legal implementation source, correction, or commentary.
3. Extract candidate measures and split each measure into atomic rules.
4. For every rule, capture:
   - affected variable and value
   - unit and comparison operator
   - geography
   - household, property, loan, or actor scope
   - announcement, promulgation, effective, grace, and expiration dates
   - exception and transition provisions
   - exact source excerpt or locator
5. Compare each rule to the currently active rule and classify it as new, tightened, loosened, extended, expired, superseded, or corrected.
6. Validate the result against `packages/contracts/policy-rule.schema.json`.
7. Flag ambiguity or conflicting official sources. Do not guess.
8. Add tests or fixture validation when a new rule shape is introduced.
9. Update coverage only after all mandatory fields and source checks pass.

## Prohibited shortcuts

- Do not treat a press summary as the legal implementation source when a law, decree, regulation, or notice exists.
- Do not infer an effective date from an announcement date.
- Do not collapse exceptions into free-form notes.
- Do not use news articles as the authority for a rule.
- Do not assign an effect size during policy ingestion.
