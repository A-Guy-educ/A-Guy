# Codebase Context: 260317-full-test

## Files to Modify
- `docs/test/full-pipeline.md` (MODIFIED — overwrite with correct content)

## Files to Read (reference patterns)
- `.tasks/260317-full-test/task.md` — original task specification with expected content

## Key Signatures
- N/A — no code functions involved, this is a static file creation

## Reuse Inventory
- No utilities needed — simple file write operation

## Integration Points
- None — standalone test documentation file with no imports or dependencies

## Imports Verified
- N/A — no code imports involved

## Current State
- `docs/test/` directory exists ✅
- `docs/test/full-pipeline.md` exists but has WRONG content (task.md copy instead of simple test content) ⚠️
- Expected final content is exactly 3 lines: `# Full Pipeline Test`, blank line, `Hello from CLI test`
