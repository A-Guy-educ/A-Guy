# Implementation Plan: Lesson Document Chat Integration

## 1. Overview

**Objective**: Automatically extract content from lesson PDF documents on first message and store as memory items for semantic retrieval, enabling AI to answer questions with high precision based on document content.

**Impact**: High - Significantly improves chat accuracy for lesson-based questions by providing actual document content as context.

**Rollout**: Safe default with feature flag (`ENABLE_DOCUMENT_MEMORY`) for controlled rollout and easy rollback.

---

## 2. Requirements → Plan Map (Trace Table)

| Spec Requirement                           | Stage(s)   | Deliverables                                        | Tests           |
| ------------------------------------------ | ---------- | --------------------------------------------------- | --------------- |
| Extract document content on first message  | Stage 1, 3 | pdf-extractor-service.ts, chat.ts modifications     | Behaviors 1, 11 |
| Retrieve document memories in answers      | Stage 3    | context-policy.ts modifications                     | Behavior 2      |
| Chunk documents respecting 2000 char limit | Stage 1    | Chunking algorithm in pdf-extractor-service.ts      | Behavior 3      |
| Skip extraction when no PDFs               | Stage 3    | Logic in chat.ts                                    | Behavior 4      |
| Skip extraction when memories exist        | Stage 2    | hasDocumentMemories() in document-memory-service.ts | Behavior 5      |
| Handle empty/unreadable PDFs gracefully    | Stage 1    | Error handling in pdf-extractor-service.ts          | Behavior 6      |
| Continue chat when extraction fails        | Stage 3    | Try-catch with graceful fallback in chat.ts         | Behavior 7      |
| Continue chat when embedding fails         | Stage 2    | Error handling in document-memory-service.ts        | Behavior 8      |
| Enforce conversation-level access control  | Stage 4    | Filter updates in vector-search.ts                  | Behavior 9      |
| Respect lesson access control              | Stage 3    | Access check in chat.ts                             | Behavior 10     |
| Process extraction asynchronously          | Stage 3    | Promise.allSettled() in chat.ts                     | Behavior 11     |
| Cache PDF extraction results               | Stage 1    | Buffer caching in extraction loop                   | Behavior 12     |

**Validation**: All 12 spec behaviors mapped to implementation stages ✓

---

## 3. Stages (Risk-Ordered)

### Stage 1: PDF Extraction Service (Core Infrastructure)

**Risk Level**: Medium - New dependency, external library integration

**Scope**:

- Create PDF text extraction service with chunking algorithm
- Add `pdf-parse` dependency
- Implement sentence-boundary chunking (max 2000 chars)
- Error handling for corrupted/empty PDFs
- Buffer caching to avoid re-downloading

**Deliverables**:

- `src/lib/ai/services/pdf-extractor-service.ts` (new)
- `tests/int/pdf-extractor.int.spec.ts` (new)
- `tests/fixtures/pdfs/` directory with 4 test PDFs
- Updated `package.json` with `pdf-parse` dependency

**Verification**:

- Unit tests pass for text extraction
- Chunking algorithm respects 2000 char limit
- Empty PDF returns empty string without error
- Corrupted PDF throws handled error

**Exit Criteria**:

- ✓ All 4 PDF fixtures tested
- ✓ Chunking produces no mid-sentence splits
- ✓ Error cases logged, not thrown
- ✓ `pnpm test:int && pnpm typecheck` passes

**Constraints Check**: Compliant

- Separation of concerns: pure service function
- No UI logic mixed with extraction
- Observable behavior tested

**Risk Note**: `pdf-parse` library may have compatibility issues with certain PDF versions; mitigate with comprehensive error handling and logging.

---

### Stage 2: Document Memory Service (Storage Layer)

**Risk Level**: Medium - Integrates with existing memory system

**Scope**:

- Create document memory service for creating and checking memory items
- Batch embedding generation (reuse existing pattern)
- Deduplication check (prevent duplicate memories)
- Type-safe memory item creation with document metadata

**Deliverables**:

- `src/lib/ai/document-memory-service.ts` (new)
- `tests/int/document-memory.int.spec.ts` (new)
- Extended MemoryItems schema with `type: 'document'` support

**Verification**:

- Memory items created with correct structure
- `hasDocumentMemories()` correctly identifies existing memories
- Embedding generation errors handled gracefully
- Source metadata includes conversationId, lessonId, fileName

**Exit Criteria**:

- ✓ 3 integration tests pass (create, skip, fail gracefully)
- ✓ Memory items queryable by conversationId + type='document'
- ✓ Deduplication prevents duplicate memories
- ✓ `pnpm test:int && pnpm typecheck` passes

