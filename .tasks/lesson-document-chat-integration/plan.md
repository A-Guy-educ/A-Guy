# Implementation Plan: AI-Powered Lesson Document Chat Integration

## Overview

Integrate AI-powered document extraction into the chat endpoint to automatically process PDF lesson materials and enable semantic search over document content. When a student sends their first message in a lesson conversation, the system will:

1. Extract structured content from lesson PDFs using Claude API (with vision)
2. Chunk the content semantically based on AI-extracted structure
3. Store chunks as memory items with embeddings for vector search
4. Retrieve relevant document chunks during chat to provide context-aware answers

**Key Design Decision**: Use Claude's PDF + vision capabilities instead of traditional pdf-parse for better understanding of educational content, diagrams, and document structure.

---

## Architecture Integration Points

### Current Chat Flow (13 Steps)

```
1. Auth Check
2. Request Validation
3. Find/Create Conversation
4. Persist User Message
5. (Not executed)
6. Get Recent Window
7. Retrieve Memory Items          ← ADD: Document memory retrieval
8. Compose Prompt
9. Call AI Model
10. Persist Assistant Response
11. Log Context Usage
12. Background: Summary Maintenance
13. Background: Memory Extraction  ← ADD: Document extraction job
```

### New Integration Points

**Step 3.5 (NEW)** - Check for Document Extraction Need:

- After conversation is found/created
- Check if first message in lesson conversation
- Check if lesson has PDF contentFiles
- Check if document memories already exist
- Trigger extraction if needed (non-blocking)

**Step 7 (MODIFY)** - Enhanced Memory Retrieval:

- Current: Retrieves conversation + global memories (8 total)
- Add: Document-specific memory retrieval with type filter
- Maintain prefer-local policy for document chunks
- Keep graceful degradation on failures

**Step 13 (ADD)** - Document Extraction Job:

- Parallel to existing memory extraction
- Downloads PDF from Vercel Blob
- Sends to Claude API for structured extraction
- Chunks by semantic boundaries (sections/concepts)
- Generates embeddings and stores as memory items
- Caches extraction results by file hash

---

## Implementation Steps

### Phase 1: Core Infrastructure

#### 1.1 Add Anthropic SDK Dependency

**File**: `package.json`

```bash
pnpm add @anthropic-ai/sdk
```

**Verification**: Package should be added to dependencies

---

#### 1.2 Create AI Document Extractor Service

**File**: `src/lib/ai/services/ai-document-extractor.ts` (NEW)

**Purpose**: Extract structured content from PDFs using Claude API

**Key Functions**:

```typescript
/**
 * Extract structured content from PDF using Claude API
 * @param pdfBuffer - Raw PDF buffer
 * @param fileName - Original file name for context
 * @returns Structured extraction result with sections, topics, etc.
 */
export async function extractDocumentContent(
  pdfBuffer: Buffer,
  fileName: string,
): Promise<DocumentExtractionResult>

/**
 * Result type from AI extraction
 */
export interface DocumentExtractionResult {
  title: string
  sections: Array<{
    heading: string
    content: string
    keyPoints: string[]
  }>
  topics: string[]
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  estimatedReadingTime?: number
}
```

**Implementation Details**:

- Use Anthropic SDK with `claude-3-5-sonnet-20241022` model
- Send PDF as base64-encoded document in message
- Use structured prompt requesting JSON output
- Timeout: 30 seconds per document
- Error handling: Return empty result on failure (graceful degradation)

**Prompt Structure**:

```
You are extracting educational content from a PDF document.

Extract the following as JSON:
{
  "title": "Document title",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Full section text (preserve key info)",
      "keyPoints": ["Key concept 1", "Key concept 2"]
    }
  ],
  "topics": ["Topic 1", "Topic 2"],
  "difficulty": "beginner|intermediate|advanced",
  "estimatedReadingTime": minutes
}

Focus on:
- Preserving technical content and examples
- Identifying clear section boundaries
- Extracting key concepts and definitions
- Maintaining context for Q&A
```

