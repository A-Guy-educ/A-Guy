All tests pass and the implementation is complete. Here's the final summary:

## Implementation Complete

### Files Created/Modified

1. **`src/infra/db/pool-stats.ts`** (new)
   - `PoolStats` interface with `poolSize`, `available`, `inUse`, `queued` metrics
   - `getPoolStats()` utility to extract pool stats from MongooseAdapter
   - `logPoolStats()` helper for debugging

2. **`src/payload.config.ts`** (modified)
   - Added `afterOpenConnection` callback for connection lifecycle logging
   - Logs pool size when connection opens: `[MongoDB] Connection pool opened with maxSize=N`

3. **`src/app/api/health/route.ts`** (modified)
   - Health endpoint now returns `pool` object with current stats
   - Includes `poolSize`, `available`, `inUse`, `queued` metrics

4. **`tests/unit/infra/db/pool-stats.test.ts`** (new)
   - 7 unit tests covering `getPoolStats` and `logPoolStats` functions
   - Tests verify stats extraction from various pool states

### Verification
- TypeScript compiles without errors
- Lint passes
- Format applied
- All 7 unit tests pass
