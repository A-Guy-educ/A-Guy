# MongoDB Connection Pool Configuration

## Overview

This document explains the MongoDB connection pool configuration and the rationale behind the hardened settings to prevent connection exhaustion on MongoDB Atlas.

## Problem Statement

### Atlas Connection Limits

MongoDB Atlas Flex tier has a hard limit of **500 concurrent connections**. In a serverless environment like Vercel, each serverless instance creates its own connection pool, which can lead to rapid connection amplification.

### Previous Configuration

```typescript
maxPoolSize: process.env.VITEST ? 5 : 100
```

**Risk:** With `maxPoolSize=100` in production:
- Only **5 concurrent serverless instances** could exhaust the entire 500-connection limit
- Formula: `5 instances × 100 connections = 500 connections` ❌

This led to production incidents where connection spikes reached the cluster limit during traffic surges or deployments.

## Solution: Hardened Configuration

### Current Configuration

Located in `src/payload.config.ts`:

```typescript
db: mongooseAdapter({
  url: databaseUrl,
  connectOptions: {
    maxPoolSize: parseInt(
      process.env.MONGODB_MAX_POOL_SIZE ?? (process.env.VITEST ? '5' : '2'),
      10,
    ),
    minPoolSize: 0,
    maxIdleTimeMS: 10000,
  },
}),
```

### Configuration Parameters

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| `maxPoolSize` | 2 (production), 5 (tests) | Maximum connections per instance |
| `minPoolSize` | 0 | Allows pool to fully drain when idle |
| `maxIdleTimeMS` | 10000 (10 seconds) | Idle connection timeout |

### Connection Capacity

With the new configuration (`maxPoolSize=2`):

- **Maximum theoretical instances:** 250 (500 ÷ 2)
- **Realistic usage (10 instances):** 20 connections (4% of limit) ✅
- **Realistic usage (50 instances):** 100 connections (20% of limit) ✅
- **Safety threshold (200 instances):** 400 connections (80% of limit) ✅

### Comparison: Before vs After

| Metric | Before (maxPoolSize=100) | After (maxPoolSize=2) | Improvement |
|--------|-------------------------|----------------------|-------------|
| Max instances before limit | 5 | 250 | **50x** |
| 10 instances usage | 1000 connections ❌ | 20 connections ✅ | **50x** safer |
| 50 instances usage | 5000 connections ❌ | 100 connections ✅ | **50x** safer |

## Environment Variable Override

### Setting Custom Pool Size

You can override the default pool size using the `MONGODB_MAX_POOL_SIZE` environment variable:

```bash
# In Vercel Production Environment Variables
MONGODB_MAX_POOL_SIZE=3
```

### When to Increase Pool Size

⚠️ **Only increase if:**
1. Load testing proves the default pool size (2) causes performance issues
2. You have monitoring in place to track connection usage
3. You understand the connection amplification risk

**Recommended maximum:** 5 connections per instance

### Environment-Specific Defaults

| Environment | Default maxPoolSize | Rationale |
|-------------|-------------------|-----------|
| Production | 2 | Prevents connection exhaustion |
| Test (VITEST=true) | 5 | Allows parallel test execution |
| Custom | Set via `MONGODB_MAX_POOL_SIZE` | For load testing or special cases |

## Connection Lifecycle

### Idle Connection Management

With `maxIdleTimeMS=10000` (10 seconds), idle connections are automatically closed:

1. Request completes → Connection returns to pool
2. No activity for 10 seconds → Connection closes
3. New request arrives → New connection created (if needed)

This prevents long-lived idle connections from consuming resources.

### Pool Draining

With `minPoolSize=0`, the connection pool can fully drain when idle:

- Serverless instance with no traffic → All connections close after 10 seconds
- Reduces overall connection count during low-traffic periods
- Connections recreated on-demand when traffic resumes

## Monitoring

### Atlas Metrics to Monitor

1. **Active Connections** - Should remain well below 500
2. **Connection Rate** - Watch for spikes during deployments
3. **Connection Errors** - Alert on "too many connections" errors

### Vercel Logs

Monitor for connection-related errors:

```
MongoServerError: Too many connections
```

If you see this error despite the hardened configuration, check:
1. Is `MONGODB_MAX_POOL_SIZE` overridden too high?
2. Are there exceptionally high concurrent serverless instances?
3. Are there connection leaks (connections not being returned to pool)?

## Verification

### Run Configuration Verification

```bash
pnpm tsx scripts/verify-mongodb-pool-config.ts
```

This script shows:
- Current effective configuration
- Connection capacity analysis
- Safety threshold calculations
- Comparison with previous configuration

### Run Tests

```bash
pnpm test:unit tests/unit/mongodb-pool-config.test.ts
```

Unit tests verify:
- Environment variable precedence
- Connection capacity calculations
- Safety threshold validations

## Architecture Notes

### Payload Singleton Pattern

Payload CMS 3.x uses a singleton pattern for `getPayload()`:
- First call creates a Payload instance with one MongoClient
- Subsequent calls return the cached instance
- Only one connection pool per serverless instance

This is why the configuration works correctly - there's guaranteed to be only one pool per instance.

### No Additional Connection Pools

Verified via code search:
- ✅ No additional `new MongoClient()` calls
- ✅ No `mongoose.connect()` or `mongoose.createConnection()` calls
- ✅ All database access goes through the Payload singleton

## Related Files

- Configuration: `src/payload.config.ts`
- Environment template: `.env.example`
- Verification script: `scripts/verify-mongodb-pool-config.ts`
- Unit tests: `tests/unit/mongodb-pool-config.test.ts`
- This documentation: `docs/mongodb-connection-pool.md`

## References

- [MongoDB Connection Pool Settings](https://www.mongodb.com/docs/drivers/node/current/fundamentals/connection/connection-options/#connection-pool-settings)
- [Payload CMS Configuration](https://payloadcms.com/docs/configuration/overview)
- [MongoDB Atlas Connection Limits](https://www.mongodb.com/docs/atlas/reference/atlas-limits/#mongodb-connection-limits)
- [Mongoose Connection Options](https://mongoosejs.com/docs/connections.html#options)

## Summary

The hardened MongoDB connection pool configuration:

✅ Reduces connection amplification risk by 50x
✅ Allows 250 concurrent serverless instances vs 5 previously
✅ Maintains performance with intelligent connection reuse
✅ Provides environment variable override for flexibility
✅ Includes comprehensive monitoring and verification tools

This is a defensive production hardening measure that prevents connection exhaustion under realistic serverless concurrency.
