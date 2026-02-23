# Spec: 260223-auto-29

## Overview

The `useEffect` hooks in the `PostHero` and `HighImpact` hero components are currently missing their dependency arrays. This causes the effect (which calls `setHeaderTheme('dark')`) to fire on every single render, leading to potential performance issues and infinite re-render loops. The fix is to add an empty dependency array `[]` so that the effect only runs once on mount.

## Requirements

### FR-001: Fix PostHero useEffect Dependency Array

**Priority**: MUST
**Description**: Update the `useEffect` call in `src/ui/web/heros/PostHero/index.tsx` (around lines 10-12) to include an empty dependency array `[]` so that it only runs on mount.

### FR-002: Fix HighImpact useEffect Dependency Array

**Priority**: MUST
**Description**: Update the `useEffect` call in `src/ui/web/heros/HighImpact/index.tsx` (around lines 13-15) to include an empty dependency array `[]` so that it only runs on mount.

### NFR-001: Performance Optimization

**Priority**: MUST
**Description**: The `setHeaderTheme('dark')` function must only be executed once when the component mounts, preventing unnecessary re-renders.

## Acceptance Criteria

- [ ] `src/ui/web/heros/PostHero/index.tsx` contains `useEffect(() => { ... }, [])`.
- [ ] `src/ui/web/heros/HighImpact/index.tsx` contains `useEffect(() => { ... }, [])`.
- [ ] In React DevTools Profiler, `setHeaderTheme('dark')` fires only once on mount for both components.
- [ ] TypeScript compilation passes.

## Guardrails

- Do NOT change the theme being set (it should remain `'dark'`).
- Do NOT modify any other logic inside the `useEffect` hooks or the components.

## Out of Scope

- Fixing or refactoring other `useEffect` hooks in the codebase.
- Changing the implementation of `setHeaderTheme` itself.
