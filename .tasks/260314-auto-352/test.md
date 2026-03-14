# Test Agent Report: 260314-auto-352

## Tests Written

This document specifies failing tests for the "Smart Resolve Conflicts" feature. All tests follow TDD Red Phase methodology — they assert expected behavior that does NOT yet exist in the codebase.

### Test Files to Create/Augment

| File | Test Count | Type | Status |
|------|-----------|------|--------|
| tests/unit/scripts/cody/conflict-utils.test.ts | 7 | unit | NEW |
| tests/unit/scripts/cody/git-utils.test.ts | 3 | unit | AUGMENT |
| tests/unit/scripts/cody/agents/merge-resolve-agent.test.ts | 6 | unit | NEW |
| tests/unit/scripts/cody/pipeline/definitions.test.ts | 8 | unit | AUGMENT |
| tests/unit/scripts/cody/stage-prompts.test.ts | 3 | unit | AUGMENT |
| tests/unit/scripts/cody/parse-inputs.test.ts | 1 | unit | AUGMENT |
| tests/unit/scripts/cody/pipeline-resolver.test.ts | 2 | unit | NEW |
| tests/unit/scripts/cody/checkout-task-branch.test.ts | 2 | unit | AUGMENT |
| tests/unit/api/cody/actions-smart-resolve.test.ts | 4 | unit | NEW |
| tests/unit/ui/cody/api-smart-resolve.test.ts | 2 | unit | NEW |
| tests/unit/ui/cody/components/TaskDetail-smart-resolve.test.tsx | 3 | unit | NEW |
| tests/unit/ui/cody/components/MergeButton-resolve.test.tsx | 2 | unit | NEW |

## Test Cases

### Step 1: Conflict Detection Utilities + Modify mergeDefaultBranch

| Test Name | Type | Expected Behavior |
|-----------|------|-------------------|
| getConflictedFiles returns array of files | unit | Mock `execFileSync` to return `"file1.ts\nfile2.ts\n"`, expect `['file1.ts', 'file2.ts']` |
| getConflictedFiles handles empty output | unit | Mock `execFileSync` to return `""`, expect `[]` |
| hasActiveMergeConflicts returns true when conflicts | unit | Mock `git ls-files --unmerged` to return output → expect `true` |
| hasActiveMergeConflicts returns false when clean | unit | Mock `git ls-files --unmerged` to return empty → expect `false` |
| writeConflictMarker creates valid markdown | unit | Mock fs + git, verify file written with correct content including header, timestamp, branches, file list |
| hasConflictMarker returns true when exists | unit | Mock `fs.existsSync`, return true for merge-conflicts.md |
| hasConflictMarker returns false when missing | unit | Mock `fs.existsSync`, return false for merge-conflicts.md |
| removeConflictMarker removes file | unit | Mock `fs.unlinkSync`, verify called with correct path |
| mergeDefaultBranch returns true on clean merge | unit | Mock git merge success, expect `true` return value |
| mergeDefaultBranch throws on conflict (backward compatible) | unit | Mock git merge conflict, expect `throw` (no options) |
| mergeDefaultBranch returns false with leaveConflicts | unit | Mock git merge conflict with `{ leaveConflicts: true }`, expect `false` without throwing |

### Step 2: Create merge-resolve Agent

| Test Name | Type | Expected Behavior |
|-----------|------|-------------------|
| agent file exists | unit | Verify `.opencode/agents/merge-resolve.md` exists |
| agent has correct YAML header | unit | Agent contains `name: merge-resolve` in frontmatter |
| agent has git permissions | unit | Agent contains `bash: true` in tools section |
| agent references conflict marker | unit | Agent contains reference to `merge-conflicts.md` |
| agent includes tsc verification | unit | Agent contains `tsc --noEmit` instruction |
| agent writes output summary | unit | Agent contains `merge-resolve.md` as output file name |

### Step 3: Add resolve-conflicts Stage + MERGE_ORDER Pipeline

