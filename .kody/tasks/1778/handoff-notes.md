# Handoff Notes: Issue #1778 — API Status page shows "(unknown)" label

## What I did

**Root cause**: The `HealthBadge` component's `HealthResponse` interface had field names that didn't match the actual `/api/health` endpoint response:
- HealthBadge expected: `projectVersion`, `payloadVersion`, `gitSha`
- Actual endpoint returns: `version` (NOT `projectVersion`), no `payloadVersion`, `gitSha`

When the endpoint returned `version: 'unknown'` and `gitSha: 'unknown'` (from env vars), the badge rendered confusing "(unknown)" text.

**Fix in `src/ui/web/components/HealthBadge.tsx`**:
1. Updated `HealthResponse` interface to use `version` (not `projectVersion`) matching the actual API response
2. Removed `payloadVersion` from interface (not returned by API)
3. Added guard `data.version !== 'unknown' && data.gitSha !== 'unknown'` before rendering version info span — when env vars are not set and values fallback to 'unknown', the version suffix is simply not shown

**Test update in `tests/int/health-badge.int.spec.ts`**:
- Updated interface and mock responses to use `version` (not `projectVersion`)
- Added regression test: "does not show (unknown) when projectVersion is missing and gitSha is unknown"
- Added integration test: "does not show ambiguous (unknown) text when API returns actual response format"

## Key files
- `src/ui/web/components/HealthBadge.tsx` — fixed version display logic
- `tests/int/health-badge.int.spec.ts` — updated mocks and added regression tests

## Verification
All 10 health-badge tests pass. Full quality gates (typecheck, lint, tests) green.
