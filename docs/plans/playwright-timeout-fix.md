# Playwright WebServer Timeout Fix - Implementation Plan

## Problem Statement

Playwright E2E tests are timing out after 5 minutes (300000ms) waiting for the web server to become ready. The server logs show "Ready in 839ms", indicating the server starts successfully, but Playwright cannot successfully make a health check request to `http://localhost:3000`.

### About `localhost:3000` in GitHub Actions

**Yes, `localhost:3000` works perfectly in GitHub Actions!**

- GitHub Actions runners are Linux VMs where everything runs on the same machine
- The Next.js server and Playwright both run on the same runner
- `localhost` refers to the runner itself, so they can communicate via `http://localhost:3000`
- This is the standard approach for E2E testing in CI environments
- No network configuration needed - it's all local to the runner

**The issue is NOT about network connectivity** - it's about the health check request hanging.

### Symptoms
- Server starts successfully (`✓ Ready in 839ms`)
- Playwright times out waiting for health check response
- Error: `Error: Timed out waiting 300000ms from config.webServer`
- This is intermittent but occurs frequently in CI
- The server is running, but the HTTP request to verify it hangs

### Root Cause Analysis

The issue likely stems from:

1. **Homepage uses dynamic APIs**: The root route (`/`) uses `[slug]/page.tsx` which calls `draftMode()`, potentially causing the first request to hang during static-to-dynamic conversion
2. **No dedicated health check endpoint**: Playwright checks `http://localhost:3000` which hits the homepage - a complex route that may trigger blocking operations
3. **Blocking operations on first request**: The first request to the server might trigger:
   - Database connections (MongoDB Atlas connection can be slow)
   - Payload initialization
   - Static-to-dynamic conversion processing
   - Middleware execution
4. **Static-to-dynamic conversion errors**: Even with try-catch, Next.js might still detect dynamic API usage and hang during the conversion process

## Solution Strategy

### Phase 1: Create Dedicated Health Check Endpoint (IMMEDIATE)

**Goal**: Provide a lightweight endpoint that Playwright can use to verify server readiness without triggering any dynamic APIs or complex operations.

**Implementation**:
1. Create `/api/health` route that:
   - Returns immediately (no database queries)
   - No dynamic APIs (`headers()`, `cookies()`, `draftMode()`)
   - Simple JSON response: `{ status: 'ok', timestamp: Date.now() }`
   - Can optionally check database connectivity (non-blocking)

**Files to create**:
- `src/app/api/health/route.ts`

**Benefits**:
- Fast response time (< 10ms)
- No risk of static-to-dynamic conversion
- Can be used by monitoring tools
- Doesn't trigger Payload initialization

### Phase 2: Update Playwright Configuration

**Goal**: Use the dedicated health check endpoint instead of the root URL.

**Changes**:
1. Update `playwright.config.ts` to use `/api/health` as the health check URL
2. Add better error handling and logging
3. Consider increasing timeout slightly if needed (but investigate root cause first)

**Files to modify**:
- `playwright.config.ts`

### Phase 3: Investigate and Fix Root Cause

**Goal**: Understand why the homepage request hangs and fix it.

**Investigation steps**:
1. Add logging to identify where the request hangs
2. Check if Payload initialization is blocking
3. Verify database connection isn't causing delays
4. Test if removing `draftMode()` from homepage helps
5. Check for any middleware that might be blocking

**Potential fixes**:
- Make homepage fully static (no `draftMode()` calls)
- Lazy-load Payload initialization
- Add request timeout handling
- Optimize database connection pooling

### Phase 4: Add Monitoring and Debugging

**Goal**: Better visibility into what's happening during server startup and health checks.

**Implementation**:
1. Add structured logging to health check endpoint
2. Log server startup time and readiness
3. Add Playwright debug mode instructions
4. Create troubleshooting guide

## Implementation Steps

### Step 1: Create Health Check Endpoint

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic' // Explicitly mark as dynamic to avoid static generation issues

