## CI Fix for PR #1873 (branch 1849-p2-ask-page-never-finishes-loading-stuck-on-loadin)

### Root Cause of CI Failure
Two integration tests failed after schema and route changes on the branch:

**1. `chat-endpoint-validation.int.spec.ts` — "returns 400 for message length over 1000 chars"**
- The PR changed `chatRequestSchema` from `max(1000)` to `max(5000)` (to fix issue #1846).
- The test still sent 1001 chars and asserted 400, but 1001 is now valid → got 200.
- Fix: Updated test to send `5001` chars and assert 400.

**2. `message-persist.int.spec.ts` — "creates a conversation and persists message when no conversation exists"**
- The PR added conversation creation to the persist route (to fix issue #1847).
- The test used `contextKey = "lessons:nonexistent-123456789"` where the ID portion is not a real MongoDB ObjectId.
- Payload's relationship field validation rejects non-existent document references with HTTP 500.
- Fix: Changed to use `lessons:${testLessonId}-unique-${Date.now()}` — a real lesson ID with a unique suffix ensures the contextRef is valid while the contextKey is unique (no pre-existing conversation).

### Files Changed
- `tests/int/chat-endpoint-validation.int.spec.ts` — test now uses 5001-char message instead of 1001-char
- `tests/int/message-persist.int.spec.ts` — test now uses `testLessonId` with unique suffix instead of fake non-existent ID
