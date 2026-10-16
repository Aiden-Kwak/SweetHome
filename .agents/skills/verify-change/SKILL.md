---
name: verify-change
description: Verifies a PolicyMap change before handoff by running targeted tests, repository checks, contract validation, and trust-label review. Use after implementation or before a demo.
---

# Verify a change

1. Inspect the diff and list the behavior that changed.
2. Run the smallest relevant test first.
3. Run `make check` from the repository root.
4. If UI behavior changed, run the application and verify the affected path in a browser.
5. Confirm that quantitative views still display `data_status`, `model_status`, and limitations.
6. Confirm that contract changes are reflected in Python, TypeScript, fixtures, and documentation.
7. Confirm that no `.env.local`, credential, large generated artifact, or private data is staged.
8. Report commands run, results, and remaining limitations.

Never report a command as passing unless it was executed successfully.
