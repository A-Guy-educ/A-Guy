# Specification: Fix Type Safety in guest-session.ts

## Overview
The guest-session.ts service file uses a custom `GuestSessionDoc` interface instead of the generated `GuestSession` type from Payload, requiring type casts. Fix by importing and using the generated type.

## Requirements
- FR-1: Verify GuestSessions collection is properly exported and included in payload.config.ts (already done)
- FR-2: Import `GuestSession` type from `payload-types.ts` in guest-session.ts
- FR-3: Replace custom `GuestSessionDoc` interface with the generated `GuestSession` type
- FR-4: Remove unnecessary type casts that bridge custom interface to Payload types
- FR-5: Keep `'guest-sessions' as const` casts (these are type-safe literal type assertions)

## Files Affected
- `src/server/services/guest-session.ts` — import GuestSession, remove custom interface, update casts

## Acceptance Criteria
1. GuestSessions collection is properly exported and included in payload.config.ts (VERIFIED)
2. `GuestSession` type from `payload-types.ts` is imported in guest-session.ts
3. Custom `GuestSessionDoc` interface is replaced with generated `GuestSession` type
4. Type casts to custom interface are removed or updated
5. `'guest-sessions' as const` casts remain (type-safe)
6. TypeScript compilation passes (`pnpm tsc --noEmit`)
