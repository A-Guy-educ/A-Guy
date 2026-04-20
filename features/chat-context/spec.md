# Chat Context + Memory System Specification

## Overview

The chat context system provides intelligent context management for long-running conversations through:
- **Running summaries** of conversation history
- **Long-term memory** with vector search retrieval
- **Automatic maintenance** and memory extraction
- **Deterministic prompt composition** following Context Policy V1

---

## Architecture

### Core Components

1. **Context Policy** ([src/lib/ai/context-policy.ts](../../src/lib/ai/context-policy.ts))
   - Defines Context Policy V1 contract
   - Provides `composePrompt()` for deterministic prompt composition
   - Helper functions: `getRecentWindow()`, `buildRetrievalQuery()`, `needsSummaryMaintenance()`

2. **Summary Maintenance** ([src/lib/ai/maintenance.ts](../../src/lib/ai/maintenance.ts))
   - Compresses old messages into running summary
   - Triggers at threshold (40 messages)
   - Trims conversation to last 20 messages

3. **Memory Extraction** ([src/lib/ai/memory-extraction.ts](../../src/lib/ai/memory-extraction.ts))
   - Extracts important facts, preferences, decisions from conversations
   - Creates memory_items with embeddings
   - Deduplicates similar memories

4. **Memory Retrieval** ([src/lib/ai/vector-search.ts](../../src/lib/ai/vector-search.ts))
   - Vector search using MongoDB Atlas Search
   - Retrieves relevant local + global memories
   - Respects Top-K limits per Context Policy V1

5. **Observability** ([src/lib/ai/observability.ts](../../src/lib/ai/observability.ts))
   - Structured logging of context usage
   - Performance metrics (retrieval latency, token counts)
   - Prompt snapshots in development mode

---

## Context Policy V1

### Prompt Composition Order (CRITICAL)

The prompt MUST be composed in this exact order:

1. **System message** (static instructions)
2. **Conversation summary** (appended to system message if exists)
3. **Retrieved memory items** (Top-K, appended to system message)
4. **Recent messages window** (last N messages as individual messages)

**No ad-hoc insertions. No reordering. No message duplication.**

### Configuration Constants

```typescript
CONTEXT_POLICY_V1 = {
  recentWindowSize: 20,      // Last 20 messages kept
  memoryTopK: 8,             // Top 8 memories retrieved
  vectorCandidates: 200,     // Vector search candidates
  summaryThreshold: 40,      // Trigger at 40 messages
  safetyThreshold: 80,       // Emergency trigger at 80
}
```

### Implementation

Use `composePrompt()` to build prompts:

```typescript
import { composePrompt } from '@/lib/ai/context-policy'

const composedPrompt = composePrompt(systemInstructions, {
  systemMessage: systemInstructions,
  summary: conversation?.summary,
  memoryItems: retrievedMemories,
  recentMessages: recentWindow,
})

// composedPrompt.messages is ready for model
// composedPrompt.metadata contains observability data
```

---

All memory features (summary maintenance, extraction, retrieval) run by default.

---

## Data Models

### Conversation
```typescript
{
  id: string
  user: string
  exercise: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: string
  }>
  summary?: string              // Running summary
  contextPolicyVersion: 'v1'    // Policy version used
  lastMessageAt: string
}
```

### MemoryItem
```typescript
{
  _id: string
  userId: string
  conversationId?: string       // Local to conversation if set
  type: string                  // 'fact', 'preference', 'decision', etc.
  text: string                  // The actual memory content
  importance: number            // 1-5 scale
  embedding: number[]           // Vector embedding
  status: 'active' | 'deprecated'
  source: {
    conversationId: string
    messageIndex: number
    extractedBy: 'model'
  }
  createdAt: Date
  updatedAt: Date
}
```

---

## API Flow

### Chat Request Flow

1. **Authenticate** user
2. **Find or create** conversation
3. **Persist user message** to DB
4. **Reload** conversation (get updated messages)
5. **Get recent window** from persisted messages
6. **Retrieve memories** (if index available)
7. **Compose prompt** using `composePrompt()` with all context
8. **Call model** with composed prompt
9. **Persist assistant response**
10. **Log context usage** for observability
11. **Run background maintenance** (summary)
12. **Extract memories** in background

