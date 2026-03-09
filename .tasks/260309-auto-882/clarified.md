# Clarified

Answers to review questions:
1. Yes, include integration tests to verify atomic behavior — this is critical for a concurrency bug
2. Adding a 'claiming' state to the GuestSessions collection is acceptable — add a 'status' field with values 'active', 'claiming', 'revoked'
3. The cron cleanup job should be updated to handle the 'claiming' state gracefully — don't delete sessions in 'claiming' state, only 'revoked' ones past their TTL
