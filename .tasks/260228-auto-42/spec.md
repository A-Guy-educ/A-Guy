# Specification (promoted)

Skipped via input_quality — taskify determined spec is unnecessary.

## Requirements

# Task

## Issue Title

Remove placeholder console.log calls in CommandPalette.tsx
## Bug

In `src/ui/web/CommandPalette.tsx`, two `CommandItem` `onSelect` handlers use `console.log` as placeholder callbacks (lines 70 and 75):

```tsx
<CommandItem onSelect={() => handleSelect(() => console.log('Search triggered'))}>
...
<CommandItem onSelect={() => handleSelect(() => console.log('New document triggered'))}>
```

These log to the browser console in production, providing no real functionality — just noise.

## Expected

Replace with no-op TODO comments:

```tsx
<CommandItem onSelect={() => handleSelect(() => { /* TODO: implement search */ })}>
...
<CommandItem onSelect={() => handleSelect(() => { /* TODO: implement new document */ })}>
```

## Fix

Replace `console.log('Search triggered')` and `console.log('New document triggered')` with no-op TODO comments on lines 70 and 75.

/cody fix the placeholder console.log calls in src/ui/web/CommandPalette.tsx lines 70 and 75: replace console.log('Search triggered') and console.log('New document triggered') with no-op TODO comments


## Acceptance Criteria

- [ ] Fix applied as described in task.md
- [ ] TypeScript compilation passes
- [ ] Unit tests pass
