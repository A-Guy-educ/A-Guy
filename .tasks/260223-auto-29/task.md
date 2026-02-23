# Task

## Description
~10 frontend components use physical directional Tailwind classes (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `border-l`, `border-r`) instead of logical RTL-aware equivalents (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `border-s`, `border-e`). Since the project is RTL-first (Hebrew default), these cause incorrect spacing and alignment in RTL mode.

## Files Affected
| File | Line | Problematic Class | Fix |
|------|------|-------------------|-----|
| `src/ui/web/chat/ChatInterface/index.tsx` | 370 | `mr-2` | `me-2` |
| `src/ui/web/chat/ChatInterface/index.tsx` | 386-387 | `ml-auto` / `mr-auto` | `ms-auto` / `me-auto` |
| `src/ui/web/chat/ChatInterface/index.tsx` | 477 | `left-5 right-5` | `start-5 end-5` |
| `src/ui/web/header/MobileMenu/index.tsx` | 65 | `right-0`, `border-l` | `end-0`, `border-s` |
| `src/ui/web/CommandPalette.tsx` | 49, 58, 62, 71, 77 | `left-1/2`, `mr-2` | `start-1/2`, `me-2` |
| `src/ui/web/components/HealthBadge.tsx` | 79 | `ml-2` | `ms-2` |
| `src/ui/web/shared/TypingAnimation/index.tsx` | 36 | `ml-1` | `ms-1` |
| `src/ui/web/UserDropdown/index.tsx` | 56 | `mr-2` | `me-2` |
| `src/ui/web/exerciserenderer/components/QuestionCard/index.tsx` | 84, 89 | `mr-2` | `me-2` |
| `src/ui/web/components/pagination.tsx` | 52, 64 | `pl-2.5` / `pr-2.5` | `ps-2.5` / `pe-2.5` |

## Steps to Test
1. Switch to Hebrew locale (RTL mode)
2. Open pages with chat, mobile menu, pagination, command palette
3. Check that spacing/alignment is correct (icons on correct side, padding not flipped)
4. Compare before/after screenshots

## Priority
HIGH — Visually broken in RTL mode (Hebrew is the primary locale)
