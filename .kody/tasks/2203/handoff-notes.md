## E2E Test Failures on PR #2203

### Fixed: Hebrew Content Test Failure

**Problem**: The test `content renders correctly in Hebrew` was failing because:
1. Test authenticates via `authenticateViaAPI` which sets `payload-token` cookie but NOT `NEXT_LOCALE` cookie
2. Middleware checks `NEXT_LOCALE` cookie first, then falls back to `Accept-Language` header
3. In CI, browser `Accept-Language` is often `en`, so middleware sets locale to `en`
4. Page renders in English instead of Hebrew, test fails

**Fix**: Modified `setupAuthenticatedUser` in `tests/e2e/helpers/auth.ts` to set `NEXT_LOCALE=he` cookie after successful authentication in all code paths.

### Remaining: Header Logo Test (Flaky)

**Problem**: Test `header logo is present` finds SVG element but reports it as hidden. Marked as "flaky" in CI (passes sometimes), suggesting timing or environmental issue.

**Next step**: Investigate CSS visibility, loading states, or CI environment differences that might cause the logo to be temporarily hidden.

## Files Changed

- `tests/e2e/helpers/auth.ts` — Added `NEXT_LOCALE=he` cookie setting after authentication

## Verification

- TypeScript check: PASSED
- ESLint: PASSED
- Format check: PASSED
- Quality gates: PASSED
