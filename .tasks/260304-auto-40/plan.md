# Plan: Typing Animation Speed Fix

**Task ID**: 260304-auto-40
**Task Type**: fix_bug
**Spec**: Typing animation in GreetingFlow is 200ms/char — should be ~30ms/char

---

## Summary

The `GreetingFlow` component passes `speed={200}` (200ms per character) to `TypingAnimation` in three locations. The spec requires ~30ms per character for a snappy feel. This is a simple prop-value bug fix across 3 call sites in a single file.

### Assumptions

- No `clarified.md` or `rerun-feedback.md` exist; this is the first run.
- The `TypingAnimation` component's default `speed` prop (50ms) does NOT need to change — the bug is in the caller (`GreetingFlow`) passing an explicit `speed={200}`.
- The spec says ~30-35ms. We will use `speed={30}` as the target value for all three usages.
- No other files use `speed={200}` that need updating (confirmed by grep — only GreetingFlow uses 200).

---

## Step 1: Write reproduction tests for slow typing speed

**Root Cause**: `GreetingFlow` component passes `speed={200}` to all three `<TypingAnimation>` instances instead of the target ~30ms.

**Files to Touch**:
- `tests/unit/components/GreetingFlow.test.tsx` (NEW)

**Reproduction Test**: Write tests that render the GreetingFlow component and verify the `speed` prop passed to `TypingAnimation` is ~30ms (not 200ms).

- **Test location**: `tests/unit/components/GreetingFlow.test.tsx`
- **Environment directive**: `// @vitest-environment jsdom`
- **Mock strategy**:
  - Mock `@/ui/web/shared/TypingAnimation` to capture the `speed` prop passed to it
  - Mock `next/navigation` (same pattern as `CourseCard.test.tsx`)
  - Mock `@/client/state/localStorage/userProfile`
  - Mock `fetch` for the courses API call
  - Wrap component in `<I18nProvider locale="en" messages={enMessages}>`
- **Tests**:

  1. `it('passes snappy speed (~30ms) to TypingAnimation in greeting step')`
     - Render `<GreetingFlow onComplete={vi.fn()} />`
     - Assert the mocked TypingAnimation was called with `speed` prop ≤ 35 (i.e., 30-35ms range)
     - **Why it fails now**: Currently `speed={200}` is passed on line 76

  2. `it('passes snappy speed (~30ms) to TypingAnimation in moodResponse step')`
     - Render, then trigger the mood selection to advance to `moodResponse` step
     - Assert `speed` prop ≤ 35 on the new TypingAnimation render
     - **Why it fails now**: Currently `speed={200}` is passed on line 106

  3. `it('passes snappy speed (~30ms) to TypingAnimation in complete step')`
     - Render, advance through greeting → mood → moodResponse → courses → complete
     - Assert `speed` prop ≤ 35
     - **Why it fails now**: Currently `speed={200}` is passed on line 152

**Acceptance Criteria**:
- [ ] Tests exist and run (even if they fail)
- [ ] Tests explicitly assert `speed` prop value
- [ ] Tests cover all 3 TypingAnimation usages in GreetingFlow
- [ ] Tests use the same patterns as existing component tests (vitest, jsdom, I18nProvider)

---

## Step 2: Fix typing speed in GreetingFlow component

**Root Cause**: Three hardcoded `speed={200}` values in `GreetingFlow/index.tsx`.

**Files to Touch**:
- `src/ui/web/homepage/GreetingFlow/index.tsx` (MODIFIED — lines 76, 106, 152)

**Fix**: Change all three `speed={200}` occurrences to `speed={30}`:

1. **Line 76** (greeting step): `speed={200}` → `speed={30}`
2. **Line 106** (moodResponse step): `speed={200}` → `speed={30}`
3. **Line 152** (complete step): `speed={200}` → `speed={30}`

**Verification**:
- Run reproduction tests from Step 1 → all 3 MUST PASS after fix
- Run `pnpm tsc --noEmit` → no type errors
- Run `pnpm lint` → no lint errors

**Spec Requirements Covered**:
- [Spec R1] Typing animation should be 1.5x faster than current → actually 6-7x faster (200 → 30)
- [Spec R2] Base character delay should be approximately 30-35ms per character → `speed={30}`
- [Spec R3] Animation should feel snappy → 30ms is near-instant per char
- [Spec AC1] TypingAnimation in greeting step uses speed ~30ms ✓
- [Spec AC2] TypingAnimation in moodResponse step uses speed ~30ms ✓
- [Spec AC3] TypingAnimation in complete step uses speed ~30ms ✓
- [Spec AC4] Animation feels snappy and responsive ✓ (30ms = ~33 chars/sec)
- [Spec AC5] No regressions in other TypingAnimation usages ✓ (only GreetingFlow changed; TypingAnimation default remains 50ms)

**Acceptance Criteria**:
- [ ] All 3 `speed={200}` changed to `speed={30}` in GreetingFlow
- [ ] No other files modified
- [ ] `TypingAnimation` default prop (50ms) unchanged
- [ ] All tests from Step 1 pass
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes

---

## Test Commands

```bash
# Run just the GreetingFlow tests
pnpm vitest run tests/unit/components/GreetingFlow.test.tsx

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

---

## Files Summary

| File | Action | Lines |
|------|--------|-------|
| `tests/unit/components/GreetingFlow.test.tsx` | NEW | ~80-100 lines |
| `src/ui/web/homepage/GreetingFlow/index.tsx` | MODIFIED | Lines 76, 106, 152 — change `speed={200}` to `speed={30}` |

---

## Risk Assessment

- **Low risk**: This is a prop value change with no logic changes
- **No regression risk**: The `TypingAnimation` component itself is not modified; only the caller's prop values change
- **No other callers affected**: Grep confirmed only `GreetingFlow` passes `speed={200}`
