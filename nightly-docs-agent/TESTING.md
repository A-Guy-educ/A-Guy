# Nightly Docs Agent Testing Guide

> **Purpose**: Test cases and validation procedures for the Nightly Docs Agent.

---

## 1. Test Categories

| Category | Description |
|----------|-------------|
| **No-Op** | Agent exits without PR when no structural changes |
| **Structural** | Agent creates PR when structural changes detected |
| **Mixed** | Agent correctly filters structural from non-structural |
| **Idempotency** | Re-run on same commit produces no new PR |
| **Edge Cases** | Missing anchors, invalid targets, empty diffs |

---

## 2. Test Cases

### TC-01: No Structural Changes

**Scenario**: Only non-structural files changed (e.g., `.md` docs, test files)

**Setup**:
```bash
# Simulate changes to non-structural files
pnpm nightly-docs --dry-run --simulate "docs/README.md:modify"
```

**Expected**:
- Exit code: 0
- Output: `No structural changes detected. Exiting without PR.`
- No PR created

---

### TC-02: Single Collection Added

**Scenario**: New Payload collection file added

**Setup**:
```bash
pnpm nightly-docs --dry-run --simulate "src/server/payload/collections/NewCollection.ts:add"
```

**Expected**:
- Exit code: 0
- Output includes: `Structural files: 1 of 1`
- Output includes: `Matched 1 mapping rule(s)`
- Would update: `src/server/payload/collections/README.md` → section: "Available Collections"
- Evidence: `Collection add: NewCollection.ts`

---

### TC-03: API Route Added

**Scenario**: New API route file added

**Setup**:
```bash
pnpm nightly-docs --dry-run --simulate "src/app/api/new-endpoint/route.ts:add"
```

**Expected**:
- Exit code: 0
- Would update: `src/app/README.md` → section: "API Endpoints"
- Evidence: `API route add: route.ts`

---

### TC-04: Multiple Structural Changes

**Scenario**: Multiple structural files changed

**Setup**:
```bash
pnpm nightly-docs --dry-run \
  --simulate "src/server/payload/collections/Users.ts:modify" \
  --simulate "src/app/api/health/route.ts:add" \
  --simulate "src/server/payload/blocks/NewBlock/index.ts:add"
```

**Expected**:
- Exit code: 0
- Output includes: `Structural files: 3 of 3`
- Multiple doc changes listed
- Deduplicated if same doc/section

---

### TC-05: Mixed Structural and Non-Structural

**Scenario**: Mix of structural and non-structural changes

**Setup**:
```bash
pnpm nightly-docs --dry-run \
  --simulate "src/server/payload/collections/Courses.ts:modify" \
  --simulate "docs/README.md:modify" \
  --simulate "tests/unit/example.test.ts:add"
```

**Expected**:
- Exit code: 0
- Output: `Structural files: 1 of 3`
- Only collection change triggers mapping

---

### TC-06: Collection Modify Without Significant Change

**Scenario**: Collection file modified but no significant patterns (fields/access/hooks)

**Setup**:
```bash
# This requires an actual file diff, so use real git operations
git checkout -b test-nightly-docs
echo "// comment" >> src/server/payload/collections/Users.ts
git add .
git commit -m "test: minor change"
pnpm nightly-docs --dry-run
git checkout -
git branch -D test-nightly-docs
```

