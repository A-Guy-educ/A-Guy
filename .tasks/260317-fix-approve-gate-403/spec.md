# Bug: Approval Gate Button Returns 403 Forbidden

## Problem
Clicking the approval gate button in the Cody dashboard returns:
```
api.ts:220  POST http://localhost:3000/api/cody/tasks/issue-822/actions 403 (Forbidden)
```

## Expected
Clicking "Approve" should post `/cody approve` as a comment on the GitHub issue and return success.

## Root Cause
The 403 originates from GitHub's API when the user's OAuth token (encrypted in the JWT session cookie) is used to call `issues.createComment()`. When the user's token has expired, been revoked, or lacks write permissions, the call fails and the error is passed through to the client without any fallback to the bot token.

## Fix Required
1. When the user's token returns 403 from GitHub, fall back to the bot token with actor attribution
2. Improve error handling to distinguish between user token failure and actual permission denial
