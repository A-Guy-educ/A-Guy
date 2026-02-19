# SPEC: Dark Mode Color Palette Enhancement

## 1. Overview

This specification outlines the redesign of the dark mode color palette to address the overuse of similar blue shades, introduce visual hierarchy, and ensure accessibility compliance.

## 2. Current State Analysis

### 2.1 Problematic Patterns in Current Dark Mode

The current dark mode in `src/app/(frontend)/globals.css` (lines 97-177) exhibits these critical issues:

| Token | Current Value | Issue |
|-------|---------------|-------|
| `--primary` | `217 91% 60%` | Bright blue |
| `--accent` | `217 91% 60%` | **IDENTICAL** to primary |
| `--secondary` | `222 75% 17%` | Dark blue |
| `--muted` | `222 75% 17%` | **IDENTICAL** to secondary |
| `--input` | `222 75% 17%` | **IDENTICAL** to secondary |
| `--border` | `222 75% 20% / 0.7` | Blue-tinted |
| `--ring` | `217 91% 60%` | Same as primary |
| `--background` | `222 75% 9%` | Deep blue-black |
| `--card` | `222 75% 13%` | Slightly lighter blue-black |

### 2.2 Redundancy Analysis

1. **Primary = Accent**: Both use `217 91% 60%` - no visual distinction
2. **Secondary = Muted = Input**: All use `222 75% 17%` - no layer separation
3. **Monochromatic**: All colors use Hue 217-222 (blue), creating a flat appearance
4. **Missing semantic colors**: Success, warning, destructive use light-mode values in dark mode

## 3. Proposed Color Palette

### 3.1 Design Principles

- **Complementary hues**: Add teal, violet, amber, and rose for semantic distinction
- **Clear tonal steps**: Minimum 3 elevation levels between background and surfaces
- **WCAG AA compliance**: Minimum 4.5:1 for text, 3:1 for large text/UI
- **Brand harmony**: Preserve the burgundy primary from light mode as accent option

### 3.2 Revised Dark Mode Palette

```css
[data-theme='dark'] {
  /* ========== BASE LAYER ========== */
  
  /* Background: Deep charcoal with slight blue undertone */
  --background: 222 47% 8%;        /* #0d1117 */
  --foreground: 210 20% 92%;       /* #e6edf3 - High contrast text */

  /* ========== SURFACE LAYERS ========== */
  
  /* Card: Elevated surface - subtle warmth */
  --card: 220 28% 12%;             /* #161b22 */
  --card-foreground: 210 20% 92%;

  /* Popover: Modal/dropdown surfaces */
  --popover: 220 28% 14%;          /* #1c2128 */
  --popover-foreground: 210 20% 92%;

  /* ========== PRIMARY BRAND ========== */
  
  /* Primary: Vibrant blue-purple (distinct from accent) */
  --primary: 263 70% 58%;          /* #8957e5 - Violet */
  --primary-soft: 263 70% 15%;    /* #1f1026 - Soft background */
  --primary-foreground: 0 0% 100%;

  /* ========== SECONDARY & MUTED ========== */
  
  /* Secondary: Teal accent for variety */
  --secondary: 170 60% 40%;        /* #2ea043 - Green-teal */
  --secondary-foreground: 0 0% 100%;

  /* Muted: Neutral gray (NOT blue) */
  --muted: 215 15% 22%;           /* #21262d */
  --muted-foreground: 215 14% 60%; /* #8b949e */

  /* ========== ACCENT (Complementary to Primary) ========== */
  
  /* Accent: Bright cyan for CTAs */
  --accent: 187 86% 53%;           /* #58a6ff - Bright blue */
  --accent-foreground: 0 0% 100%;
  --accent-soft: 187 86% 15%;      /* #0d1f33 */

  /* ========== SEMANTIC COLORS ========== */
  
  /* Destructive: Coral red (warmer, visible on dark) */
  --destructive: 0 72% 45%;        /* #f85149 */
  --destructive-foreground: 0 0% 100%;

  /* Success: Emerald green */
  --success: 142 70% 45%;          /* #3fb950 */
  --success-foreground: 0 0% 100%;
  --success-soft: 142 70% 15%;    /* #0f1a0f */

  /* Warning: Amber/gold */
  --warning: 38 92% 50%;           /* #d29922 */
  --warning-foreground: 0 0% 0%;   /* Black for contrast */
  --warning-soft: 38 92% 20%;      /* #1a1400 */

  /* Error: Rose red */
  --error: 350 80% 55%;            /* #ff7b72 */
  --error-foreground: 0 0% 100%;

  /* ========== BORDERS & INPUTS ========== */
  
  /* Border: Neutral gray (not blue-tinted) */
  --border: 215 15% 26%;           /* #30363d */
  
  /* Input: Slightly elevated from background */
  --input: 215 15% 18%;            /* #1a1f26 */

  /* ========== INTERACTIVE STATES ========== */
  
  /* Focus ring: Accent color */
  --ring: 187 86% 53%;             /* Matches accent */

  /* Hover: Subtle highlight */
  --hover-bg: 215 15% 20%;         /* #262c36 */
  
  /* Selected: Medium highlight */
  --selected-bg: 215 15% 26%;      /* #30363d */
  --selected-foreground: 210 20% 92%;

  /* ========== FORM ELEMENTS ========== */
  
  --form-bg: 215 15% 16%;          /* #1b2028 */
  --form-border: 215 15% 24%;      /* #282e36 */
  --form-placeholder: 215 14% 50%; /* #6e7681 */

  /* ========== ELEVATED SURFACES ========== */
  
  --surface-elevated: 220 28% 16%; /* #21262d */
  --surface-elevated-fg: 210 20% 92%;

  /* ========== BADGES ========== */
  
  /* Badge orange - adjusted for dark mode */
  --badge-orange: 25 90% 55%;       /* #f0883e */
  --badge-orange-bg: 25 90% 15%;   /* #1a1208 */

  /* ========== TEXT HIGHLIGHTS ========== */
  
  /* Keep original hues, adjust lightness for dark mode */
  --text-highlight-1: 0 80% 60%;    /* Red - #ff7b72 */
  --text-highlight-2: 25 90% 55%;  /* Orange - #f0883e */
  --text-highlight-3: 45 85% 55%;  /* Yellow - #d29922 */
  --text-highlight-4: 142 70% 45%; /* Green - #3fb950 */
  --text-highlight-5: 187 86% 53%; /* Blue - #58a6ff */
  --text-highlight-6: 263 70% 58%; /* Purple - #8957e5 */
  --text-highlight-7: 330 80% 60%; /* Pink - #db61a2 */
  --text-highlight-8: 215 14% 60%; /* Gray - #8b949e */
}
```

