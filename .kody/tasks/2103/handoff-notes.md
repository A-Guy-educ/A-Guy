# Issue #2103 Implementation Notes

## What was done

Implemented guide/teacher mode for the global floating agent button as specified in the issue.

### Files changed

1. **`src/server/services/user-learning-context.ts`**
   - Added `LessonContext` interface with lessonId, title, slug, courseSlug, chapterSlug, exerciseCount, topicDescription, lessonUrl
   - Added `lessonContext: LessonContext | null` to `UserLearningContext`
   - Added `fetchLessonContext()` function that queries a lesson by course/chapter/lesson slugs and returns exercise count, topic, and URL
   - Updated `buildUserContextBlock()` to include lesson context in the user prompt block
   - Fixed pino child logger `log.debug` call to use correct signature: `log.debug({ ...params, detail: 'message' })` instead of `log.debug('message', params)` (pino child logger narrows debug type to only accept object-first signature)

2. **`src/server/payload/endpoints/agent/learning-chat.ts`**
   - Extended `learningChatRequestSchema` with `mode: z.enum(['guide', 'teacher'])`, `courseSlug`, `lessonSlug`, `chapterSlug` fields
   - Updated `fetchUserLearningContext` call to pass lesson context params when in guide mode with all three slugs
   - Split `buildLearningChatSystemInstructions` into two branches:
     - **guide mode**: emphasizes navigation questions, exercise counts, topic info, and direct links
     - **teacher mode**: original personal learning assistant behavior

3. **`src/ui/web/learning-agent/AgentChatWindow/index.tsx`**
   - Added URL-based mode detection: teacher mode on lesson/exam pages, guide mode on all others
   - Added URL parsing to extract `courseSlug`, `chapterSlug`, `lessonSlug` from lesson URLs
   - Passes all context params (`mode`, `courseSlug`, `chapterSlug`, `lessonSlug`) to the API

4. **`tests/unit/server/services/user-learning-context.test.ts`** (new file)
   - Tests for `fetchUserLearningContext` including lesson context fetching
   - Tests for `fetchLessonContext` including null handling, correct structure, error handling
   - Tests for `buildUserContextBlock` including lesson context rendering

## Key design decisions

- Mode detection is URL-based (automatic, no user choice needed per spec)
- Teacher mode is the default (backward compatible with existing behavior)
- Lesson context is only fetched when in guide mode AND all three slugs are present
- Guide mode system prompt emphasizes navigation/usefulness rather than teaching

## Followups

- Welcome message per mode not implemented (mode detected on send, not on open)
- gradeLevel hardcoded as '7' in AgentChatWindow (existing issue, not regression)
