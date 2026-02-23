# Spec: 260223-auto-27

## Overview

The `useEffect` hooks in the `PostHero` and `HighImpact` hero components are currently missing their dependency arrays. This causes the effect, which calls `setHeaderTheme('dark')`, to fire on every single render. This missing dependency array leads to potential performance issues and infinite re-render loops. The fix is to add `[setHeaderTheme]` as the dependency array so that the effect only runs when needed (consistent with existing codebase patterns).

## Requirements

### FR-001: Add Dependency Array to PostHero

**Priority**: MUST
**Description**: Update the `useEffect` hook in the `PostHero` component that calls `setHeaderTheme('dark')` to include `[setHeaderTheme]` as the dependency array (consistent with existing codebase pattern).

### FR-002: Add Dependency Array to HighImpact

**Priority**: MUST
**Description**: Update the `useEffect` hook in the `HighImpact` hero component that calls `setHeaderTheme('dark')` to include `[setHeaderTheme]` as the dependency array (consistent with existing codebase pattern).

### NFR-001: Prevent Re-render Loops

**Priority**: MUST
**Description**: The fix must resolve the infinite re-render loop issue and eliminate the performance degradation caused by continuous re-renders on mount.

## Acceptance Criteria

- [ ] `useEffect` hook in the `PostHero` component includes `[setHeaderTheme]` as its second argument.
- [ ] `useEffect` hook in the `HighImpact` component includes `[setHeaderTheme]` as its second argument.
- [ ] The `setHeaderTheme('dark')` logic still executes successfully upon component mount.
- [ ] No regression is introduced to the visual rendering of the Hero components.

## Guardrails

- The logic inside the `useEffect` must remain exactly the same (e.g., calling `setHeaderTheme('dark')`).
- The dependency array must include `[setHeaderTheme]` to align with existing codebase patterns.
- Do not refactor other parts of `PostHero` or `HighImpact` outside of this specific hook.
- Ensure the `useHeaderTheme` custom hook (or similar context) usage is not broken or removed.

## Out of Scope

- Fixing or auditing `useEffect` hooks in other components not specified in this task.
- Changing the actual theme logic or global state implementation.
