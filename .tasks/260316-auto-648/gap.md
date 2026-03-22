# Gap Analysis: 260316-auto-648

## Summary

- Gaps Found: 2
- Spec Revised: Yes

## Gaps Found

### Gap 1: Vitest Coverage Config Already Exists

**Severity:** Medium
**Location:** `vitest.config.unit.mts`
**Issue:** The spec states to "add coverage config to vitest.config.unit.mts" but the file already has complete coverage configuration:

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'lcov'],
  include: [...],
  exclude: [...],
  thresholds: {
    statements: 30,
    branches: 25,
    functions: 30,
  },
}
```

**Fix Applied:** Updated spec to clarify that vitest config is complete, and the actual change needed is adding the `--coverage` flag to the CI workflow's `test:unit` step.

### Gap 2: Browser Tracing Integration Missing

**Severity:** High
**Location:** `src/infra/instrumentation-client.ts`
**Issue:** The file has `Sentry.replayIntegration()` but is missing `Sentry.browserTracingIntegration()`. This means Web Vitals (LCP, FID/INP, CLS, TTFB, FCP) are not being captured.

Current code (lines 21-26):
```typescript
integrations: [
  Sentry.replayIntegration({
    maskAllText: true,
    blockAllMedia: true,
  }),
],
```

**Fix Applied:** This gap is correctly identified in the spec. No spec revision needed - FR-008 (Web Vitals Tracking) is correctly specified.

## Changes Made to Spec

- Updated acceptance criteria to clarify that vitest.config.unit.mts already has coverage config
- Clarified that the CI change is adding `--coverage` flag, not modifying vitest config

## Verification of Other Items

| Item | Status | Notes |
|------|--------|-------|
| Security headers (next.config.js) | Needs Implementation | No headers() function exists |
| Frontend error.tsx | Needs Implementation | File does not exist |
| Env validation | Needs Implementation | File does not exist |
| handleCodyApiError | Needs Implementation | Has console.error, NO Sentry |
| captureAndRespond utility | Exists | Already has Sentry integrated |
| 6 non-Cody routes | Varies | Some have captureAndRespond, some need it |
| Web Vitals | Needs Implementation | Missing browserTracingIntegration |
| CI coverage | Partial | vitest has config, CI missing --coverage flag |

## No Other Gaps Found

The spec accurately covers:
- All Phase 1 critical items (headers, error boundary, env validation)
- All Phase 2 Sentry coverage items
- All Phase 3 infrastructure items

The two gaps identified are:
1. A misunderstanding that vitest config needed to be added (it's already there)
2. A correctly-identified gap for browserTracingIntegration
