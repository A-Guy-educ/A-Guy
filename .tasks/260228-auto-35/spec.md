# Specification (promoted)

Skipped via input_quality — taskify determined spec is unnecessary.

## Requirements

# Task

## Issue Title

Remove eslint-disable prefer-const in tag-version.ts
## Bug

In `scripts/cody/tag-version.ts`, `commitMsg` is declared as `let` on line 106 but is only assigned once (line 130). This required an `// eslint-disable-next-line prefer-const` suppression comment on line 129.

```typescript
// line 106
let commitMsg: string
...
// lines 129-130
// eslint-disable-next-line prefer-const
commitMsg = getCurrentMessage()
```

## Expected

Use `const` directly and remove the lint suppression:

```typescript
const commitMsg = getCurrentMessage()
```

## Fix

Delete the `let` declaration (line 106), delete the eslint-disable comment (line 129), and change assignment to `const` declaration (line 130).

/cody fix the let → const issue with commitMsg in scripts/cody/tag-version.ts: remove the let declaration on line 106, remove the eslint-disable comment on line 129, and change line 130 to use const


## Acceptance Criteria

- [ ] Fix applied as described in task.md
- [ ] TypeScript compilation passes
- [ ] Unit tests pass
