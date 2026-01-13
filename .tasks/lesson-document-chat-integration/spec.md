# Task: Lesson Document Chat Integration

## 1. Scope

```yaml
Feature: Automatic lesson document integration with chat context
Type: feature
Impact: high
```

**Description**: When a student sends their first message in a lesson conversation, the system should automatically extract structured content from the lesson's PDF documents using AI (Claude with vision), store it as memory items, and make it available for semantic retrieval. This enables the AI to answer questions with high precision based on the actual document content, with better understanding of document structure, diagrams, and educational hierarchy than traditional PDF parsing.

---

## 2. Behaviors to Cover

### Happy Path

1. **Should extract and store document content when user sends first message in lesson conversation**
   - Given: Lesson has contentFiles with PDFs
   - When: User sends first message in conversation
   - Then: PDF sent to Claude API for structured extraction, parsed content chunked, and stored as MemoryItems with metadata

2. **Should retrieve document memories when answering questions about document content**
   - Given: Document memories exist for conversation
   - When: User asks question about document topic
   - Then: Vector search retrieves relevant document chunks in context

3. **Should chunk large documents into multiple memory items respecting 2000 char limit**
   - Given: AI extracts structured content with 10,000+ characters
   - When: Processing for memory storage
   - Then: Creates 5+ memory items with semantic chunking by sections/concepts

### Edge Cases

4. **Should skip document extraction when lesson has no PDF files**
   - Given: Lesson contentFiles contains only images/videos
   - When: First message sent
   - Then: Conversation proceeds without document extraction (no error)

5. **Should skip document extraction when conversation already has document memories**
   - Given: Conversation already has memory items with type='document'
   - When: First message sent
   - Then: Skips extraction, uses existing memories

6. **Should handle empty or unreadable PDFs gracefully**
   - Given: PDF file exists but Claude returns empty/minimal content
   - When: AI extraction attempted
   - Then: Logs warning, continues chat without document context

### Failures

7. **Should continue chat when AI extraction fails**
   - Given: Claude API throws error (rate limit, timeout, corrupted PDF)
   - When: First message processing
   - Then: Chat responds normally, logs error, no document context added

8. **Should continue chat when embedding generation fails**
   - Given: AI extraction successful but OpenAI embedding API fails
   - When: Creating memory items
   - Then: Chat responds normally, logs error, retries embedding in background

### Security

9. **Should enforce conversation-level access control for document memories**
   - Given: User A has conversation with lesson document
   - When: User B queries their own lesson conversation
   - Then: User B cannot retrieve User A's document memories (isolated by conversationId)

10. **Should respect lesson access control before extracting documents**
    - Given: User does not have access to lesson
    - When: Attempting to start conversation
    - Then: Returns 403, does not extract or store document content

### Performance

11. **Should process AI extraction asynchronously without blocking chat response**
    - Given: User sends first message
    - When: Chat response generation starts
    - Then: AI extraction runs in background, first response sent within 3s

12. **Should cache AI extraction results to avoid duplicate API calls**
    - Given: PDF file already processed by Claude API
    - When: Same lesson conversation started by different user
    - Then: Uses cached structured content, no duplicate AI extraction (keyed by file hash)

---

## 3. Expected Outcomes

**Behavior 1 → Outcome**:

- Database: MemoryItems collection contains records with:
  - `userId`: Current user ID
  - `conversationId`: Current conversation ID
  - `type`: 'document'
  - `text`: Chunk of structured content (~1500-2000 chars)
  - `embedding`: 1536-dim vector
  - `importance`: 5 (highest for source material)
  - `status`: 'active'
  - `source`: { conversationId, lessonId, fileName, chunkIndex, timestamp, sectionTitle, topics }
- Count: 1+ memory items (depends on document length)
- Cache: Extracted content stored in cache with file hash key (Redis or in-memory)

**Behavior 2 → Outcome**:

- API: Chat response includes content that references document text
- Logs: Context usage includes document memory items with source citations

**Behavior 3 → Outcome**:

- Database: Multiple MemoryItems with same conversationId, sequential chunkIndex
- Each item: `text.length <= 2000`
- Chunking: Respects section/concept boundaries (semantic chunking based on AI-extracted structure)

**Behavior 4 → Outcome**:

- Database: No document-type memory items created
- API: 200 response with chat answer
- Logs: Info log "No PDF documents found for lesson {lessonId}"

**Behavior 5 → Outcome**:

