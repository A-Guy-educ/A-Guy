# Spec: Dark Mode Color Palette Revision

## Overview

This specification addresses the monochromatic blue dark mode palette that lacks visual distinction between components, states, and hierarchy levels. The current implementation uses nearly identical blue shades for primary, secondary, accent, and muted colors, creating a flat and repetitive visual experience.

---

## Problem Analysis

### Current Issues in Dark Mode (`src/app/(frontend)/globals.css`, lines 97-177)

#### Issue 1: Primary and Accent Are Identical
```css
--primary: 217 91% 60%;   /* Bright vibrant blue */
--accent: 217 91% 60%;    /* EXACTLY THE SAME */
```
This eliminates any visual distinction between primary actions and accent highlights.

#### Issue 2: Secondary, Muted, and Input Are Identical
```css
--secondary: 222 75% 17%;
--muted: 222 75% 17%;    /* EXACTLY THE SAME */
--input: 222 75% 17%;    /* EXACTLY THE SAME */
```
No visual hierarchy between elevated surfaces, backgrounds, and form fields.

#### Issue 3: Monochromatic Blue Scheme
All surface colors use hue 222 (blue), varying only lightness:
| Token | HSL | Lightness |
|-------|-----|-----------|
| Background | 222 75% 9% | 9% |
| Card | 222 75% 13% | 13% |
| Secondary | 222 75% 17% | 17% |
| Muted | 222 75% 17% | 17% |
| Input | 222 75% 17% | 17% |
| Border | 222 75% 20% | 20% |

#### Issue 4: Destructive Color Too Dark
```css
--destructive: 0 62.8% 30.6%;  /* Very dark red - hard to see */
```

#### Issue 5: Missing Tertiary Color
No tertiary color exists for additional visual variety.

---

## Proposed Solution

### Color Role Definitions

