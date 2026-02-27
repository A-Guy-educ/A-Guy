# PRD: Cody Pipeline Git Integration Tests

## 1. Overview

**Test Task ID**: `260226-test-git-integration`  
**Domain**: CI/CD - Cody Pipeline Testing  
**Priority**: Medium  
**Note**: New task - no existing related Cody task

### Summary

Test the Git integration utilities used by the Cody pipeline for committing changes, pushing branches, and creating pull requests.

---

## 2. Background

The Cody pipeline uses Git for:
1. **Commit** - Commit task files (status.json, stage outputs)
2. **Push** - Push branch to remote
3. **Create PR** - Create GitHub pull request

Key functions in `scripts/cody/git-utils.ts`:
- `commit(taskDir, message, dryRun?)` → commitHash
- `push(branch, dryRun?)`
- `createPR(branch, title, body)` → prUrl

---

## 3. Test Objectives

| Objective | Description | Test Type |
|-----------|-------------|-----------|
| O1 | Verify commit creates correct commit hash | Unit |
| O2 | Verify push pushes to correct branch | Unit |
| O3 | Verify PR creation with correct title/body | Unit |
| O4 | Verify dry-run mode doesn't make changes | Unit |
| O5 | Verify error handling for git failures | Integration |

---

## 4. Test Scenarios

### 4.1 Unit Tests

| ID | Scenario | Input | Expected Output |
|----|----------|-------|-----------------|
| UT-01 | Commit with message | `commit(taskDir, 'feat: test')` | Returns valid commit hash |
| UT-02 | Commit dry-run | `commit(taskDir, 'test', true)` | Returns commit hash, no commit created |
| UT-03 | Push to branch | `push('feature/test')` | No error |
| UT-04 | Push dry-run | `push('feature/test', true)` | No error, no push |
| UT-05 | Create PR | `createPR('feature/test', 'Title', 'Body')` | Returns PR URL |
| UT-06 | Create PR with labels | `createPR('feature/test', 'Title', 'Body', ['auto'])` | PR created with labels |

### 4.2 Integration Tests

| ID | Scenario | Description |
|----|----------|-------------|
| IT-01 | Full commit-push-PR flow | Commit → push → create PR |
| IT-02 | Git command failure handling | Handle `git` not found or command failure |
| IT-03 | Empty commit handling | Verify no empty commits created |
| IT-04 | Branch already exists | Handle push to existing branch |

---

## 5. Implementation Plan

### Step 1: Create Test File
- Location: `tests/unit/scripts/cody/git-utils.test.ts`
- Mock: `child_process.execSync`, GitHub API

### Step 2: Implement Unit Tests
- Test commit function with various messages
- Test push function
- Test PR creation

### Step 3: Implement Integration Tests
- Test full flow (requires git repository)
- Test error scenarios

### Step 4: Verify
```bash
pnpm vitest run tests/unit/scripts/cody/git-utils.test.ts
```

---

## 6. Dependencies

- `scripts/cody/git-utils.ts` - Git utilities
- `child_process` - For executing git commands

---

## 7. Acceptance Criteria

| Criterion | Description |
|-----------|-------------|
| AC-1 | All unit tests pass |
| AC-2 | All integration tests pass |
| AC-3 | Commit creates valid commit hash |
| AC-4 | Push executes without error |
| AC-5 | PR created with correct title and body |
| AC-6 | Dry-run mode doesn't make actual changes |
| AC-7 | Git failures handled gracefully |

---

## 8. Related Documentation

- [Cody Pipeline README](../scripts/cody/README.md) - Key Functions section
- [git-utils.ts](../scripts/cody/git-utils.ts) - Source file