- Database: No new memory items created (count unchanged)
- Query: `db.memory_items.countDocuments({ conversationId: X, type: 'document' })` > 0
- Logs: Debug log "Document memories already exist, skipping extraction"

**Behavior 6 → Outcome**:

- API: 200 response with chat answer
- Logs: Warn log "Claude returned minimal content for PDF {fileName}"
- Database: No memory items created for empty/minimal PDF

**Behavior 7 → Outcome**:

- API: 200 response with chat answer (no failure exposed to user)
- Logs: Error log with Claude API error details + stack trace
- Database: No document memory items created

**Behavior 8 → Outcome**:

- API: 200 response with chat answer
- Logs: Error log "Embedding generation failed, will retry in background"
- Background: Task queued to retry embedding generation

**Behavior 9 → Outcome**:

- Vector Search: Filter includes `{ conversationId: <user's conversation>, userId: <current user> }`
- Results: Only memories from user's own conversation returned
- Test: User B queries → 0 document memories from User A's conversation

**Behavior 10 → Outcome**:

- API: 403 response with message "Access denied to lesson"
- Database: No conversation created, no memory items created
- Logs: Security log "Unauthorized lesson access attempt by user {userId}"

**Behavior 11 → Outcome**:

- API: Chat response time < 3s (measured in integration test)
- Background: AI extraction task spawned with `Promise.allSettled()` (non-blocking)
- Logs: Two separate log entries with timestamps showing async execution

**Behavior 12 → Outcome**:

- Network: Single Claude API call per unique PDF (keyed by file hash)
- Cache: Structured content stored in cache with TTL (1 hour)
- Logs: Debug log showing "Using cached extraction for {fileHash}"

---

## 4. Out of Scope

**Explicitly excluded from this task:**

### Feature Exclusions

- Scanned PDF OCR extraction (Claude can read text PDFs, not scanned images)
- Video transcript extraction (future enhancement)
- Document summarization UI (will be handled by existing memory extraction)
- Admin UI for viewing/editing document memories
- Document version tracking (when lesson PDF updated)
- Multi-language translation (Claude extracts in original language)
- Document search/filtering UI

### Test Type Exclusions

- E2E tests (chat interaction tested at integration level)
- Performance benchmarks (extraction time variance too high for CI)
- Load testing (background processing behavior)

### Technical Exclusions

- Complex table extraction (Claude extracts structure, but complex tables may lose formatting)
- PDF form field extraction (only document content)
- Scanned/image-based PDFs (Claude requires text-based PDFs)
- PDF password/encryption handling (assume unprotected PDFs)
- Real-time document updates (extraction triggered once per conversation)

### Domain Exclusions

- Exercise-level document context (only lesson-level)
- Document access analytics (usage tracking)
- Document quality scoring (readability metrics)
- Citation generation (footnote/reference extraction)

---

## 5. Test Boundaries

```yaml
Test level: integration
Mocking: required (Claude API, OpenAI embedding API, Vercel Blob fetch)
External services: mocked (Claude for extraction, OpenAI for embeddings, network for PDF downloads)
Database: real (test MongoDB with vector search)
```

**Rationale**:

- Integration tests verify full flow: API request → AI extraction → memory creation → vector retrieval
- Mock Claude API to avoid cost and rate limits (use fixture structured JSON responses)
- Mock OpenAI to avoid cost and rate limits (use deterministic fake embeddings)
- Mock Vercel Blob fetch to avoid network dependency (use fixture PDF buffers)
- Real MongoDB required to test vector search indexing and retrieval
- No E2E needed - chat behavior already covered by existing chat integration tests

**Test Data**:

- Fixture PDFs: `tests/fixtures/pdfs/` directory
  - `sample-lesson.pdf` (3 pages, ~2000 chars, single chunk)
  - `long-lesson.pdf` (10 pages, ~10,000 chars, multi-chunk)
  - `empty.pdf` (0 pages, no text)
  - `corrupted.pdf` (invalid PDF structure)
- Mock Claude responses: `tests/fixtures/ai-extractions/` directory
  - `sample-lesson-extraction.json` (structured content for sample-lesson.pdf)
  - `long-lesson-extraction.json` (structured content for long-lesson.pdf)
  - `empty-extraction.json` (minimal content response)

---

## 6. Stop Conditions

**All tests must pass:**

- ✓ 12 behaviors → 12 integration tests passing
- ✓ `pnpm test:int` (all existing + new tests pass)
- ✓ `pnpm typecheck && pnpm lint && pnpm build` (no errors)
- ✓ `pnpm generate:types` (Payload types regenerated if collections modified)

