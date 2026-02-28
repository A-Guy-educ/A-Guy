# Conversation DELETE Endpoint Ownership Bypass Fix

## Overview
Fix a security vulnerability in the DELETE endpoint for conversations where any authenticated user can archive any other user's conversation.

## Requirements

### FR-1: Ownership Enforcement
The DELETE handler must verify that the conversation belongs to the requesting user before allowing archival.

### FR-2: Proper Access Control Usage
The DELETE handler should use Payload's built-in access control rather than bypassing it.

## Acceptance Criteria

- [ ] DELETE handler in `src/app/api/conversations/by-context/route.ts` uses `overrideAccess: false` and passes `user` to enforce ownership
- [ ] Any authenticated user cannot archive another user's conversation
- [ ] The `isOwner` access control in `Conversations` collection handles update operations correctly
- [ ] The `as any` cast in POST handler is removed/fixed
