# Fix: HealthBadge API Version Field Mismatch

## Root Cause
The `HealthBadge` component's `HealthResponse` interface expected `projectVersion` and `payloadVersion` fields, but the `/api/health` endpoint returns `version` (not `projectVersion`). When `showVersion=true`, the badge tried to access `data.projectVersion` which was `undefined`, causing the version to not display.

## What Changed
- `src/ui/web/components/HealthBadge.tsx`: Updated `HealthResponse` interface to use `version` instead of `projectVersion`/`payloadVersion`, and updated the render logic to use `data.version`.
- `tests/int/health-badge.int.spec.ts`: Updated test mocks and added regression test to verify the fix works with actual API response structure.

## Files Changed
1. `src/ui/web/components/HealthBadge.tsx` - Interface and render fix
2. `tests/int/health-badge.int.spec.ts` - Updated mocks and added regression test