**Code quality gates:**

- ✓ No unrelated test modifications
- ✓ No snapshot-only tests (all assertions explicit)
- ✓ All new code covered by tests (100% for new service layer)
- ✓ Error handling paths tested (failures don't crash)

**Functional completeness:**

- ✓ AI extraction service implemented and tested
- ✓ Structured content parsing and memory chunking respects 2000 char limit
- ✓ Vector search retrieves document memories correctly
- ✓ Background processing doesn't block chat response
- ✓ Access control enforced (conversation-scoped isolation)
- ✓ Extraction caching prevents duplicate API calls

**Documentation:**

- ✓ AGENTS.md updated with AI extraction patterns
- ✓ Inline code comments for structured content parsing and chunking
- ✓ Error handling documented in service layer
- ✓ Cache strategy documented

---

## 7. Deliverables

```yaml
Tests: 12 integration tests in tests/int/lesson-document-chat.int.spec.ts
CI: required (all tests must pass in GitHub Actions)
Docs: yes (AGENTS.md - add AI extraction service pattern)
i18n: no (error messages are server-side logs only)
Migrations: no (uses existing MemoryItems collection)
Types: yes (pnpm generate:types if Conversation schema changes)
```

**New Files**:

1. `src/lib/ai/services/ai-document-extractor.ts` - AI-powered document extraction using Claude
2. `src/lib/ai/document-memory-service.ts` - Document memory creation + retrieval with caching
3. `src/lib/ai/extraction-cache.ts` - Cache layer for AI extraction results
4. `tests/int/lesson-document-chat.int.spec.ts` - Integration test suite
5. `tests/fixtures/pdfs/` - Test PDF files (4 fixtures)
6. `tests/fixtures/ai-extractions/` - Mock Claude API responses (3 fixtures)

**Modified Files**:

1. `src/endpoints/agent/chat.ts` - Add AI extraction logic to Step 3-4
2. `src/lib/ai/context-policy.ts` - Document memory retrieval in compose step
3. `docs/AGENTS.md` - Add AI extraction service documentation

**Dependencies**:

- No new dependencies required (uses existing @anthropic-ai/sdk and @vercel/blob)

---

## 8. Risk & Rollback

### Breaking Changes

```yaml
Breaking: Chat responses may be delayed if AI extraction blocks
Blast radius: module (lesson conversations only)
Rollback: revert PR (feature flag: ENABLE_DOCUMENT_MEMORY)
Data safety: medium (large memory items created, quota impact)
Cost impact: medium (Claude API calls for extraction, OpenAI for embeddings)
```

**Risk Mitigation**:

1. **Performance risk**: Background processing prevents blocking
   - Mitigation: `Promise.allSettled()` + timeout (30s max per PDF for Claude API)
   - Fallback: Skip extraction, log error, chat continues

2. **Storage risk**: Large lessons create many memory items
   - Mitigation: Chunking limit (max 50 chunks per document)
   - Monitoring: Track memory item count per conversation

3. **Cost risk**: Claude API calls for extraction + OpenAI for embeddings
   - Mitigation: Cache extraction results by file hash (1 hour TTL)
   - Mitigation: Skip if document memories already exist
   - Monitoring: Log Claude API request count and cache hit rate
   - Estimated: ~$0.03-0.10 per document (one-time per unique PDF)

4. **Quality risk**: Claude API failures or poor extraction
   - Mitigation: Graceful degradation (chat continues without document context)
   - Mitigation: Structured extraction prompt with JSON schema
   - Testing: Verify retrieval precision with mock Claude responses

### Rollback Strategy

1. **Immediate rollback**: Revert PR (single commit)
2. **Feature flag**: `ENABLE_DOCUMENT_MEMORY=false` (env var)
3. **Data cleanup**: Document memories remain (no breaking change)
4. **Monitoring**: Track chat response latency in logs

### Data Safety

- **No destructive operations**: Only creates memory items
- **Idempotent**: Checks for existing memories before creating
- **User isolation**: Conversation-scoped, no cross-user contamination
- **Quota impact**: ~10-50 memory items per lesson conversation (within limits)

### Blast Radius

- **Affected**: Lesson conversations with PDF documents
- **Unaffected**: Exercise-only conversations, image-only lessons
- **Scope**: New conversations only (existing conversations unaffected)
- **Recovery**: Disable feature flag, chat continues without document context
