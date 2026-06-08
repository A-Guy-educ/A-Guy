# Fix slow conversation load on /admin/chat (#2520)

## What changed

`src/server/payload/endpoints/agent/get-conversation.ts` — reduced `depth: 2` to `depth: 0` in the Payload query and updated the media/chatAssets message mapping to handle both string IDs (depth:0) and populated objects (depth:2+).

## Root cause

`depth: 2` in Payload causes recursive population of ALL relationship fields on the queried document and its nested subdocuments. For the `conversations` collection, this means:

- `contextRef` (polymorphic to 5 collections) gets fully populated at depth 1
- `messages` array subdocuments contain `media[].mediaId` and `chatAssets[].chatAssetId` relationship fields — at depth 2, each one triggers a separate DB query to the `media` and `chat-assets` collections

For a conversation with 100 messages × 5 media items, this could trigger 500+ extra DB queries per request, causing the ~2 min loading delay.

The endpoint only needs plain message text — no populated relationships — so `depth: 0` is correct. The messages array itself is a plain field unaffected by depth; the fix required updating the mapping to handle `mediaId`/`chatAssetId` as strings (depth:0) vs populated objects (depth:2+).

## Changes

- `get-conversation.ts:110` — `depth: 2` → `depth: 0`
- `get-conversation.ts:200-238` — media and chatAssets mapping updated with `typeof m.mediaId === 'object'` checks to handle both string IDs and populated objects