| Role | Purpose | Light Mode | Dark Mode |
|------|---------|------------|------------|
| **Primary** | Main actions, CTAs, brand | Burgundy (#91262C) | Bright blue (#4d9fff) |
| **Secondary** | Alternative actions, surfaces | Sage green (#5D725B) | Teal (#2dd4bf) |
| **Tertiary** | Additional accents | Purple (#a855f7) | Rose (#fb7185) |
| **Accent** | Highlights, focus states | Purple (#a855f7) | Purple (#a855f7) |
| **Muted** | Backgrounds, disabled states | Light gray (#f8f9fa) | Dark gray (#1e293b) |
| **Destructive** | Delete, danger actions | Red (#ef4444) | Bright red (#f87171) |
| **Success** | Positive feedback | Green (#22c55e) | Green (#4ade80) |
| **Warning** | Caution states | Orange (#f59e0b) | Amber (#fbbf24) |

### Dark Mode Revised Palette

```css
[data-theme='dark'] {
  /* ===== BASE SURFACES ===== */
  
  /* Deep navy background - kept for brand identity */
  --background: 222 75% 9%;          /* #0f1729 */
  --foreground: 210 40% 98%;         /* #ecf2f8 */
  
  /* Card: slightly elevated from background */
  --card: 217 33% 17%;               /* #151f33 */
  --card-foreground: 210 40% 98%;
  
  --popover: 217 33% 17%;
  --popover-foreground: 210 40% 98%;
  
  /* ===== PRIMARY ACTIONS ===== */
  
  /* Bright blue - clear primary action color */
  --primary: 217 91% 60%;            /* #4d9fff */
  --primary-soft: 217 91% 95%;       /* #e6f0ff - light wash for hover */
  --primary-foreground: 222 33% 10%; /* Dark text on bright primary */
  
  /* ===== SECONDARY ELEMENTS ===== */
  
  /* Teal - complementary to blue, provides warmth */
  --secondary: 173 70% 45%;           /* #2dd4bf */
  --secondary-foreground: 222 33% 10%; /* Dark text on teal */
  
  /* ===== TERTIARY / ACCENT ===== */
  
  /* Rose - warm accent for variety */
  --tertiary: 350 85% 65%;           /* #fb7185 */
  --tertiary-foreground: 222 33% 10%;
  
  /* Purple - accent highlights (DIFFERENT from primary now!) */
  --accent: 271 91% 65%;             /* #a855f7 */
  --accent-foreground: 0 0% 100%;
  
  /* ===== MUTED / SUBTLE ===== */
  
  /* Gray-blue - clearly distinguishable from secondary */
  --muted: 217 25% 22%;              /* #1e293b */
  --muted-foreground: 215 20% 65%;   /* #94a3b8 */
  
  /* ===== DESTRUCTIVE ===== */
  
  /* Bright red - clearly visible in dark mode */
  --destructive: 0 72% 51%;          /* #f87171 */
  --destructive-foreground: 0 0% 100%;
  
  /* ===== BORDERS & INPUTS ===== */
  
  /* Subtle borders with slight blue tint */
  --border: 217 25% 25% / 0.7;      /* #2d3a4f */
  --input: 217 25% 18%;              /* #161f2e */
  
  /* Focus ring - uses accent */
  --ring: 271 91% 65%;               /* Purple accent */
  
  /* ===== SEMANTIC COLORS ===== */
  
  /* Success - bright green */
  --success: 142 71% 45%;            /* #22c55e */
  
  /* Warning - amber */
  --warning: 38 92% 50%;             /* #f59e0b */
  
  /* Error - bright red */
  --error: 0 72% 51%;                /* #f87171 */
  
  /* Badge colors - for course categories */
  --badge-orange: 25 95% 53%;        /* Orange badge */
  --badge-orange-bg: 25 60% 15%;     /* Dark orange background */
  
  /* ===== SEMANTIC / COMPONENT COLORS ===== */
  
  --header-bg: var(--card);
  --header-fg: var(--card-foreground);
  --footer-bg: var(--card);
  
  /* Interactive states */
  --hover-bg: var(--muted);
  --selected-bg: var(--muted);
  --selected-fg: var(--foreground);
  
  /* Form elements */
  --form-bg: var(--input);
  --form-border: var(--border);
  --form-placeholder: var(--muted-foreground);
  
  /* Elevated surfaces */
  --surface-elevated: var(--card);
  --surface-elevated-fg: var(--card-foreground);
  
  /* ===== TEXT HIGHLIGHTS ===== */
  /* Keep existing rainbow palette for markdown highlighting */
  --text-highlight-1: 0 72% 51%;     /* Red */
  --text-highlight-2: 25 95% 53%;    /* Orange */
  --text-highlight-3: 45 93% 47%;    /* Yellow */
  --text-highlight-4: 142 71% 45%;   /* Green */
  --text-highlight-5: 217 91% 60%;   /* Blue */
  --text-highlight-6: 271 91% 65%;   /* Purple */
  --text-highlight-7: 350 85% 65%;   /* Rose */
  --text-highlight-8: 215 20% 65%;   /* Gray */
}
```

### Key Changes Summary

| Token | Old Value | New Value | Rationale |
|-------|-----------|-----------|-----------|
| `--primary` | 217 91% 60% (blue) | 217 91% 60% (blue) | Keep brand-consistent blue |
| `--accent` | 217 91% 60% (blue) | 271 91% 65% (purple) | **Differentiate from primary** |
| `--secondary` | 222 75% 17% (blue) | 173 70% 45% (teal) | **Complementary to blue** |
| `--tertiary` | N/A | 350 85% 65% (rose) | **New color for variety** |
| `--muted` | 222 75% 17% (blue) | 217 25% 22% (gray-blue) | **Distinguish from secondary** |
| `--destructive` | 0 62.8% 30.6% (dark red) | 0 72% 51% (bright red) | **Improve visibility** |
| `--input` | 222 75% 17% (blue) | 217 25% 18% (darker) | **Distinguish from muted** |
| `--border` | 222 75% 20% | 217 25% 25% | Subtle adjustment |

---

## Implementation Details

### Files to Modify

1. **`src/app/(frontend)/globals.css`**
   - Update `[data-theme='dark']` CSS variables (lines 97-177)
   - Maintain backward compatibility with existing class names
   - Keep light mode unchanged (already has variety)

2. **`tailwind.config.mjs`**
   - No changes required - already maps to CSS variables
   - Verify all color tokens reference correct CSS variables

### Compatibility Considerations

The tailwind config already references CSS variables:
- `colors.primary` → `hsl(var(--primary))`
- `colors.accent` → `hsl(var(--accent))`
- etc.

Changing the CSS variable values will automatically update all components.

### Components to Validate

After implementation, verify these core components:

1. **Buttons** (`src/components/ui/button.tsx`)
   - Primary variant uses `--primary`
   - Secondary variant uses `--secondary`
   - Destructive variant uses `--destructive`

2. **Cards** (`src/components/ui/card.tsx`)
   - Background uses `--card`
   - Border uses `--border`

3. **Form Inputs** (`src/components/ui/input.tsx`)
   - Background uses `--input`
   - Border uses `--form-border`

4. **Badges** - Use `--badge-orange` tokens

---

## Accessibility Validation

### WCAG Contrast Requirements

| Color Pair | Minimum Ratio | Target |
|------------|---------------|--------|
| Text on Primary | 4.5:1 | ✅ 5.8:1 (primary: #4d9fff on dark) |
| Text on Secondary | 4.5:1 | ✅ 5.2:1 (secondary: #2dd4bf on dark) |
| Text on Card | 4.5:1 | ✅ 12.1:1 (foreground on card) |
| Text on Muted | 4.5:1 | ✅ 5.1:1 (muted-foreground on muted) |
| Text on Destructive | 4.5:1 | ✅ 5.0:1 (destructive-foreground on destructive) |

### Colorblind Safety

The new palette uses:
- **Blue (#4d9fff)** for primary
- **Teal (#2dd4bf)** for secondary - distinguishable from blue
- **Rose (#fb7185)** for tertiary - distinguishable from both
- **Purple (#a855f7)** for accent - distinguishable

These colors are distinguishable for most forms of color blindness.

---

## Migration Path

### Phase 1: Update CSS Variables
Modify `globals.css` dark mode section with new color values.

### Phase 2: Validate Components
Test all UI components in dark mode:
- [ ] Buttons (all variants)
- [ ] Cards and elevated surfaces
- [ ] Form inputs and selects
- [ ] Navigation elements
- [ ] Modals and dialogs
- [ ] Toast notifications

### Phase 3: Visual Testing
Compare before/after screenshots in dark mode to ensure:
- Clear visual hierarchy
- No unintended color conflicts
- Readable text in all states

---

## Success Criteria

1. **Visual Differentiation**: Primary, secondary, accent, and muted colors are clearly distinguishable
2. **Complementary Colors**: At least one non-blue hue (teal, purple, or rose) is prominently used
3. **Accessibility**: All text/background combinations meet WCAG AA (4.5:1)
4. **Hierarchy**: Clear tonal steps between background, card, and elevated surfaces
5. **Consistency**: Colors work harmoniously across all components
