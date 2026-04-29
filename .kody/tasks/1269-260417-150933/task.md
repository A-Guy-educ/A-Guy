# fix: MongoDB connection pool exhaustion

## Problem

MongoDB Atlas is experiencing connection pool exhaustion under load. This causes intermittent failures and degrades reliability of the platform.

## Impact

- API requests fail with connection timeout errors
- Affects all students and instructors using the platform
- Degrades AI tutor reliability

## Investigation needed

1. Review current Mongoose connection configuration in the Payload CMS setup
2. Check `maxPoolSize`, `minPoolSize`, and `serverSelectionTimeoutMS` settings
3. Identify connection leak patterns (e.g., unclosed connections in API handlers)
4. Add connection pool metrics logging

## Fix

- Set appropriate `maxPoolSize` (recommend 10-50 depending on Atlas tier)
- Add connection lifecycle logging
- Consider connection keepAlive settings
- Add health check endpoint that reports pool status

## Acceptance Criteria

- No connection pool exhaustion errors in production logs
- Pool status visible in health endpoint
- Tests cover connection lifecycle

---

## Discussion (2 comments)

**@aguyaharonyair** (2026-04-17):
@kody

**@aguyaharonyair** (2026-04-17):
🚀 Kody pipeline started: `1269-260417-150933` ([logs](https://github.com/A-Guy-educ/A-Guy/actions/runs/24572204544))

