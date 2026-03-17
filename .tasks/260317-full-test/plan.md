# Plan: 260317-full-test — Create Full Pipeline Test File

## Research Findings

- `docs/test/` directory: ✅ exists
- `docs/test/full-pipeline.md`: ✅ exists but contains WRONG content (copy of task.md instead of the specified content)
- The file currently has the task description instead of the expected simple content: `# Full Pipeline Test\n\nHello from CLI test`
- No other files in the project are affected by this change
- No integration points — this is a standalone documentation/test file

## Reuse Inventory

- No existing utilities needed — this is a simple file creation/overwrite task
- No new utilities to create

---

## Step 1: Create/overwrite `docs/test/full-pipeline.md` with correct content

**Files to Touch**:
- `docs/test/full-pipeline.md` (MODIFIED — overwrite entire file)

**Exact Behavior**:
- The file must contain exactly:
  ```
  # Full Pipeline Test

  Hello from CLI test
  ```
- 3 lines total: heading, blank line, content line
- No trailing content beyond this

**Tests (verification)**:
1. **File existence test**: `test -f docs/test/full-pipeline.md` → exits 0
2. **Content test**: `grep -q "Hello from CLI test" docs/test/full-pipeline.md` → exits 0
3. **Heading test**: `head -1 docs/test/full-pipeline.md` → outputs `# Full Pipeline Test`
4. **No extra content test**: File should be exactly 3 lines (heading, blank, content)

**Acceptance Criteria**:
- [ ] File exists at `docs/test/full-pipeline.md`
- [ ] First line is `# Full Pipeline Test`
- [ ] File contains the string `Hello from CLI test`
- [ ] File does NOT contain task description content (no `## Task`, `## Implementation`, `## Verify` sections)
- [ ] File is exactly 3 lines

---

## Verification Commands

```bash
# All of these must pass:
test -f docs/test/full-pipeline.md && echo "PASS: file exists"
grep -q "Hello from CLI test" docs/test/full-pipeline.md && echo "PASS: content present"
head -1 docs/test/full-pipeline.md | grep -q "# Full Pipeline Test" && echo "PASS: heading correct"
wc -l < docs/test/full-pipeline.md | grep -q "3" && echo "PASS: line count correct"
```

## Notes

- The file already exists from a previous (incorrect) pipeline run that copied task.md content into it
- The build agent should overwrite with the correct simple content specified in the task
- This is a trivial single-step plan for a complexity-5 ops task