**Dependencies**:

- `@anthropic-ai/sdk`
- Environment variable: `ANTHROPIC_API_KEY`

---

#### 1.3 Create Extraction Cache Service

**File**: `src/lib/ai/extraction-cache.ts` (NEW)

**Purpose**: Cache AI extraction results to avoid duplicate API calls

**Implementation Strategy**: In-memory cache (simple Map)

- Key: SHA-256 hash of PDF buffer
- Value: Extraction result + timestamp
- TTL: 1 hour
- Eviction: Lazy (check on get)

**Key Functions**:

```typescript
/**
 * Get cached extraction result by file hash
 */
export function getCachedExtraction(fileHash: string): DocumentExtractionResult | null

/**
 * Store extraction result in cache
 */
export function setCachedExtraction(fileHash: string, result: DocumentExtractionResult): void

/**
 * Generate file hash from buffer
 */
export function generateFileHash(buffer: Buffer): string
```

**Future Enhancement**: Could be replaced with Redis for production at scale

---

#### 1.4 Create Document Memory Service

**File**: `src/lib/ai/document-memory-service.ts` (NEW)

**Purpose**: Orchestrate document extraction → chunking → memory storage

**Key Functions**:

```typescript
/**
 * Process lesson documents and create memory items
 * - Downloads PDFs from Vercel Blob
 * - Extracts content via Claude API
 * - Chunks content by sections (respecting 2000 char limit)
 * - Generates embeddings
 * - Stores as memory items with type='document'
 */
export async function processLessonDocuments(
  payload: Payload,
  userId: string,
  conversationId: string,
  lessonId: string,
): Promise<DocumentProcessingResult>

/**
 * Check if lesson has PDF files to process
 */
export async function hasProcessableDocuments(payload: Payload, lessonId: string): Promise<boolean>

/**
 * Check if document memories already exist for conversation
 */
export async function hasExistingDocumentMemories(db: Db, conversationId: string): Promise<boolean>

/**
 * Chunk extracted content by sections, respecting 2000 char limit
 */
function chunkDocumentContent(extractedContent: DocumentExtractionResult): DocumentChunk[]

export interface DocumentChunk {
  text: string // Max 2000 chars
  sectionTitle: string
  chunkIndex: number
  topics: string[]
}
```

**Chunking Strategy**:

1. Process sections sequentially
2. If section content <= 2000 chars: Single chunk
3. If section content > 2000 chars: Split at paragraph boundaries
4. Each chunk gets metadata: `sectionTitle`, `chunkIndex`, `topics`

**Memory Item Structure**:

```typescript
{
  userId: string
  conversationId: string
  type: 'document'                    // New memory type
  text: string                        // Chunk content (max 2000)
  embedding: number[]                 // 1536-dim vector
  importance: 5                       // Highest priority for source material
  status: 'active'
  source: {
    sourceConversationId: string
    sourceMessageTimestamp: Date
    sourceMessageRole: 'assistant'    // Background job
    // Document-specific fields:
    lessonId: string
    fileName: string
    chunkIndex: number
    sectionTitle: string
    topics: string[]
  }
}
```

**Error Handling**:

- PDF download fails: Log error, continue chat
- Claude API fails: Log error, continue chat
- Embedding fails: Log error, queue retry (optional)
- Network timeout: 30s max, then fail gracefully

---

### Phase 2: Chat Endpoint Integration

#### 2.1 Modify Chat Endpoint - Add Document Extraction Check

**File**: `src/endpoints/agent/chat.ts`

**Location**: After Step 3 (conversation creation), before Step 4 (persist message)

**Changes**:

