# Plan: Fix guest-sessions collection type safety

**Task ID**: 260225-auto-90
**Task Type**: fix_bug
**Branch**: fix/260225-auto-90-guest-sessions-type-safety

---

## Summary

The `guest-session.ts` service uses `'guest-sessions' as const` type casts on 7 Payload API calls (lines 150, 178, 201, 222, 239, 265, 286). These are unnecessary because the `'guest-sessions'` collection is properly registered in Payload's type system (`payload-types.ts` line 77). The test factory `guest-session.factory.ts` also uses `as any` on line 73 and `as any` on line 109. All these should be removed for proper type safety.

Additionally, the service defines a manual `GuestSessionDoc` interface (lines 23-35) that duplicates the auto-generated `GuestSession` type from `payload-types.ts`. The manual interface should be replaced with the generated one to prevent type drift. There are also multiple `as unknown as GuestSessionDoc` and `as GuestSessionDoc` casts that become unnecessary once we use the proper generated type.

## Assumptions

- The `GuestSession` type from `payload-types.ts` is the source of truth and matches the collection schema
- Removing `as const` will still compile because `'guest-sessions'` is a known literal in the `Config` type
- The `as any` casts in the factory are workarounds for the same perceived type issue
- Existing unit tests mock Payload, so they will still pass after type changes

---

### Step 1: Remove `as const` casts from guest-session.ts service and replace manual GuestSessionDoc with generated type

**Root Cause**: Developer added `as const` casts defensively when the collection slug `'guest-sessions'` wasn't recognized by TypeScript, or as a habit. The types are now correctly generated, making these casts unnecessary. The manual `GuestSessionDoc` interface duplicates the generated `GuestSession` type, and explicit `as GuestSessionDoc` / `as unknown as GuestSessionDoc` casts hide real type errors.

**Files to Touch**:
- `src/server/services/guest-session.ts` (MODIFIED - lines 16, 23-35, 150, 168, 178, 187, 201, 205, 209, 222, 230, 239, 248, 265, 273, 286)

**Changes**:
1. Add import: `import type { GuestSession } from '@/payload-types'`
2. Replace the manual `GuestSessionDoc` interface (lines 23-35) with a type alias: `export type GuestSessionDoc = GuestSession` — this preserves backward compatibility for any external consumers while using the generated type
3. Remove `as const` from all 7 collection slug strings (lines 150, 178, 201, 222, 239, 265, 286) — just use the plain string `'guest-sessions'`
4. Remove `as unknown as GuestSessionDoc` cast on line 168 — Payload's `create()` already returns the typed `GuestSession`
5. Remove `as GuestSessionDoc` cast on line 187 — `sessions.docs[0]` is already typed as `GuestSession`
6. Remove `(session as GuestSessionDoc)` cast on line 205 — `findByID` returns `GuestSession`
7. Remove `session as GuestSessionDoc` on line 209 — already typed
8. Remove `as GuestSessionDoc` cast on line 230 — `update()` returns `GuestSession`
9. Remove `as GuestSessionDoc` cast on line 248 — `update()` returns `GuestSession`
10. Remove `session as GuestSessionDoc` on line 273 — `findByID` returns `GuestSession`

**Reproduction Test**:
- Test location: `tests/unit/server/services/guest-session-types.test.ts` (NEW)
- What it tests: Verify that the service module compiles and exports functions with correct types without any `as const` or manual type assertions
- How:
  ```
  Test 1: "guest-session service functions accept Payload and return properly typed results"
    - Import all exported functions from guest-session.ts
    - Verify createGuestSession returns { session: GuestSessionDoc; token: string }
    - Verify getGuestSessionByToken returns GuestSessionDoc | null
    - Verify updateGuestSessionActivity returns GuestSessionDoc | null
    - Verify revokeGuestSession returns GuestSessionDoc | null
    - Verify checkAndIncrementGuestMessageCount returns GuestMessageLimitResult
  
  Test 2: "GuestSessionDoc type matches GuestSession from payload-types"
    - Import GuestSessionDoc from guest-session.ts
    - Import GuestSession from payload-types
    - TypeScript compilation itself validates type compatibility
    - At runtime: verify that a mock session object satisfies both types
  ```
- Why it fails before: Before the fix, removing `as const` would cause TS errors if types weren't properly registered (but they are, so this confirms the fix is safe). The test also validates that the `GuestSessionDoc` export is compatible with `GuestSession`.

**Verification**:
- Run `pnpm tsc --noEmit` — MUST PASS (no type errors after removing casts)
- Run `pnpm vitest run tests/unit/server/services/guest-session` — existing tests MUST PASS
- Run `pnpm vitest run tests/unit/server/services/guest-session-types` — new type test MUST PASS

