# Spec: 260223-auto-29

## Overview
Replace physical directional Tailwind CSS classes with logical RTL-aware equivalents across ~10 frontend components to fix spacing and alignment issues in RTL mode (Hebrew locale). The project is RTL-first, but components use physical directional classes (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `border-l`, `border-r`) which cause incorrect spacing and alignment when rendered in RTL mode.

## Requirements

### FR-001: Fix ChatInterface RTL Classes
**Priority**: MUST
**Description**: Replace physical classes with logical ones.
- Line 366: `mr-2` → `me-2` (Loader2 icon in loading state)
- Line 382: `ml-auto` → `ms-auto` (user message alignment)
- Line 383: `mr-auto` → `me-auto` (assistant message alignment)
- Line 440: `mr-auto` → `me-auto` (ChatMessageContent wrapper)
- Line 493: `left-5 right-5` → `start-5 end-5` (tooltip positioning)

### FR-002: Fix MobileMenu RTL Classes
**Priority**: MUST
**Description**: Update `right-0` → `end-0` and `border-l` → `border-s` at line 65.

### FR-003: Fix CommandPalette RTL Classes
**Priority**: MUST
**Description**: Update `left-1/2` → `start-1/2` and `mr-2` → `me-2` at lines 49, 58, 62, 71, 77.

### FR-004: Fix HealthBadge RTL Classes
**Priority**: MUST
**Description**: Update `ml-2` → `ms-2` (version text spacing) at line 89.

### FR-005: Fix TypingAnimation RTL Classes
**Priority**: MUST
**Description**: Update `ml-1` → `ms-1` (cursor animation spacing) at line 33.

### FR-006: Fix UserDropdown RTL Classes
**Priority**: MUST
**Description**: Update `mr-2` → `me-2` at line 56.

### FR-007: Fix QuestionCard RTL Classes
**Priority**: MUST
**Description**: Update `mr-2` → `me-2` at lines 84, 89.

### FR-008: Fix Pagination RTL Classes
**Priority**: MUST
**Description**: Update `pl-2.5` → `ps-2.5` at line 52 and `pr-2.5` → `pe-2.5` at line 64.

### NFR-001: Additional Files Needing Similar Fixes (Future Iterations)
**Priority**: SHOULD
**Description**: The following files outside current scope have similar RTL issues and should be addressed in future iterations:
- `src/ui/web/exerciserenderer/questions/TableQuestion/index.tsx` (line 95): `mr-2`
- `src/ui/web/exerciserenderer/answers/TrueFalseAnswerUI/index.tsx` (line 66): `ml-2`
- `src/ui/web/auth/GoogleLoginButton.tsx` (line 40): `mr-2`
- `src/ui/web/components/command.tsx` (lines 29, 108): `mr-2`, `ml-auto`
- `src/ui/web/components/dropdown-menu.tsx` (lines 37, 108, 165): `ml-auto`
- Note: Animation classes (`slide-in-from-left-*`, `slide-in-from-right-*`) in Radix UI components may need special handling and are not priority.

### NFR-002: RTL Handling Approach
**Priority**: MUST
**Description**: Use logical CSS properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) as default. For asymmetric designs (e.g., rounded corners like `rounded-bl-[4px]`), consider conditional RTL logic like the pattern in ExerciseRenderer: `isHebrew ? 'ml-auto' : 'mr-auto'`. Components with icons that need mirroring should use conditional logic based on locale.

## Acceptance Criteria

- [ ] All physical directional classes replaced with logical equivalents (per FR-001 through FR-008).
- [ ] No functional changes - only CSS class name changes.
- [ ] Components render correctly in RTL mode (Hebrew locale).
- [ ] TypeScript compilation succeeds.
- [ ] No linting errors.
- [ ] Asymmetric components (rounded corners, icon positioning) verified - may need conditional RTL logic if logical classes cause visual issues.

## Guardrails

- Do NOT alter any existing component logic or state.
- Do NOT remove or modify other non-directional Tailwind classes.
- Limit changes strictly to the CSS class replacements identified above.

## Out of Scope

- Applying RTL fixes to additional files identified in NFR-001 (unless trivial and safe).
- Implementing new RTL features or adding new translations.
