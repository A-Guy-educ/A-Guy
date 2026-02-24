# Spec: 260223-auto-18

## Overview

Refactor frontend components to replace physical directional Tailwind CSS classes (e.g., `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `border-l`, `border-r`) with logical RTL-aware equivalents. The project is RTL-first (Hebrew default), and using physical classes causes incorrect spacing and alignment when rendered in RTL mode. Replacing these with logical properties ensures the UI mirrors correctly across both RTL and LTR modes.

## Requirements

### FR-001: Replace Margin Classes
**Priority**: MUST
**Description**: Find and replace all instances of physical margin classes (`ml-*`, `mr-*`, `-ml-*`, `-mr-*`) with logical equivalents (`ms-*`, `me-*`, `-ms-*`, `-me-*`) in frontend React components.

### FR-002: Replace Padding Classes
**Priority**: MUST
**Description**: Find and replace all instances of physical padding classes (`pl-*`, `pr-*`) with logical equivalents (`ps-*`, `pe-*`) in frontend React components.

### FR-003: Replace Positioning Classes
**Priority**: MUST
**Description**: Find and replace all instances of physical positioning classes (`left-*`, `right-*`, `-left-*`, `-right-*`) with logical equivalents (`start-*`, `end-*`, `-start-*`, `-end-*`) in frontend React components.

### FR-004: Replace Border and Rounded Classes
**Priority**: MUST
**Description**: Find and replace physical border classes (`border-l-*`, `border-r-*`) with logical equivalents (`border-s-*`, `border-e-*`). Replace physical rounded corners (`rounded-l-*`, `rounded-r-*`, `rounded-tl-*`, `rounded-tr-*`, `rounded-bl-*`, `rounded-br-*`) with logical equivalents (`rounded-s-*`, `rounded-e-*`, `rounded-ss-*`, `rounded-se-*`, `rounded-es-*`, `rounded-ee-*`).

### FR-005: Replace Text Alignment Classes
**Priority**: MUST
**Description**: Find and replace physical text alignment classes (`text-left`, `text-right`) with logical equivalents (`text-start`, `text-end`).

### FR-006: Replace Floats and Clears
**Priority**: SHOULD
**Description**: Replace physical float and clear classes (`float-left`, `float-right`, `clear-left`, `clear-right`) with logical equivalents (`float-start`, `float-end`, `clear-start`, `clear-end`).

### FR-007: Address Directional Gradients and Transforms
**Priority**: SHOULD
**Description**: For classes that don't have logical equivalents, use bidirectional variant prefixes. Replace directional gradients (e.g., `bg-gradient-to-r`) with `ltr:bg-gradient-to-r rtl:bg-gradient-to-l`. Replace physical X-axis transforms (e.g., `translate-x-*`) with `ltr:translate-x-* rtl:-translate-x-*` where applicable.

### NFR-001: Component Coverage
**Priority**: MUST
**Description**: The refactor should cover approximately 10 identified frontend components where these physical directional classes are currently causing spacing and alignment issues in RTL mode.

### NFR-002: LTR and RTL Compatibility
**Priority**: MUST
**Description**: Hebrew (RTL) is the default locale. The application must look correct in RTL by default, and the use of logical properties must seamlessly mirror this layout when rendered in English (LTR) mode.

## Acceptance Criteria

- [ ] All `ml-`/`mr-` classes are replaced with `ms-`/`me-`.
- [ ] All `pl-`/`pr-` classes are replaced with `ps-`/`pe-`.
- [ ] All `left-`/`right-` classes are replaced with `start-`/`end-`.
- [ ] All `border-l`/`border-r` classes are replaced with `border-s`/`border-e`.
- [ ] All `rounded-tl`/`rounded-tr`/`rounded-bl`/`rounded-br` classes are replaced with `rounded-ss`/`rounded-se`/`rounded-es`/`rounded-ee`.
- [ ] All `text-left`/`text-right` classes are replaced with `text-start`/`text-end`.
- [ ] The UI renders correctly without spacing or alignment issues in both RTL (Hebrew) and LTR (English) modes.

## Guardrails

- Do NOT alter any vertical spacing or alignment classes (e.g., `mt-`, `mb-`, `pt-`, `pb-`, `top-`, `bottom-`).
- Do NOT change `space-x-*` or `divide-x-*` classes as modern Tailwind handles these automatically via logical properties.
- Do NOT change the logical flow or functionality of any component; changes must be strictly limited to CSS classes.
- Ensure replacements in string literals, template literals, and `cn()` utility calls are exact and don't accidentally modify unrelated text.

## Out of Scope

- Fixing unrelated visual bugs or functional issues in the affected components.
- Refactoring CSS classes outside of the target frontend components (e.g., in Payload CMS admin UI, unless it explicitly requires RTL support and is part of the identified components).
- Adding new RTL-specific features or translating text content.

## Open Questions

- Which specific ~10 frontend components are targeted for this refactoring? (The implementation phase will need to identify these via codebase search).
