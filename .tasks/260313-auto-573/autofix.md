# Autofix Report: 260313-auto-573

## Errors Fixed

- Added missing `// @vitest-environment jsdom` directive to AxisConfigPanel.spec.tsx - The test file was missing the jsdom environment annotation, causing "document is not defined" errors
- Added missing `cleanup` import and `afterEach` hook to AxisConfigPanel.spec.tsx - Tests were failing due to leftover DOM state between test runs causing "Found multiple elements" errors
- Fixed overly broad regex `/numbers/i` to `/^numbers$/i` in test - The regex was matching "Invert X Numbers" and "Invert Y Numbers" in addition to "Numbers", causing test failures

## Quality

- TypeScript: PASS
- Lint: PASS
- Format: PASS
