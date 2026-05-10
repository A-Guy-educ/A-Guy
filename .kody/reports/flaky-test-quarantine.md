# Flaky Test Quarantine — Status Report

**Generated**: 2026-05-10T00:00:00Z

## Summary

No flip candidates detected in this scan.

## Scan Details

- **Branches checked**: dev, main
- **Runs examined**: 50 total (25 per branch)
- **Flip candidates**: 0

## Why No Candidates?

A flip candidate requires the same commit (`headSha`) to have:
1. At least one failed CI attempt
2. A subsequent successful retry (`attempt > 1`)

All examined runs showed `attempt: 1`, indicating:
- No commits were retried in this window
- Recent CI failures haven't had follow-up runs yet

## Tracked Branches

| Branch | CI Failures (attempt 1) | Notes |
|--------|------------------------|-------|
| dev    | 2 (non-test workflows) | Exercise Conversion Runner, AI Docs Refresh |
| main   | 4                      | CI workflow failures, no retries yet |

## Action

Monitor will continue. Candidates will be tracked when retries occur.

**Next scan**: 2026-05-11T00:00:00Z (20h cadence)