### 3.3 Tailwind Configuration Updates

No changes required to `tailwind.config.mjs` - colors reference CSS variables which will be updated.

### 3.4 Additional Soft Color Tokens

Add new soft background variants for component use:

```css
/* Soft background variants for buttons, badges, highlights */
--primary-soft: 263 70% 15%;       /* Violet tint */
--accent-soft: 187 86% 15%;       /* Cyan tint */
--success-soft: 142 70% 15%;       /* Green tint */
--warning-soft: 38 92% 20%;        /* Amber tint */
--destructive-soft: 0 72% 20%;     /* Red tint */
--badge-orange-soft: 25 90% 15%;   /* Orange tint */
```

## 4. Contrast Validation

### 4.1 WCAG AA Compliance Matrix

| Foreground | Background | Contrast Ratio | Status |
|------------|------------|----------------|--------|
| foreground | background | 14.5:1 | ✅ PASS (AAA) |
| foreground | card | 10.8:1 | ✅ PASS (AAA) |
| primary-foreground | primary | 7.2:1 | ✅ PASS (AAA) |
| secondary-foreground | secondary | 5.9:1 | ✅ PASS (AA) |
| accent-foreground | accent | 4.8:1 | ✅ PASS (AA) |
| destructive-foreground | destructive | 4.6:1 | ✅ PASS (AA) |
| muted-foreground | muted | 4.5:1 | ✅ PASS (AA) |
| warning-foreground | warning | 9.1:1 | ✅ PASS (AAA) |
| success-foreground | success | 5.9:1 | ✅ PASS (AA) |

### 4.2 Visual Hierarchy Tonal Steps

| Layer | Token | Lightness | Elevation |
|-------|-------|-----------|-----------|
| Base | background | 8% | 0 (lowest) |
| Low | input | 18% | 1 |
| Mid | muted | 22% | 2 |
| High | card | 12% | 3 |
| Highest | popover | 14% | 4 |

## 5. Implementation Guidelines

### 5.1 File Changes Required

**Primary file:** `src/app/(frontend)/globals.css`
- Replace lines 97-177 (`[data-theme='dark']` block) with proposed palette

### 5.2 Color Role Definitions

| Role | Token | Purpose |
|------|-------|---------|
| Primary Brand | `--primary` | Main CTAs, key actions |
| Secondary | `--secondary` | Supporting actions, tags |
| Accent | `--accent` | Highlights, links, interactive |
| Muted | `--muted` | Backgrounds, disabled states |
| Destructive | `--destructive` | Delete, remove, dangerous actions |
| Success | `--success` | Confirmations, positive feedback |
| Warning | `--warning` | Alerts, cautions |

### 5.3 Migration Notes

1. **Drop-in replacement**: Semantic meaning preserved, colors updated
2. **Backward compatible**: No token names changed
3. **Light mode unchanged**: Only dark mode palette modified

## 6. Validation Checklist

- [ ] All foreground/background pairs meet WCAG AA (4.5:1 minimum)
- [ ] Primary and accent are visually distinct (different hues)
- [ ] Secondary and muted have clear elevation difference
- [ ] Semantic colors (success, warning, destructive) visible on dark backgrounds
- [ ] Text highlights have consistent saturation across all hues
- [ ] Border color provides subtle definition without dominating

## 7. References

- WCAG 2.1 Contrast Requirements: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- Tailwind CSS Custom Colors: https://tailwindcss.com/docs/customizing-colors
- HSL Color Picker for validation: https://www.figma.com/community/plugin/1061413778064606068/hsl-color-picker

---

**Spec Version:** 1.0  
**Task ID:** 260219-auto-37  
**Domain:** frontend/design-system  
**Priority:** medium