**Constraints Check**: Compliant

- Payload-first: Uses Payload API for memory creation
- No direct DB bypass
- Server-side only (access control preserved)

**Risk Note**: OpenAI embedding API failures; mitigate with retry logic and background task queuing.

---

### Stage 3: Chat Integration (Orchestration)

**Risk Level**: High - Modifies critical chat endpoint

**Scope**:

- Integrate document extraction into chat flow on first message
- Check if first message in conversation
- Fetch lesson contentFiles (PDFs only)
- Download PDF from Vercel Blob
- Extract, chunk, and create memories in background
- Graceful degradation if extraction fails

**Deliverables**:

- Modified `src/endpoints/agent/chat.ts`
- `tests/int/lesson-document-chat.int.spec.ts` (new)
- Feature flag: `ENABLE_DOCUMENT_MEMORY` in env

**Verification**:

- Document extraction triggers on first message only
- Extraction runs asynchronously (doesn't block response)
- Chat responds normally if extraction fails
- Lesson access control enforced before extraction

**Exit Criteria**:

- ✓ 3 integration tests pass (first message, skip subsequent, fail gracefully)
- ✓ Chat response time < 3s (extraction in background)
- ✓ 403 when user lacks lesson access
- ✓ All existing chat tests still pass
- ✓ `pnpm test:int && pnpm typecheck && pnpm lint` passes

**Constraints Check**: Compliant

- Payload-first: Uses Payload's lesson query API
- No hardcoded strings (logs only)
- Minimal change to chat.ts (single async function call)

**Risk Note**: Highest risk stage - modifies production-critical chat endpoint. Mitigate with feature flag, extensive testing, and async processing to prevent blocking.

---

### Stage 4: Access Control & Security (Critical Path)

**Risk Level**: Critical - Security implications

**Scope**:

- Update vector search filter to enforce conversation-scoped isolation
- Ensure userId + conversationId always included in filters
- Security audit of memory retrieval paths
- Verify no cross-user memory leakage

**Deliverables**:

- Modified `src/lib/ai/vector-search.ts` (filter enhancement)
- Security tests in `tests/int/lesson-document-chat.int.spec.ts`

**Verification**:

- Vector search filters by both userId AND conversationId
- User A cannot retrieve User B's document memories
- All memory retrieval paths audited
- Test: Create memories for User A, query as User B, expect 0 results

**Exit Criteria**:

- ✓ 2 security tests pass (conversation isolation, lesson access)
- ✓ All vector search queries include userId filter
- ✓ No cross-tenant data leakage in any scenario
- ✓ `pnpm test:int && pnpm typecheck` passes

**Constraints Check**: Compliant

- Payload-first: Uses Payload's user context
- Security-first: Tenant isolation enforced at query level

**Risk Note**: Data leakage between users is unacceptable. This stage gates all others - must pass security review before proceeding.

---

### Stage 5: Documentation & Polish (Quality Gate)

**Risk Level**: Low - Non-functional improvements

**Scope**:

- Update AGENTS.md with PDF extraction patterns
- Add inline code comments for chunking algorithm
- Document error handling patterns
- Add feature flag configuration guide

**Deliverables**:

- Updated `docs/AGENTS.md`
- Code comments in new services
- Feature flag in `src/lib/feature-flags.ts`

**Verification**:

- Documentation complete and accurate
- Code comments explain non-obvious logic
- Feature flag documented in AGENTS.md

**Exit Criteria**:

- ✓ AGENTS.md includes PDF extraction section
- ✓ All new functions have JSDoc comments
- ✓ Feature flag behavior documented
- ✓ `pnpm lint` passes (comment style checked)

**Constraints Check**: Compliant

- Documentation requirement met
- No scope creep

**Risk Note**: Low risk; documentation-only changes.

---

## 4. Test Plan (Staged)

### Stage 1 Tests (PDF Extraction)

**Behaviors Covered**: 3, 6, 12

- ✅ Extract text from valid PDF (sample-lesson.pdf)
- ✅ Chunk long text with sentence boundaries (long-lesson.pdf)
- ✅ Handle empty PDF gracefully (empty.pdf)
- ✅ Handle corrupted PDF with error (corrupted.pdf)
- ✅ Cache buffer across chunks (verify single fetch call)

**Red-First Test**: Corrupted PDF extraction (expect graceful error, not crash)

### Stage 2 Tests (Memory Service)

**Behaviors Covered**: 5, 8

- ✅ Create document memories from chunks
- ✅ Skip if memories already exist (hasDocumentMemories returns true)
- ✅ Handle embedding API failure gracefully

**Red-First Test**: Embedding generation fails (OpenAI API mocked to throw error)

### Stage 3 Tests (Chat Integration)

**Behaviors Covered**: 1, 4, 7, 10, 11

- ✅ Extract documents on first message (verify memory items created)
- ✅ Skip extraction when lesson has no PDFs
- ✅ Skip extraction on subsequent messages
- ✅ Continue chat if extraction fails (PDF download timeout)
- ✅ Respect lesson access control (403 for unauthorized)
- ✅ Process extraction asynchronously (response time < 3s)

**Red-First Test**: Chat on first message with PDF (expect memory items in DB after response)

### Stage 4 Tests (Security)

**Behaviors Covered**: 9, 10

- ✅ Enforce conversation-level isolation (User A can't see User B's memories)
- ✅ Respect lesson access control (no extraction for unauthorized users)

**Red-First Test**: Cross-tenant memory leakage (User B queries, expect 0 results from User A)

### Stage 5 Tests (Documentation)

**Behaviors Covered**: None (quality gate)

- ✅ Verify all existing tests still pass
- ✅ Verify build succeeds

---

## 5. Data & Migration

**Changes**: Schema extension (non-breaking)

**Migration**: None required

- `type: 'document'` is a new enum value (existing types unchanged)
- `source` fields are optional (existing memories unaffected)
- No data backfill needed

**Rollback Implication**: Safe

- New memory items remain in database (harmless)
- Feature flag disables creation of new document memories
- Existing memories unaffected
- No destructive operations

---

## 6. Rollout & Monitoring

**Environments**: dev → staging → prod

**Feature Flag Strategy**:

```typescript
// In .env
ENABLE_DOCUMENT_MEMORY=false  // Start disabled

// Rollout phases:
1. Dev: true (internal testing)
2. Staging: true (QA verification)
3. Prod: false → true (gradual rollout, monitor 24h)
```

**Monitoring**:

- **Errors**: PDF extraction failures (log rate)
- **Performance**: Chat response time (p95 < 3s)
- **Usage**: Document memories created per day
- **Quality**: Memory retrieval success rate in chat

**Key User Flows**:

1. Student sends first message in lesson → memories created → chat responds
2. Student asks document question → memories retrieved → accurate answer
3. Extraction fails → chat still responds (graceful degradation)

**Success Signals**:

- ✅ Chat response time remains < 3s (p95)
- ✅ Zero security incidents (cross-user leakage)
- ✅ Document extraction success rate > 90%
- ✅ Memory retrieval includes document memories in top 4 results

**Failure Signals**:

- ❌ Chat response time > 5s (p95) → disable feature flag
- ❌ PDF extraction failure rate > 20% → investigate library compatibility
- ❌ Security alert (cross-tenant data) → immediate rollback

---

## 7. Stop Conditions

**DONE only if**:

- ✓ All 5 stages complete with exit criteria met
- ✓ All 12 spec behaviors have tests and pass in CI
- ✓ `pnpm test:int && pnpm typecheck && pnpm lint && pnpm build` passes
- ✓ Security review approved (Stage 4)
- ✓ Feature flag configured and tested
- ✓ Documentation complete (AGENTS.md updated)
- ✓ All engineering constraints respected:
  - Payload-first: ✓ (uses Payload APIs)
  - i18n only: ✓ (logs only, no UI strings)
  - Microcomponents: N/A (backend only)
  - Separation of concerns: ✓ (service layer pattern)
  - Testing alignment: ✓ (12 integration tests)
  - Change discipline: ✓ (minimal changes, no scope creep)

**Explicit Defers**:

- Admin UI for document memories → future enhancement
- Video transcript extraction → out of scope
- OCR for scanned PDFs → future enhancement

---

## 8. Implementation Sequence

### Day 1-2: Stage 1 (PDF Extraction)

- Add `pdf-parse` dependency
- Create `pdf-extractor-service.ts`
- Implement chunking algorithm
- Write 5 unit tests
- Create test fixtures

**Checkpoint**: `pnpm test:int tests/int/pdf-extractor.int.spec.ts` passes

---

### Day 3-4: Stage 2 (Memory Service)

- Create `document-memory-service.ts`
- Implement `createDocumentMemories()` and `hasDocumentMemories()`
- Batch embedding generation
- Write 3 integration tests

**Checkpoint**: `pnpm test:int tests/int/document-memory.int.spec.ts` passes

---

### Day 5-7: Stage 3 (Chat Integration)

- Modify `src/endpoints/agent/chat.ts`
- Add document extraction logic (async)
- Fetch lesson contentFiles
- Download PDF from Vercel Blob
- Write 6 integration tests
- Test with real lesson data

**Checkpoint**: All existing chat tests + new tests pass

---

### Day 8: Stage 4 (Security)

- Update `vector-search.ts` filters
- Add conversation-scoped isolation
- Write 2 security tests
- Security audit of all retrieval paths

**Checkpoint**: Security tests pass, manual review complete

---

### Day 9: Stage 5 (Documentation)

- Update AGENTS.md
- Add code comments
- Configure feature flag
- Final CI/CD check

**Checkpoint**: All quality gates pass, documentation complete

---

## 9. Constraints Compliance Summary

| Constraint             | Compliance  | Evidence                                                               |
| ---------------------- | ----------- | ---------------------------------------------------------------------- |
| Payload-First          | ✓ Compliant | Uses Payload APIs for lesson queries, memory creation                  |
| i18n Only              | ✓ Compliant | No UI strings (backend only, logs exempted)                            |
| Microcomponents        | N/A         | Backend services only                                                  |
| Separation of Concerns | ✓ Compliant | Service layer (pdf-extractor, document-memory), endpoint orchestration |
| Testing Alignment      | ✓ Compliant | 12 integration tests, observable behavior validated                    |
| Change Discipline      | ✓ Compliant | Minimal changes to chat.ts, no unrelated refactors                     |

**Violations**: None

**Deviations**: None

---

## 10. Dependencies

### New NPM Dependencies

```json
{
  "pdf-parse": "^1.1.1"
}
```

### Development Dependencies

```json
{
  "@types/pdf-parse": "^1.1.4"
}
```

### Existing Dependencies (Already Available)

- `openai` - Embedding generation
- `mongodb` - Vector search
- `zod` - Validation
- `pino` - Logging

---

## 11. Risk Mitigation Matrix

| Risk                             | Likelihood | Impact   | Mitigation                                           |
| -------------------------------- | ---------- | -------- | ---------------------------------------------------- |
| PDF library compatibility issues | Medium     | Medium   | Comprehensive error handling, test with diverse PDFs |
| Chat response time degradation   | Low        | High     | Async processing (Promise.allSettled), timeout (10s) |
| OpenAI API failure               | Medium     | Low      | Graceful degradation, retry in background            |
| Cross-user memory leakage        | Low        | Critical | Mandatory userId filter, security tests, audit       |
| Large document token overflow    | Medium     | Medium   | Chunking limit (max 50 chunks), preview extraction   |
| Feature breaks existing chat     | Low        | High     | Feature flag, extensive integration tests            |

---

## 12. Code Patterns Reference

### Pattern 1: Payload-First Query

```typescript
// ✅ Correct: Use Payload API
const lesson = await payload.findByID({
  collection: 'lessons',
  id: lessonId,
  user: req.user,
})

// ❌ Wrong: Direct DB query
const lesson = await db.collection('lessons').findOne({ _id: lessonId })
```

### Pattern 2: Async Background Processing

```typescript
// ✅ Correct: Non-blocking
const extractionPromise = extractAndStoreDocuments(lesson, conversation)
Promise.allSettled([extractionPromise]).catch((err) => {
  req.payload.logger.error('Background extraction failed', { error: err })
})

// Respond immediately (don't await)
return res.json({ message: 'Chat response' })
```

### Pattern 3: Tenant-Safe Vector Search

```typescript
// ✅ Correct: Always filter by userId
const memories = await retrieveMemoryItems(db, userId, query, conversationId)

// ❌ Wrong: Missing userId filter
const memories = await collection.find({ conversationId })
```

### Pattern 4: Graceful Error Handling

```typescript
// ✅ Correct: Fail gracefully
try {
  const text = await extractTextFromPDF({ pdfBuffer })
  await createDocumentMemories(text, metadata)
} catch (error) {
  req.payload.logger.error('PDF extraction failed', { error })
  // Chat continues without document context
}
```

---

## 13. Final Checklist

Before considering implementation complete:

- [ ] All 12 spec behaviors tested
- [ ] All 5 stages completed with exit criteria met
- [ ] Security review passed (Stage 4)
- [ ] Feature flag configured and tested
- [ ] Documentation updated (AGENTS.md)
- [ ] All constraints respected
- [ ] CI/CD passing (`pnpm test:int && pnpm typecheck && pnpm lint && pnpm build`)
- [ ] No cross-user data leakage (verified in tests)
- [ ] Chat response time < 3s (verified in integration test)
- [ ] Rollback plan documented and tested
- [ ] Monitoring/logging in place

---

**Plan Status**: Ready for implementation ✓

**Constraints**: All compliant ✓

**Traceability**: All requirements mapped ✓

**Risk Assessment**: Mitigated with feature flag, async processing, and security tests ✓