**Acceptance Criteria**:
- [ ] Zero instances of `as const` on `'guest-sessions'` string in `guest-session.ts`
- [ ] Zero instances of `as unknown as GuestSessionDoc` or `as GuestSessionDoc` in `guest-session.ts`
- [ ] `GuestSessionDoc` is a type alias for `GuestSession` (not a manually duplicated interface)
- [ ] `GuestSessionDoc` is still exported (backward compatibility)
- [ ] TypeScript compilation passes with `pnpm tsc --noEmit`
- [ ] All existing unit tests pass

---

### Step 2: Remove `as any` casts from guest-session.factory.ts

**Root Cause**: The test factory uses `'guest-sessions' as any` on line 73 and `payload.db as any` on line 109 as workarounds. The collection cast is unnecessary (same reason as Step 1). The `payload.db as any` cast is needed because the raw MongoDB access pattern isn't typed by Payload — we'll keep that one but clean up the collection slug cast.

**Files to Touch**:
- `tests/factories/guest-session.factory.ts` (MODIFIED - line 73)

**Changes**:
1. Line 73: Change `collection: 'guest-sessions' as any` to `collection: 'guest-sessions'`
2. Line 109: Keep `payload.db as any` — this is a legitimate cast for raw MongoDB access that isn't exposed in Payload's types
3. Also add `messageCount: 0` to the factory's `buildGuestSessionData` default data (line 48-60) if it's missing, since the collection requires it — check if it's there (it appears to be missing, which could cause create failures)

**Reproduction Test**:
- Test location: `tests/unit/factories/guest-session-factory.test.ts` (NEW)
- What it tests: The factory's `buildGuestSessionData` returns valid data matching the GuestSession schema, and `createGuestSession` calls Payload with the correct collection slug without type casts
- How:
  ```
  Test 1: "buildGuestSessionData returns data with all required GuestSession fields"
    - Call buildGuestSessionData() with default input
    - Assert the returned data object has: tokenHash, tokenVersion, createdAt, lastActiveAt, expiresAt, hardExpiresAt, status
    - Assert status defaults to 'active'
    - Assert token is a 64-character hex string
  
  Test 2: "createGuestSession calls payload.create with correct collection slug"
    - Create a mock Payload instance
    - Call createGuestSession(mockPayload, {})
    - Assert mockPayload.create was called with { collection: 'guest-sessions', ... }
    - Assert the collection value is exactly the string 'guest-sessions' (not cast)
  ```
- Why it fails before: With `as any`, TypeScript doesn't validate the collection slug. After removing it, if there were a type mismatch, TS would catch it at compile time. The runtime test verifies the factory produces valid data.

**Verification**:
- Run `pnpm tsc --noEmit` — MUST PASS
- Run `pnpm vitest run tests/unit/factories/guest-session-factory` — new test MUST PASS

**Acceptance Criteria**:
- [ ] Zero instances of `as any` on collection slug in `guest-session.factory.ts`
- [ ] `buildGuestSessionData` produces data that would pass Payload validation for `guest-sessions` collection
- [ ] TypeScript compilation passes
- [ ] Factory test passes

---

### Step 3: Final type-check and integration verification

**Root Cause**: N/A — this is a verification step to ensure all changes work together.

**Files to Touch**:
- No new files — verification only

**Verification**:
- Run `pnpm tsc --noEmit` — full project type check MUST PASS
- Run `pnpm vitest run tests/unit/server/services/guest-session` — existing tests MUST PASS
- Run `pnpm vitest run tests/unit/server/services/guest-session-types` — new type test MUST PASS
- Run `pnpm vitest run tests/unit/factories/guest-session-factory` — new factory test MUST PASS
- Run `pnpm lint` — no lint errors

**Acceptance Criteria**:
- [ ] `pnpm tsc --noEmit` passes with zero errors
- [ ] All guest-session related tests pass
- [ ] No `as const` on `'guest-sessions'` anywhere in `src/`
- [ ] No `as any` on collection slugs in `tests/factories/`
- [ ] `GuestSessionDoc` is a re-export of the generated `GuestSession` type

---

## Spec Requirement Traceability

| Spec Requirement | Plan Step |
|---|---|
| Req 1: Verify GuestSessions registered in types | Pre-verified (payload-types.ts line 77) |
| Req 2: Remove 'as const' casts (7 instances) | Step 1 |
| Req 3: Address 'as any' casts in factory | Step 2 |
| Req 4: Verify type safety after fix | Step 3 |

## Notes for Build Agent

- **Do NOT run `pnpm generate:types`** — types are already correct
- When removing `as GuestSessionDoc` casts, the Payload return types should already match since `GuestSessionDoc` will be an alias for `GuestSession`
- If any `as GuestSessionDoc` removal causes a type error, it means there's a field mismatch between the manual interface and generated type — investigate and fix the calling code rather than adding the cast back
- The `messageCount` field exists in the generated `GuestSession` type (payload-types.ts line 1147) and in the manual `GuestSessionDoc` interface, so the alias should be seamless
- The `claimedByUser` field differs: manual interface has `string`, generated has `(string | null) | User` — this is fine when using the generated type since it's a superset
