The fix is complete and verified. Here's what was done:

**Changes Made:**

1. **`src/ui/web/exerciserenderer/utils/safeMathEval.ts`** - Replaced `eval()` with `mathjs.evaluate()`:
   - Removed dangerous `eval()` that could execute arbitrary JavaScript
   - Now uses `mathjs.evaluate()` which only parses math expressions
   - Added JSDoc header with proper metadata
   - Function scope is passed explicitly to `evaluate()` (no globals exposed)

2. **`package.json`** - Added `mathjs@^13.2.3` dependency

**Verification:**
- TypeScript compiles cleanly
- ESLint passes
- The public API (`parseMathExpression`) remains unchanged - no downstream changes needed

**Why this prevents injection:**
- `eval()` executes any valid JavaScript code
- `mathjs.evaluate()` only evaluates mathematical expressions (numbers, operators, functions like `sin`, `cos`, `sqrt`, variables). Even if an attacker injects `x; require('child_process')`, mathjs will throw an error because `require` is not a valid math expression
