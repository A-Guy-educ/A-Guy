# Codebase Context: 260317-full-test

## Files to Modify
- `docs/test/full-pipeline.md` (all lines, OVERWRITE) — Replace task description with correct content: heading + "Hello from CLI test"

## Files to Read (reference patterns)
- None — standalone markdown file, no patterns to follow

## Key Signatures
- None — no code involved

## Reuse Inventory
- None — standalone documentation file

## Integration Points
- None — file is not imported, referenced, or linked anywhere

## Imports Verified
- N/A — no TypeScript/JavaScript involved

## Notes for Build Agent
- The file already exists at `docs/test/full-pipeline.md` with 12 lines of wrong content (task description)
- Must overwrite with exactly 3 lines: `# Full Pipeline Test`, blank line, `Hello from CLI test`
- Verify with: `grep -q "Hello from CLI test" docs/test/full-pipeline.md`