```typescript
// NEW: Step 3.5 - Check for document extraction need
if (contextType === 'lesson' && !existingConv.docs.length) {
  // First message in new lesson conversation
  const lessonId = validated.lessonId!

  // Check if lesson has PDFs to process
  const hasDocuments = await hasProcessableDocuments(req.payload, lessonId)

  if (hasDocuments) {
    const db = (req.payload.db as any).connection.db

    // Check if already processed
    const hasMemories = await hasExistingDocumentMemories(db, conversationId)

    if (!hasMemories && featureFlags.DOCUMENT_EXTRACTION_ENABLED) {
      reqLogger.info({ lessonId, conversationId }, 'Triggering document extraction')

      // Trigger extraction (non-blocking)
      processLessonDocuments(req.payload, req.user.id, conversationId, lessonId).catch((err) => {
        reqLogger.error({ err, lessonId, conversationId }, 'Document extraction failed')
      })
    } else {
      reqLogger.debug('Document memories already exist or extraction disabled')
    }
  } else {
    reqLogger.debug({ lessonId }, 'No PDF documents found for lesson')
  }
}
```

**Key Points**:

- Only runs on first message in NEW lesson conversations
- Non-blocking (Promise not awaited)
- Graceful: Chat continues even if extraction fails
- Feature flag controlled

---

#### 2.2 Modify Memory Retrieval - Include Document Memories

**File**: `src/lib/ai/vector-search.ts`

**Changes**: No changes needed! Document memories use same vector search.

**Why**: Memory items with `type='document'` are automatically included in vector search. The existing prefer-local policy works perfectly:

- Document chunks are conversation-scoped (have conversationId)
- They compete with other memories in the 4 local + 4 global slots
- Higher importance (5) means they rank higher

**Optional Enhancement** (future): Could add type-specific retrieval to guarantee document context:

```typescript
// Retrieve 4 document-specific + 4 general memories
const documentQuery = { ...baseFilter, type: { $eq: 'document' } }
```

---

### Phase 3: Feature Flags & Environment

#### 3.1 Add Feature Flags

**File**: `src/lib/feature-flags.ts`

**Changes**:

```typescript
export const featureFlags = {
  // ... existing flags
  DOCUMENT_EXTRACTION_ENABLED: process.env.DOCUMENT_EXTRACTION_ENABLED === 'true',
} as const
```

**Environment Variable**:

```bash
# .env
DOCUMENT_EXTRACTION_ENABLED=true
ANTHROPIC_API_KEY=sk-ant-...
```

---

### Phase 4: Testing Infrastructure

#### 4.1 Create Test Fixtures

**PDF Fixtures**: `tests/fixtures/pdfs/`

- `sample-lesson.pdf` - 3 pages, ~2000 chars (single chunk test)
- `long-lesson.pdf` - 10 pages, ~10,000 chars (multi-chunk test)
- `empty.pdf` - 0 text content (edge case)
- `corrupted.pdf` - Invalid PDF structure (error handling)

**Mock Claude Responses**: `tests/fixtures/ai-extractions/`

- `sample-lesson-extraction.json`:

```json
{
  "title": "Introduction to Variables",
  "sections": [
    {
      "heading": "What are Variables?",
      "content": "Variables are named containers...",
      "keyPoints": ["Storage", "Declaration", "Assignment"]
    }
  ],
  "topics": ["programming basics", "variables", "data types"],
  "difficulty": "beginner"
}
```

- `long-lesson-extraction.json` - Multi-section response
- `empty-extraction.json` - Minimal/empty response

---

#### 4.2 Integration Test Suite

**File**: `tests/int/lesson-document-chat.int.spec.ts` (NEW)

**Test Structure**:

