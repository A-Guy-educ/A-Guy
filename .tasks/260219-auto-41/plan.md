# Plan: Dark Mode Color Palette Enhancement

## Task ID
260219-auto-41

## Overview
This plan addresses the dark mode color palette that lacks variety with overuse of similar blue shades. The goal is to create a balanced, expressive, and accessible dark theme with clear visual hierarchy.

## Current State Analysis

### Problems Identified (from spec.md)

1. **Duplicate Colors:**
   - `--primary` (line 110) and `--accent` (line 122) are both `217 91% 60%` (identical blue)
   - `--secondary` (line 114) and `--muted` (line 118) are both `222 75% 17%` (identical blue)
   
2. **Monochromatic Blue Palette:**
   - All colors use Hue 217-222 (blue)
   - No complementary hues for accents
   - No visual distinction between states

3. **Broken Badge Colors:**
   - `--badge-orange-bg` (line 147): `24 95% 97%` - light background unusable in dark mode

4. **Unoptimized Semantic Colors:**
   - Success, warning, error use same values in both modes
   - Not optimized for dark background contrast

## Implementation Approach

### File to Modify
- **Target:** `src/app/(frontend)/globals.css`
- **Section:** `[data-theme='dark']` block (lines 97-177)

### Color Changes

#### 1. Background & Surface Colors
- Slightly darker background: `222 47% 7%` (from `222 75% 9%`)
- Elevated card: `222 47% 11%` (from `222 75% 13%`)

#### 2. Primary Brand Color
- Change from blue (`217 91% 60%`) to coral-red (`353 73% 56%`) for brand consistency with light mode's burgundy
- Add `--primary-soft` for hover states: `353 73% 15%`

#### 3. Secondary & Accent Colors
- Secondary: `220 25% 16%` (different from muted)
- Accent: `261 75% 65%` (vibrant purple - complementary to coral)

#### 4. Muted Colors
- `--muted`: `215 20% 14%` (dark gray-blue)
- `--muted-foreground`: `215 15% 60%` (proper muted text)

#### 5. Semantic Colors
- `--destructive`: `0 70% 35%` (darker red)
- `--success`: `158 64% 45%` (emerald green)
- `--warning`: `38 90% 50%` (amber orange)
- `--error`: `0 72% 45%` (crimson red)

#### 6. Border & Input
- `--border`: `222 25% 18%` (subtle blue-gray)
- `--input`: `222 20% 14%` (input background)
- `--ring`: `353 73% 56%` (focus ring follows primary)

#### 7. Badge Colors
- `--badge-orange-bg`: `25 90% 15%` (dark orange background)

#### 8. Interactive States
- Add `--hover-bg` and `--selected-bg` variants

## File Changes

### Modified File
- `src/app/(frontend)/globals.css` - Update `[data-theme='dark']` CSS custom properties (lines 97-177)

### No Changes Required
- Tailwind config (uses CSS variables)
- Component files (already use semantic tokens)
- Light mode tokens (already well-structured)

## Quality Checks

Run after implementation:
1. `pnpm typecheck` - Verify TypeScript compilation
2. `pnpm lint` - Verify code style

## Testing Checklist

- [ ] All buttons render with correct colors
- [ ] Cards have visible elevation difference from background
- [ ] Form inputs are distinguishable
- [ ] Badges are visible and readable
- [ ] Success/warning/error states are distinct
- [ ] Navigation has clear active/inactive states
- [ ] No flash of incorrect colors on theme switch
- [ ] All text meets WCAG AA contrast
