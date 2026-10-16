---
trigger: glob
globs: "apps/web/**/*.{ts,tsx,css,html}"
description: "Frontend architecture, accessibility, and trust-display requirements for the PolicyMap web application."
---

# Frontend rules

- Keep data fetching in `src/api.ts` and presentation in components.
- Do not calculate policy applicability, price effects, or confidence in the browser.
- Show `data_status`, `model_status`, and the demo warning near every quantitative result.
- Use Korean for user-visible text and English for identifiers.
- Use semantic HTML, visible focus states, sufficient contrast, and reduced-motion support.
- Do not rely on color alone to show increases, decreases, risk, or confidence.
- Keep the primary result readable on a 390 px wide screen.
- Prefer progressive disclosure. Show the summary first and sources and limitations on demand.
- A loading state, empty state, error state, and incomplete-data state are required for data-driven views.
- Do not add a dependency when a small local component is sufficient.
