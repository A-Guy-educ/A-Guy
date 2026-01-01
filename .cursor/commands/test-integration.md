---
name: Run Integration Tests
description: Run Vitest integration tests
---

Run `pnpm test:int` to execute integration tests.

For a specific test file:
```bash
pnpm exec vitest run tests/int/<test-file>.int.spec.ts --config ./vitest.config.mts
```

