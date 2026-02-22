# Fix Plan: Direct-to-Vercel-Blob Uploads

**Date:** 2026-02-08
**Feature Branch:** `feat/direct-to-vercel-blob-uploads`

## Priority Summary

| #   | Severity | Issue                                                                  | Files                                      |
| --- | -------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| 1   | CRITICAL | Rate limiter is completely broken - `check()` never increments counter | `rate-limiter.ts`                          |
| 2   | CRITICAL | Finalize race condition - duplicate chat-assets possible               | `ChatAssets/index.ts`, `finalize/route.ts` |
| 3   | MEDIUM   | Zod schema marks `uploadSessionId` as optional but required            | `finalize/route.ts`                        |
| 4   | MEDIUM   | Error messages leak internal details to clients                        | Both routes                                |
| 5   | MEDIUM   | `isVercelBlobUrl` uses `includes()` instead of URL parsing             | `vercel-blob-adapter.ts`                   |
| 6   | WARNING  | Stale closure in retry logic                                           | `useDirectChatAssetUpload.ts`              |
| 7   | WARNING  | Dead code `_getRetryDelay`, 429 not in retryable                       | `useDirectChatAssetUpload.ts`              |
| 8   | WARNING  | `ChatAssetUploads.tsx` uses CSS instead of Tailwind                    | `ChatAssetUploads.tsx`                     |
| 9   | WARNING  | `clearAll` cancels but doesn't remove files                            | `useDirectChatAssetUpload.ts`              |
| 10  | WARNING  | Cron jobs limited to 100 items, no pagination                          | Both cron endpoints                        |

---

## Task 1: Fix Rate Limiter (CRITICAL)

**File:** `src/server/utils/rate-limiter.ts`

### Problem

`check()` never increments `entry.count` — rate limiting is a complete no-op.

### Changes

**Line 38-39 and 47-48:** Change initial count from 1 to 0 (check() will increment):

```typescript
const newEntry: RateLimitEntry = {
  count: 0, // was 1
  resetAt: now + windowMs,
}
```

**Lines 59-63:** Fix check() to increment counter:

```typescript
// Before:
check(key: string): boolean {
  cleanup()
  const entry = getEntry(key)
  return entry.count < maxRequests
}

// After:
check(key: string): boolean {
  cleanup()
  const entry = getEntry(key)
  if (entry.count >= maxRequests) return false
  entry.count++
  return true
}
```

---

## Task 2: Fix Finalize Race Condition (CRITICAL)

### Problem

Two concurrent finalize requests for the same session can both pass the status check and create duplicate chat-assets.

### Changes

**File:** `src/server/payload/collections/ChatAssets/index.ts`, lines 120-128

Add `unique: true` to `uploadSessionId` field:

```typescript
{
  name: 'uploadSessionId',
  type: 'text',
  required: true,
  unique: true,   // ← add this
  index: true,
  admin: {
    hidden: true,
  },
}
```

**File:** `src/app/api/chat-assets/finalize/route.ts`, around line 137

Wrap the create in try/catch to handle duplicate key error gracefully:

```typescript
try {
  const chatAsset = await payload.create({
    collection: 'chat-assets',
    data: {
      tenant: session.tenant,
      createdBy: userId,
      url: session.blobUrl,
      pathname: session.pathname,
      originalFilename: session.originalFilename,
      mimeType: session.mimeType,
      filesize: metadata.size || session.expectedSize || 0,
      retentionPolicy: 'ephemeral',
      expiresAt: expiresAt.toISOString(),
      uploadSessionId: session.id,
    },
    overrideAccess: true,
  })
  // ... update session, return response
} catch (createError) {
  // If duplicate key error, fetch existing and return it
  const existing = await payload.find({
    collection: 'chat-assets',
    where: { uploadSessionId: { equals: session.id } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    const asset = existing.docs[0]
    return Response.json({
      chatAssetId: asset.id,
      chatAsset: {
        id: asset.id,
        url: asset.url,
        pathname: asset.pathname,
        originalFilename: asset.originalFilename,
        mimeType: asset.mimeType,
        filesize: asset.filesize,
        expiresAt: asset.expiresAt,
      },
    })
  }
  throw createError
}
```

---

## Task 3: Fix Zod Schema Mismatch (MEDIUM)

**File:** `src/app/api/chat-assets/finalize/route.ts`, lines 19-21

```typescript
// Before:
const finalizeSchema = z.object({
  uploadSessionId: z.string().min(1).optional(),
})

// After:
const finalizeSchema = z.object({
  uploadSessionId: z.string().min(1),
})
```

Remove the redundant manual check at lines 54-56.

---

## Task 4: Fix Error Message Leakage (MEDIUM)

**File:** `src/app/api/blob/upload-token/route.ts`, lines 150-152
**File:** `src/app/api/chat-assets/finalize/route.ts`, lines 176-179

```typescript
// Before:
const message = error instanceof Error ? error.message : 'Unknown error'
return Response.json({ error: message }, { status: 500 })

// After:
console.error('[finalize] Error:', error)
return Response.json({ error: 'Internal server error' }, { status: 500 })
```

---

## Task 5: Fix `isVercelBlobUrl` (MEDIUM)

**File:** `src/infra/blob/vercel-blob-adapter.ts`, lines 346-348

```typescript
// Before:
export function isVercelBlobUrl(url: string): boolean {
  return url.includes('.blob.vercel-storage.com') || url.includes('public.blob.vercel-storage.com')
}

// After:
export function isVercelBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname.endsWith('.blob.vercel-storage.com')
  } catch {
    return false
  }
}
```

---

## Task 6: Fix Stale Closure in Retry Logic (WARNING)

**File:** `src/ui/web/chat/hooks/useDirectChatAssetUpload.ts`, lines 240-278