```typescript
describe('Lesson Document Chat Integration', () => {
  // Setup: Create test lesson with PDF contentFiles
  // Setup: Mock Claude API responses
  // Setup: Mock Vercel Blob fetch

  describe('Happy Path', () => {
    test('should extract and store document content on first message', async () => {
      // Given: Lesson with PDF
      // When: Send first message
      // Then: Memory items created with type='document'
      // Then: Items have correct structure and metadata
    })

    test('should retrieve document memories in chat context', async () => {
      // Given: Document memories exist
      // When: Ask question about document content
      // Then: Vector search returns relevant chunks
      // Then: Chat response uses document context
    })

    test('should chunk large documents respecting 2000 char limit', async () => {
      // Given: PDF with 10,000+ chars
      // When: Extraction and chunking
      // Then: Multiple memory items created
      // Then: Each chunk <= 2000 chars
      // Then: Chunks have sequential indexes
    })
  })

  describe('Edge Cases', () => {
    test('should skip extraction when lesson has no PDFs', async () => {
      // Given: Lesson with only images
      // When: First message
      // Then: No document extraction triggered
      // Then: Chat works normally
    })

    test('should skip extraction when memories already exist', async () => {
      // Given: Document memories already present
      // When: First message in existing conversation
      // Then: No new extraction
      // Then: Uses existing memories
    })

    test('should handle empty PDFs gracefully', async () => {
      // Given: PDF with no extractable content
      // When: Extraction attempted
      // Then: Warning logged
      // Then: Chat continues without document context
    })
  })

  describe('Failures', () => {
    test('should continue chat when Claude API fails', async () => {
      // Given: Claude API returns error
      // When: First message processing
      // Then: Error logged
      // Then: Chat response successful
      // Then: No document memories created
    })

    test('should continue chat when embedding generation fails', async () => {
      // Given: Extraction successful, OpenAI fails
      // When: Creating memory items
      // Then: Chat continues
      // Then: Error logged with retry suggestion
    })
  })

  describe('Security', () => {
    test('should enforce conversation-level isolation', async () => {
      // Given: User A has conversation with doc memories
      // When: User B queries their conversation
      // Then: User B cannot access User A's memories
      // Then: Verified via vector search filters
    })

    test('should respect lesson access control', async () => {
      // Given: User without lesson access
      // When: Attempt to start conversation
      // Then: 403 error
      // Then: No extraction or storage occurs
    })
  })

  describe('Performance', () => {
    test('should process extraction asynchronously', async () => {
      // Given: First message sent
      // When: Chat endpoint called
      // Then: Response received < 3s
      // Then: Extraction runs in background
    })

    test('should cache extraction results', async () => {
      // Given: PDF already extracted (cache hit)
      // When: Second user starts conversation
      // Then: No Claude API call
      // Then: Uses cached result
      // Then: Cache hit logged
    })
  })
})
```

**Mocking Strategy**:

- Mock `@anthropic-ai/sdk`: Return fixture JSON responses
- Mock `openai.embeddings.create`: Return deterministic vectors
- Mock Vercel Blob fetch: Return fixture PDF buffers
- Real MongoDB: Vector search must work end-to-end

---

### Phase 5: Documentation Updates

#### 5.1 Update AGENTS.md

**File**: `docs/AGENTS.md`

**Section to Add**: "AI Document Extraction Pattern"

**Content**:

````markdown
## AI Document Extraction for Lesson Context

When students interact with lesson content, the system automatically extracts and indexes PDF documents using Claude's vision capabilities.

### Architecture

1. **Trigger**: First message in lesson conversation
2. **Extraction**: Claude API processes PDF → structured JSON
3. **Chunking**: Content split by sections (semantic boundaries)
4. **Storage**: Chunks stored as memory items with type='document'
5. **Retrieval**: Vector search includes document chunks in context

### Service Layer

**AI Document Extractor** (`src/lib/ai/services/ai-document-extractor.ts`):

- Sends PDF to Claude API for structured extraction
- Returns sections, topics, key points
- 30s timeout, graceful failure

**Document Memory Service** (`src/lib/ai/document-memory-service.ts`):

- Orchestrates extraction → chunking → storage
- Semantic chunking by sections (max 2000 chars)
- Caches results by file hash (1 hour TTL)

