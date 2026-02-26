# Build Agent Report: 260226-fix-react-keys

## Changes

- **src/ui/web/chat/hooks/useNotebookChat.ts** - Added `id: string` field to ChatMessage interface and added `id: crypto.randomUUID()` to all message creation sites (initial welcome message, loaded history messages, user messages, streaming placeholder messages, sync assistant messages, reset welcome message, addAssistantMessage)

- **src/ui/web/chat/ChatInterface/index.tsx** - Changed message loop from `key={idx}` to `key={msg.id}`, updated TTS messageId to use `msg.id` instead of `msg-${idx}`, changed nested media loop from `key={mediaIdx}` to `key={mediaItem.mediaId}`, changed nested chatAssets loop from `key={assetIdx}` to `key={asset.chatAssetId}`

- **src/ui/web/CollectionArchive/index.tsx** - Changed archive posts loop from `key={index}` to `key={result.slug}`, removed unused `index` parameter from map

- **tests/unit/hooks/useNotebookChat.test.ts** - Updated existing tests to use `expect.objectContaining()` to accommodate new `id` field in messages

## Tests Written

- **tests/unit/components/chat/ChatInterface-keys.test.tsx** - New test file with 8 tests:
  - ChatMessage has non-empty id string property
  - ChatMessage type has id as required string field
  - All message IDs are unique (no duplicates)
  - ChatInterface does NOT use key={idx} or key={index} for messages
  - ChatInterface uses key={msg.id} for messages
  - ChatInterface does NOT use key={mediaIdx} or key={assetIdx}
  - CollectionArchive uses key={result.slug} for posts
  - CollectionArchive does NOT use key={index} or key={i}

## Quality

- TypeScript: PASS
- Lint: PASS (only pre-existing warnings)
- Unit Tests: PASS (2398 tests)
