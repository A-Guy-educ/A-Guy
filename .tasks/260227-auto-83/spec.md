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

### Visibility
- Visible to logged-in users
- Visible to guest users
- No role restrictions

### Behavior
- On click: navigate to `/study-plan`
- Same tab navigation
- Standard router push behavior

### Styling
- Use existing design system button component
- Secondary prominence (not primary CTA)
- No new styles
- No layout shifts
- Must align correctly in RTL and LTR

### Constraints
- No new dependencies
- No changes outside Preferences section
- No regression in accordion open/close behavior

## Acceptance Criteria

1. Button appears only inside expanded Preferences section
2. Correct label based on locale
3. Clicking navigates to `/study-plan`
4. Works for guest and logged-in users
5. No UI regression in Account page
6. RTL/LTR alignment remains correct
