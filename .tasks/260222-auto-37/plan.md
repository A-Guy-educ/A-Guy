# Plan: 260222-auto-37 — Remove Redundant Inline Styles

## Summary

Two components have inline `style={{}}` props that duplicate existing Tailwind classes. We remove the inline styles, adopt `cn()` for class composition in TypingAnimation, and verify nothing breaks via lint and typecheck.

**Task Type**: refactor  
**Estimated Total Time**: ~15 minutes (2 steps)

---

## Assumptions

- The `cn()` utility at `@/infra/utils/ui` is the project-standard class-merge helper (confirmed).
- `text-xs` in Tailwind produces `font-size: 12px` (0.75rem at default 16px base), matching the removed inline style.
- `font-mono` in Tailwind resolves to the project's configured monospace font stack (Geist Mono), which is the *desired* outcome per FR-002.
- No snapshot/visual regression tests exist for these components; typecheck + lint are sufficient quality gates.

---

## Step 1: Remove inline `style` from Footer VersionDisplay

**Spec Refs**: FR-001, NFR-001  
**Time Estimate**: 5 minutes

### Files to Touch

| File | Action | Lines |
|------|--------|-------|
| `src/ui/web/footer/Component.tsx` | MODIFIED | line 32 |

### Exact Behavior

On line 32, the `<span>` element currently has:
```tsx
<span className="text-xs text-muted-foreground/70 font-normal" style={{ fontSize: '12px' }}>
```

**Change**: Remove `style={{ fontSize: '12px' }}` entirely. The `text-xs` class already applies `font-size: 0.75rem` (12px). The line becomes:
```tsx
<span className="text-xs text-muted-foreground/70 font-normal">
```

No other changes to this file.

### Tests (FAIL before, PASS after)

**Test 1 — Integration: No inline style attribute in Footer VersionDisplay**
- **Location**: `tests/int/refactor-inline-styles.int.spec.ts` (NEW)
- **What it tests**: Read the source file `src/ui/web/footer/Component.tsx` as a string, assert it does NOT contain the pattern `style={{ fontSize` or `style={{fontSize`.
- **Why it fails before**: The inline style is present in the source.
- **After step**: The inline style is removed; regex match returns no results → test passes.

**Test 2 — Integration: Footer VersionDisplay still has text-xs class**
- **Location**: Same test file as above
- **What it tests**: Assert the source file still contains `text-xs` on the VersionDisplay span.
- **Why it fails before**: N/A (this is a guardrail — it passes both before and after, but guards against accidental class removal).

### Acceptance Criteria

- [ ] `src/ui/web/footer/Component.tsx` line 32 has NO `style=` prop.
- [ ] `text-xs` class is still present on the same element.
- [ ] `pnpm -s tsc --noEmit` passes with zero errors.
- [ ] `pnpm -s lint` passes with zero errors.

---

## Step 2: Remove inline `style` and adopt `cn()` in TypingAnimation

**Spec Refs**: FR-002, FR-003, NFR-001  
**Time Estimate**: 10 minutes

### Files to Touch

| File | Action | Lines |
|------|--------|-------|
| `src/ui/web/shared/TypingAnimation/index.tsx` | MODIFIED | lines 3, 16, 34 |

### Exact Behavior

**Change A — Add `cn` import (line 3 area)**:
Add at top of file after existing imports:
```tsx
import { cn } from '@/infra/utils/ui'
```

**Change B — Remove default value for className param (line 16)**:
Change `className = ''` to just `className` (optional string, no default needed since `cn()` handles undefined).
```tsx
// Before
className = '',
// After
className,
```

**Change C — Replace template literal + remove inline style (line 34)**:
```tsx
// Before
<div className={`font-mono ${className}`} style={{ fontFamily: 'Courier New, monospace' }}>

// After
<div className={cn('font-mono', className)}>
```

This:
1. Removes the redundant `style={{ fontFamily: 'Courier New, monospace' }}` (FR-002)
2. Uses `cn()` for class composition instead of template literals (FR-003)
3. Retains the `font-mono` Tailwind class (guardrail)

