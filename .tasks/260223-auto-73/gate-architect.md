# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | fix_bug |
| **Confidence** | 0.9 |
| **Scope** | `loading indicator component`, `locale/i18n handling`, `translation mechanism` |

### Task Summary
> Thanks for assigning this issue to me. I'm starting to work on it and will keep this PR's description up to date as I form a plan and make progress.

### Assumptions
- Translation keys for both languages already exist
- A locale resolution mechanism exists in the codebase
- This is a frontend component issue, not backend locale handling
- The fix should integrate with existing i18n system without new locale detection

### Plan
```
# Plan: 260223-auto-73 — Fix Hardcoded Loading Text in HomePage

## Summary

The `HomePage` component at `src/app/(frontend)/_components/HomePage/index.tsx` (line 26) has hardcoded Hebrew text `"טוען..."` for its loading state. This means English-locale users see Hebrew loading text instead of `"Loading..."`. The fix is to use the existing `useTranslations` hook from `@/ui/web/providers/I18n` with the `homepage.greeting` namespace, which already has a `loading` key in both `en.json` and `he.json`.

## Assumptions

- Translation keys `homepage.greeting.loading` already exist in both `src/i18n/en.json` ("Loading...") and `src/i18n/he.json` ("טוען...") — **confirmed by reading the files**.
- The `useTranslations` hook from `@/ui/web/providers/I18n` is the project's standard pattern — **confirmed by 37+ existing usages across the codebase**.
- The `I18nProvider` is already wrapping the frontend layout (otherwise existing pages using `useTranslations` would crash) — no need to add it.
- No existing tests for `HomePage` component exist — **confirmed by searching test files**.

---

## Step 1: Write Reproduction Test for Hardcoded Loading Text

**Root Cause**: The `HomePage` component renders `<div className="text-muted-foreground">טוען...</div>` with a hardcoded Hebrew string instead of using the translation mechanism. When locale is English, users still see Hebrew text.

**Files to Touch**:
```

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