**Expected**:
- Exit code: 0
- Output: `Structural changes found but no doc mappings apply.` (if content patterns don't match)

---

### TC-07: Idempotency - Same Commit Twice

**Scenario**: Run agent twice on same commit

**Setup**:
```bash
# First run (creates state)
pnpm nightly-docs --dry-run --simulate "src/server/payload/collections/Test.ts:add"

# Check state file
cat .ai-docs/nightly-docs-state.json

# Second run (should be no-op)
pnpm nightly-docs --dry-run
```

**Expected (second run)**:
- Exit code: 0
- Output: `No structural changes detected.` (delta is empty since lastCommit == HEAD)

---

### TC-08: Force Run

**Scenario**: Force run even with existing state

**Setup**:
```bash
pnpm nightly-docs --dry-run --force --simulate "src/server/payload/collections/Test.ts:add"
```

**Expected**:
- Ignores state file
- Processes simulated changes

---

### TC-09: Missing Anchor

**Scenario**: Target doc exists but anchor markers missing

**Setup**:
1. Temporarily remove anchor from target doc
2. Run agent with structural change

**Expected**:
- Warning: `Missing anchor in {doc}: {anchorId}`
- That specific change is skipped
- Other valid changes still processed

---

### TC-10: Deleted Collection

**Scenario**: Collection file deleted

**Setup**:
```bash
pnpm nightly-docs --dry-run --simulate "src/server/payload/collections/OldCollection.ts:delete"
```

**Expected**:
- Exit code: 0
- Would update collection list
- Evidence: `Collection delete: OldCollection.ts`

---

### TC-11: Workflow Change

**Scenario**: GitHub Actions workflow added

**Setup**:
```bash
pnpm nightly-docs --dry-run --simulate ".github/workflows/new-workflow.yml:add"
```

**Expected**:
- Exit code: 0
- Would flag review in `INDEX.md`
- Evidence: `CI workflow add: new-workflow.yml`

---

### TC-12: Ignored File Pattern

**Scenario**: File matches structural path but also matches ignore pattern

**Setup**:
```bash
pnpm nightly-docs --dry-run --simulate "src/server/payload/collections/Test.spec.ts:add"
```

**Expected**:
- Exit code: 0
- Output: `No structural changes detected.` (test file ignored)

---

## 3. Manual Verification Checklist

### Before First Run

- [ ] `docs/nightly-docs-agent/CONFIG.md` exists and is valid
- [ ] Target docs have anchor markers
- [ ] `gh` CLI is authenticated
- [ ] Git is configured

### After Run

- [ ] State file updated (if not dry-run)
- [ ] PR created with correct:
  - [ ] Title format
  - [ ] Labels
  - [ ] Body sections (triggers, changes, evidence)
- [ ] Only anchored sections modified
- [ ] No extraneous changes

---

## 4. Adding Anchors to Target Docs

For the agent to work, target docs need anchor markers.

### Example: Adding anchors to a README

```markdown
## Available Collections

<!-- nightly-docs:collections-list:start -->
- `Courses`
- `Lessons`
- `Users`
<!-- nightly-docs:collections-list:end -->

## Other Section

Content here is NOT modified by the agent.
```

### Anchor Format

```
<!-- nightly-docs:{anchor_id}:start -->
{content managed by agent}
<!-- nightly-docs:{anchor_id}:end -->
```

---

## 5. Debugging

### Verbose Mode

```bash
pnpm nightly-docs --verbose --dry-run
```

Shows detailed step-by-step output including:
- Config loading
- Each file's structural match result
- Mapping rule evaluation
- Target validation

### Check State

```bash
cat .ai-docs/nightly-docs-state.json
```

Shows:
- `lastCommit`: SHA of last processed commit
- `lastRun`: Timestamp of last run
- `processedFiles`: Files included in last PR

### Clear State (for testing)

```bash
rm .ai-docs/nightly-docs-state.json
```

Forces fallback to 24h lookback.

---

## 6. CI Integration Tests

Add to CI pipeline for validation:

```yaml
- name: Validate Nightly Docs Config
  run: |
    # Check config parses
    pnpm nightly-docs --dry-run --simulate "test:add" 2>&1 | grep -q "Loading config"

- name: Validate No Unexpected Changes
  run: |
    # Ensure dry-run makes no file changes
    git diff --exit-code
```

---

## 7. Regression Test Matrix

| Test | Input | Expected Output | Status |
|------|-------|-----------------|--------|
| TC-01 | Non-structural only | Exit 0, no PR | ✅ |
| TC-02 | Collection add | PR with collection list | ✅ |
| TC-03 | API route add | PR with API list | ✅ |
| TC-04 | Multiple structural | PR with all changes | ✅ |
| TC-05 | Mixed changes | Only structural in PR | ✅ |
| TC-06 | Modify no patterns | Exit 0, no PR | ✅ |
| TC-07 | Idempotency | Second run no-op | ✅ |
| TC-08 | Force flag | Ignores state | ✅ |
| TC-09 | Missing anchor | Skip + warning | ✅ |
| TC-10 | Delete event | PR with updated list | ✅ |
| TC-11 | Workflow change | PR with flag | ✅ |
| TC-12 | Ignored pattern | Exit 0, no PR | ✅ |
