# Task: Lesson Document Chat Integration

## 1. Scope

```yaml
Feature: Automatic lesson document integration with chat context
Type: feature
Impact: high
```

**Description**: When a student sends their first message in a lesson conversation, the system should automatically extract content from the lesson's PDF documents, store it as memory items, and make it available for semantic retrieval. This enables the AI to answer questions with high precision based on the actual document content.

---

## 2. Behaviors to Cover

### Happy Path

1. **Should extract and store document content when user sends first message in lesson conversation**
   - Given: Lesson has contentFiles with PDFs
   - When: User sends first message in conversation
   - Then: PDF text extracted, chunked, and stored as MemoryItems

2. **Should retrieve document memories when answering questions about document content**
   - Given: Document memories exist for conversation
   - When: User asks question about document topic
   - Then: Vector search retrieves relevant document chunks in context

3. **Should chunk large documents into multiple memory items respecting 2000 char limit**
   - Given: PDF has 10,000 characters of text
   - When: Processing for memory storage
   - Then: Creates 5+ memory items with semantic chunking

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
   - Given: PDF file exists but contains no extractable text
   - When: Extraction attempted
   - Then: Logs warning, continues chat without document context

### Failures

7. **Should continue chat when PDF extraction fails**
   - Given: PDF extraction throws error (corrupted file, network timeout)
   - When: First message processing
   - Then: Chat responds normally, logs error, no document context added

8. **Should continue chat when embedding generation fails**
   - Given: PDF text extracted successfully but OpenAI embedding API fails
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

11. **Should process document extraction asynchronously without blocking chat response**
    - Given: User sends first message
    - When: Chat response generation starts
    - Then: Document extraction runs in background, first response sent within 3s

12. **Should cache PDF text extraction results to avoid re-downloading**
    - Given: PDF file already downloaded from Vercel Blob
    - When: Second chunk being processed
    - Then: Uses cached buffer, no duplicate network request

---

## 3. Expected Outcomes

**Behavior 1 → Outcome**:

- Database: MemoryItems collection contains records with:
  - `userId`: Current user ID
  - `conversationId`: Current conversation ID
  - `type`: 'document'
  - `text`: Chunk of PDF text (~1500-2000 chars)
  - `embedding`: 1536-dim vector
  - `importance`: 5 (highest for source material)
  - `status`: 'active'
  - `source`: { conversationId, lessonId, fileName, chunkIndex, timestamp }
- Count: 1+ memory items (depends on document length)

**Behavior 2 → Outcome**:

- API: Chat response includes content that references document text
- Logs: Context usage includes document memory items with source citations

**Behavior 3 → Outcome**:

- Database: Multiple MemoryItems with same conversationId, sequential chunkIndex
- Each item: `text.length <= 2000`
- Chunking: Respects sentence/paragraph boundaries (no mid-sentence cuts)

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
- Logs: Warn log "PDF {fileName} contains no extractable text"
- Database: No memory items created for empty PDF

**Behavior 7 → Outcome**:

- API: 200 response with chat answer (no failure exposed to user)
- Logs: Error log with PDF extraction error details + stack trace
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
- Background: Document extraction task spawned with `Promise.allSettled()` (non-blocking)
- Logs: Two separate log entries with timestamps showing async execution

**Behavior 12 → Outcome**:

- Network: Single `fetch()` call to Vercel Blob URL per PDF
- Memory: Buffer stored in scope/closure during chunking loop
- Logs: Debug log showing "Processing chunk 2/5 from cached buffer"

---

## 4. Out of Scope

**Explicitly excluded from this task:**

### Feature Exclusions

- Image OCR extraction (only PDF text extraction)
- Video transcript extraction (future enhancement)
- Document summarization (will be handled by existing memory extraction)
- Admin UI for viewing/editing document memories
- Document version tracking (when lesson PDF updated)
- Multi-language document support (translation)
- Document search/filtering UI

### Test Type Exclusions

- E2E tests (chat interaction tested at integration level)
- Performance benchmarks (extraction time variance too high for CI)
- Load testing (background processing behavior)

### Technical Exclusions

- PDF table/form extraction (only plain text)
- PDF image extraction (only text content)
- Scanned PDF OCR (requires Gemini vision API - future)
- PDF password/encryption handling (assume unprotected PDFs)
- Real-time document updates (batch processing only)

### Domain Exclusions

- Exercise-level document context (only lesson-level)
- Document access analytics (usage tracking)
- Document quality scoring (readability metrics)
- Citation generation (footnote/reference extraction)

---

## 5. Test Boundaries

```yaml
Test level: integration
Mocking: allowed (OpenAI embedding API, Vercel Blob fetch)
External services: mocked (OpenAI for embeddings, network for PDF downloads)
Database: real (test MongoDB with vector search)
```

**Rationale**:

- Integration tests verify full flow: API request → PDF extraction → memory creation → vector retrieval
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

- ✓ Document extraction service implemented and tested
- ✓ Memory chunking respects 2000 char limit
- ✓ Vector search retrieves document memories correctly
- ✓ Background processing doesn't block chat response
- ✓ Access control enforced (conversation-scoped isolation)

**Documentation:**

- ✓ AGENTS.md updated with PDF extraction patterns
- ✓ Inline code comments for chunking algorithm
- ✓ Error handling documented in service layer

---

## 7. Deliverables

```yaml
Tests: 12 integration tests in tests/int/lesson-document-chat.int.spec.ts
CI: required (all tests must pass in GitHub Actions)
Docs: yes (AGENTS.md - add PDF extraction service pattern)
i18n: no (error messages are server-side logs only)
Migrations: no (uses existing MemoryItems collection)
Types: yes (pnpm generate:types if Conversation schema changes)
```

**New Files**:

1. `src/lib/ai/services/pdf-extractor-service.ts` - PDF text extraction + chunking
2. `src/lib/ai/document-memory-service.ts` - Document memory creation + retrieval
3. `tests/int/lesson-document-chat.int.spec.ts` - Integration test suite
4. `tests/fixtures/pdfs/` - Test PDF files (4 fixtures)

**Modified Files**:

1. `src/endpoints/agent/chat.ts` - Add document extraction logic to Step 3-4
2. `src/lib/ai/context-policy.ts` - Document memory retrieval in compose step
3. `docs/AGENTS.md` - Add PDF extraction service documentation
4. `package.json` - Add `pdf-parse` dependency

**Dependencies to Add**:

- `pdf-parse` (^1.1.1) - Server-side PDF text extraction
- `@types/pdf-parse` (dev dependency)

---

## 8. Risk & Rollback

### Breaking Changes

```yaml
Breaking: Chat responses may be delayed if PDF extraction blocks
Blast radius: module (lesson conversations only)
Rollback: revert PR (feature flag: ENABLE_DOCUMENT_MEMORY)
Data safety: medium (large memory items created, quota impact)
```

**Risk Mitigation**:

1. **Performance risk**: Background processing prevents blocking
   - Mitigation: `Promise.allSettled()` + timeout (10s max per PDF)
   - Fallback: Skip extraction, log error, chat continues

2. **Storage risk**: Large lessons create many memory items
   - Mitigation: Chunking limit (max 50 chunks per document)
   - Monitoring: Track memory item count per conversation

3. **Cost risk**: OpenAI embedding API calls increase
   - Mitigation: Cache embeddings, skip if already exists
   - Monitoring: Log embedding request count

4. **Quality risk**: Poor chunking breaks semantic retrieval
   - Mitigation: Sentence-boundary chunking algorithm
   - Testing: Verify retrieval precision in integration tests

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
