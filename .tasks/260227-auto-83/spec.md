# Spec: Build Exam Study Plan CTA in Account Preferences

## Overview

Add a "Build Exam Study Plan" CTA button inside the Preferences section of the Account page that navigates users to `/study-plan`.

## Requirements

### Location
- Account page: `/account?section=preferences`
- Button must appear inside the expanded Preferences section only
- Not a new accordion item
- Does not affect other sections

### Button Labels
- **Hebrew:** `הכנת תוכנית לימודים לקראת מבחן`
- **English:** `Build exam study plan`
- Must respect active locale (RTL/LTR support)

### Translations Required
- Add `buildExamStudyPlan` key to `src/i18n/en.json` under `auth.account`:
  - Value: `Build exam study plan`
- Add `buildExamStudyPlan` key to `src/i18n/he.json` under `auth.account`:
  - Value: `הכנת תוכנית לימודים לקראת מבחן`

### Visibility
- Visible to authenticated users only (Account page requires login)
- No role restrictions

### Behavior
- Use `<Link>` component from `next/link` to navigate to `/study-plan`
- Same tab navigation (default Link behavior)
- No onClick handler needed - Link handles navigation

### Styling
- Use existing design system button component (`@/ui/web/components/button`)
- Use `variant="secondary"` for secondary prominence
- Wrap button with `<Link>` component from `next/link`
- No new styles
- No layout shifts
- Must align correctly in RTL and LTR (Link component handles this)

### Constraints
- No new dependencies
- No changes outside Preferences section
- No regression in accordion open/close behavior

## Acceptance Criteria

1. Button appears only inside expanded Preferences section
2. Correct label based on locale (using i18n translation key)
3. Clicking navigates to `/study-plan` via Link component
4. Works for authenticated users only (Account page requires login)
5. No UI regression in Account page
6. RTL/LTR alignment remains correct
7. Button translations exist in both en.json and he.json under auth.account
