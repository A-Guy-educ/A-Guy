# Plan: Guest Session Type Safety Fix

**Task ID**: 260225-auto-90
**Task Type**: fix_bug
**Spec Requirements**: FR-1, FR-2, FR-3

## Rerun Context

This is a rerun (feedback: "Rerun requested via /cody rerun" — no specific code issues cited).

**Previous run analysis**: The prior run produced a plan but never completed the build/implementation phase — it was stuck at the architect gate. The source file `src/server/services/guest-session.ts` still has:
- 7× `'guest-sessions' as const` (unnecessary — Payload infers the literal type from generics)
- 1× `export interface GuestSessionDoc` (redundant — duplicates auto-generated `GuestSession` from `payload-types.ts`)
- 1× `as unknown as GuestSessionDoc` (line 168)
- 5× `as GuestSessionDoc` (lines 187, 205, 209, 230, 248, 273)
- TypeScript currently compiles cleanly (`tsc --noEmit` passes)

**What changed in this plan revision**: Minor wording refinements. The prior plan was comprehensive and correct — implementation just needs to run.

**Key insight**: The generated `GuestSession` type (from `src/payload-types.ts:1094`) is a strict superset of the manually defined `GuestSessionDoc`. All fields match. The generated type additionally includes `ipHash`, `userAgentHash`, and `updatedAt` which the manual interface omitted. Replacing the interface with `export type GuestSessionDoc = GuestSession` gives callers MORE type information, not less, and maintains backward compatibility.

---

## Assumptions

1. `guest-sessions` is registered in `Config['collections']` in `payload-types.ts` (confirmed at line 77)
2. Generated `GuestSession` type has all fields that `GuestSessionDoc` defines (confirmed field-by-field)
3. No external files import `GuestSessionDoc` from `guest-session.ts` (confirmed via grep — zero external importers)
4. `as const` is unnecessary because Payload generics constrain `collection` to `keyof Config['collections']`
5. `GuestSessionDoc` will be kept as a type alias (`export type GuestSessionDoc = GuestSession`) for backward compatibility even though no external callers exist — it's good practice and zero-cost

---

### Step 1: Replace GuestSessionDoc interface with type alias, remove all casts and `as const`

**Root Cause**: The service manually defines `GuestSessionDoc` interface (lines 23-35) that duplicates the auto-generated `GuestSession` from `payload-types.ts`. This required `as GuestSessionDoc` casts on every Payload return value. Additionally, `'guest-sessions' as const` is used on every Payload operation, which is unnecessary since the literal string type is already inferred correctly by Payload's generics.

**Files to Touch**:

- `src/server/services/guest-session.ts` (MODIFIED — lines 16-17, 23-35, 150, 168, 178, 187, 201, 205, 209-210, 222, 230, 239, 248, 265, 273-274, 286)

**Reproduction Test** (MUST FAIL before fix, PASS after):

- Test location: `tests/unit/server/services/guest-session.test.ts`
- Add this test at the END of the top-level `describe` block (before the closing `})` on line 326):

```typescript
describe('Type safety - no manual type casts', () => {
  it('should not have manual GuestSessionDoc interface or type casts', async () => {
    const fs = await import('fs')
    const sourceCode = fs.readFileSync('./src/server/services/guest-session.ts', 'utf-8')

    // After fix: no hand-written GuestSessionDoc interface (should be a type alias instead)
    expect(sourceCode).not.toMatch(/^export interface GuestSessionDoc/m)

    // After fix: no type assertion casts involving GuestSessionDoc
    expect(sourceCode).not.toMatch(/as GuestSessionDoc/)
    expect(sourceCode).not.toMatch(/as unknown as GuestSessionDoc/)

    // After fix: no 'as any' casts on collection names
    expect(sourceCode).not.toMatch(/'guest-sessions' as any/)

    // After fix: no unnecessary 'as const' on collection names
    expect(sourceCode).not.toMatch(/'guest-sessions' as const/)

    // After fix: imports GuestSession from payload-types
    expect(sourceCode).toMatch(/import.*GuestSession.*from ['"]@\/payload-types['"]/)

    // After fix: uses type alias
    expect(sourceCode).toMatch(/export type GuestSessionDoc\s*=\s*GuestSession/)
  })
})
```

- **Why it fails before**: The file has `export interface GuestSessionDoc`, 6 `as GuestSessionDoc` casts, 7 `as const`, and no import from `@/payload-types`
- **Why it passes after**: All casts removed, interface replaced with type alias, import added

**Fix — exact changes to `src/server/services/guest-session.ts`**:

#### Change 1: Add import (after line 16)

**Current line 16:**
```typescript
import type { Payload } from 'payload'
```

**Add new line 17:**
```typescript
import type { GuestSession } from '@/payload-types'
```

#### Change 2: Replace interface with type alias (lines 23-35)

**Current (lines 23-35):**
```typescript
export interface GuestSessionDoc {
  id: string
  tokenHash: string
  tokenVersion: number
  createdAt: string
  lastActiveAt: string
  expiresAt: string
  hardExpiresAt: string
  status: 'active' | 'expired' | 'revoked'
  claimedByUser?: string
  claimedAt?: string
  messageCount: number
}
```

**Replace with:**
```typescript
export type GuestSessionDoc = GuestSession
```

#### Change 3: Remove `as const` on line 150

```
Before: collection: 'guest-sessions' as const,
After:  collection: 'guest-sessions',
```

