# Apply Audit Report: 260227-frontend-loading-error

## Improvements Applied

| #   | Type   | Where                                      | Status            |
| --- | ------ | ------------------------------------------ | ----------------- |
| 1   | DOC    | .ai-docs/BOOTSTRAP.md                     | status: IMPLEMENTED |
| 2   | INDEX  | .ai-docs/quick-reference/CHEAT-SHEET.md    | status: IMPLEMENTED |
| 3   | PROMPT | .opencode/agents/spec.md                  | status: IMPLEMENTED |

## Changes Made

### 1. .ai-docs/BOOTSTRAP.md (status: IMPLEMENTED)
Added **i18n Translation Checklist** section with:
- Checklist item to verify translation keys don't already exist before adding new keys
- Documentation of common translation key patterns (e.g., `common.error.*`)
- Reference to translation file locations (`messages/en.json`, `messages/he.json`)

### 2. .ai-docs/quick-reference/CHEAT-SHEET.md (status: IMPLEMENTED)
Added **Next.js Route Segment Patterns** section with:
- Table of route segment files (loading.tsx, error.tsx, not-found.tsx, global-error.tsx, template.tsx, layout.tsx)
- Use cases for each file type
- Code examples for loading.tsx, error.tsx, and not-found.tsx
- Best practices including reuse of existing Spinner component

### 3. .opencode/agents/spec.md (status: IMPLEMENTED)
Added **Infrastructure Discovery** section with:
- Step to check for existing components before proposing new ones
- Specific search locations: `src/components/`, `src/ui/`, `src/infra/`
- Guidance to check loading patterns like `@/infra/loading/components/Spinner`
- Instruction to reference existing implementations to prevent redundant work

## Suggested Improvements (Not Applied)

1. **Type:** CODE_PATTERN
   - **Where:** src/app/(frontend)/loading.tsx
   - **Title:** Reuse existing Spinner component pattern was correctly applied
   - **Reason:** Not in safe-path whitelist - this is production code in src/. The auditor noted this as positive (build agent correctly reused @/infra/loading/components/Spinner), so no code changes needed. The pattern is now documented in CHEAT-SHEET.md.

## Notes

- All three improvements from the auditor were in whitelisted paths and have been implemented
- The i18n checklist in BOOTSTRAP.md mirrors the content from the instructions in BOOTSTRAP.md itself (lines 84-89), making the bootstrap guidance consistent
- The Next.js route segment patterns were already partially covered in AGENTS.md but are now more prominently documented in CHEAT-SHEET.md for quick reference
- The infrastructure discovery guidance in spec.md will help future spec writers avoid redundant work by checking for existing components first
