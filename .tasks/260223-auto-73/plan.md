# Plan: 260223-auto-73 — Fix Hardcoded Loading Text in HomePage

## Summary

The `HomePage` component at `src/app/(frontend)/_components/HomePage/index.tsx` (line 26) has hardcoded Hebrew text `"טוען..."` for its loading state. This means English-locale users see Hebrew loading text instead of `"Loading..."`. The fix is to use the existing `useTranslations` hook from `@/ui/web/providers/I18n` with the `homepage.greeting` namespace, which already has a `loading` key in both `en.json` and `he.json`.

## Assumptions

- Translation keys `homepage.greeting.loading` already exist in both `src/i18n/en.json` ("Loading...") and `src/i18n/he.json` ("טוען...") — **confirmed by reading the files**.
- The `useTranslations` hook from `@/ui/web/providers/I18n` is the project's standard pattern — **confirmed by 37+ existing usages across the codebase**.
- The `I18nProvider` is already wrapping the frontend layout (otherwise existing pages using `useTranslations` would crash) — no need to add it.
- No existing tests for `HomePage` component exist — **confirmed by searching test files**.

---

## Step 1: Write Reproduction Test for Hardcoded Loading Text

**Root Cause**: The `HomePage` component renders `<div className="text-muted-foreground">טוען...</div>` with a hardcoded Hebrew string instead of using the translation mechanism. When locale is English, users still see Hebrew text.

**Files to Touch**:
- `tests/unit/components/HomePage.test.tsx` (NEW)

**Reproduction Test**: Write a test that demonstrates the bug (MUST FAIL now):

- Test location: `tests/unit/components/HomePage.test.tsx`
- What it tests: When `HomePage` is rendered within an English I18n context and is in loading state, the loading text should read "Loading..." (from `en.json`).
- Why it fails: Currently the component hardcodes `"טוען..."` regardless of locale, so `screen.getByText('Loading...')` will not find a match.

**Test Details**:

```
// @vitest-environment jsdom
// 
// Setup:
// - Mock `next/navigation` (useRouter returns { push: vi.fn() })
// - Mock `@/client/state/localStorage/userProfile` to make getUserProfile() return null
//   (this ensures the loading state is briefly shown before setIsLoading(false))
//   ACTUALLY: Since useEffect runs asynchronously, while isLoading=true is the initial state,
//   we need to capture the INITIAL render before useEffect fires.
//
// Test 1: "displays English loading text when locale is English"
//   - Render <I18nProvider locale="en" messages={enMessages}><HomePage /></I18nProvider>
//   - Assert: screen.getByText('Loading...') exists
//   - This FAILS now because the hardcoded text is "טוען..."
//
// Test 2: "displays Hebrew loading text when locale is Hebrew"  
//   - Render <I18nProvider locale="he" messages={heMessages}><HomePage /></I18nProvider>
//   - Assert: screen.getByText('טוען...') exists
//   - This PASSES now (coincidentally matches hardcoded text) but ensures no regression
//
// Test 3: "does not contain hardcoded Hebrew loading string"
//   - Import the component source file as text and check it doesn't contain the literal "טוען..."
//   - OR: Render with English locale and assert "טוען..." is NOT in the document
//   - This FAILS now because the hardcoded string is always rendered
```

**Acceptance Criteria**:
- [x] `tests/unit/components/HomePage.test.tsx` exists with at least 2 tests
- [ ] Test 1 (English loading text) FAILS before fix, PASSES after
- [ ] Test 2 (Hebrew loading text) PASSES before and after fix
- [ ] Test 3 (no hardcoded Hebrew in English locale) FAILS before fix, PASSES after

**Spec Requirements**: FR-001, FR-002, FR-003

**Estimated Time**: 10 minutes

---

## Step 2: Replace Hardcoded Loading Text with useTranslations

**Root Cause**: Line 26 of `src/app/(frontend)/_components/HomePage/index.tsx` has `<div className="text-muted-foreground">טוען...</div>` instead of using a translated string.

**Files to Touch**:
- `src/app/(frontend)/_components/HomePage/index.tsx` (MODIFIED — lines 1-2 imports, line 26 loading text)

**Fix**: Minimal code change:

1. Add import: `import { useTranslations } from '@/ui/web/providers/I18n'`
2. Inside the `HomePage` function, add: `const t = useTranslations('homepage.greeting')`
3. Replace line 26 `<div className="text-muted-foreground">טוען...</div>` with `<div className="text-muted-foreground">{t('loading')}</div>`

**Important**: The `useTranslations` call must be at the top level of the component (before any conditional returns), because React hooks cannot be called conditionally. The `isLoading` check is a conditional return, so `useTranslations` must come before it.

