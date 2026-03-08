# Autofix Report: 260306-auto-330

## Errors Fixed

- **TypeScript error**: Merge conflict markers at lines 15, 16, 20 in `src/app/api/cody/pipeline/[taskId]/route.ts`
- **Lint error**: Parsing error due to merge conflict markers
- **Format error**: Syntax error due to merge conflict markers

**Resolution**: Resolved the git merge conflict by keeping all required imports (`findTaskBranch`, `findBranchByIssueNumber`, `getStatusFromBranch`, `findStatusOnBranch`, `getStatusFromArtifact`, `fetchWorkflowRuns`) and removing the duplicate `getStatusFromBranch` import.

## Quality

- TypeScript: PASS
- Lint: PASS
- Format: PASS
