# Issue #1971 - API Status Page "(unknown)" Fix

## Root Cause
The `HealthBadge` component (`src/ui/web/components/HealthBadge.tsx`) expected `projectVersion` and `payloadVersion` fields in the health API response, but the actual API (`src/app/api/health/route.ts`) returns a single `version` field. This caused `data.projectVersion` to be `undefined`, resulting in no version being displayed.

## Fix
Updated `HealthBadge` component to match the actual API response shape:
- Changed `HealthResponse` interface: replaced `payloadVersion` and `projectVersion` with `version`
- Changed display line from `data.projectVersion` to `data.version`

## Test
Updated `tests/int/health-badge.int.spec.ts` to use the actual API response shape (with `version` instead of `payloadVersion`/`projectVersion`). Test failed before fix and passed after.

## Files Changed
- `src/ui/web/components/HealthBadge.tsx` - Fixed interface and display
- `tests/int/health-badge.int.spec.ts` - Updated mock to match actual API response