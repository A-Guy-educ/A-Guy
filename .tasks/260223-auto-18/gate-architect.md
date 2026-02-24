# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | refactor |
| **Confidence** | 0.95 |
| **Scope** | `Replace physical directional Tailwind CSS classes (ml-, mr-, pl-, pr-, left-, right-, border-l, border-r) with logical RTL-aware equivalents across ~10 frontend components`, `Fix spacing and alignment issues in RTL mode for Hebrew locale` |

### Task Summary
> refactor: description

### Assumptions
- Approximately 10 frontend components need CSS refactoring
- Physical classes to replace: ml-*, mr-*, pl-*, pr-*, left-*, right-*, border-l, border-r
- Logical equivalents should be: ms-*, me-*, ps-*, pe-*, start-*, end-*, border-s, border-e

### Plan
```
# Plan: 260223-auto-18 — RTL Logical CSS Refactor

## Summary

Refactor ~25 frontend components to replace physical directional Tailwind CSS classes with RTL-aware logical equivalents. The project is RTL-first (Hebrew), so using physical classes (`ml-`, `mr-`, `left-`, `right-`, etc.) causes incorrect spacing in RTL mode. This plan groups files by domain into 6 steps, each independently testable.

## Assumptions

1. `src/ui/cody/` components are in-scope since they are frontend components (not Payload admin).
2. The `border-r-transparent` on Spinner.tsx is a **visual trick** (makes one side of a circle border invisible to create a spinner arc) — it is NOT a directional layout class and must NOT be changed. The spec guardrails say "Do NOT alter" anything that isn't directional layout.
3. Dialog centering classes (`left-[50%]`, `translate-x-[-50%]`, `slide-out-to-left-1/2`, `slide-in-from-left-1/2`) are for absolute centering via transform and are NOT directional layout — they must NOT be changed.
4. CommandPalette centering (`left-1/2`, `-translate-x-1/2`) is the same centering pattern — NOT changed.
5. Animation data-attributes (`data-[side=left]:slide-in-from-right-2`, etc.) in dropdown-menu.tsx and select.tsx are Radix UI animation directives — these are side-aware but come from the library and should use `ltr:/rtl:` variant prefixes only if there's a directional concern. For this refactor, these are **out of scope** since they are animation hints tied to Radix side props, not layout.
6. The `isHebrew ? 'ml-auto' : 'mr-auto'` pattern in ExerciseRenderer already handles RTL manually — replacing with a single `ms-auto` is the correct logical equivalent.
7. Chat bubble corner rounding (`rounded-bl-[4px]`, `rounded-br-[4px]`) IS directional and needs logical equivalents (`rounded-es-[4px]`, `rounded-ee-[4px]`).

## Test Strategy

For this CSS class refactor, we write **snapshot/regex-based tests** that scan source files for remaining physical classes. This is more effective than rendering tests because:
- The changes are purely mechanical class replacements
```

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
