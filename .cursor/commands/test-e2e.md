---
name: Run E2E Tests
description: Run Playwright end-to-end tests
---

Run `pnpm test:e2e` to execute Playwright E2E tests.

For headed mode (see browser):
```bash
pnpm exec playwright test --headed
```

For UI mode:
```bash
pnpm exec playwright test --ui
```

