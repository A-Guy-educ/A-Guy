# Clarified

1. **Backward compatibility**: ✅ Yes. Return type `void` → `boolean` is backward compatible in TypeScript when return value is ignored. All existing callers (L270, L292, L351 in git-utils.ts) don't capture the return, so they continue to work. The throw behavior is preserved when `leaveConflicts` is not set.

2. **Auto-skip logic**: ⚠️ Gap. Only checks for marker file existence, not whether git is actually in merge state. A stale marker from a previous failed resolution would incorrectly trigger the stage. Should add `git ls-files --unmerged` check.

3. **runFixMode() fix**: ⚠️ Ordering issue. The merge at L750-755 happens BEFORE taskDir is resolved (L788). Need to move the merge block after taskDir resolution, or write marker to temp location.

4. **User documentation**: ✅ Yes. Should add to:
   - `scripts/cody/README.md` — modes table
   - `.ai-docs/quick-reference/CHEAT-SHEET.md` — pipeline patterns
