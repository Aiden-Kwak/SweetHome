---
name: start-task
description: Starts a PolicyMap feature or fix by grounding the task in product constraints, architecture, contracts, and a verifiable implementation plan. Use for any new coding task or significant change.
---

# Start a task

1. Read `GEMINI.md` and the documents it routes to for the requested area.
2. Inspect the current implementation and tests before proposing changes.
3. Restate the user outcome in one sentence.
4. Identify the affected contract, service boundary, trust state, and demo limitation.
5. Write a short implementation plan with concrete files and verification commands.
6. Implement the smallest complete vertical slice.
7. Add or update tests.
8. Run `/verify-change` before reporting completion.

Do not create real-looking policy facts or price effects to make the feature appear complete. Use clearly labeled fixture records when real data is not available.
