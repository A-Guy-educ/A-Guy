
### build (2026-04-05T18:55:43)
## Summary

Fixed the OAuth login race condition bug in `issueSessionForLinkedAccount` by replacing the dangerous password-swap pattern with direct JWT generation.

### The Problem
The original code (lines 108-164) temporarily replaced the user's password hash with a temporary secret to call `payload.login()`, then restored the original hash. This created a race condition where:
- Concurrent requests could see the temporary password
- If the restore failed (network error, timeout), users would b
...(truncated)

### review (2026-04-05T19:02:51)
## Verdict: PASS

## Summary

Fixed the OAuth login race condition bug in `issueSessionForLinkedAccount` by replacing the dangerous password-swap pattern with direct JWT generation using `jose` library. The old approach temporarily replaced the user's password hash with a temp secret to call `payload.login()`, creating a race window where concurrent requests could see the temp password or the restore could fail, permanently corrupting the password hash. The new approach generates a compatible JW
...(truncated)

### review-fix (2026-04-05T19:04:41)
The review found **no Critical or Major issues** - the verdict is **PASS**. 

The only finding is a **Minor** issue (hardcoded `TOKEN_EXPIRATION`), which according to my instructions should be ignored.

Since there are no Critical or Major findings to fix, the implementation is complete. The OAuth login race condition bug has been successfully fixed by:

1. **Removing the dangerous password-swap pattern** that temporarily replaced the user's password hash with a temp secret
2. **Generating JWT d
...(truncated)
