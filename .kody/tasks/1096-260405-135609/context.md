
### build (2026-04-05T18:55:43)
## Summary

Fixed the OAuth login race condition bug in `issueSessionForLinkedAccount` by replacing the dangerous password-swap pattern with direct JWT generation.

### The Problem
The original code (lines 108-164) temporarily replaced the user's password hash with a temporary secret to call `payload.login()`, then restored the original hash. This created a race condition where:
- Concurrent requests could see the temporary password
- If the restore failed (network error, timeout), users would b
...(truncated)
