# Spec: 260222-auto-37

## Overview
Two React components currently have inline `style={{}}` props that conflict with or duplicate Tailwind CSS classes already applied to them. This task involves removing these redundant inline styles to adhere to Tailwind best practices (Tailwind-only styling) and keep the code clean.

## Requirements

### FR-001: Remove inline font-size in Footer
**Priority**: MUST
**Description**: In `src/ui/web/footer/Component.tsx` (around line 32), remove the inline style `style={{ fontSize: '12px' }}`. The element already has the Tailwind class `text-xs` which provides the exact same styling.

### FR-002: Remove inline font-family in TypingAnimation
**Priority**: MUST
**Description**: In `src/ui/web/shared/TypingAnimation/index.tsx` (around line 34), remove the inline style `style={{ fontFamily: 'Courier New, monospace' }}`. 
*Note*: The element already has the Tailwind class `font-mono`. Relying purely on `font-mono` will update the font from *Courier New* to **Geist Mono** (the project's official design system font), which is the correct and desired behavior.

### FR-003: Refactor class composition in TypingAnimation
**Priority**: SHOULD
**Description**: In `src/ui/web/shared/TypingAnimation/index.tsx`, update the class composition to use the `cn()` utility from `@/infra/utils/ui` instead of template literals (e.g., `className={cn('font-mono', className)}`).

### NFR-001: Design System Alignment
**Priority**: MUST
**Description**: The visual appearance of the footer component must not break, as the removed inline styles are perfectly covered by the existing Tailwind classes (`text-xs`). The `TypingAnimation` component will correctly adopt the design system's monospace font (Geist Mono).

## Acceptance Criteria
- [ ] `src/ui/web/footer/Component.tsx` no longer contains the inline `style={{ fontSize: '12px' }}` prop on the target element.
- [ ] `src/ui/web/shared/TypingAnimation/index.tsx` no longer contains the inline `style={{ fontFamily: 'Courier New, monospace' }}` prop on the target element.
- [ ] `src/ui/web/shared/TypingAnimation/index.tsx` uses the `cn()` utility for combining `className` props.
- [ ] Both components still retain their corresponding Tailwind utility classes (`text-xs` and `font-mono`).
- [ ] No linting or TypeScript errors are introduced.

## Guardrails
- MUST NOT remove any `className` attributes or Tailwind utility classes from these elements.
- MUST NOT make any changes to the core logic or structure of the components.
- Adhere strictly to the "Tailwind-only styling" rule: never use inline styles except for dynamic values.

## Out of Scope
- Auditing or refactoring other files in the codebase for inline styles.
- Modifying the global Tailwind configuration (`tailwind.config.mjs`).