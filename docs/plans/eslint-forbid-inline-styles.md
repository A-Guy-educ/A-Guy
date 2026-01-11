# Plan: Add ESLint Rule to Forbid Inline Styles (Excluding Admin)

## Overview
Add ESLint rule `react/forbid-dom-props` to prevent inline styles in non-admin code, while allowing necessary exceptions for dynamic values and third-party component styling.

## Current State Analysis

### Inline Style Usage Summary
- **Total files with inline styles:** 11 files
- **Admin files (will be excluded):** 6 files (~33 instances)
- **Non-admin files (need fixing):** 5 files (~5 instances)

### Non-Admin Files Requiring Refactoring

| File | Lines | Type | Action Required |
|------|-------|------|-----------------|
| `src/app/global-error.tsx` | 21 | Static | Convert to Tailwind |
| `src/app/(frontend)/not-found.tsx` | 15 | Static | Convert to Tailwind |
| `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonContent.tsx` | 65-68 | CSS vars gradient | Convert to CSS module |
| `src/blocks/Form/Width/index.tsx` | 9 | Dynamic width% | Keep as exception (add comment) |
| `src/components/AdminBar/index.tsx` | 75-80 | Third-party component | Keep as exception (add comment) |

## Implementation Steps

### Step 1: Refactor Static Inline Styles to Tailwind

#### 1.1 Fix `src/app/global-error.tsx`
**Current (line 21):**
```tsx
<div style={{ padding: '20px', textAlign: 'center' }}>
```

**New:**
```tsx
<div className="p-5 text-center">
```

#### 1.2 Fix `src/app/(frontend)/not-found.tsx`
**Current (line 15):**
```tsx
<h1 style={{ marginBottom: 0 }}>{t('title')}</h1>
```

**New:**
```tsx
<h1 className="mb-0">{t('title')}</h1>
```

### Step 2: Refactor Complex Gradient to CSS Module

#### 2.1 Create CSS Module
**File:** `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonContent.module.css`

```css
.dividerGradient {
  background: linear-gradient(
    to right,
    transparent,
    hsl(var(--border)) 20%,
    hsl(var(--border)) 80%,
    transparent
  );
}
```

#### 2.2 Update `LessonContent.tsx`
**Current (lines 65-68):**
```tsx
<div
  className="h-0.5 my-8 flex-shrink-0"
  style={{
    background:
      'linear-gradient(to right, transparent, hsl(var(--border)) 20%, hsl(var(--border)) 80%, transparent)',
  }}
/>
```

**New:**
```tsx
import styles from './LessonContent.module.css'

// ... later in component
<div className={`${styles.dividerGradient} h-0.5 my-8 flex-shrink-0`} />
```

### Step 3: Document Necessary Exceptions

#### 3.1 Add Comment to `src/blocks/Form/Width/index.tsx`
**Before line 9:**
```tsx
// eslint-disable-next-line react/forbid-dom-props -- Dynamic width percentage requires inline style
<div className={className} style={{ maxWidth: width ? `${width}%` : undefined }}>
```

#### 3.2 Add Comment to `src/components/AdminBar/index.tsx`
**Before line 75:**
```tsx
{/* eslint-disable-next-line react/forbid-dom-props -- Third-party PayloadAdminBar component requires inline styles for proper override */}
<PayloadAdminBar
  style={{
    backgroundColor: 'transparent',
    padding: 0,
    position: 'relative',
    zIndex: 'unset',
  }}
/>
```

### Step 4: Update ESLint Configuration

**File:** `eslint.config.mjs`

Add the `react/forbid-dom-props` rule to the existing rules section:

```javascript
const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // ... existing rules ...

      // React rules
      'react/forbid-dom-props': [
        'error',
        {
          forbid: [
            {
              propName: 'style',
              message: 'Inline styles are forbidden. Use Tailwind classes or CSS modules instead. For dynamic values, add an eslint-disable comment with justification.',
            },
          ],
        },
      ],
    },
  },
  {
    // Exclude admin components from inline style rule
    files: ['src/components/admin/**/*', 'src/app/(payload)/admin/**/*'],
    rules: {
      'react/forbid-dom-props': 'off',
    },
  },
  {
    ignores: ['.next/', 'node_modules/', '.cache/', 'dist/', 'build/', 'coverage/'],
  },
]
```

## Critical Files to Modify

1. `src/app/global-error.tsx` - Remove inline styles (Tailwind)
2. `src/app/(frontend)/not-found.tsx` - Remove inline styles (Tailwind)
3. `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonContent.tsx` - Refactor to CSS module
4. `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonContent.module.css` - Create new CSS module
5. `src/blocks/Form/Width/index.tsx` - Add ESLint disable comment
6. `src/components/AdminBar/index.tsx` - Add ESLint disable comment
7. `eslint.config.mjs` - Add new rule configuration

## Dependencies

- **No new dependencies required**
- `eslint-plugin-react@7.37.5` is already available (transitive dependency via `eslint-config-next`)

## Verification Steps

### 1. Verify Refactoring Works
```bash
# Start dev server and check pages render correctly
pnpm dev

# Visit these pages to verify:
# - http://localhost:3000/some-invalid-url (404 page)
# - Trigger an error to test global-error.tsx
# - Navigate to any lesson page (LessonContent)
```

### 2. Run ESLint
```bash
# Run lint to verify no errors in non-admin files
pnpm lint

# Should show NO errors related to inline styles in non-admin files
# Admin files should still be able to use inline styles
```

### 3. Verify Exceptions Work
- Check that `Width/index.tsx` and `AdminBar/index.tsx` don't trigger errors despite having inline styles
- Verify the ESLint disable comments are working

### 4. Test Visual Appearance
- **404 page:** Title should have no bottom margin, content centered
- **Error page:** Content should be centered with padding
- **Lesson page:** Gradient divider should render correctly with proper colors
- **Form width:** Dynamic width should still work correctly
- **Admin bar:** Should display properly with transparent background

### 5. Run Full Quality Gates
```bash
# Run all checks to ensure nothing broke
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

## Risk Assessment

**Low Risk:**
- Changes are minimal and isolated
- All static styles have direct Tailwind equivalents
- CSS module approach is standard and well-supported
- Exceptions are properly documented
- Admin components remain unaffected

**Potential Issues:**
- Gradient rendering might need color verification
- ESLint disable comments must be exact format
- Need to verify CSS module import works in lesson components

## Rollback Plan

If issues arise:
1. Revert changes to individual files
2. Remove the ESLint rule from `eslint.config.mjs`
3. Git operations:
   ```bash
   git checkout HEAD -- <file-path>
   # or
   git revert <commit-hash>
   ```

## Success Criteria

- ✅ ESLint passes with no inline style errors in non-admin code
- ✅ All pages render correctly with proper styling
- ✅ Dynamic width in Form/Width still works
- ✅ Admin bar displays correctly
- ✅ Admin components can still use inline styles
- ✅ Type checking passes
- ✅ All tests pass
- ✅ No visual regressions
