# Plan: 260318-test — Full Pipeline Test File

## Research Findings

- `docs/test/full-pipeline.md` ✅ exists (but content is wrong — describes the task instead of containing the required text)
- `docs/test/` ✅ directory exists
- File currently has 11 lines describing the task, but does NOT contain "Hello from CLI test" as the primary content per spec

## Reuse Inventory

- No existing utilities needed — this is a simple file write operation
- No new utilities needed

---

## Step 1: Update `docs/test/full-pipeline.md` with correct content

**Files to Touch**:
- `docs/test/full-pipeline.md` (MODIFIED — replace entire content)

**Behavior**:
- The file must contain the text "Hello from CLI test" as its primary content
- The current file incorrectly describes the task rather than containing the required text

**What to Write**:
```markdown
Hello from CLI test
```

**Tests** (verification commands, not code tests):

1. **File exists**: `test -f docs/test/full-pipeline.md && echo PASS || echo FAIL`
   - Expected: PASS
2. **File contains required text**: `grep -q "Hello from CLI test" docs/test/full-pipeline.md && echo PASS || echo FAIL`
   - Expected: PASS (currently FAILS because the text appears in a description, not as standalone content)

**Acceptance Criteria**:
- [ ] File exists at `docs/test/full-pipeline.md`
- [ ] File contains the text "Hello from CLI test"
- [ ] File is clean, minimal markdown

---

## Summary

| Step | Description | Files | Time |
|------|-------------|-------|------|
| 1 | Write correct content to full-pipeline.md | 1 MODIFIED | 5 min |

**Total estimated time**: 5 minutes