**Before** (current code):
```tsx
export function HomePage() {
  const [showGreeting, setShowGreeting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  // ... useEffect ...
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">טוען...</div>  // ← HARDCODED
      </div>
    )
  }
  // ...
}
```

**After** (fixed code):
```tsx
import { useTranslations } from '@/ui/web/providers/I18n'
// ...
export function HomePage() {
  const [showGreeting, setShowGreeting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const t = useTranslations('homepage.greeting')  // ← ADDED (before conditional returns)
  // ... useEffect ...
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">{t('loading')}</div>  // ← FIXED
      </div>
    )
  }
  // ...
}
```

**Verification**:
- Run test from Step 1 → ALL tests PASS
- Run `pnpm -s tsc --noEmit` → no type errors
- Run `pnpm -s lint` → no lint errors

**Acceptance Criteria**:
- [ ] No hardcoded `"טוען..."` string in `src/app/(frontend)/_components/HomePage/index.tsx` (FR-003)
- [ ] Loading text is derived via `useTranslations('homepage.greeting')` calling `t('loading')` (FR-001)
- [ ] English locale renders "Loading...", Hebrew locale renders "טוען..." (FR-002)
- [ ] No new imports of locale detection logic (NFR-001)
- [ ] No changes to routing, middleware, or locale architecture (NFR-002)
- [ ] `useTranslations` is called before any conditional returns (React hooks rules)
- [ ] TypeScript compiles cleanly (`pnpm -s tsc --noEmit`)
- [ ] All tests in `tests/unit/components/HomePage.test.tsx` pass

**Spec Requirements**: FR-001, FR-002, FR-003, NFR-001, NFR-002

**Estimated Time**: 5 minutes

---

## Step 3: Run Quality Gates

**Files to Touch**: None (verification only)

**Commands**:
```bash
pnpm -s tsc --noEmit          # Type check — must pass
pnpm -s lint                   # Lint — must pass  
pnpm vitest run tests/unit/components/HomePage.test.tsx  # New test — must pass
```

**Acceptance Criteria**:
- [ ] TypeScript compilation succeeds with zero errors
- [ ] Lint passes with zero errors
- [ ] All HomePage tests pass
- [ ] No regressions in existing tests (`pnpm vitest run tests/unit/components/`)

**Estimated Time**: 5 minutes

---

## Test Strategy Summary

| Test | Type | Fails Before | Passes After | What It Proves |
|------|------|-------------|-------------|----------------|
| English loading text shows "Loading..." | Unit (jsdom) | ✅ YES — hardcoded Hebrew | ✅ YES | FR-001, FR-002 |
| Hebrew loading text shows "טוען..." | Unit (jsdom) | ❌ NO — coincidental match | ✅ YES | FR-002 (regression guard) |
| No hardcoded Hebrew in English render | Unit (jsdom) | ✅ YES — hardcoded Hebrew present | ✅ YES | FR-003 |

## File Change Summary

| File | Action | Lines Changed |
|------|--------|---------------|
| `tests/unit/components/HomePage.test.tsx` | NEW | ~60-80 lines |
| `src/app/(frontend)/_components/HomePage/index.tsx` | MODIFIED | 3 lines (1 import + 1 hook call + 1 template change) |

## Key Technical Notes for Build Agent

1. **Hook placement**: `useTranslations` MUST be called at the top of the `HomePage` function body, BEFORE the `if (isLoading)` conditional return. React hooks cannot be called conditionally.

2. **Import path**: Use `import { useTranslations } from '@/ui/web/providers/I18n'` — this is the project's custom I18n provider, NOT `next-intl`. The spec mentions `next-intl` but the codebase uses a custom provider.

3. **Test pattern**: Follow the established pattern from `tests/unit/components/CourseCard.test.tsx`:
   - Use `// @vitest-environment jsdom` directive
   - Import `I18nProvider` from `@/ui/web/providers/I18n`
   - Import `enMessages` from `../../../src/i18n/en.json` and `heMessages` from `../../../src/i18n/he.json`
   - Wrap component in `<I18nProvider locale="..." messages={...}>` for rendering
   - Mock `next/navigation` with `vi.mock`

4. **Testing the loading state**: The `HomePage` component starts with `isLoading = true` (initial `useState` value). The `useEffect` runs asynchronously after the first render, so the initial render will show the loading state. The test can simply check the initial render output before `useEffect` fires.

5. **Mock `getUserProfile`**: Mock `@/client/state/localStorage/userProfile` to control the effect behavior and prevent errors in the test environment.

6. **No translation file changes needed**: The keys `homepage.greeting.loading` already exist in both `src/i18n/en.json` (line 249: `"loading": "Loading..."`) and `src/i18n/he.json` (line 249: `"loading": "טוען..."`).
