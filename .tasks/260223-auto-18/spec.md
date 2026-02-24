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

**Special Cases - DO NOT CHANGE:**
- `left-[50%]` when used with `translate-x-[-50%]` for centering modals (this is a centering technique)
- `left-2` when used for positioning icons inside input/button elements (this is icon positioning, not margin/padding)
- `right-4` and `top-4` when used for absolute positioned elements like dialog close buttons

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

**Note:** The codebase already uses `ltr:` and `rtl:` prefixes in some places (e.g., ExercisesPager/index.tsx uses `rtl:rotate-0 ltr:rotate-180`). Maintain this pattern.

### NFR-001: Component Coverage
**Priority**: MUST
**Description**: The refactor should cover the following identified frontend components where physical directional classes are causing spacing and alignment issues in RTL mode:

**Components in src/ui/web:**
- header/MobileMenu/index.tsx (`border-l`, `right-0`)
- components/dialog.tsx (`right-4`)
- components/dropdown-menu.tsx (`pl-8`, `pr-2`, `left-2`)
- components/select.tsx (`pl-8`, `pr-2`, `left-2`)
- components/pagination.tsx (`pl-2.5`, `pr-2.5`)
- components/command.tsx (`mr-2`)
- providers/Theme/ThemeSelector/index.tsx (`pl-0`, `md:pl-3`)
- chat/ChatInterface/index.tsx (`mr-2`, `ml-auto`, `mr-auto`, `rounded-bl-[4px]`, `rounded-br-[4px]`)
- shared/Typography/Text.tsx (`text-left`, `text-right` in align map)
- shared/Typography/Heading.tsx (`text-left`, `text-right` in align map)
- shared/TypingAnimation/index.tsx (`ml-1`)
- exerciserenderer/questions/TableQuestion/ExerciseTable.tsx (`text-left`, `text-right` in align map)
- exerciserenderer/answers/TrueFalseAnswerUI/index.tsx (`ml-2`)
- exerciserenderer/components/QuestionCard/index.tsx (`mr-2`, `text-right`, `justify-end`)
- components/HealthBadge.tsx (`ml-2`)
- auth/GoogleLoginButton.tsx (`mr-2`)
- UserDropdown/index.tsx (`mr-2`)
- CommandPalette.tsx (`mr-2`, `left-1/2`)

**Components in src/app/(frontend):**
- courses/_components/CourseCard/index.tsx (`mr-2`)
- courses/_components/BackToCourses/index.tsx (`pl-0`)
- courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ViewToggle.tsx (`mr-2`)
- courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/NotebookWorkspace/index.tsx (`ml-6`)
- ask/_components/AskContent/index.tsx (`mr-2`)

**Note:** Some components like ChatMessageContent/index.tsx already use logical properties (`ps-5`, `border-s-4`). Maintain consistency with these existing patterns.

### NFR-002: LTR and RTL Compatibility
**Priority**: MUST
**Description**: Hebrew (RTL) is the default locale. The application must look correct in RTL by default, and the use of logical properties must seamlessly mirror this layout when rendered in English (LTR) mode.

## Acceptance Criteria

- [ ] All `ml-`/`mr-` classes are replaced with `ms-`/`me-`.
- [ ] All `pl-`/`pr-` classes are replaced with `ps-`/`pe-`.
- [ ] All `left-`/`right-` classes are replaced with `start-`/`end-` (except special cases noted in FR-003).
- [ ] All `border-l`/`border-r` classes are replaced with `border-s`/`border-e`.
- [ ] All `rounded-tl`/`rounded-tr`/`rounded-bl`/`rounded-br` classes are replaced with `rounded-ss`/`rounded-se`/`rounded-es`/`rounded-ee`.
- [ ] All `text-left`/`text-right` classes are replaced with `text-start`/`text-end`.
- [ ] The UI renders correctly without spacing or alignment issues in both RTL (Hebrew) and LTR (English) modes.

## Guardrails

- Do NOT alter any vertical spacing or alignment classes (e.g., `mt-`, `mb-`, `pt-`, `pb-`, `top-`, `bottom-`).
- Do NOT change `space-x-*` or `divide-x-*` classes as modern Tailwind handles these automatically via logical properties.
- Do NOT change the logical flow or functionality of any component; changes must be strictly limited to CSS classes.
- Ensure replacements in string literals, template literals, and `cn()` utility calls are exact and don't accidentally modify unrelated text.
- PRESERVE `left-[50%]` with `translate-x-[-50%]` for centering modals (this is a centering technique, not a directional class).
- PRESERVE `left-2` when used for positioning icons inside input/button elements (this is different from padding).
- PRESERVE `right-4 top-4` for absolute positioned elements like dialog close buttons.
- PRESERVE any existing usage of `ltr:` and `rtl:` prefixes as they are the correct pattern for bidirectional content.

## Out of Scope

- Fixing unrelated visual bugs or functional issues in the affected components.
- Refactoring CSS classes outside of the identified frontend components.
- Adding new RTL-specific features or translating text content.
