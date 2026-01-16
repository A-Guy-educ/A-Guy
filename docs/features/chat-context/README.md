# Chat Context & Long-Term Memory System

This directory contains documentation for the AI-powered chat context and long-term memory system.

## Overview

The memory system enables conversations to maintain context across sessions using:

1. **Running Summaries** - Compress old messages to save tokens
2. **Long-Term Memory** - Extract and store facts, preferences, decisions
3. **Vector Search** - Retrieve relevant memories using semantic similarity

## Documentation

### Getting Started

- **Atlas Configuration** - See `infra/atlas/` for vector index setup
- **Verification** - Run `pnpm verify:vector-index` to check index status

### Technical Documentation

- **[Specification](spec.md)** - System architecture and design
- **[Implementation Plan](plan.md)** - Step-by-step implementation guide

## Architecture

```
User Query
    ↓
[Recent Messages (20)]
    ↓
[Vector Search] → Retrieve relevant memories
    ↓
[Running Summary] → Context from older messages
    ↓
[Compose Prompt]
    ↓
AI Model → Response
    ↓
[Extract Memories] → Store for future use
    ↓
[Update Summary] → Compress if needed
```

## Key Features

### 1. Context Policy V1

**Deterministic ordering** of context elements:
1. System instructions
2. Running summary (compressed history)
3. Long-term memory items (semantic search)
4. Recent message window (last 20 messages)

### 2. Memory Extraction

AI extracts important information:
- **Preferences**: UI choices, learning styles, etc.
- **Decisions**: Important choices made
- **Facts**: Persistent information about user
- **Open Loops**: Unfinished tasks or questions
- **Profile**: Background info, roles, context
- **Constraints**: Limitations or requirements

### 3. Vector Search

MongoDB Atlas Vector Search with:
- **1536 dimensions** (text-embedding-3-small)
- **Cosine similarity** for semantic matching
- **Tenant isolation** (userId filtering)
- **Prefer-local policy** (conversation-scoped first)

### 4. Summary Maintenance

Automatic compression when conversation grows:
- Triggers at 40+ messages (normal)
- Triggers at 80+ messages (safety)
- Compresses older messages into summary
- Keeps last 20 messages for recency

## Collections

### `memory_items`

Long-term memory storage with vector embeddings.

**Key fields**:
- `userId` - Tenant isolation (scalar, not relationship)
- `conversationId` - Optional scope (scalar)
- `text` - Memory content (max 2000 chars)
- `embedding` - Vector (1536 dimensions)
- `type` - Category (preference, fact, decision, etc.)
- `importance` - Scale 1-5
- `status` - active or deprecated

**Security**:
- Users can only read their own memories
- Creation/update/delete restricted to admin (server-side)
- Vector search MUST filter by userId

### `conversations`

Chat history with running summaries.

**Key fields**:
- `user` - Relationship to users collection
- `exercise` - Relationship to exercises collection
- `messages` - Array of message objects
- `summary` - Compressed history
- `summaryUpdatedAt` - Last summary generation
- `summaryUntilTimestamp` - Summary coverage
- `contextPolicyVersion` - For future migrations

All memory features (summarization, extraction, retrieval) are enabled by default.

## Implementation

### Core Services

Located in `src/lib/ai/`:

- **`embeddings.ts`** - Generate vector embeddings (OpenAI)
- **`vector-search.ts`** - Query MongoDB Atlas vector search
- **`vector-index-check.ts`** - Runtime index verification
- **`memory-extraction.ts`** - Extract memories from conversations
- **`summary.ts`** - Generate conversation summaries
- **`maintenance.ts`** - Automatic summary maintenance
- **`context-policy.ts`** - Compose prompts with context

### Endpoints

- **`POST /api/agent/chat`** - Main chat endpoint with full context system

### Collections

- **`src/collections/MemoryItems.ts`** - Memory items collection
- **`src/collections/Conversations.ts`** - Conversations collection

## Testing

### Integration Tests

```bash
# Full memory system tests
pnpm test:int tests/int/memory-system.int.spec.ts

# Requires OPENAI_API_KEY in environment
```

### Manual Testing

```bash
# Verify vector index setup
pnpm verify:vector-index

# Test embeddings generation
pnpm tsx -e "import { generateEmbedding } from './src/lib/ai/embeddings.js'; console.log((await generateEmbedding('test')).embedding.length)"
```

## Monitoring

### Logs

The system logs key operations:

```
[VectorSearch] Retrieved memories - Shows retrieval metrics
[MemoryExtraction] Extracted N candidates - Shows extraction results
[Summary] Generated summary - Shows summary generation
✅ Vector search index ready - Startup check passed
```

### Observability

Context usage is logged via `src/lib/ai/observability.ts`:
- Summary presence and length
- Memory retrieval counts (local vs global)
- Message window size
- Policy version

## Performance

### Token Usage

Typical prompt with full context:
- System instructions: ~200 tokens
- Running summary: ~300 tokens
- Memory items (8): ~400 tokens
- Recent messages (20): ~2000 tokens
- **Total**: ~3000 tokens per request

### Latency

- Vector search: ~50-200ms (MongoDB Atlas)
- Embedding generation: ~200-500ms (OpenAI)
- Summary generation: ~2-5s (OpenAI)

### Costs

- Embeddings: $0.02 per 1M tokens (~$0.01 per 100 conversations)
- Chat completion: Varies by model
- MongoDB Atlas: M10 starts at ~$60/month

## Security

### Critical Patterns

1. **Tenant Isolation**: Always filter by userId in vector search
2. **Access Control**: Users can only read their own memories
3. **Validation**: Embeddings must be exactly 1536 dimensions
4. **Deduplication**: Check similarity before creating memories

### Security Checklist

- [ ] Vector search filters by userId
- [ ] Memory items creation restricted to server-side
- [ ] Embeddings dimension validated (1536)
- [ ] No memory leakage between users
- [ ] Index has filter fields for userId

## Troubleshooting

### Common Issues

**"Vector search index not ready"**
→ Run `pnpm verify:vector-index` or check `infra/atlas/` configuration

**"OPENAI_API_KEY not set"**
→ Add to `.env` file

**"SearchNotEnabled"**
→ Upgrade to MongoDB Atlas M10+ cluster

**No memories retrieved**
→ Check memories exist for user, verify index is Active

## Resources

- [MongoDB Atlas Vector Search](https://www.mongodb.com/docs/atlas/atlas-search/vector-search/)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [Payload CMS Collections](https://payloadcms.com/docs/configuration/collections)

## Contributing

When modifying the memory system:

1. Update relevant documentation files
2. Run integration tests
3. Update CHANGELOG.md
4. Consider feature flag rollout strategy
5. Monitor token usage and costs

