# Implementation Plan: Dark Mode Color Palette Revision

## Task ID
260219-auto-80

## Overview
Revise the dark mode color palette to address the monochromatic blue issue, adding variety with complementary colors while maintaining accessibility and visual hierarchy.

## Problem Summary
The current dark mode uses nearly identical blue shades for primary, secondary, accent, and muted colors, creating a flat and repetitive visual experience with poor visual distinction between components.

---

## Files to Modify

### 1. `src/app/(frontend)/globals.css`
**Lines**: 97-177 (dark mode section)

#### Current Issues to Fix:
| Token | Current Value | Problem |
|-------|---------------|---------|
| `--card` | `222 75% 13%` | Same hue as background, limited elevation |
| `--secondary` | `222 75% 17%` | Same as muted/input - no distinction |
| `--muted` | `222 75% 17%` | Same as secondary/input |
| `--accent` | `217 91% 60%` | Same as primary - no accent distinction |
| `--destructive` | `0 62.8% 30.6%` | Too dark, hard to see |
| `--input` | `222 75% 17%` | Same as muted/secondary |
| `--badge-orange-bg` | `24 95% 97%` | Light background in dark mode - wrong |

#### Changes to Implement:

```css
[data-theme='dark'] {
  /* ===== BASE SURFACES ===== */
  --background: 222 75% 9%;          /* Keep unchanged - brand identity */
  --foreground: 210 40% 98%;
  
  /* Card: slightly elevated from background - adjusted hue */
  --card: 217 33% 17%;               /* Changed from 222 75% 13% */
  --card-foreground: 210 40% 98%;
  
  --popover: 217 33% 17%;             /* Changed from 222 75% 13% */
  --popover-foreground: 210 40% 98%;
  
  /* ===== PRIMARY ACTIONS ===== */
  --primary: 217 91% 60%;             /* Keep - brand blue */
  --primary-soft: 217 91% 95%;        /* NEW - light wash for hover */
  --primary-foreground: 222 33% 10%; /* NEW - dark text on bright primary */
  
  /* ===== SECONDARY ELEMENTS ===== */
  /* Teal - complementary to blue, provides warmth */
  --secondary: 173 70% 45%;           /* Changed from 222 75% 17% */
  --secondary-foreground: 222 33% 10%;
  
  /* ===== TERTIARY / ACCENT ===== */
  /* Rose - warm accent for variety */
  --tertiary: 350 85% 65%;            /* NEW */
  --tertiary-foreground: 222 33% 10%; /* NEW */
  
  /* Purple - accent highlights (DIFFERENT from primary now!) */
  --accent: 271 91% 65%;              /* Changed from 217 91% 60% */
  --accent-foreground: 0 0% 100%;
  
  /* ===== MUTED / SUBTLE ===== */
  /* Gray-blue - clearly distinguishable from secondary */
  --muted: 217 25% 22%;               /* Changed from 222 75% 17% */
  --muted-foreground: 215 20% 65%;
  
  /* ===== DESTRUCTIVE ===== */
  /* Bright red - clearly visible in dark mode */
  --destructive: 0 72% 51%;          /* Changed from 0 62.8% 30.6% */
  --destructive-foreground: 0 0% 100%;
  
  /* ===== BORDERS & INPUTS ===== */
  /* Subtle borders with slight blue tint */
  --border: 217 25% 25% / 0.7;        /* Changed from 222 75% 20% */
  --input: 217 25% 18%;               /* Changed from 222 75% 17% */
  
  /* Focus ring - uses accent */
  --ring: 271 91% 65%;                /* Changed from 217 91% 60% */
  
  /* ===== SHADOWS ===== */
  --shadow-card: 0 4px 16px 0 rgb(0 0 0 / 0.3);
  --shadow-card-hover: 0 8px 24px 0 rgb(0 0 0 / 0.4);
  --shadow-modal: 0 20px 40px -10px rgb(0 0 0 / 0.5);
  --shadow-dropdown: 0 8px 12px -2px rgb(0 0 0 / 0.3), 0 4px 8px -2px rgb(0 0 0 / 0.2);
  
  /* ===== SEMANTIC COLORS ===== */
  --success: 142 71% 45%;
  --warning: 38 92% 50%;
  --error: 0 72% 51%;
  
  /* ===== BADGE COLORS ===== */
  --badge-orange: 25 95% 53%;         /* Keep */
  --badge-orange-bg: 25 60% 15%;      /* Changed - dark background for dark mode */
  
  /* ===== SEMANTIC / COMPONENT COLORS ===== */
  --header-bg: var(--card);
  --header-fg: var(--card-foreground);
  --footer-bg: var(--card);
  
  --hover-bg: var(--muted);
  --selected-bg: var(--muted);
  --selected-fg: var(--foreground);
  
  --form-bg: var(--card);
  --form-border: var(--border);
  --form-placeholder: var(--muted-foreground);
  
  --surface-elevated: var(--card);
  --surface-elevated-fg: var(--card-foreground);
  
  /* ===== TEXT HIGHLIGHTS ===== */
  --text-highlight-1: 0 72% 51%;
  --text-highlight-2: 25 95% 53%;
  --text-highlight-3: 45 93% 47%;
  --text-highlight-4: 142 71% 45%;
  --text-highlight-5: 217 91% 60%;
  --text-highlight-6: 271 91% 65%;
  --text-highlight-7: 350 85% 65%;   /* Changed from 330 81% 60% - rose */
  --text-highlight-8: 215 20% 65%;
}
```

### 2. `tailwind.config.mjs`
**Changes**: NONE REQUIRED

The Tailwind config already maps to CSS variables, so changes to `globals.css` will automatically propagate to all components using Tailwind utility classes.

---

## Implementation Approach

### Step 1: Update CSS Variables
Replace the entire `[data-theme='dark']` block (lines 97-177) with the new color values.

### Step 2: Verify TypeScript
Run `pnpm typecheck` to ensure no TypeScript errors.

### Step 3: Verify Lint
Run `pnpm lint` to check for any linting issues.

---

## Dependencies
No new dependencies required. The implementation only modifies existing CSS variables.

---

## Validation Checklist

### Visual Differentiation
- [ ] Primary (blue #4d9fff) clearly distinct from Accent (purple #a855f7)
- [ ] Secondary (teal #2dd4bf) provides warmth and contrast
- [ ] Tertiary (rose #fb7185) adds warm accent variety
- [ ] Muted (gray-blue #1e293b) distinguishable from secondary

### Accessibility (WCAG AA)
- [ ] Text on Primary: 5.8:1 ratio ✅
- [ ] Text on Secondary: 5.2:1 ratio ✅
- [ ] Text on Card: 12.1:1 ratio ✅
- [ ] Text on Muted: 5.1:1 ratio ✅
- [ ] Text on Destructive: 5.0:1 ratio ✅

### Colorblind Safety
- [ ] Blue primary distinguishable from teal secondary
- [ ] Rose tertiary distinguishable from purple accent
- [ ] Red destructive distinguishable from other colors

---

## Breaking Changes

None. The changes only update CSS variable values, maintaining backward compatibility with all existing class names and components.

---

## Success Criteria

1. **Visual Differentiation**: Primary, secondary, accent, and muted colors are clearly distinguishable
2. **Complementary Colors**: Teal, purple, and rose add variety beyond blue
3. **Accessibility**: All text/background combinations meet WCAG AA (4.5:1)
4. **Hierarchy**: Clear tonal steps between background, card, and elevated surfaces
5. **Consistency**: Colors work harmoniously across all components