### Tests (FAIL before, PASS after)

**Test 1 — Integration: No inline style attribute in TypingAnimation**
- **Location**: `tests/int/refactor-inline-styles.int.spec.ts` (same file as Step 1)
- **What it tests**: Read the source file `src/ui/web/shared/TypingAnimation/index.tsx` as a string, assert it does NOT contain `style={{ fontFamily` or `style={{fontFamily`.
- **Why it fails before**: The inline style is present.
- **After step**: Removed → test passes.

**Test 2 — Integration: TypingAnimation uses cn() utility**
- **Location**: Same test file
- **What it tests**: Assert the source file contains `import { cn }` (or `import {cn}`) from `@/infra/utils/ui` AND contains the pattern `cn('font-mono'` or `cn("font-mono"`.
- **Why it fails before**: No `cn` import exists; template literal is used instead of `cn()`.
- **After step**: `cn` is imported and used → test passes.

**Test 3 — Integration: TypingAnimation still has font-mono class**
- **Location**: Same test file
- **What it tests**: Assert the source contains `font-mono` as a class reference.
- **Why it fails before**: N/A (guardrail — passes before and after).

### Acceptance Criteria

- [ ] `src/ui/web/shared/TypingAnimation/index.tsx` has NO `style=` prop on any element.
- [ ] File imports `cn` from `@/infra/utils/ui`.
- [ ] `className` composition uses `cn('font-mono', className)`.
- [ ] `font-mono` class is still referenced.
- [ ] No template literal class composition remains (no backtick `className={...}`).
- [ ] `pnpm -s tsc --noEmit` passes with zero errors.
- [ ] `pnpm -s lint` passes with zero errors.

---

## Test File Summary

| File | Status | Purpose |
|------|--------|---------|
| `tests/int/refactor-inline-styles.int.spec.ts` | NEW | Source-level integration tests verifying inline styles removed, Tailwind classes retained, cn() adopted |

### Test File Structure

```typescript
// tests/int/refactor-inline-styles.int.spec.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Inline style removal refactor', () => {
  describe('Footer VersionDisplay (FR-001)', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/web/footer/Component.tsx'),
      'utf-8',
    )

    it('should NOT contain inline fontSize style', () => {
      expect(source).not.toMatch(/style=\{\{[\s]*fontSize/)
    })

    it('should still have text-xs Tailwind class', () => {
      expect(source).toMatch(/text-xs/)
    })
  })

  describe('TypingAnimation (FR-002, FR-003)', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/web/shared/TypingAnimation/index.tsx'),
      'utf-8',
    )

    it('should NOT contain inline fontFamily style', () => {
      expect(source).not.toMatch(/style=\{\{[\s]*fontFamily/)
    })

    it('should import cn from @/infra/utils/ui', () => {
      expect(source).toMatch(/import\s+\{[^}]*cn[^}]*\}\s+from\s+['"]@\/infra\/utils\/ui['"]/)
    })

    it('should use cn() for class composition with font-mono', () => {
      expect(source).toMatch(/cn\(['"]font-mono['"]/)
    })

    it('should still have font-mono Tailwind class', () => {
      expect(source).toMatch(/font-mono/)
    })

    it('should NOT use template literal for className', () => {
      // No backtick-based className composition
      expect(source).not.toMatch(/className=\{`/)
    })
  })
})
```

---

## Quality Gates (run after all steps)

```bash
# TypeScript compilation
pnpm -s tsc --noEmit

# Lint
pnpm -s lint

# Run the refactor tests
pnpm vitest run tests/int/refactor-inline-styles.int.spec.ts
```

All three must pass with zero errors for the task to be considered complete.

---

## Guardrails Checklist

- [ ] No `className` attributes or Tailwind utility classes were removed
- [ ] No component logic or structure was modified
- [ ] No inline styles remain (except dynamic values — none in these components)
- [ ] No changes to `tailwind.config.mjs`
- [ ] No changes to files outside the two target components (+ new test file)
