# Build: Fix Slow Typing Animation in Welcome Greeting

**Task ID**: 260302-auto-09
**Task Type**: fix_bug
**Risk Level**: low

---

## Verified Context

- **Root cause confirmed**: `src/ui/web/homepage/GreetingFlow/index.tsx` uses `speed={200}` (200ms/char) at lines 76, 106, 152 — 3 usages of `<TypingAnimation>` with explicitly slow speed.
- **TypingAnimation component**: `src/ui/web/shared/TypingAnimation/index.tsx` — `speed` prop = ms per character, default 50. No changes needed to this component.
- **No existing unit test** for GreetingFlow at `tests/unit/ui/web/homepage/`.

---

## Step 1: Create reproduction test

**File**: `tests/unit/ui/web/homepage/GreetingFlow.test.ts` (NEW)

Create this file with the following content:

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

**Verify fails**: `pnpm vitest run tests/unit/ui/web/homepage/GreetingFlow.test.ts` — should FAIL (speed={200} found).

---

## Step 2: Fix speed values in GreetingFlow

**File**: `src/ui/web/homepage/GreetingFlow/index.tsx` (MODIFIED)

Three exact edits — all are `speed={200}` → `speed={30}`:

### Edit 1 — Line 76 (greeting step)

Use surrounding context for unique match:

```
oldString: "            text={t('welcome')}\n            speed={200}"
newString: "            text={t('welcome')}\n            speed={30}"
```

### Edit 2 — Line 106 (moodResponse step)

```
oldString: "            text={t(`moodResponses.${selectedMood}`)}\n            speed={200}"
newString: "            text={t(`moodResponses.${selectedMood}`)}\n            speed={30}"
```

### Edit 3 — Line 152 (complete step)

```
oldString: "          <TypingAnimation text={t('letsStart')} speed={200} className=\"text-2xl\" />"
newString: "          <TypingAnimation text={t('letsStart')} speed={30} className=\"text-2xl\" />"
```

---

## Step 3: Verify

Run these commands in order:

1. `pnpm vitest run tests/unit/ui/web/homepage/GreetingFlow.test.ts` — all 3 tests PASS
2. `pnpm -s tsc --noEmit` — no type errors
3. `pnpm -s lint` — no lint errors

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/ui/web/homepage/GreetingFlow.test.ts` | NEW | Source-analysis test asserting speed={30} on all 3 TypingAnimation usages |
| `src/ui/web/homepage/GreetingFlow/index.tsx` | MODIFIED | `speed={200}` → `speed={30}` on lines 76, 106, 152 |

---

## Acceptance Criteria Traceability

- [x] Fix applied as described — 3 speed values changed from 200 to 30
- [x] TypeScript compilation passes — verified via `tsc --noEmit`
- [x] Unit tests pass — new test validates all 3 usages have speed={30}
