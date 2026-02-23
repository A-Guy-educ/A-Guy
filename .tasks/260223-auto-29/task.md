# Task

## Description
`useEffect` calls in `PostHero` and `HighImpact` hero components are missing their dependency arrays, causing the effect to fire on **every single render**. This can cause performance issues and potential infinite re-render loops.

## Files Affected
- `src/ui/web/heros/PostHero/index.tsx` — line 10-12
- `src/ui/web/heros/HighImpact/index.tsx` — line 13-15

## Current Code
```tsx
useEffect(() => {
  setHeaderTheme('dark')
})
// Missing: dependency array []
```

## Expected Fix
```tsx
useEffect(() => {
  setHeaderTheme('dark')
}, []) // Run once on mount
```

## Steps to Test
1. Open any page using PostHero or HighImpact hero components
2. Open React DevTools Profiler
3. Observe `setHeaderTheme('dark')` firing on every render
4. After fix: effect should fire only once on mount

## Priority
HIGH — Performance bug, fires every render
