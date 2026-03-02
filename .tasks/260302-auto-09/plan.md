# Plan: Fix Slow Typing Animation in Welcome Greeting

**Task ID**: 260302-auto-09
**Task Type**: fix_bug
**Risk Level**: low
**Primary Domain**: frontend

---

## Summary

The `GreetingFlow` component uses `TypingAnimation` with `speed={200}` (200ms per character), which is far too slow for a natural typing feel. The `TypingAnimation` component defaults to `speed=50` (50ms/char), which is a good baseline. The three usages in `GreetingFlow` explicitly override this to 200ms, making the animation feel "laggy." The fix is to reduce the speed value from `200` to `30` ms/char across all three `TypingAnimation` usages, providing a fast-but-readable feel (~33 chars/sec, roughly matching natural human typing/reading pace for short messages).

---

## Root Cause Analysis

**File**: `src/ui/web/homepage/GreetingFlow/index.tsx` (lines 76, 106, 152)

The `TypingAnimation` component's `speed` prop is **milliseconds per character** — a *higher* value means *slower* typing. All three usages in `GreetingFlow` set `speed={200}`, meaning each character takes 200ms (5 characters per second). A typical greeting message of 40 characters would take **8 seconds** to display, which is unacceptably slow.

The default speed in `TypingAnimation` is 50ms/char (20 chars/sec), which is reasonable. The fix is to use `speed={30}` (roughly 33 chars/sec) for a snappy, engaging feel, or simply remove the `speed` prop entirely to use the default of 50ms.

**Decision**: Change `speed={200}` → `speed={30}` on all three usages. This provides a noticeably faster, human-like typing pace while still maintaining the "interactive dialogue" feel described in the expected result.

---

## Assumptions

1. The `speed` prop in `TypingAnimation` represents milliseconds per character delay (confirmed from source code)
2. A speed of 30ms/char (~33 chars/sec) is considered natural/engaging for a typing animation
3. All three `TypingAnimation` usages in `GreetingFlow` should use the same speed value
4. No changes needed to the `TypingAnimation` component itself — only the speed values passed to it

---

### Step 1: Write reproduction test confirming the slow speed values

**Root Cause**: The `speed={200}` prop values in GreetingFlow make the animation too slow.

**Files to Touch**:
- `tests/unit/ui/web/homepage/GreetingFlow.test.ts` (NEW)

**Reproduction Test**: A source-code analysis test (similar to existing patterns in `tests/int/refactor-inline-styles.int.spec.ts`) that reads the GreetingFlow source file and asserts the speed values are fast enough.

- **Test location**: `tests/unit/ui/web/homepage/GreetingFlow.test.ts`
- **What it tests**:
  1. All `TypingAnimation` usages in GreetingFlow use `speed={30}` (not `speed={200}` or any value > 80)
  2. There are exactly 3 `TypingAnimation` usages in the file
  3. No `TypingAnimation` usage has `speed={200}` (the known-slow value)
- **Why it fails now**: The current file has `speed={200}` on all three usages

**Test implementation guidance**:
```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('GreetingFlow typing animation speed', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/web/homepage/GreetingFlow/index.tsx'),
    'utf-8',
  )

  it('should NOT have slow speed={200} on any TypingAnimation', () => {
    expect(source).not.toMatch(/speed=\{200\}/)
  })

  it('should have speed={30} for fast natural typing on all TypingAnimation usages', () => {
    const speedMatches = source.match(/speed=\{30\}/g)
    expect(speedMatches).not.toBeNull()
    expect(speedMatches!.length).toBe(3)
  })

  it('should have exactly 3 TypingAnimation component usages', () => {
    const usages = source.match(/<TypingAnimation/g)
    expect(usages).not.toBeNull()
    expect(usages!.length).toBe(3)
  })
})
```

**Verification**:
- Run `pnpm vitest run tests/unit/ui/web/homepage/GreetingFlow.test.ts` → FAILS (speed={200} found, speed={30} not found)

**Acceptance Criteria**:
- [ ] Test file created at `tests/unit/ui/web/homepage/GreetingFlow.test.ts`
- [ ] Test fails when run against the current source code
- [ ] Test validates all 3 TypingAnimation usages have correct speed

---

### Step 2: Fix GreetingFlow speed values from 200 to 30

**Root Cause**: Three `TypingAnimation` components in GreetingFlow have `speed={200}` (too slow).

**Files to Touch**:
- `src/ui/web/homepage/GreetingFlow/index.tsx` (MODIFIED - lines 76, 106, 152)

**Fix**: Change all three occurrences of `speed={200}` to `speed={30}`:

1. **Line 76** (greeting step): `speed={200}` → `speed={30}`
2. **Line 106** (moodResponse step): `speed={200}` → `speed={30}`
3. **Line 152** (complete step): `speed={200}` → `speed={30}`

No other changes required. The component structure, callbacks, classNames, and text content remain identical.

**Verification**:
- Run `pnpm vitest run tests/unit/ui/web/homepage/GreetingFlow.test.ts` → PASSES (all 3 tests green)
- Run `pnpm -s tsc --noEmit` → no type errors
- Run existing test: `pnpm vitest run tests/int/refactor-inline-styles.int.spec.ts` → still passes (TypingAnimation component unchanged)

**Acceptance Criteria**:
- [ ] All three `speed={200}` changed to `speed={30}` in GreetingFlow
- [ ] No other code changes in the file
- [ ] TypeScript compilation passes (`pnpm -s tsc --noEmit`)
- [ ] New test passes (`pnpm vitest run tests/unit/ui/web/homepage/GreetingFlow.test.ts`)
- [ ] Existing related test passes (`pnpm vitest run tests/int/refactor-inline-styles.int.spec.ts`)
- [ ] Lint passes (`pnpm -s lint`)

---

## Quality Gates

1. **TypeScript**: `pnpm -s tsc --noEmit` passes
2. **Lint**: `pnpm -s lint` passes  
3. **Unit test**: `pnpm vitest run tests/unit/ui/web/homepage/GreetingFlow.test.ts` passes
4. **Integration test**: `pnpm vitest run tests/int/refactor-inline-styles.int.spec.ts` passes
5. **Full test suite**: `pnpm vitest run` passes

---

## Files Summary

| File | Action | Lines |
|------|--------|-------|
| `tests/unit/ui/web/homepage/GreetingFlow.test.ts` | NEW | ~30 lines |
| `src/ui/web/homepage/GreetingFlow/index.tsx` | MODIFIED | lines 76, 106, 152 |

---

## Spec Requirements Traceability

- **"Typing animation should have a natural, human-like pace"** → speed={30} = 33 chars/sec, natural typing feel
- **"Fast enough to keep the user engaged"** → 30ms/char is ~6.5x faster than current 200ms/char
- **"Slow enough to maintain interactive dialogue feel"** → still shows character-by-character typing effect (not instant)
- **"Fix applied as described"** → all 3 TypingAnimation usages updated
- **"TypeScript compilation passes"** → quality gate #1
- **"Unit tests pass"** → quality gates #2-5
