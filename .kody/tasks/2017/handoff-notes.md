# Fix for Issue #2017: Target Application Unreachable

## Root Cause
When the database is unavailable, MongoDB driver defaults to 30 seconds for server selection (`serverSelectionTimeoutMS`). Combined with Vercel's 60-second function timeout, users see 60-second hangs instead of fast failures.

## What Was Fixed
1. Added `serverSelectionTimeoutMS: 5000` to MongoDB config in `payload.config.ts` - this fails fast (5s) when database is unavailable
2. Updated guardrail test to only block `waitQueueTimeoutMS` (which causes `MongoWaitQueueTimeoutError` during cold starts), not `serverSelectionTimeoutMS`
3. Added new test `tests/unit/mongodb-timeout-failfast.test.ts` to ensure `serverSelectionTimeoutMS` is always set

## Key Insight
`serverSelectionTimeoutMS` and `waitQueueTimeoutMS` have different failure modes:
- `serverSelectionTimeoutMS`: Controls timeout when NO server is available (fails fast when DB is down)
- `waitQueueTimeoutMS`: Controls timeout waiting for connection from pool (causes `MongoWaitQueueTimeoutError` during pool exhaustion)

The guardrail was incorrectly blocking both. Only `waitQueueTimeoutMS` causes `MongoWaitQueueTimeoutError` during cold starts.

## Files Changed
- `src/payload.config.ts`: Added `serverSelectionTimeoutMS: 5000`
- `tests/unit/mongodb-pool-config.test.ts`: Updated guardrail to only block `waitQueueTimeoutMS`
- `tests/unit/mongodb-timeout-failfast.test.ts`: New test ensuring `serverSelectionTimeoutMS` is set