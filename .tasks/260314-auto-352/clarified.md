# Clarified

1. Backward compatibility of mergeDefaultBranch()
There's a real issue. The plan changes the return type from void to boolean. Let me trace every caller:

Caller	File:Line	Current usage	Impact
ensureFeatureBranch (CI)	git-utils.ts:270	mergeDefaultBranch(cwd) — no return captured, throws on conflict → caught at L255	✅ Safe — void → boolean is backward compatible when return is ignored. Still throws when leaveConflicts is not set.
ensureFeatureBranch (local)	git-utils.ts:292	Same pattern — throw is caught by the try/catch in the parent	✅ Safe
ensureFeatureBranch (local branch)	git-utils.ts:351	Same pattern	✅ Safe
runFixMode	entry.ts:752	mergeDefaultBranch(process.cwd()) in try/catch — this is the bug we're fixing	🔧 Will be changed to use { leaveConflicts: true }
checkout-task-branch.ts:92	Separate local function — NOT the exported one from git-utils.ts	⚠️ Different function entirely — needs its own fix	
Verdict: backward compatible. Changing void → boolean return is safe in TypeScript — existing callers that ignore the return value still work. The throw behavior is preserved when options is not passed (or leaveConflicts is falsy). The one subtle thing is that checkout-task-branch.ts has its own local mergeDefaultBranch() (L92-101) that already returns boolean but aborts the merge. The plan correctly identifies this needs a separate fix. No plan change needed.

2. Auto-skip logic for resolve-conflicts stage
There's a gap. The plan says shouldSkip checks for merge-conflicts.md in taskDir. But consider these scenarios:

Scenario	Marker exists?	Should skip?	Plan handles?
Clean merge (no conflicts)	No	Yes ✅	✅
Merge mode with conflicts	Yes	No ✅	✅
Normal full run (no prior merge attempt)	No	Yes ✅	✅
rerun on already-resolved conflicts	Stale marker?	Should skip	⚠️ Gap
fix mode — merge succeeds	No	Yes ✅	✅
The gap: If a previous merge run resolved conflicts but the marker wasn't cleaned up (e.g., agent failed mid-resolution), a subsequent rerun would re-enter resolve-conflicts unnecessarily. The merge-resolve agent instructions say "delete the marker after resolution," but if the agent crashes, it won't.

Fix needed in plan: The resolve-conflicts stage should also check whether git is actually in a merge conflict state (not just the marker file). Add to the shouldSkip:

1. No merge-conflicts.md → skip (no conflicts detected by checkout)
2. merge-conflicts.md exists but git is NOT in merge state → delete stale marker, skip
3. merge-conflicts.md exists and git IS in merge state → don't skip (resolve)
The git check is: git ls-files --unmerged — if empty, no active merge conflicts.

I'll add this to the plan.

3. Fix to runFixMode() handling
The plan is correct but needs one refinement. Currently:

// BUG (entry.ts:750-755):
try {
  mergeDefaultBranch(process.cwd())  // Merge is ABORTED inside, then throws
} catch (error) {
  logger.error({ error }, 'Failed to merge default branch, continuing anyway')
  // Continues with stale code — silently broken!
}
The plan proposes:

const merged = mergeDefaultBranch(process.cwd(), { leaveConflicts: true })
if (!merged) {
  writeConflictMarker(ctx.taskDir, process.cwd())
}
This is correct — and since FIX_FULL_ORDER is prepended with resolve-conflicts, the stage will pick up the marker. But there's a sequencing question: runFixMode() does the merge at L750-755 before resolving the task directory (L761-787). We need the task dir to write the marker.

Fix: Move the merge attempt to AFTER ctx.taskDir is resolved (after L788), or use a temporary marker location and move it later. The cleanest approach is to move the merge block after task dir resolution. I'll note this in the plan update.

4. User-facing documentation
Yes, it should be documented. The @cody merge command and the Smart Resolve button are user-facing features. Specific places:

Doc	What to add
scripts/cody/README.md	Add merge to the modes table, explain when to use it
.ai-docs/quick-reference/CHEAT-SHEET.md	Add to Cody Pipeline Patterns section — new MERGE flow
Issue/PR template or help text	@cody merge in the available commands list
