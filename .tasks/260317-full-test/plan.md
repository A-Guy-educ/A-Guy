# Plan: Full Pipeline Test (260317-full-test)

## Research Findings

- **`docs/test/full-pipeline.md`** — ✅ File exists but contains wrong content (task description instead of expected output). Must be overwritten with correct content.
- **`docs/test/` directory** — ✅ Exists (parent directory confirmed).
- **No integration points** — This is a standalone markdown file with no imports/exports.
- **No existing patterns needed** — Pure file creation task.

## Reuse Inventory

- No existing utilities needed — this is a standalone documentation file.
- No new utilities required.

## Summary

The spec requires a file at `docs/test/full-pipeline.md` with the content:

```
# Full Pipeline Test

Hello from CLI test
```

The file already exists but has incorrect content (it contains the task description). The build step must overwrite it with the correct content.

---

## Step 1: Create/overwrite `docs/test/full-pipeline.md` with correct content

**Spec refs**: Requirements #1, #2; Acceptance Criteria #1, #2

**Files to touch**:
- `docs/test/full-pipeline.md` (MODIFIED — overwrite all 12 lines with 3 lines of correct content)

**Exact behavior**:
- The file must contain exactly:
  ```
  # Full Pipeline Test

  Hello from CLI test
  ```
- Line 1: Markdown heading `# Full Pipeline Test`
- Line 2: Empty line
- Line 3: Text `Hello from CLI test`
- No trailing content beyond this

**Tests that FAIL before, PASS after**:

1. **Content test**: Read `docs/test/full-pipeline.md` → assert line 3 equals `Hello from CLI test` (currently FAILS because file contains task description text instead)
2. **Structure test**: Read `docs/test/full-pipeline.md` → assert total line count is 3 (currently FAILS — file has 12 lines)

**Verification command**:
```bash
# Check file exists and has correct content
test -f docs/test/full-pipeline.md && grep -q "Hello from CLI test" docs/test/full-pipeline.md && echo "PASS" || echo "FAIL"
```

**Acceptance criteria**:
- [ ] File exists at `docs/test/full-pipeline.md`
- [ ] File contains the text "Hello from CLI test"
- [ ] File starts with `# Full Pipeline Test`
- [ ] File has exactly 3 lines (heading, blank, content)
