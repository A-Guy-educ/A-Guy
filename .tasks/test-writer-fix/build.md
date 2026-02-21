# Build Agent Report: test-writer-fix

## Changes

- `.opencode/agents/test-writer.md` - Updated test-writer agent instructions to prevent module resolution failures

## Problem

The test-writer agent generated a test file using `require()` (CommonJS) instead of ESM `import` syntax:

```typescript
// ❌ WRONG - CommonJS require (fails with Vite)
const { ConvertForm } = require('@/ui/admin/exercise-conversion/ConvertForm')
```

This caused `MODULE_NOT_FOUND` errors because `require()` doesn't go through Vite's `tsconfig-paths` plugin that resolves `@/` aliases.

## Fix

Added explicit guidance to the test-writer agent:

1. **Critical: Import Style section** - Added clear rules:
   - Always use ESM `import` syntax, NEVER `require()`
   - Explains that Vite resolves `@/` aliases but `require()` does not
   - Shows correct vs incorrect examples

2. **Before Writing Tests section** - Added pre-step instructions:
   - Read the source file being tested first
   - Read an existing test for reference patterns
   - Note: Directory-based modules (e.g., `ConvertForm/index.tsx`) still use the directory path without `/index`

3. **Fixed Output section** - Removed incorrect instruction to run `pnpm test:unit` (since `bash: false` means the test-writer can't run bash commands; the build agent runs tests)

## Quality

- TypeScript: PASS
- Lint: PASS (only pre-existing warnings)
