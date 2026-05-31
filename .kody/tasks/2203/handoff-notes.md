## Root Cause

The CI E2E Gate job was failing with:
```
TypeError: Module "file:///home/runner/work/A-Guy/A-Guy/src/brands/aguy/messages/en.json" needs an import attribute of "type: json"
```

This error occurs in Node.js ESM mode when importing JSON files without the `with { type: 'json' }` attribute. The brands bundle (`src/brands/aguy/index.ts`) was importing JSON message files without this attribute.

## Fix Applied

Changed in `src/brands/aguy/index.ts`:
```typescript
// Before (broken):
import en from './messages/en.json'
import he from './messages/he.json'

// After (fixed):
import en from './messages/en.json' with { type: 'json' }
import he from './messages/he.json' with { type: 'json' }
```

This was fixed in commit `7be0e3f01` which is already present in the dev branch.

## Verification

All quality gates pass: typecheck, lint, and tests pass locally (verified via mcp__kody-verify__verify).