### Maintenance Flow (Background)

**Summary Maintenance**:
1. Check if `messages.length > summaryThreshold`
2. Get messages to summarize (all except last 20)
3. Call AI to generate/update summary
4. Update conversation: set summary, trim messages to last 20

**Memory Extraction**:
1. Get recent messages + existing summary
2. Call AI to identify important information
3. Generate embeddings for each memory
4. Deduplicate against existing memories
5. Persist new/updated memory items

---

## Vector Search

### Index Configuration

MongoDB Atlas Search index on `memory_items` collection:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "userId"
    },
    {
      "type": "filter",
      "path": "conversationId"
    },
    {
      "type": "filter",
      "path": "status"
    }
  ]
}
```

### Retrieval Strategy

1. **Build query** from last 3 user messages
2. **Generate embedding** for query text
3. **Search** with filters:
   - Local memories: `conversationId = current && status = 'active'`
   - Global memories: `userId = current && conversationId = null && status = 'active'`
4. **Combine** local + global (up to memoryTopK total)
5. **Return** with latency metrics

---

## Observability

### Context Usage Logs

```json
{
  "level": "info",
  "msg": "[Context Usage]",
  "conversationId": "...",
  "userId": "...",
  "policyVersion": "v1",
  "summary": {
    "present": true,
    "length": 245
  },
  "memory": {
    "localCount": 3,
    "globalCount": 2,
    "totalCount": 5,
    "retrievalLatencyMs": 127
  },
  "messages": {
    "windowSize": 20,
    "totalCount": 42
  },
  "featureFlags": {
    "summaryMaintenance": true,
    "memoryExtraction": true,
    "memoryRetrieval": true
  }
}
```

### Prompt Snapshots (Dev Mode)

```json
{
  "level": "debug",
  "msg": "[Prompt Snapshot]",
  "conversationId": "...",
  "systemMessageLength": 1234,
  "totalMessages": 21,
  "metadata": {
    "policyVersion": "v1",
    "summaryLength": 245,
    "memoryCount": 5,
    "messageCount": 20
  }
}
```

---

## Testing

### Unit Tests
- Context policy helpers
- Prompt composition
- Memory deduplication logic

### Integration Tests
- End-to-end chat flow
- Summary maintenance triggering
- Memory extraction and retrieval
- Vector search functionality

See [tests/int/memory-system.int.spec.ts](../../tests/int/memory-system.int.spec.ts)

---

## Rollout Plan

### Phase 1: Index Readiness (Week 1)
- Ensure vector index is ready
- Monitor: retrieval latency, relevance
- Verify: memories enhance context

### Phase 2: Production Monitoring (Week 2+)
- Memory features run by default
- Monitor end-to-end metrics
- Iterate on thresholds and configurations

---

## Performance Considerations

### Token Budget
- Summary reduces tokens from old messages
- Recent window capped at 20 messages
- Memory items limited to Top-K (8 items)
- System message includes summary + memories

### Latency
- Memory retrieval: ~100-200ms (vector search)
- Summary generation: ~1-2s (background, non-blocking)
- Memory extraction: ~2-3s (background, non-blocking)

### Storage
- Conversation messages trimmed regularly
- Memories deduplicated to prevent bloat
- Archived memories retained but not retrieved

---

## Security & Privacy

### Data Isolation
- Memories scoped by userId
- Conversation isolation via conversationId
- Local memories never cross conversations
- Global memories visible only to owner

### Access Control
- All operations require authentication
- Users can only access their own conversations
- Memory retrieval respects user boundaries

---

## Future Enhancements

1. **Multi-turn memory deduplication** - Cross-conversation deduplication
2. **Smart summary compression** - Hierarchical summaries for very long conversations
3. **Adaptive window sizing** - Adjust based on token budget
4. **Relevance scoring** - Track which memories were actually useful
5. **Memory expiration** - Auto-archive old/unused memories
6. **User memory controls** - Allow users to view/edit/delete memories

---

## References

- Implementation: [src/lib/ai/](../../src/lib/ai/)
- Tests: [tests/int/memory-system.int.spec.ts](../../tests/int/memory-system.int.spec.ts)
- Plan: [plan.md](./plan.md)