Replace the catch block's retry logic to use the functional setter:

```typescript
} catch (error) {
  const statusVal: number =
    error instanceof Error && 'status' in error && typeof error.status === 'number'
      ? error.status
      : 0
  const canRetry = isRetryableError(statusVal)

  setUploadingFiles((prev) => {
    const currentFile = prev.find((f) => f.localId === localId)
    if (!currentFile) return prev

    const retryCountNum = currentFile.retryCount ?? 0
    const shouldRetry = canRetry && retryCountNum < MAX_RETRIES

    if (shouldRetry) {
      // Schedule re-queue after delay
      const delay = BASE_DELAY_MS * Math.pow(2, retryCountNum) + Math.random() * 500
      setTimeout(() => setUploadQueue((q) => [...q, localId]), delay)

      return prev.map((f) =>
        f.localId === localId
          ? { ...f, retryCount: retryCountNum + 1, status: 'queued' as const }
          : f,
      )
    }

    const errorMessage = error instanceof Error ? error.message : 'Upload failed'
    return prev.map((f) =>
      f.localId === localId
        ? { ...f, status: 'failed' as const, error: errorMessage, abortController: undefined }
        : f,
    )
  })
}
```

Also remove `uploadingFiles` from the `uploadAndFinalize` dependency array (change `[]`).

---

## Task 7: Remove Dead Code + Add 429 Retryable (WARNING)

**File:** `src/ui/web/chat/hooks/useDirectChatAssetUpload.ts`

1. Delete `_getRetryDelay` function (lines 58-60)

2. Update `isRetryableError`:

```typescript
function isRetryableError(status: number): boolean {
  return status === 0 || status === 429 || status >= 500
}
```

---

## Task 8: Convert `ChatAssetUploads` to Tailwind (WARNING)

**File:** `src/ui/web/chat/components/ChatAssetUploads.tsx`

Replace CSS class names with Tailwind utilities:

| CSS class                   | Tailwind replacement                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `chat-asset-uploads`        | `space-y-2 rounded-lg border border-border bg-card p-3`                                        |
| `chat-asset-uploads-header` | `flex items-center justify-between`                                                            |
| `close-button`              | `text-muted-foreground hover:text-foreground`                                                  |
| `upload-item`               | `flex flex-col gap-1 rounded-md border p-2`                                                    |
| `status-complete`           | `border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950`                         |
| `status-failed`             | `border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950`                                 |
| `status-cancelled`          | `border-muted bg-muted/50`                                                                     |
| `status-progress`           | `border-border bg-card`                                                                        |
| `upload-item-info`          | `flex flex-col gap-0.5`                                                                        |
| `upload-item-name`          | `text-sm font-medium truncate max-w-[180px]`                                                   |
| `upload-item-meta`          | `text-xs text-muted-foreground flex gap-2`                                                     |
| `upload-item-progress`      | `mt-1`                                                                                         |
| `progress-bar`              | `h-1.5 w-full rounded-full bg-muted`                                                           |
| `progress-fill`             | `h-full rounded-full bg-primary transition-all`                                                |
| `upload-item-actions`       | `flex items-center gap-1 mt-1`                                                                 |
| `action-button`             | `text-xs text-muted-foreground hover:text-foreground p-1 rounded`                              |
| `action-button.cancel`      | `hover:text-destructive`                                                                       |
| `action-button.retry`       | `hover:text-yellow-600`                                                                        |
| `action-button.remove`      | `hover:text-destructive`                                                                       |
| `clear-all-button`          | `w-full text-sm text-muted-foreground hover:text-foreground py-2 rounded-md hover:bg-muted/50` |

---

## Task 9: Fix `clearAll` to Actually Clear (WARNING)

**File:** `src/ui/web/chat/hooks/useDirectChatAssetUpload.ts`, lines 119-129

```typescript
// Before:
const clearAll = useCallback(() => {
  setUploadingFiles((prev) =>
    prev.map((f) => {
      if (f.abortController) f.abortController.abort()
      return { ...f, status: 'cancelled' as const, abortController: undefined }
    }),
  )
  setUploadQueue([])
}, [])

// After:
const clearAll = useCallback(() => {
  setUploadingFiles((prev) => {
    for (const f of prev) {
      if (f.abortController) f.abortController.abort()
    }
    return []
  })
  setUploadQueue([])
}, [])
```

---

## Task 10: Add Pagination to Cron Jobs (WARNING)

**Files:**

- `src/server/payload/endpoints/cron/chat-asset-expiry.ts`
- `src/server/payload/endpoints/cron/upload-session-cleanup.ts`

Add a `do...while` loop:

```typescript
let hasMore = true
while (hasMore) {
  const { docs } = await payload.find({
    collection: '...',
    where: { ... },
    limit: 100,
    overrideAccess: true,
  })

  hasMore = docs.length === 100

  for (const doc of docs) {
    // ... existing delete logic
  }
}
```

---

## Post-Implementation Checks

```bash
# Type check
pnpm tsc --noEmit

# Lint
pnpm lint

# Unit tests (especially rate limiter)
pnpm test:unit

# Generate types
pnpm generate:types

# Build
pnpm build
```

---

## Commit Message

```
fix: Address critical and high-priority issues in blob upload feature

- Fix rate limiter counter (was a no-op)
- Add unique constraint on uploadSessionId to prevent duplicates
- Fix Zod schema to require uploadSessionId
- Prevent internal error messages from leaking to clients
- Use URL parsing for isVercelBlobUrl validation
- Fix stale closure in retry logic
- Remove dead code and add 429 to retryable statuses
- Convert ChatAssetUploads to Tailwind
- Fix clearAll to empty array instead of marking cancelled
- Add pagination to cron cleanup jobs
```
