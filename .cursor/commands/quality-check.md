---
name: Quality Check
description: Run all quality gates (typecheck, lint, tests)
---

Run all quality gates to ensure code is ready for PR:

1. TypeScript check: `pnpm typecheck`
2. Lint: `pnpm lint`
3. Integration tests: `pnpm test:int`

Report any errors found.