### Memory Item Structure

```typescript
{
  type: 'document',
  importance: 5,        // Highest priority
  source: {
    lessonId: string,
    fileName: string,
    chunkIndex: number,
    sectionTitle: string,
    topics: string[]
  }
}
```
````

### Error Handling

All failures are graceful - chat continues without document context:

- PDF download fails → Log error, skip
- Claude API error → Log error, skip
- Embedding fails → Log error, skip (optional retry)

### Caching Strategy

Extraction results cached in-memory by file hash:

- TTL: 1 hour
- Eviction: Lazy on get
- Key: SHA-256 of PDF buffer
- Prevents duplicate API calls across users

````

---

## Critical Files Summary

### New Files (6)
1. `src/lib/ai/services/ai-document-extractor.ts` - Claude API integration
2. `src/lib/ai/document-memory-service.ts` - Orchestration layer
3. `src/lib/ai/extraction-cache.ts` - Caching layer
4. `tests/int/lesson-document-chat.int.spec.ts` - Integration tests
5. `tests/fixtures/pdfs/` - Test PDF files (4 files)
6. `tests/fixtures/ai-extractions/` - Mock responses (3 files)

### Modified Files (3)
1. `src/endpoints/agent/chat.ts` - Add Step 3.5 + background job
2. `src/lib/feature-flags.ts` - Add DOCUMENT_EXTRACTION_ENABLED
3. `docs/AGENTS.md` - Add documentation section

### No Changes Needed
- `src/lib/ai/vector-search.ts` - Works as-is with document type
- `src/lib/ai/context-policy.ts` - Works as-is with memory items
- `src/collections/MemoryItems.ts` - Schema supports document type

---

## Dependencies

### New Package
```json
{
  "@anthropic-ai/sdk": "^0.32.0"
}
````

### Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...
DOCUMENT_EXTRACTION_ENABLED=true
```

---

## Implementation Order

### Day 1: Core Services

1. Add Anthropic SDK dependency
2. Implement AI document extractor service
3. Implement extraction cache service
4. Implement document memory service (without chat integration)

### Day 2: Integration

5. Modify chat endpoint (Step 3.5 + background job)
6. Add feature flag
7. Manual testing with Postman/curl

### Day 3: Testing

8. Create test fixtures (PDFs + mock responses)
9. Write integration test suite (12 tests)
10. Run full test suite, fix any issues

### Day 4: Documentation & Polish

11. Update AGENTS.md
12. Add inline code comments
13. Final code review and cleanup
14. Run all quality gates (typecheck, lint, test)

---

## Verification & Testing

### Manual Testing Steps

1. **Setup**:

   ```bash
   # Set environment variables
   export ANTHROPIC_API_KEY=sk-ant-...
   export DOCUMENT_EXTRACTION_ENABLED=true

   # Start dev server
   pnpm dev
   ```

2. **Create Test Lesson**:
   - Go to `/admin/collections/lessons`
   - Create lesson with PDF in `contentFiles`
   - Note lesson ID

3. **Test First Message**:

   ```bash
   curl -X POST http://localhost:3000/api/agent/chat \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "message": "What is this lesson about?",
       "acknowledgment": "test",
       "lessonId": "<lesson-id>"
     }'
   ```

4. **Verify Extraction**:
   - Check logs for "Triggering document extraction"
   - Check logs for "Memory extraction completed"
   - Query MongoDB:
     ```javascript
     db.memory_items.find({
       conversationId: '<conv-id>',
       type: 'document',
     })
     ```

5. **Test Retrieval**:
   - Send second message asking about document content
   - Check logs for memory retrieval including document items
   - Verify chat response references document content

### Integration Test Execution

```bash
# Run all integration tests
pnpm test:int

# Run specific test file
pnpm exec vitest run tests/int/lesson-document-chat.int.spec.ts --config ./vitest.config.mts

# Watch mode for TDD
pnpm test:watch lesson-document-chat
```

