# Task

## Description
Several catch blocks discard the original error, making debugging difficult. They either return null/generic message or show a toast without logging the actual error.

## Files Affected
| File | Line | Issue |
|------|------|-------|
| `src/server/repos/queries/exercises.ts` | 35-37 | `catch (_error) { return null }` — can't distinguish "not found" from "DB error" |
| `src/server/services/api/api-service.ts` | 123 | `catch (_error) { return { success: false, error: 'Network error' } }` |
| `src/server/services/api/api-service.ts` | 197 | Same pattern |
| `src/server/services/api/api-service.ts` | 235 | Same pattern |
| `src/ui/web/chat/hooks/useNotebookChat.ts` | 518, 571, 599 | `catch (_error) { toast.error(...) }` — no client-side logging |
| `src/ui/admin/exercise-conversion/ConvertForm/index.tsx` | 84 | `catch (_err) { setError('Queue failed') }` |

## Expected Fix
At minimum, log the error before handling:
```typescript
catch (error) {
  logger.error('Operation failed:', error)
  // Then return null / show toast / etc.
}
```

should also implement error in logger.

## Priority
LOW — Debugging experience, not user-facing
