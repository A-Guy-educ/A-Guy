# TASK-03: GitHub Client with Cache & Branch Discovery

## Summary
Create an Octokit wrapper with in-memory caching, branch name discovery (5 prefixes), status.json access from branches/artifacts, and PR association.

## Task Type
implement_feature

## Dependencies
- TASK-02 (types and constants)

## Requirements

### R1: Install Octokit
- `pnpm add @octokit/rest`

### R2: Create github-client.ts
- File: `src/lib/cody/github-client.ts`

**Exports**:

```typescript
// Singleton Octokit
export function getOctokit(): Octokit

// TTL cache
export async function getCached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T>

// Try all 5 branch prefixes (feat/, fix/, refactor/, docs/, chore/) to find existing branch
export async function findTaskBranch(taskId: string): Promise<string | null>

// Read status.json from branch via GitHub Contents API
export async function getStatusFromBranch(taskId: string, branch: string): Promise<CodyPipelineStatus | null>

// Download artifact zip and extract status.json
export async function getStatusFromArtifact(taskId: string, runId: number): Promise<CodyPipelineStatus | null>

// Find open PR by branch name matching any prefix + taskId
export async function findAssociatedPR(taskId: string): Promise<{ number: number; url: string; merged: boolean; merged_at: string | null } | null>

// Owner/repo config
export function getRepoConfig(): { owner: string; repo: string }
```

### R3: Implementation details

**getOctokit()**: Lazy singleton. Uses `process.env.GH_TOKEN`. Throws if not set.

**getCached()**: Simple Map-based TTL cache:
```typescript
const cache = new Map<string, { data: unknown; expires: number }>()
```
Returns cached value if within TTL. Otherwise calls fetcher, stores result, returns it.

**findTaskBranch()**: Uses `Promise.allSettled()` to try all 5 branch prefixes in parallel:
```typescript
const results = await Promise.allSettled(
  BRANCH_PREFIXES.map(prefix =>
    octokit.repos.getBranch({ owner, repo, branch: `${prefix}/${taskId}` })
  )
)
```
Returns first fulfilled result's branch name, or null.

**getStatusFromBranch()**: 
```typescript
const content = await octokit.repos.getContent({
  owner, repo, path: `.tasks/${taskId}/status.json`, ref: branch
})
// base64 decode → JSON parse → return CodyPipelineStatus
```

**getStatusFromArtifact()**: 
- List artifacts matching `cody-${taskId}-*`
- Download zip, extract status.json
- Parse JSON, return CodyPipelineStatus
- Note: This is complex (zip handling). Use a simple approach: `octokit.actions.downloadArtifact()` returns a redirect URL to a zip. For V1, this can be a stub that returns null (branch-based access + comment parsing cover most cases).

**findAssociatedPR()**:
- `octokit.pulls.list({ owner, repo, state: 'all', per_page: 30 })`
- Filter: `pr.head.ref` matches any `{prefix}/{taskId}` pattern
- Return first match with number, url, merged status

### R4: Repo config
- `GITHUB_OWNER` and `GITHUB_REPO` from env vars, or parse from `git remote get-url origin`
- Fallback: hardcode if needed (this is a single-repo dashboard)

## Files to Create/Modify
- `src/lib/cody/github-client.ts` (NEW)
- `package.json` (MODIFIED — @octokit/rest)

## Tests
- File: `tests/unit/lib/cody/github-client.test.ts`
- Mock Octokit using vi.mock
- Test `getCached` returns cached value within TTL
- Test `getCached` re-fetches after TTL expires  
- Test `findTaskBranch` returns correct branch name when one exists
- Test `findTaskBranch` returns null when no branch exists
- Test `findAssociatedPR` finds PR by branch name
- Test `getOctokit` throws when GH_TOKEN is missing

## Acceptance Criteria
- [ ] `pnpm tsc --noEmit` passes
- [ ] All unit tests pass: `pnpm vitest run tests/unit/lib/cody/github-client.test.ts`
- [ ] getCached correctly caches and expires
- [ ] findTaskBranch tries all 5 prefixes

## Notes
- `GH_TOKEN` is the env var name (GitHub CLI convention, already used in CI)
- getStatusFromArtifact can be a stub returning null in V1 — branch-based + comment-based access covers most cases
- NEVER expose GH_TOKEN to the browser — this module runs server-side only