| Test Name | Type | Expected Behavior |
|-----------|------|-------------------|
| MERGE_ORDER has correct sequence | unit | `MERGE_ORDER` equals `['resolve-conflicts', 'commit', 'verify', 'pr']` |
| IMPL_ORDER_STANDARD starts with resolve-conflicts | unit | `IMPL_ORDER_STANDARD[0]` equals `'resolve-conflicts'` |
| IMPL_ORDER_LIGHTWEIGHT starts with resolve-conflicts | unit | `IMPL_ORDER_LIGHTWEIGHT[0]` equals `'resolve-conflicts'` |
| FIX_FULL_ORDER starts with resolve-conflicts | unit | `FIX_FULL_ORDER[0]` equals `'resolve-conflicts'` |
| stage definition exists | unit | `createStageDefinitions()` returns stage with name `'resolve-conflicts'`, type `'agent'`, agentName `'merge-resolve'` |
| shouldSkip returns skip when no marker | unit | Mock no marker file, expect `{ shouldSkip: true, reason: ... }` |
| shouldSkip returns no-skip when marker+conflicts | unit | Mock marker exists + active conflicts, expect `{ shouldSkip: false }` |
| shouldSkip cleans stale marker | unit | Mock marker exists but NO active conflicts, expect marker removed and `{ shouldSkip: true }` |
| ALL_STAGES includes resolve-conflicts | unit | `[...ALL_STAGES]` includes `'resolve-conflicts'` |
| STAGE_CONTEXT_FILES maps correctly | unit | `STAGE_CONTEXT_FILES['resolve-conflicts']` equals `['merge-conflicts.md']` |
| stageInstructions has entry | unit | `stageInstructions['resolve-conflicts']` is a function returning non-empty string |

### Step 4: Add merge Mode to Entry Point + Pipeline Resolver

| Test Name | Type | Expected Behavior |
|-----------|------|-------------------|
| merge is valid mode | unit | `'merge'` is in `VALID_MODES` array |
| resolvePipelineForMode returns MERGE_ORDER | unit | `resolvePipelineForMode('merge', ...)` returns pipeline with `MERGE_ORDER` order |
| pipeline contains merge stages | unit | Pipeline stages map contains 'resolve-conflicts', 'commit', 'verify', 'pr' |

### Step 5: Fix runFixMode Bug + checkout-task-branch.ts

| Test Name | Type | Expected Behavior |
|-----------|------|-------------------|
| no exit(1) on conflict | unit | When `mergeDefaultBranch()` returns false, `process.exit(1)` is NOT called |
| log message contains pipeline resolve | unit | Log message includes "will be resolved by pipeline" |

### Step 6: Dashboard API — Add smart-resolve Action

| Test Name | Type | Expected Behavior |
|-----------|------|-------------------|
| action returns success | unit | POST with `{ action: 'smart-resolve' }` returns `{ success: true }` |
| triggerWorkflow called with merge mode | unit | `triggerWorkflow` called with `{ taskId, mode: 'merge' }` |
| postComment called with resolution message | unit | `postComment` called with conflict resolution message |
| clearCache called | unit | `clearCache()` is called after action |

### Step 7: Dashboard UI — Types, API Client, Hooks

| Test Name | Type | Expected Behavior |
|-----------|------|-------------------|
| smartResolve calls correct endpoint | unit | `tasksApi.smartResolve(123)` calls fetch to `/tasks/issue-123/actions` with `action: 'smart-resolve'` |
| smartResolve includes actorLogin | unit | `tasksApi.smartResolve(123, 'testuser')` includes `actorLogin: 'testuser'` in body |

### Step 8: Dashboard UI — Smart Resolve Button + MergeButton

| Test Name | Type | Expected Behavior |
|-----------|------|-------------------|
| SmartResolveButton renders with conflicts | unit | Mock `usePRCIStatus` returning `hasConflicts: true`, button renders in done column |
| SmartResolveButton hidden without conflicts | unit | Mock `usePRCIStatus` returning `hasConflicts: false`, button does NOT render |
| SmartResolveButton calls mutation on click | unit | Clicking button invokes `taskActions.smartResolve()` |
| MergeButton shows Resolve action | unit | Mock `hasConflicts: true` + `onSmartResolve` provided, render "Resolve" link |
| MergeButton hides Resolve without conflicts | unit | Mock `hasConflicts: false`, "Resolve" link NOT rendered |

## Mock Patterns

### execFileSync Mock (git-utils)
```typescript
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}))
const execFileSync = vi.mocked(childProcess.execFileSync)
```

### fs Mock (conflict-utils)
```typescript
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}))
```

### fetch Mock (API tests)
```typescript
global.fetch = vi.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({ success: true }),
}))
```

### usePRCIStatus Mock (UI tests)
```typescript
vi.mock('@/ui/cody/hooks/usePRCIStatus', () => ({
  usePRCIStatus: vi.fn(() => ({
    hasConflicts: true,
    isLoading: false,
  })),
}))
```

## Verification Command

After implementation, verify all tests compile:
```bash
pnpm -s tsc --noEmit
```
