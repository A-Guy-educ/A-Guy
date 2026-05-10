# Flaky Test Quarantine — Status Report

**Generated**: 2026-05-10T16:26:00Z

## Summary

Seed scan complete. No flip candidates detected.

### Scan Details

- Branches checked: dev, main
- Runs examined: 50 total (25 per branch)
- Flip candidates: 0

### Why No Candidates?

A flip candidate requires the same commit (headSha) to have:
1. At least one failed CI attempt
2. A subsequent successful re-run (attempt > 1)

All examined runs show attempt: 1, indicating:
- No commits were retried in this window
- Recent CI failures have not yet had follow-up runs

### Observed CI Failures (not flips — no successful re-run yet)

main branch:
- 09871b2d: CI workflow failed (QA Scenarios full) — auth-student-logout, auth-guest-upgrade, access-gate-free
- 354a0e96: CI workflow failed (QA Scenarios full) — same 3 scenarios
- ed048cc4: CI workflow failed (QA Scenarios full) — same 3 scenarios
- bf3c3165: CI workflow failed (QA Scenarios full) — same 3 scenarios

dev branch:
- 929cdddc: Exercise Conversion Runner failed (non-test workflow)

### Tracked Scenarios (pending flips)

These test IDs appear in recent failures. They will become candidates if the same SHAs get re-run successfully:
- auth-student-logout — timeout on logout click
- auth-guest-upgrade — toBeVisible assertion failed
- access-gate-free — toBeVisible assertion failed

### Escalations This Tick

None — no candidate reached flips >= 3.

**Next scan**: 2026-05-11T12:26:00Z (20h cadence)
