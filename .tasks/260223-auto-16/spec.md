# Fix Type Safety in guest-session.ts

## Overview
Remove `as any` type casts from the guest-session.ts service by ensuring proper Payload types are generated and used.

## Requirements
1. Generate Payload types using `pnpm generate:types`
2. Verify GuestSessions collection is properly exported and included in payload.config.ts
3. Replace all `as any` casts with proper types

## Files Affected
- `src/server/services/guest-session.ts` — lines 178, 202, 223, 241, 267, 288

## Acceptance Criteria
- [ ] All `as any` casts removed from guest-session.ts (use `'guest-sessions' as const` or import generated GuestSession type from payload-types.ts)
- [ ] TypeScript compiles without errors
- [ ] Code continues to function correctly