#### Change 4: Remove cast on line 168

```
Before: return { session: session as unknown as GuestSessionDoc, token }
After:  return { session, token }
```

(This works because `payload.create({ collection: 'guest-sessions', ... })` returns `GuestSession`, and `GuestSessionDoc = GuestSession`, so the return type `Promise<{ session: GuestSessionDoc; token: string }>` is satisfied directly.)

#### Change 5: Remove `as const` on line 178

```
Before: collection: 'guest-sessions' as const,
After:  collection: 'guest-sessions',
```

#### Change 6: Remove cast on line 187

```
Before: const session = sessions.docs[0] as GuestSessionDoc
After:  const session = sessions.docs[0]
```

#### Change 7: Remove `as const` on line 201

```
Before: collection: 'guest-sessions' as const,
After:  collection: 'guest-sessions',
```

#### Change 8: Remove cast on line 205

```
Before: if (!session || (session as GuestSessionDoc).status !== 'active') {
After:  if (!session || session.status !== 'active') {
```

#### Change 9: Remove intermediate variable on lines 209-210

```
Before:
  const doc = session as GuestSessionDoc
  const hardExpiresAt = new Date(doc.hardExpiresAt)
After:
  const hardExpiresAt = new Date(session.hardExpiresAt)
```

(Delete line 209 entirely. Change `doc.hardExpiresAt` to `session.hardExpiresAt` on line 210.)

#### Change 10: Remove `as const` on line 222

```
Before: collection: 'guest-sessions' as const,
After:  collection: 'guest-sessions',
```

#### Change 11: Remove cast on line 230

```
Before: return updated as GuestSessionDoc
After:  return updated
```

#### Change 12: Remove `as const` on line 239

```
Before: collection: 'guest-sessions' as const,
After:  collection: 'guest-sessions',
```

#### Change 13: Remove cast on line 248

```
Before: return updated as GuestSessionDoc
After:  return updated
```

#### Change 14: Remove `as const` on line 265

```
Before: collection: 'guest-sessions' as const,
After:  collection: 'guest-sessions',
```

#### Change 15: Remove intermediate variable on lines 273-274

```
Before:
  const doc = session as GuestSessionDoc
  const currentCount = doc.messageCount ?? 0
After:
  const currentCount = session.messageCount ?? 0
```

(Delete line 273 entirely. Change `doc.messageCount` to `session.messageCount` on line 274.)

#### Change 16: Remove `as const` on line 286

```
Before: collection: 'guest-sessions' as const,
After:  collection: 'guest-sessions',
```

**CRITICAL NOTE for build agent**: If `tsc --noEmit` fails after these changes with type incompatibility errors (e.g., `GuestSession` doesn't satisfy some return type constraint), the likely cause is Payload's `update`/`findByID` return types being slightly different from `GuestSession`. In that case, keep the `as GuestSessionDoc` cast ONLY on the specific line that fails and document why. But based on analysis, all removals should work cleanly.

**Verification**:

- [ ] Run `pnpm test:unit -- tests/unit/server/services/guest-session.test.ts` → new "Type safety" test FAILS before fix (file still has interface/casts)
- [ ] Apply all 16 changes above
- [ ] Run `pnpm test:unit -- tests/unit/server/services/guest-session.test.ts` → all tests pass including new one
- [ ] Run `pnpm -s tsc --noEmit` → zero type errors
- [ ] `grep -c 'as any' src/server/services/guest-session.ts` returns 0
- [ ] `grep -c 'as unknown' src/server/services/guest-session.ts` returns 0
- [ ] `grep -c 'as GuestSessionDoc' src/server/services/guest-session.ts` returns 0
- [ ] `grep -c 'export interface GuestSessionDoc' src/server/services/guest-session.ts` returns 0
- [ ] `grep -c 'as const' src/server/services/guest-session.ts` returns 0
- [ ] `grep 'GuestSession.*payload-types' src/server/services/guest-session.ts` returns 1 match

**Estimated time**: 15-20 minutes

---

## Acceptance Criteria (from spec)

| Requirement | Status | Verification |
|-------------|--------|--------------|
| FR-1: `pnpm generate:types` runs without errors | ✅ Already done | `guest-sessions` is at line 77 of `payload-types.ts` |
| FR-2: GuestSessions collection properly exported | ✅ Already done | Imported at line 40 of `payload.config.ts` |
| FR-3: All 7 `as any` casts removed from guest-session.ts | 🔧 This plan | Changed to `as const` in prior attempt; this plan removes `as const` too |
| TypeScript compilation succeeds without type errors | 🔧 This plan | Must verify after removing all casts |
| GuestSessions collection properly typed in Payload ops | 🔧 This plan | Remove redundant interface + all unnecessary casts |

## Test Commands

```bash
# Run guest-session unit tests (includes new source-check test)
pnpm test:unit -- tests/unit/server/services/guest-session.test.ts

# Full type check
pnpm -s tsc --noEmit

# Verify no casts remain
grep -cE 'as any|as GuestSessionDoc|as unknown|as const' src/server/services/guest-session.ts
# Expected: 0

# Verify import exists
grep 'GuestSession.*payload-types' src/server/services/guest-session.ts
# Expected: 1 match

# Verify type alias exists
grep 'export type GuestSessionDoc' src/server/services/guest-session.ts
# Expected: 1 match
```
