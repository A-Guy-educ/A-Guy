# Specification: Fix Type Safety in guest-session.ts

## Overview
Remove `'as any'` type casts from guest-session.ts service file, as they bypass TypeScript type checking. The collection should be properly registered in Payload's generated types.

## Requirements
- FR-1: Generate Payload types using `pnpm generate:types`
- FR-2: Verify GuestSessions collection is properly exported and included in payload.config.ts
- FR-3: Remove all 7 instances of `'as any'` cast from guest-session.ts

## Files Affected
- `src/server/services/guest-session.ts` — lines 149, 173, 197, 218, 236, 262, 283

## Acceptance Criteria
1. Running `pnpm generate:types` completes without errors
2. GuestSessions collection appears in the generated payload-types.ts
3. All `'as any'` casts are removed from guest-session.ts
4. TypeScript compilation passes (`pnpm tsc --noEmit`)
