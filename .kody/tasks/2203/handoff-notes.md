## Root Cause

Node.js 22 (used in CI) enforces ESM import assertions for JSON files. The error:

```
TypeError: Module "file:///home/runner/work/A-Guy/A-Guy/src/brands/aguy/messages/en.json" needs an import attribute of "type: json"
```

## Fix

`src/brands/aguy/index.ts` lines 13–14: added `with { type: "json" }` import attribute to both `en.json` and `he.json` imports.

## Why it worked before

Local dev used a different Node.js version or the project was using CommonJS-style `require()`. The CI runner (Node 22) requires explicit import attributes for JSON under ESM.

## Verification

`mcp__kody-verify__verify` passed on first attempt (typecheck + lint + tests).
