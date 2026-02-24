# Gap Analysis: 260223-auto-18

## Summary

- Gaps Found: 4
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing Component Enumeration

**Severity:** High
**Location:** All affected frontend components
**Issue:** The spec mentions "~10 identified frontend components" but does not enumerate the specific files that need to be changed. The Open Questions section acknowledges this but it's a critical gap since the implementation phase needs specific file paths.

**Fix Applied:** Added new section to spec enumerating all files with physical directional classes identified in the codebase search:

- src/ui/web/header/MobileMenu/index.tsx (border-l, right-0)
- src/ui/web/components/dialog.tsx (right-4)
- src/ui/web/components/dropdown-menu.tsx (pl-8, pr-2, left-2)
- src/ui/web/components/select.tsx (pl-8, pr-2, left-2)
- src/ui/web/components/pagination.tsx (pl-2.5, pr-2.5)
- src/ui/web/providers/Theme/ThemeSelector/index.tsx (pl-0, md:pl-3)
- src/ui/web/chat/ChatInterface/index.tsx (mr-2, ml-auto, mr-auto, rounded-bl-[4px], rounded-br-[4px])
- src/ui/web/shared/Typography/Text.tsx (text-left, text-right in align map)
- src/ui/web/shared/Typography/Heading.tsx (text-left, text-right in align map)
- src/ui/web/exerciserenderer/questions/TableQuestion/ExerciseTable.tsx (text-left, text-right in align map)
- src/ui/web/exerciserenderer/answers/TrueFalseAnswerUI/index.tsx (ml-2)
- src/ui/web/exerciserenderer/components/QuestionCard/index.tsx (mr-2, text-right, justify-end)
- src/ui/web/shared/TypingAnimation/index.tsx (ml-1)
- src/ui/web/components/HealthBadge.tsx (ml-2)
- src/ui/web/components/command.tsx (mr-2)
- src/ui/web/auth/GoogleLoginButton.tsx (mr-2)
- src/ui/web/UserDropdown/index.tsx (mr-2)
- src/ui/web/CommandPalette.tsx (mr-2, left-1/2)
- src/app/(frontend)/courses/_components/CourseCard/index.tsx (mr-2)
- src/app/(frontend)/courses/_components/BackToCourses/index.tsx (pl-0)
- src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ViewToggle.tsx (mr-2)
- src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/NotebookWorkspace/index.tsx (ml-6)
- src/app/(frontend)/ask/_components/AskContent/index.tsx (mr-2)

### Gap 2: Missing Reference to Existing Logical Properties Usage

**Severity:** Medium
**Location:** NFR requirements
**Issue:** The spec doesn't mention that some parts of the codebase already use logical properties (e.g., `ps-5`, `ms-`, `me-`, `border-s-*`). Found in ChatMessageContent/index.tsx, CompleteContent.tsx, ExercisesPager/index.tsx. This is important context for ensuring consistency.

**Fix Applied:** Added reference to existing usage patterns in NFR-002 section, noting that some components like ChatMessageContent already use logical properties like `ps-5` and `border-s-4`.

### Gap 3: Missing Guidance on Bidirectional Variants

**Severity:** Medium
**Location:** FR-007
**Issue:** The spec mentions bidirectional variants in FR-007 but doesn't reference that the codebase already uses `ltr:` and `rtl:` prefixes in some places (e.g., ExercisesPager/index.tsx uses `rtl:rotate-0 ltr:rotate-180`). This is an important existing pattern to maintain.

**Fix Applied:** Updated FR-007 to reference existing usage of `ltr:` and `rtl:` prefixes in the codebase.

### Gap 4: Missing Special Case Handling for Centering and Icon Positioning

**Severity:** High
**Location:** FR-003, Guardrails
**Issue:** The spec doesn't account for special cases:
1. `left-[50%]` used for centering modals (translate-x-[-50%]) - this is not a directional class but a centering technique
2. `left-2` used for positioning icons inside elements - this is different from margin/padding
3. Dialog close button `right-4 top-4` - this is absolute positioning relative to the dialog, not flow layout

The guardrails section mentions not to change vertical spacing but doesn't address these special cases.

**Fix Applied:** Added new guardrails:
- Preserve `left-[50%]` with `translate-x-[-50%]` for centering modals (this is a centering technique, not directional)
- Preserve `left-2` when used for icon positioning inside input/button elements (this is different from padding)
- Preserve `right-4 top-4` for absolute positioned elements like dialog close buttons

## Changes Made to Spec

- Added component enumeration section listing all ~24 affected files
- Added reference to existing logical properties usage (ps-*, ms-*, me-*, border-s-*)
- Added reference to existing ltr:/rtl: bidirectional variant usage
- Added special case handling for centering, icon positioning, and absolute positioning
- Updated NFR-001 to reflect the actual number of components (~24)
- Updated acceptance criteria to include `text-left`/`text-right` mapping to `text-start`/`text-end`
