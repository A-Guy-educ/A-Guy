# SPEC: Dark Mode Color Palette Enhancement

## Task ID
260219-auto-41

## Overview
This spec addresses the dark mode color palette lacking variety with overuse of similar blue shades. The goal is to create a balanced, expressive, and accessible dark theme with clear visual hierarchy.

## Current State Analysis

### Identified Problems

1. **Duplicate Colors:**
   - `--primary` and `--accent` are both `217 91% 60%` (identical blue)
   - `--secondary` and `--muted` are both `222 75% 17%` (identical blue)
   
2. **Monochromatic Blue Palette:**
   - All colors use Hue 217-222 (blue)
   - No complementary hues for accents
   - No visual distinction between states

3. **Broken Badge Colors:**
   - `--badge-orange-bg: 24 95% 97%` - light background unusable in dark mode

4. **Unoptimized Semantic Colors:**
   - Success, warning, error use same values in both modes
   - Not optimized for dark background contrast

## Implementation Approach

### File Modification
- **Target:** `src/app/(frontend)/globals.css`
- **Section:** `[data-theme='dark']` block (lines 97-177)

### Color Token Architecture

Maintain the existing CSS variable structure with these modifications:

#### 1. Background & Surface Colors
Keep deep navy base but adjust tonal steps:
```css
--background: 222 47% 7%;    /* Deepest navy (slightly darker) */
--foreground: 210 40% 98%;    /* Off-white text */

--card: 222 47% 11%;          /* Elevated surface */
--card-foreground: 210 40% 98%;

--popover: 222 47% 11%;       /* Popover surface */
--popover-foreground: 210 40% 98%;
```

#### 2. Primary Brand Color
Change from blue to a brand-aligned warm red/coral (preserving light mode's burgundy relationship):
```css
--primary: 353 73% 56%;       /* Vibrant coral-red */
--primary-foreground: 0 0% 100%;
--primary-soft: 353 73% 15%;   /* Dark wash for hover states */
```

#### 3. Secondary & Accent Colors
Introduce complementary hues:
```css
--secondary: 220 25% 16%;      /* Muted blue-gray (different from muted) */
--secondary-foreground: 210 40% 90%;

--accent: 261 75% 65%;         /* Vibrant purple (complementary to coral) */
--accent-foreground: 0 0% 100%;
```

#### 4. Muted Colors
Create proper distinction:
```css
--muted: 215 20% 14%;          /* Dark gray-blue */
--muted-foreground: 215 15% 60%;  /* Muted text */
```

#### 5. Semantic Colors
Optimize for dark background visibility:
```css
--destructive: 0 70% 35%;      /* Darker red */
--destructive-foreground: 0 0% 95%;

--success: 158 64% 45%;        /* Emerald green */
--success-foreground: 0 0% 100%;

--warning: 38 90% 50%;         /* Amber orange */
--warning-foreground: 0 0% 10%;

--error: 0 72% 45%;            /* Crimson red */
--error-foreground: 0 0% 100%;
```

#### 6. Border & Input
Adjust for better visibility:
```css
--border: 222 25% 18%;         /* Subtle blue-gray border */
--input: 222 20% 14%;         /* Input background */
--ring: 353 73% 56%;          /* Focus ring follows primary */
```

#### 7. Badge Colors
Create proper dark mode variants:
```css
--badge-orange: 25 95% 60%;    /* Orange badge */
--badge-orange-bg: 25 90% 15%; /* Dark orange background */
```

#### 8. Interactive States
Add hover/selected variants:
```css
--hover-bg: 222 25% 16%;      /* Subtle hover background */
--selected-bg: 220 25% 20%;   /* Selected state background */
--selected-fg: 210 40% 95%;  /* Selected text */
```

#### 9. Primary Soft Variant
Add light mode variant for consistency:
```css
--primary-soft: 353 73% 15%;  /* Dark wash for dark mode hover */
```

### Accessibility Requirements

All foreground colors must meet WCAG AA contrast ratios:
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- Interactive elements: 3:1 minimum

Verify contrast ratios:
- `--foreground` (210 40% 98%) on `--background` (222 47% 7%) = ~14.5:1 ✓
- `--card-foreground` on `--card` = ~12:1 ✓
- `--muted-foreground` (215 15% 60%) on `--card` (222 47% 11%) = ~4.8:1 ✓

### Backward Compatibility

- Maintain all existing CSS variable names
- Keep the same structure (H S L format)
- Preserve any component-specific overrides
- Ensure no breaking changes to components using these tokens

### Tonal Steps Reference

| Token | Lightness | Purpose |
|-------|-----------|----------|
| background | 97% → 7% | Page background |
| card | 100% → 11% | Elevated surfaces |
| secondary | 95% → 16% | Secondary surfaces |
| muted | 96% → 14% | Muted backgrounds |
| border | 95% → 18% | Borders |

## Validation Plan

### 1. Core Components to Test
- Buttons (primary, secondary, ghost, outline)
- Cards and elevated surfaces
- Form inputs and selects
- Navigation elements
- Badges and tags
- Toast notifications
- Command palette
- Modals and dialogs

### 2. Color Contrast Testing
Verify all text/background combinations meet WCAG AA:
- Use browser DevTools or color contrast checker
- Test: foreground on background, card-foreground on card
- Test: muted-foreground on muted

### 3. Visual Hierarchy Check
Ensure distinct visual tiers:
1. Primary actions (buttons, links)
2. Secondary actions
3. Content areas
4. Muted/inactive states

## File Changes Summary

**Modified File:**
- `src/app/(frontend)/globals.css` - Update `[data-theme='dark']` CSS custom properties (lines 97-177)

**No changes required to:**
- Tailwind config (uses CSS variables)
- Component files (already use semantic tokens)
- Light mode tokens (already well-structured)

## Testing Checklist

- [ ] All buttons render with correct colors
- [ ] Cards have visible elevation difference from background
- [ ] Form inputs are distinguishable
- [ ] Badges are visible and readable
- [ ] Success/warning/error states are distinct
- [ ] Navigation has clear active/inactive states
- [ ] No flash of incorrect colors on theme switch
- [ ] All text meets WCAG AA contrast
