# Spec: 260223-auto-73

## Overview

In the Development environment, the loading indicator text ("Loading..." / "טוען...") does not consistently align with the active website language. The goal is to ensure the loading indicator text always matches the currently resolved active locale in Development without introducing new locale detection logic or changing the overall locale resolution architecture.

## Requirements

### FR-001: Resolve Loading Text Using Existing Translation Mechanism
**Priority**: MUST
**Description**: The loading text component must derive its text via the existing translation mechanism (e.g., next-intl `useTranslations`) rather than using a hardcoded string or failing to receive the locale.

### FR-002: Align Loading Text with Active Locale
**Priority**: MUST
**Description**: The loading text must use the exact same locale resolution mechanism as the rest of the page content. Hebrew UI must show "טוען...", English UI must show "Loading...".

### FR-003: Fix Hardcoded Loading Text in HomePage Component
**Priority**: MUST
**Description**: The HomePage component at `src/app/(frontend)/_components/HomePage/index.tsx` (line 26) has hardcoded Hebrew text "טוען...". This must be replaced with `useTranslations('homepage.greeting')` to derive the loading text dynamically based on the active locale.

**Example Fix:**
```tsx
// Before:
<div className="text-muted-foreground">טוען...</div>

// After:
const t = useTranslations('homepage.greeting')
// ... in render:
<div className="text-muted-foreground">{t('loading')}</div>
```

### NFR-001: No New Locale Detection Logic
**Priority**: MUST
**Description**: Do not introduce any new locale detection logic to determine the loading text language. The fix must rely entirely on the existing infrastructure.

### NFR-002: Maintain Existing Architecture
**Priority**: MUST
**Description**: Do not change the overall locale resolution architecture, routing behavior, or middleware behavior. The Next.js App Router routing approach should remain untouched.

## Acceptance Criteria

- [ ] In Development, when the UI is rendered in Hebrew, the loading text displays as "טוען...".
- [ ] In Development, when the UI is rendered in English, the loading text displays as "Loading...".
- [ ] The HomePage component (`src/app/(frontend)/_components/HomePage/index.tsx` line 26) no longer contains hardcoded "טוען..." text.
- [ ] No hardcoded loading strings remain in the loading indicator component.
- [ ] The loading text is derived using the existing translation mechanism (e.g., `useTranslations` hook).
- [ ] No regression occurs in other translated content on the page.
- [ ] Routing and middleware behavior remain unchanged.

## Guardrails

- Do not introduce new locale detection logic.
- Do not modify the overall locale resolution architecture.
- Do not modify routing or middleware.
- Ensure no new CSS, SCSS, or inline styles are introduced (must follow `DESIGN_SYSTEM.md` guardrails by strictly focusing on text replacement).

## Out of Scope

- Fixing or adding new missing translation keys (the keys already exist).
- Modifying backend locale handling.

## Open Questions

None. Validated with `@web-expert` who confirmed the proposed UI matches design system patterns, translations are accounted for accurately, and the routing approach correctly avoids touching Next.js middleware by leveraging existing `NextIntlClientProvider` context via the `useTranslations` hook.
