# Task

## Description
Two components have inline `style={{}}` that duplicate or conflict with Tailwind classes already applied.

## Files Affected
| File | Line | Issue |
|------|------|-------|
| `src/ui/web/footer/Component.tsx` | 32 | `style={{ fontSize: '12px' }}` alongside `text-xs` class — redundant, inline overrides Tailwind |
| `src/ui/web/shared/TypingAnimation/index.tsx` | 34 | `style={{ fontFamily: 'Courier New, monospace' }}` alongside `font-mono` class — doubly redundant |

## Expected Fix
Remove the inline `style` props — Tailwind classes already provide the same styling.

## Priority
LOW — Code cleanliness, minor Tailwind anti-pattern