### Quality Gates

All must pass:

```bash
pnpm typecheck          # No TypeScript errors
pnpm lint               # No ESLint errors
pnpm format:check       # Code formatted
pnpm test:int           # All integration tests pass
pnpm build              # Production build succeeds
```

---

## Rollback Plan

### Immediate Rollback

1. Set `DOCUMENT_EXTRACTION_ENABLED=false`
2. Chat continues without document context
3. No data deletion needed (memories remain)

### Full Rollback

1. Revert PR (single commit)
2. Remove Anthropic SDK: `pnpm remove @anthropic-ai/sdk`
3. Existing conversations unaffected

### Data Cleanup (Optional)

```javascript
// Remove all document-type memories
db.memory_items.deleteMany({ type: 'document' })
```

---

## Risk Mitigation

### Performance Risks

- **Risk**: Claude API slow (10-30s per PDF)
- **Mitigation**: Non-blocking execution, chat proceeds immediately
- **Monitoring**: Log extraction latency, set 30s timeout

### Cost Risks

- **Risk**: Claude API costs (~$0.03-0.10 per PDF)
- **Mitigation**: Cache extraction results by file hash (1 hour TTL)
- **Mitigation**: Skip if document memories already exist
- **Monitoring**: Log Claude API call count and cache hit rate

### Quality Risks

- **Risk**: Poor extraction breaks Q&A
- **Mitigation**: Structured prompt with JSON schema
- **Mitigation**: Server-side validation of extraction results
- **Testing**: Integration tests verify retrieval precision

### Storage Risks

- **Risk**: Large lessons create many memory items
- **Mitigation**: Chunk limit (max 50 chunks per document)
- **Mitigation**: 2000 char limit per chunk (enforced)
- **Monitoring**: Track memory item count per conversation

---

## Success Criteria

### Functional

- ✅ First message in lesson conversation triggers extraction
- ✅ PDFs extracted and chunked correctly (<= 2000 chars)
- ✅ Document memories stored with correct metadata
- ✅ Vector search retrieves relevant document chunks
- ✅ Chat responses reference document content
- ✅ All 12 integration tests pass

### Non-Functional

- ✅ Chat response time < 3s (extraction non-blocking)
- ✅ Extraction cached to prevent duplicate API calls
- ✅ Graceful failure handling (chat continues on errors)
- ✅ Access control enforced (conversation-scoped isolation)
- ✅ All quality gates pass (typecheck, lint, format, build)

### Documentation

- ✅ AGENTS.md updated with extraction patterns
- ✅ Inline comments explain chunking and caching
- ✅ Error handling documented in service layer

---

## Notes

### Why Claude Over pdf-parse?

Traditional PDF parsing (pdf-parse, pdfjs-dist):

- Extracts raw text mechanically
- Struggles with complex layouts, tables, diagrams
- No understanding of content hierarchy
- Manual work to structure for Q&A

AI extraction (Claude with vision):

- Understands document structure semantically
- Handles complex layouts intelligently
- Extracts structured content (sections, concepts, key points)
- Better semantic chunking for Q&A
- Works with images, diagrams, charts

**Cost**: ~$0.03-0.10 per document (one-time)
**Quality**: Significantly better for educational Q&A

### Memory Item Reuse

Document memories use the existing `MemoryItems` collection:

- No schema changes needed
- Same vector search infrastructure
- Type-based discrimination (`type: 'document'`)
- Consistent with existing patterns

### Future Enhancements

1. **Redis Cache**: Replace in-memory cache for production scale
2. **Retry Queue**: Background retry for failed embeddings
3. **Document Updates**: Track PDF versions, re-extract on changes
4. **OCR Support**: Add scanned PDF support via Gemini vision
5. **Analytics**: Track document access patterns, popular chunks
6. **Admin UI**: View/edit document memories in admin panel
