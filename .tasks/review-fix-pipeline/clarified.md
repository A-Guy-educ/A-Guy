# Clarified: Architect Agent Code Review + Self-Healing Pipeline

## Questions Addressed

### Q1: Is max 2 fix attempts appropriate?
**A**: Yes. Two attempts balance between giving the pipeline a chance to self-heal while preventing infinite loops. If verify fails after 2 fix attempts, human intervention is warranted.

### Q2: Should review stage be optional for low-complexity tasks?
**A**: Yes. Add skip condition based on complexity threshold (e.g., complexity < 30 skips review). This aligns with existing pattern used for other stages.

### Q3: Is the verify loop exit condition clear?
**A**: Yes. Loop exits when:
- verify passes → proceed to pr
- fix attempt >= 2 → pipeline fails with summary

## Additional Design Decisions

### D1: Review always runs by default
For consistency, review stage runs on all tasks. Can be skipped via task.json or complexity threshold.

### D2: Fix stage can be triggered from multiple sources
Priority order:
1. Verify failures (most recent)
2. Review findings
3. Human feedback (@cody fix)

### D3: Fix mode is separate from rerun --from=build
- @cody fix → targeted fix, skips build
- @cody rerun --from=build → full regeneration with feedback

## Plan Confirmed

This plan is ready for implementation.