export async function GET() {
  // Simple, fast response - no database, no Payload, no dynamic APIs
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
    },
    { status: 200 }
  )
}
```

**Why `force-dynamic`**:
- Prevents Next.js from trying to statically generate this route
- Ensures it's always available as a dynamic route
- No risk of static-to-dynamic conversion errors
- Fast response (< 10ms) - perfect for health checks

**Why this works in GitHub Actions**:
- `localhost:3000` works fine - server and Playwright are on the same runner
- The health endpoint avoids all blocking operations
- Simple JSON response that Playwright can quickly verify

### Step 2: Update Playwright Config

```typescript
// playwright.config.ts
webServer: {
  command: 'rm -rf .next && pnpm build && test -d .next && pnpm start',
  reuseExistingServer: !process.env.CI,
  url: 'http://localhost:3000/api/health', // Use dedicated health endpoint
  timeout: 300000, // 5 minutes (enough for build + server start)
  stdout: 'pipe',
  stderr: 'pipe',
  // ... rest of config
}
```

**Why `localhost:3000` works in GitHub Actions**:
- GitHub Actions runners are isolated VMs where everything runs locally
- The server binds to `localhost:3000` (or `0.0.0.0:3000` - both work)
- Playwright runs on the same runner and can access `localhost:3000`
- No network configuration needed - it's all local to the runner VM

### Step 3: Test Locally

1. Run `pnpm test:e2e` locally
2. Verify health check endpoint works: `curl http://localhost:3000/api/health`
3. Check Playwright logs for any errors
4. Verify tests pass consistently

### Step 4: Investigate Homepage Issue (If Still Needed)

If the health check works but homepage still has issues:

1. **Check homepage route**:
   - Verify `src/app/(frontend)/page.tsx` doesn't use dynamic APIs
   - Ensure `[slug]/page.tsx` handles static generation properly

2. **Add request logging**:
   ```typescript
   // Add to middleware or a request logger
   console.log('[Server] Request received:', req.url, new Date().toISOString())
   ```

3. **Test homepage directly**:
   ```bash
   curl -v http://localhost:3000/
   ```

### Step 5: Add Optional Database Health Check

If we want to verify database connectivity:

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const health: {
    status: 'ok' | 'degraded'
    timestamp: number
    uptime: number
    database?: 'connected' | 'disconnected'
  } = {
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
  }

  // Optional: Check database (non-blocking, with timeout)
  try {
    const payload = await Promise.race([
      getPayload({ config }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database check timeout')), 2000)
      ),
    ])
    health.database = 'connected'
  } catch (error) {
    health.status = 'degraded'
    health.database = 'disconnected'
  }

  return NextResponse.json(health, {
    status: health.status === 'ok' ? 200 : 503,
  })
}
```

**Note**: Keep this optional and non-blocking to avoid the same timeout issue.

## Testing Strategy

### Unit Tests
- Test health endpoint returns correct response
- Test health endpoint doesn't use dynamic APIs
- Test health endpoint is fast (< 50ms)

### Integration Tests
- Test health endpoint works in production build
- Test health endpoint works when database is down (if implemented)

### E2E Tests
- Verify Playwright can successfully check health endpoint
- Verify tests run without timeout
- Run tests multiple times to check for flakiness

## Rollout Plan

1. **Phase 1 (Immediate)**: Create health endpoint and update Playwright config
   - Low risk, high impact
   - Can be merged immediately
   - Should fix 90% of timeout issues

2. **Phase 2 (Follow-up)**: Investigate and fix homepage if needed
   - Only if Phase 1 doesn't fully resolve
   - Requires more investigation
   - May need architectural changes

3. **Phase 3 (Optional)**: Add database health check
   - Only if we want to verify database connectivity
   - Keep it non-blocking
   - Useful for monitoring

## Success Criteria

- ✅ Playwright E2E tests start within 1 minute of server "Ready" message
- ✅ Health check endpoint responds in < 50ms
- ✅ No timeout errors in CI
- ✅ Tests are reliable (no flakiness)

## Monitoring

After implementation:
1. Monitor CI build times
2. Track health check response times
3. Monitor for any new timeout errors
4. Collect metrics on server startup time

## Rollback Plan

If issues occur:
1. Revert Playwright config to use root URL
2. Keep health endpoint for future use
3. Investigate why health endpoint didn't work

## Related Issues

- Static-to-dynamic conversion errors (already partially fixed)
- Server startup performance
- Database connection pooling
- Payload initialization timing

## References

- [Next.js App Router - Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Playwright - Web Server Configuration](https://playwright.dev/docs/test-webserver)
- [Next.js - Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)

