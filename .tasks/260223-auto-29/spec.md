# RTL CSS Fix Specification

## Overview
Replace physical directional Tailwind CSS classes with logical RTL-aware equivalents across ~10 frontend components to fix spacing and alignment issues in RTL mode (Hebrew locale).

## Problem
The project is RTL-first (Hebrew default), but components use physical directional classes (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `border-l`, `border-r`) which cause incorrect spacing and alignment when rendered in RTL mode.

## Requirements

### FR-1: Fix ChatInterface RTL Classes
- Line 366: `mr-2` → `me-2` (Loader2 icon in loading state)
- Line 382: `ml-auto` → `ms-auto` (user message alignment)
- Line 383: `mr-auto` → `me-auto` (assistant message alignment)
- Line 440: `mr-auto` → `me-auto` (ChatMessageContent wrapper)
- Line 493: `left-5 right-5` → `start-5 end-5` (tooltip positioning)

### FR-2: Fix MobileMenu RTL Classes
- Line 65: `right-0` → `end-0`, `border-l` → `border-s`

### FR-3: Fix CommandPalette RTL Classes
- Lines 49, 58, 62, 71, 77: `left-1/2` → `start-1/2`, `mr-2` → `me-2`

### FR-4: Fix HealthBadge RTL Classes
- Line 79: `ml-2` → `ms-2`

### FR-5: Fix TypingAnimation RTL Classes
- Line 36: `ml-1` → `ms-1`

### FR-6: Fix UserDropdown RTL Classes
- Line 56: `mr-2` → `me-2`

### FR-7: Fix QuestionCard RTL Classes
- Lines 84, 89: `mr-2` → `me-2`

### FR-8: Fix Pagination RTL Classes
- Line 52: `pl-2.5` → `ps-2.5`
- Line 64: `pr-2.5` → `pe-2.5`

## Acceptance Criteria

1. All physical directional classes replaced with logical equivalents
2. No functional changes - only CSS class name changes
3. Components render correctly in RTL mode (Hebrew locale)
4. TypeScript compilation succeeds
5. No linting errors
