# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | implement_feature |
| **Confidence** | 0.95 |
| **Scope** | `/account page`, `accordion-based layout`, `collapsible sections` |

### Task Summary
> Account Page – Collapsible Sections

### Plan
```
# Plan: Accordion-Based Account Hub

**Task ID**: 260225-auto-21
**Task Type**: implement_feature
**Estimated Total**: 5 steps, ~90 minutes

## Summary

Replace the current flat card layout on `/account` with a Radix/Shadcn Accordion (`type="single"`, `collapsible`). Four sections: Details (default open), Courses, Preferences (placeholder), Teachers Profile (placeholder). Support deep linking via `?section=...` query parameter with shallow URL sync.

## Assumptions

1. **Profile Picture**: The `User` type has no `imageUrl`/`avatar` field. FR-002 says "Profile Picture" — we will show the existing `UserAvatar` component (initials-based fallback) since there is no stored profile image URL. This matches the current approach used in `UserDropdown`.
2. **Accordion component**: Must be added via `npx shadcn@latest add accordion` — `@radix-ui/react-accordion` is NOT currently installed.
3. **shadcn paths**: The `components.json` aliases point to `@/components` but existing shadcn components live at `src/ui/web/components/`. The build agent must either update `components.json` or manually move the generated accordion file to `src/ui/web/components/accordion.tsx` and fix the import of `cn` from `@/infra/utils/ui`.
4. **Translation namespace**: We will extend `auth.account` namespace in both `en.json` and `he.json`.
5. **searchParams**: Per Next.js App Router patterns, `searchParams` is read in the server component (`page.tsx`) and passed as a prop to the client component.

## Recommended Skills

```

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
