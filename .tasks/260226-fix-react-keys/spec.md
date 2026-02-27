# Specification (promoted)

Skipped via input_quality — taskify determined spec is unnecessary.

## Requirements

# Task

## Issue Title

[MEDIUM] Bug: Chat messages use array index as React key
## Description
The `ChatInterface` component uses array indices as React keys for messages and media items. When messages are streamed, deleted, or reordered, React can misidentify DOM elements causing flickering, animation glitches, or stale content.

## Files Affected
- `src/ui/web/chat/ChatInterface/index.tsx` — line 382: `key={idx}` for messages
- `src/ui/web/chat/ChatInterface/index.tsx` — line 395: `key={mediaIdx}` for nested media
- `src/ui/web/CollectionArchive/index.tsx` — line 20: `key={index}` for archive posts

## Expected Fix
Use stable identifiers:
```tsx
// Messages — use message ID
{messages.map((msg) => (
  <div key={msg.id}>{/* ... */}</div>
))}

// Archive — use post slug or ID
{posts.map((post) => (
  <Card key={post.slug || post.id} />
))}
```

## Steps to Test
1. Open a chat conversation
2. Send several messages rapidly
3. Before fix: messages may flicker or animate incorrectly during streaming
4. After fix: smooth, stable rendering

## Priority
MEDIUM — UI glitch during chat interactions


## Acceptance Criteria

- [ ] Fix applied as described in task.md
- [ ] TypeScript compilation passes
- [ ] Unit tests pass
