# Task 1964: Send Button Not Enabling After Text Input

## What was done

1. **E2E test infrastructure investigation**: Spent significant time trying to get E2E tests to navigate to the protected `/ask` route. Key findings:
   - Middleware (`src/middleware.ts:82-86`) requires `payload-token` cookie for `/ask` route
   - `RequireCourseSelection` component checks localStorage for user profile with `gradeLevel`
   - Both auth cookie AND localStorage profile must be set before navigating to `/ask`
   - Cookie domain mismatch (`localhost` vs `127.0.0.1`) was causing auth failures

2. **Test file updated**: `tests/e2e/ask-send-button-simple.e2e.spec.ts`
   - Uses `setupAuthenticatedUser()` to set `payload-token` cookie
   - Sets localStorage user profile for `RequireCourseSelection`
   - Uses `localhost` instead of `127.0.0.1` to match cookie domain

3. **Code analysis** of send button disabled logic in `src/ui/web/chat/ChatInterface/index.tsx:808-813`:
   ```tsx
   disabled={
     isLoading ||
     isDirectUploading ||
     (!inputValue.trim() && completedChatAssetIds.length === 0) ||
     !!(currentUser && !isAdmin && quota.isLimitReached)
   }
   ```
   - Logic appears correct: typing text should make `inputValue.trim()` truthy, enabling button
   - Potential issue: if `isLoading`, `isDirectUploading`, or quota is exceeded, button stays disabled

## Why outcome is "partial"

- Cannot navigate to `/ask` in test environment due to combined auth + middleware complexity
- Tests timeout or redirect to login/home
- Code analysis cannot confirm actual bug existence
- No QA evidence (screenshot) accessible in current environment

## What needs to happen next

1. **Debug auth flow**: The test correctly sets up auth but still redirects. Need to verify cookie is being sent with requests to `/ask`

2. **Alternative approach**: Consider testing via API or creating a simpler unit test that tests the send button disabled logic directly

3. **If bug confirmed**: Focus on conditions that could keep button disabled:
   - `isLoading` stuck true (check API response handling)
   - `isDirectUploading` stuck true (check file upload completion)
   - `quota.isLimitReached` true unexpectedly (check quota API response)

## Key files

- `src/ui/web/chat/ChatInterface/index.tsx:808-813` - Send button disabled condition
- `src/ui/web/chat/hooks/useNotebookChat.ts:96` - `inputValue` state initialization
- `src/ui/web/chat/hooks/useNotebookChat.ts:354-356` - `handleInputChange` function
- `src/ui/web/chat/hooks/useChatQuota.ts:42` - `isLimitReached` computation
- `src/middleware.ts:82-86` - Auth guard for protected routes
- `tests/e2e/ask-send-button-simple.e2e.spec.ts` - Current test attempt