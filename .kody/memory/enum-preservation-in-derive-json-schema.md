---
name: enum-preservation-in-derive-json-schema
title: Enum Preservation In Derive Json Schema
type: decision
source: task:1747
recorded_at: 2026-05-24T08:48:05Z
---

When deriveJsonSchemaFromValue encounters a short alphanumeric string (identifier-like), it now produces `{ type: 'string', enum: [value] }` instead of plain `{ type: 'string' }`. This enables reliable block-type detection in augmentBlocksSchema without a generic string fallback. Longer strings (>64 chars) remain plain `{ type: 'string' }`. **Why:** Without this, isQuestionBlockSchema could not distinguish question_* blocks from rich_text blocks in a heterogeneous array since both would produce identical `{ type: 'string' }` for their `type` field. **How to apply:** If you change deriveJsonSchemaFromValue's string handling, ensure block-type detection still works by verifying the heterogeneous-blocks test still passes.

**Source task:** `1747`
