# Lesson Document Chat Integration – MVP Spec

> **For AI Agents**: Auto-ingest lesson PDFs into shared KB, retrieve in chat. 50-60% reduction from original.

---

## Changelog (Compact)

```yaml
2026-01-13 Round 5: CRITICAL FIXES - Added "How to Use" section, required metadata enforcement, blocked auto-ingest on first message, added hard chat guard (409 error), updated Stop Conditions to 16 tests
2026-01-13 Round 4: Async fire-and-forget, removed heartbeat from MVP, DB-cheap KB check, fixed CRON auth
2026-01-13 Round 3: userId validation fix, fileHash strategy, 45min lock TTL, heartbeat Phase 2, KB exists criteria
Initial: Added MemoryItems schema, lock mechanism, retry policy, vector index update
```

---

## 1. Scope

```yaml
Feature: Auto-ingest lesson PDFs → shared lesson KB + optional student memory
Type: feature
Impact: high
Dependencies: MemoryItems schema + Media.fileHash + vector index + AI extraction service
Kill Switch: LESSON_KB_ENABLED env var (default: true)
```

**MVP Pattern**: Pre-ingest on lesson publish/update (Lessons `afterChange` hook). Chat assumes KB already exists. Chat-triggered ingestion is fallback/recovery only. Phase 2: Add queue/worker (Vercel Queue, BullMQ).

---

## 2. How to Use (Admin UX)

**PDFs are attached to lessons through the Payload Admin panel, not uploaded inside the chat.**

### Admin Setup Flow

1. **Navigate to Lesson Admin**: Access `/admin/collections/lessons`
2. **Edit or Create Lesson**: Open the lesson editor
3. **Add Content Files**:
   - Locate the `contentFiles` field (array)
   - Click "Add Item" to add a new PDF
   - Upload or select existing Media document
   - **Check `ingestToKb` checkbox** to enable KB ingestion for this PDF
   - Optionally add a label (display name)
4. **Publish Lesson**: Set status to "published"
   - Ingestion triggers automatically for all files where `ingestToKb === true`
   - Lesson becomes chat-ready once ingestion completes

### Key Points

- **`ingestToKb` checkbox**: Controls whether a PDF is eligible for ingestion
  - Located in each `contentFiles[]` item
  - Default: `false` (opt-in required)
  - Must be explicitly checked to ingest
- **Same Media, different contexts**: A Media file can be:
  - Ingested in Lesson A (`ingestToKb=true`)
  - Skipped in Lesson B (`ingestToKb=false`)
- **No chat uploads**: Students cannot upload PDFs during chat sessions

---

## 3. Storage & Scope

| Layer              | Scope               | Purpose             | Lifetime                                  | userId                      | Eligibility                                   |
| ------------------ | ------------------- | ------------------- | ----------------------------------------- | --------------------------- | --------------------------------------------- |
| **Lesson KB**      | `lessonId`          | PDF chunks (shared) | Until PDF changes OR `ingestToKb` toggled | undefined/null/'' (ignored) | Only contentFiles where `ingestToKb === true` |
| **Student Memory** | `userId + lessonId` | Personal progress   | Per student                               | Required (non-empty string) | N/A (separate feature)                        |

**Key Constraints:**

- Lesson KB ingestion is **context-driven** - controlled by `lesson.contentFiles[].ingestToKb` flag
- Media objects are **neutral assets** - same Media can be ingested in one lesson, skipped in another
- Zero ingestable files (`all ingestToKb === false`) is **valid** - not an error condition

---

## 4. Context-Driven Ingestion (CRITICAL)

**Ingestion is a property of the Lesson ↔ Media relationship, NOT of Media itself.**

### Core Principle

- **Media objects are neutral assets** - they carry no ingestion semantics
- **Ingestion eligibility is determined by lesson context** - the same Media file may be ingestable in one lesson and NOT ingestable in another
- **Explicit opt-in required** - ingestion never happens automatically based on MIME type or file extension alone

### Lesson Schema - contentFiles Structure

```typescript
// Lessons collection field
contentFiles: [
  {
    media: { relationTo: 'media', type: 'relationship' }, // Media document reference
    ingestToKb: { type: 'checkbox', defaultValue: false }, // NEW - explicit ingestion flag
    label: { type: 'text' }, // Optional display name
  },
]
```

### Ingestion Rules

1. **Eligible for ingestion** → `ingestToKb === true`
2. **Must be ignored** → `ingestToKb === false` or `undefined`
3. **Filter at source** → Ingestion service MUST filter files before processing:
   ```typescript
   const ingestableFiles = lesson.contentFiles.filter((f) => f.ingestToKb === true)
   if (ingestableFiles.length === 0) {
     // Skip ingestion, log info (NOT error)
     return
   }
   ```

### Consequences

- **No ingestion** if all `ingestToKb === false` - this is valid and expected
- **Partial ingestion** is supported - some PDFs ingested, others skipped
- **Same Media, different contexts** - Media doc X can be ingested in Lesson A but not in Lesson B

### Non-Goal (Explicit)

**The system MUST NOT:**

- Infer ingestion eligibility from Media type, MIME, or file extension
- Automatically ingest all PDFs in a lesson
- Treat Media objects as carrying ingestion semantics

---

## 5. Idempotency & Identity

**Chunk ID components:**

```yaml
fileId: Media doc ID
fileHash: SHA-256 of PDF bytes (Media.fileHash field)
pageNumber: 1-based page index
chunkIndex: 0-based chunk within page
chunkHash: Hash of normalized chunk text
exerciseId: ${lessonId}:${fileHash}:${pageNumber}:ex${num} OR :h${hash}
```

**Deterministic `exerciseId`:**

- If exercise number detected → `:ex${detectedNumber}`
- Else → `:h${hash(normalizedSnippet)}`

---

## 6. Concurrency Control (Lock)

```yaml
Collection: ingestion_locks
Lock Key: 'lesson_kb_ingestion:${lessonId}:${fileId}:${fileHash}'
States: running | done | failed
TTL: 45 minutes (safe for long PDFs)
Heartbeat: Phase 2 only (MVP accepts rare duplicate risk)
```

**Lock behavior:**

- `state=running` → exit (in progress)
- `state=done` → check KB exists criteria
- `state=failed` + age>5min → retry
- On success → update `state=done` + `metadata.chunkCount`
- On failure → update `state=failed` + error details

**TTL index** (manual creation required):

```javascript
db.ingestion_locks.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

---

## 7. KB Exists Criteria (DB-Cheap)

**Both conditions required:**

1. Lock: `state='done'` AND `metadata.chunkCount > 0`
2. Active items: At least 1 MemoryItem via indexed query:
   ```typescript
   {
     scopeType: 'lesson_kb',
     lessonId: currentLessonId,
     sourceFileId: currentFileId,
     sourceFileHash: currentFileHash,
     status: 'active'
   }
   // Use findOne() with limit:1 (indexed, no scan)
   ```

**If only failed/archived items exist** → treat as missing, trigger re-ingestion.

---

## 8. Staleness Detection

**Stale when (for ingestable files only):**

- Current `Media.fileHash` ≠ stored `sourceFileHash` in KB items
- OR KB items exist but lesson's contentFiles no longer reference that fileId
- OR KB items exist but `ingestToKb` flag toggled from `true` → `false`

**CRITICAL: Only process files where `ingestToKb === true`**

**fileHash computation (MVP):**

1. **Primary**: Compute in `beforeChange` hook if buffer available
2. **Fallback**: Fetch from Vercel Blob during first ingestion (once), persist hash
3. **Legacy**: Compute on-demand for existing Media docs without fileHash

**On stale detection:**

1. Mark old KB items `status='archived'`
2. Trigger re-ingestion with new fileHash (if `ingestToKb === true`)
3. New items get `status='active'`

**On PDF removal OR `ingestToKb` toggled to `false`:**

- Archive all KB items with that `sourceFileId`
- Update lock state
- Log cleanup (info level - not an error)
- Do NOT attempt re-ingestion

**On `ingestToKb` toggled from `false` → `true`:**

- Treat as new ingestion request
- Create KB items if Media exists and is accessible

---

## 9. Retry Policy

**Fields** (add to MemoryItems schema):

```typescript
retryCount: number (default: 0)
nextRetryAt: date
lastError: textarea
```

**Policy:**

- Max retries: 5
- Backoff: 1m, 5m, 15m, 1h, 6h
- After max → `status='failed'` (permanent)

**Trigger**: Vercel Cron → secured API endpoint

```json
{
  "crons": [
    {
      "path": "/api/cron/retry-embeddings",
      "schedule": "* * * * *",
      "headers": {
        "Authorization": "Bearer ${CRON_SECRET}"
      }
    }
  ]
}
```

**CRITICAL**: Must set `CRON_SECRET` in Vercel env vars + vercel.json headers. Vercel does NOT send auth automatically.

---

## 10. Behaviors (16 Tests)

| #   | Behavior                                   | Type           | Test Assertion                                                                                  |
| --- | ------------------------------------------ | -------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Ingest PDFs when `ingestToKb=true`         | Happy          | MemoryItems created, scopeType='lesson_kb'                                                      |
| 2   | Reuse existing KB (fileHash unchanged)     | Happy          | No duplicate items                                                                              |
| 3   | Retrieve KB chunks in lesson chat          | Happy          | KB items in context                                                                             |
| 4   | Enforce 2000 char chunk limit              | Happy          | All chunks ≤ 2000 chars                                                                         |
| 5   | Skip when no PDFs                          | Edge           | No errors, logs info                                                                            |
| 6   | Skip when all PDFs have `ingestToKb=false` | Edge           | No ingestion, no errors, info logged                                                            |
| 7   | Handle empty/unreadable PDFs               | Edge           | Warning logged, no items                                                                        |
| 8   | Don't block chat on ingestion fail         | Failure        | Response returned, ingestion logged failed                                                      |
| 9   | Handle embedding failures (retry)          | Failure        | Items created `status='pending_embedding'`                                                      |
| 10  | Enforce lesson access control              | Security       | 403 or empty results                                                                            |
| 11  | Prevent cross-lesson contamination         | Security       | Only current lessonId items returned                                                            |
| 12  | Fallback ingestion doesn't block chat      | Performance    | Chat completes normally when KB missing (recovery scenario)                                     |
| 13  | Cache extraction by fileHash               | Performance    | Only 1 extraction call per unique hash                                                          |
| 14  | Same Media, different contexts             | Context-Driven | Media doc X: ingested in Lesson A (`ingestToKb=true`), skipped in Lesson B (`ingestToKb=false`) |
| 15  | Toggle `ingestToKb` from `true` → `false`  | Context-Driven | Existing KB items archived, no re-ingestion                                                     |
| 16  | Toggle `ingestToKb` from `false` → `true`  | Context-Driven | New KB items created from Media                                                                 |

---

## 11. Triggers

**Primary (MVP):**

- On Lesson publish OR on contentFiles change (added/removed/toggled `ingestToKb`)
- Trigger: Lessons collection `afterChange` hook
- **CRITICAL**: Only process contentFiles where `ingestToKb === true`
- Ingestion completes before lesson is marked as chat-ready
- Chat assumes Lesson KB already exists

**Trigger Conditions (ALL must be true):**

1. Lesson is published (`status === 'published'`)
2. At least one contentFile has `ingestToKb === true`
3. One of:
   - New lesson created
   - contentFiles modified (added, removed, or `ingestToKb` toggled)
   - Media file content changed (fileHash differs)

**Fallback / Recovery (Error Handling Only):**

- **CRITICAL**: Chat-triggered ingestion is a fallback mechanism and MUST NOT be relied on in normal flows
- **DO NOT auto-ingest on first student message** - this violates MVP design
- Used only when:
  - Legacy lessons exist without KB (detected via server-side check)
  - Ingestion previously failed (lock state=failed)
  - Data drift detected (KB missing but lesson marked ready)
- Fire-and-forget pattern: `void checkAndIngestLessonKb()` (no await)
- Missing KB in chat context is treated as a system error, not a user-facing flow
- **Trigger conditions for fallback (ALL must be true)**:
  1. Lesson is published
  2. Ingestable files exist (`contentFiles[].ingestToKb === true`)
  3. KB missing criteria met (no active items + lock state != 'running')
  4. Request is explicitly marked as recovery (internal flag), NOT triggered by "first message"
- **Monitoring**: Log `fallback_ingestion_triggered=true` and alert if frequent (indicates systemic issue)

**Implementation** (in `src/collections/Lessons.ts` `afterChange` hook):

```typescript
// Primary trigger: Lesson publish or ingestable contentFiles change
afterChange: [
  async ({ doc, req, operation }) => {
    if (operation === 'update' || operation === 'create') {
      // Check if lesson is published
      if (doc.status !== 'published') return

      // Check if any contentFiles have ingestToKb === true
      const hasIngestableFiles = doc.contentFiles?.some((f) => f.ingestToKb === true)
      if (!hasIngestableFiles) {
        // Valid state - no ingestion needed
        return
      }

      // Check if contentFiles changed
      if (hasContentFilesChanged(doc, previousDoc)) {
        void ingestLessonKb(req, doc.id).catch((err) => {
          req.payload.logger.error({ err, lessonId: doc.id }, 'Lesson KB ingestion failed')
        })
      }
    }
  },
]
```

**Fallback implementation** (in `src/endpoints/agent/chat.ts`):

```typescript
// Fallback only: Handle missing KB as recovery scenario
// CRITICAL: DO NOT trigger on normal first message - only for recovery
if (contextType === 'lesson' && contextId) {
  const lesson = await req.payload.findByID({ collection: 'lessons', id: contextId })

  // Check if lesson should have KB
  const hasIngestableFiles = lesson.contentFiles?.some((f) => f.ingestToKb === true)
  if (!hasIngestableFiles) {
    // No KB expected - continue normally
    return
  }

  // Check if KB exists
  const kbExists = await checkLessonKbExists(req.payload, contextId)
  if (!kbExists) {
    // KB missing but should exist - this is a system error
    reqLogger.error({ lessonId: contextId }, 'Lesson KB missing - data integrity issue detected')

    // Optionally trigger fallback (fire-and-forget)
    // Only if lock not running and lesson is published
    const lock = await checkIngestionLock(req.payload, contextId)
    if (lock?.state !== 'running' && lesson.status === 'published') {
      reqLogger.warn({ lessonId: contextId }, 'Triggering fallback ingestion for missing KB')
      void checkAndIngestLessonKb(req.payload, contextId).catch((err) => {
        reqLogger.error({ err, lessonId: contextId }, 'Fallback KB ingestion failed')
      })
    }
  }
}
```

---

## 12. Lesson Readiness Contract (CRITICAL)

**A lesson is considered chat-ready only after all ingestable PDFs (`ingestToKb=true`) are successfully ingested.**

### Core Requirements

- **Pre-Ingest First**: Ingestion must complete during lesson publish/update lifecycle, not during chat
- **No Runtime Dependency**: Chat must not rely on runtime ingestion as part of normal operation
- **Missing KB = System Error**: If Lesson KB is missing when chat is accessed, the system must treat it as an error or recovery scenario
- **Server-Side Enforcement**: Readiness checks are enforced server-side, not UI-dependent

### Chat Behavior

- **Assumption**: Chat assumes Lesson KB already exists when contextType='lesson'
- **Fallback Only**: Chat-triggered ingestion is a recovery mechanism for exceptional cases:
  - Legacy lessons without KB
  - Previous ingestion failures
  - Data drift detection
- **User Experience**: Users should never need to wait for ingestion during a chat session

### Enforcement Mechanisms (Server-Side)

1. **Lesson Status**: Lessons with ingestable PDFs should not be marked as 'published' until ingestion completes (or implement 'ingesting' status)
2. **Chat Access Guard (REQUIRED)**:
   - **When**: Lesson has `ingestToKb=true` files AND KB does not exist
   - **Action**: Return 409 Conflict error with deterministic payload
   - **Error Response**:
     ```typescript
     {
       error: 'lesson_kb_not_ready',
       message: 'Lesson KB is being prepared. Please try again shortly.',
       statusCode: 409,
       lessonId: string,
       retryAfter: number // seconds
     }
     ```
   - **Optional**: Trigger fallback ingestion (fire-and-forget) on first detection
   - **UI Behavior**: Display friendly message, poll for readiness
3. **Monitoring**: Alert on frequent fallback ingestion triggers (indicates systemic issue)
4. **Documentation**: Admin UI should clearly communicate lesson readiness state

**Implementation** (in `src/endpoints/agent/chat.ts`):

```typescript
// Hard guard: Block chat if KB expected but missing
if (contextType === 'lesson' && contextId) {
  const lesson = await req.payload.findByID({ collection: 'lessons', id: contextId })
  const hasIngestableFiles = lesson.contentFiles?.some((f) => f.ingestToKb === true)

  if (hasIngestableFiles) {
    const kbExists = await checkLessonKbExists(req.payload, contextId)
    if (!kbExists) {
      // KB missing - block chat
      reqLogger.error({ lessonId: contextId }, 'Chat blocked - Lesson KB not ready')

      // Optionally trigger fallback (once)
      const lock = await checkIngestionLock(req.payload, contextId)
      if (lock?.state !== 'running') {
        void checkAndIngestLessonKb(req.payload, contextId)
      }

      // Return error to client
      return res.status(409).json({
        error: 'lesson_kb_not_ready',
        message: 'Lesson KB is being prepared. Please try again shortly.',
        statusCode: 409,
        lessonId: contextId,
        retryAfter: 30, // seconds
      })
    }
  }
}
```

---

## 13. Schema Changes (BLOCKING – DO FIRST)

### 13.1 Media Collection

```typescript
{
  name: 'fileHash',
  type: 'text',
  required: false, // Optional for backward compatibility
  index: true,
  admin: { description: 'SHA-256 hash of file bytes' }
}
```

### 13.2 MemoryItems Collection

**New/Updated fields:**

```typescript
// New scopeType options
scopeType: 'lesson_kb' | 'student_memory' (+ existing)

// Make userId optional
userId: {
  type: 'text',
  required: false,
  validate: (value, { data }) => {
    const isNonEmptyString = typeof value === 'string' && value.trim().length > 0
    if (data.scopeType === 'lesson_kb') {
      if (isNonEmptyString) return 'Lesson KB items must not have userId'
      return true // Allow undefined | null | ''
    }
    if (!isNonEmptyString) return 'userId required for user-scoped items'
    return true
  }
}

// New lessonId field
lessonId: { type: 'text', index: true, required: scopeType === 'lesson_kb' }

// New status options
status: 'pending_embedding' | 'failed' | 'archived' (+ existing)

// Retry fields
retryCount: { type: 'number', defaultValue: 0 }
nextRetryAt: { type: 'date' }
lastError: { type: 'textarea' }

// Source metadata (top-level, not nested)
// CRITICAL: All lesson_kb items MUST have these fields populated
sourceFileId: { type: 'text', required: scopeType === 'lesson_kb', index: true }
sourceFileName: { type: 'text', required: scopeType === 'lesson_kb' }
sourceFileHash: { type: 'text', required: scopeType === 'lesson_kb', index: true }
sourcePageNumber: { type: 'number', min: 1, required: scopeType === 'lesson_kb' }
sourceChunkIndex: { type: 'number', min: 0, required: scopeType === 'lesson_kb' }
sourceChunkHash: { type: 'text', required: scopeType === 'lesson_kb' }
sourceExerciseId: { type: 'text', index: true } // Optional - only when exercise detected
sourceSectionTitle: { type: 'text' } // Optional - populated when available
sourceTopics: { type: 'array', fields: [{ name: 'topic', type: 'text' }] } // Optional - populated when available

// New type options
type: 'document' | 'mistake_pattern' | 'progress' (+ existing)
```

### 13.3 IngestionLocks Collection (NEW)

```typescript
{
  slug: 'ingestion_locks',
  fields: [
    { name: 'lockKey', type: 'text', required: true, unique: true, index: true },
    { name: 'state', type: 'select', options: ['running', 'done', 'failed'], index: true },
    { name: 'expiresAt', type: 'date', required: true, index: true },
    { name: 'metadata', type: 'json' } // { lessonId, fileId, fileName, fileHash, chunkCount, timestamps, error }
  ],
  timestamps: true
}
```

**After schema changes**: Run `pnpm generate:types`

---

## 14. Retrieval Filters (SECURITY-CRITICAL)

**Lesson KB** (hardcoded in retrieval service):

```typescript
{
  scopeType: { $eq: 'lesson_kb' },
  lessonId: { $eq: currentLessonId },
  status: { $eq: 'active' }
  // NO userId filter - lesson_kb items are shared
  // NO fileId filter - search across ALL PDFs in lesson
}
```

**User memory** (existing):

```typescript
{
  scopeType: { $in: ['user_global', 'conversation', 'student_memory'] },
  userId: { $eq: currentUserId },
  status: { $eq: 'active' },
  ...(currentLessonId && { lessonId: { $eq: currentLessonId } })
}
```

---

## 15. Context Composition Updates

**New interface:**

```typescript
interface ContextComponents {
  systemMessage: string
  summary?: string
  lessonKbItems: MemoryItem[] // NEW
  memoryItems: MemoryItem[]
  recentMessages: Message[]
}
```

**Retrieval order:**

1. Lesson KB (topK=6, filtered by lessonId)
2. User memories (topK=4, filtered by userId + optional lessonId)
3. Recent conversation turns / summary

---

## 16. Deliverables (Implementation Order)

### Phase 0: Schema (BLOCKING)

- [ ] `src/collections/Lessons.ts` → Add `contentFiles[].ingestToKb` checkbox field (defaultValue: false)
- [ ] `src/collections/Media.ts` → Add `fileHash` field
- [ ] `src/collections/MemoryItems.ts` → Add all new fields
- [ ] `src/collections/IngestionLocks.ts` (NEW) → Full schema
- [ ] `scripts/migrations/create-ttl-index.ts` (NEW) → TTL index script
- [ ] Run `pnpm generate:types`

### Phase 1: Utilities

- [ ] `src/lib/utils/file-hash.ts` (NEW) → SHA-256 utility

### Phase 2: AI Services (CRITICAL: Implement ingestToKb filtering + metadata population)

- [ ] `src/lib/ai/lesson-kb/types.ts` (NEW) → Interfaces
- [ ] `src/lib/ai/lesson-kb/pdf-extractor.ts` (NEW) → Claude extraction
- [ ] `src/lib/ai/lesson-kb/chunker.ts` (NEW) → Semantic chunking (2000 char)
- [ ] `src/lib/ai/lesson-kb/lock-manager.ts` (NEW) → Lock CRUD
- [ ] `src/lib/ai/lesson-kb/ingestion-service.ts` (NEW) → Orchestration + **CRITICAL REQUIREMENTS**:
  - **MUST filter by ingestToKb === true** before processing
  - **MUST populate ALL required metadata fields** for every MemoryItem:
    - `lessonId` (from lesson doc)
    - `sourceFileId` (from Media doc ID)
    - `sourceFileName` (from Media.filename)
    - `sourceFileHash` (from Media.fileHash)
    - `sourcePageNumber` (1-based, from chunk position)
    - `sourceChunkIndex` (0-based, sequential within page)
    - `sourceChunkHash` (hash of normalized chunk text)
  - **MUST populate optional metadata when available**:
    - `sourceSectionTitle` (from Claude extraction)
    - `sourceTopics` (from Claude extraction, empty array if none)
    - `sourceExerciseId` (only when exercise detected)
  - **MUST NOT create MemoryItem without required fields**
- [ ] `src/lib/ai/lesson-kb/retrieval-service.ts` (NEW) → Hardcoded filters

### Phase 3: Context Updates

- [ ] `src/lib/ai/context-policy.ts` (UPDATE) → Add `lessonKbItems`
- [ ] `src/lib/ai/vector-search.ts` (UPDATE) → Lesson KB retrieval

### Phase 4: Lesson Lifecycle Integration

- [ ] `src/collections/Lessons.ts` (UPDATE) → Primary trigger: `afterChange` hook (check `ingestToKb === true`)
- [ ] `src/endpoints/agent/chat.ts` (UPDATE) → **CRITICAL CHANGES**:
  - **Add hard guard**: Block chat (409 error) if lesson has `ingestToKb=true` files but KB missing
  - **Remove auto-ingest on first message**: Only trigger fallback for explicit recovery scenarios
  - **Fallback conditions**: Only trigger when legacy/failed/drift detected AND lock not running
  - **Error response**: Return deterministic 409 payload with `retryAfter`

### Phase 5: Cron Setup

- [ ] `vercel.json` (UPDATE) → Cron config + auth header
- [ ] `src/app/api/cron/retry-embeddings/route.ts` (NEW) → Retry handler

### Phase 6: Database

- [ ] MongoDB Atlas vector index update → Add `sourceFileId`, `sourceFileHash` filters
- [ ] Run TTL index migration script

### Phase 7: Tests

- [ ] `tests/int/lesson-document-chat.int.spec.ts` (NEW) → 16 tests including:
  - **Metadata validation tests**: Assert all required fields present (lessonId, sourceFileId, sourceFileName, sourceFileHash, sourceChunkIndex)
  - **No auto-ingest test**: Assert first message does NOT trigger ingestion when KB properly exists
  - **Hard guard test**: Assert 409 error when KB missing + `ingestToKb=true`
  - **ingestToKb flag tests**: Toggle behavior validation
- [ ] `tests/fixtures/pdfs/` (NEW) → Test PDFs
- [ ] `tests/fixtures/ai-extractions/` (NEW) → Mock responses

### Phase 8: Documentation

- [ ] `docs/AGENTS.md` (UPDATE) → Lesson KB pattern
- [ ] `docs/features/chat-context/LESSON-KB.md` (NEW) → Feature guide

---

## 17. Pre-Flight Checklist (READ BEFORE CODING)

### MVP Design Decisions

- [ ] **Context-driven ingestion**: MUST filter by `ingestToKb === true`, never ingest all PDFs automatically
- [ ] **Media neutrality**: Media objects carry no ingestion semantics, same Media can be ingested in one lesson but not another
- [ ] **Zero ingestable files is valid**: If all `ingestToKb === false`, skip ingestion (info log, not error)
- [ ] **userId semantics**: Lesson KB allows undefined/null/'', validation checks `typeof value === 'string' && value.trim().length > 0` for user-scoped
- [ ] **fileHash computation**: Primary=buffer in beforeChange, Fallback=fetch during ingestion, Legacy=lazy compute
- [ ] **Lock TTL**: 45min, no heartbeat in MVP (Phase 2), accept rare duplicate risk
- [ ] **KB exists check**: Lock state=done + chunkCount>0 + at least 1 active item (indexed findOne)
- [ ] **Primary ingestion**: Lessons afterChange hook (publish/ingestable PDF update), chat assumes KB exists
- [ ] **Fallback ingestion**: Chat-triggered as recovery only (legacy/failed/drift), fire-and-forget
- [ ] **Hard chat guard**: Block chat with 409 error if KB missing + `ingestToKb=true` files exist
- [ ] **No auto-ingest on first message**: Chat does NOT trigger ingestion in normal flows
- [ ] **Required metadata fields**: ALL lesson_kb items MUST have lessonId, sourceFileId, sourceFileName, sourceFileHash, sourceChunkIndex, sourceChunkHash
- [ ] **CRON auth**: Must configure `Authorization` header in vercel.json + set CRON_SECRET env var
- [ ] **Vector index**: Add sourceFileId, sourceFileHash filters (future-proofing)

### Security Requirements

- [ ] Always filter by `scopeType` in vector search
- [ ] Verify user has lesson access before KB retrieval
- [ ] Always pass `req` to nested Payload operations
- [ ] Use `overrideAccess: false` when passing `user` to Local API
- [ ] Hardcode retrieval filters in service (never expose to caller)

### Observability

- [ ] Log all ingestion ops: lessonId, fileId, fileHash, chunkCount, requestId, duration
- [ ] Use existing `src/lib/ai/observability.ts` patterns
- [ ] Log errors with full context

### Error Handling

- [ ] Never block chat on ingestion failure
- [ ] Log errors, continue with available context
- [ ] Set status='failed' on failed MemoryItems
- [ ] Implement retry mechanism (Vercel Cron)

---

## 18. Stop Conditions

```yaml
Tests: All 16 tests pass (pnpm test:int tests/int/lesson-document-chat.int.spec.ts)
Quality: pnpm typecheck && pnpm lint && pnpm build (all pass)
Types: pnpm generate:types (after schema changes)
Database: Vector index updated + TTL index created
Idempotency: No duplicates on rerun (verified via tests)
Security: scopeType + lessonId filters enforced (code review)
Performance: Chat not blocked by ingestion (test #12)
Metadata: All required fields populated and validated (tests #1-16)
Chat Guard: 409 error enforced when KB missing (test assertion)
No Auto-Ingest: First message does NOT trigger ingestion (test assertion)
Observability: All ops logged with requestId
Transactions: All nested Payload ops pass req param
```

---

## 19. Vector Index Definition (MongoDB Atlas)

**Update existing `memory_items_embedding_v1`:**

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 1536, "similarity": "cosine" },
    { "type": "filter", "path": "userId" },
    { "type": "filter", "path": "scopeType" },
    { "type": "filter", "path": "lessonId" },
    { "type": "filter", "path": "conversationId" },
    { "type": "filter", "path": "status" },
    { "type": "filter", "path": "sourceFileId", "comment": "Future-proof: per-file cleanup" },
    { "type": "filter", "path": "sourceFileHash", "comment": "Future-proof: deduplication queries" }
  ]
}
```

**Rationale**: sourceFileId/sourceFileHash enable per-file cleanup, staleness checks, deduplication without collection scans.

---

## 20. Complete Example: Lesson KB MemoryItem

```typescript
{
  // Scope
  scopeType: 'lesson_kb',
  lessonId: 'lesson_xyz',
  userId: undefined, // Or null or '' (ignored on retrieval)

  // Content
  type: 'document',
  text: 'Exercise 3: Solve for x in equation...', // <= 2000 chars
  embedding: [0.123, -0.456, ...], // 1536 dims
  importance: 4, // High for source material

  // Status
  status: 'active', // Or pending_embedding, failed, archived

  // Source metadata
  sourceFileId: 'media_abc123',
  sourceFileName: 'lesson-03.pdf',
  sourceFileHash: 'sha256:deadbeef...',
  sourcePageNumber: 5,
  sourceChunkIndex: 2,
  sourceChunkHash: 'sha256:chunk...',
  sourceExerciseId: 'lesson_xyz:deadbeef:5:ex3',
  sourceSectionTitle: 'Quadratic Equations',
  sourceTopics: ['algebra', 'quadratic', 'solving'],

  // Retry fields
  retryCount: 0,
  nextRetryAt: null,
  lastError: null,

  // Timestamps
  createdAt: '2026-01-13T10:00:00Z',
  updatedAt: '2026-01-13T10:00:00Z'
}
```

---

## 21. Error Recovery

| Error                            | Action                                                                |
| -------------------------------- | --------------------------------------------------------------------- |
| Claude extraction fails          | Log error, set ingestion lock state=failed, chat continues without KB |
| Embedding API fails              | Save item with status='pending_embedding', schedule retry             |
| Lock already acquired            | Exit early, log "ingestion in progress"                               |
| Stale KB detected                | Archive old items, trigger re-ingestion with new fileHash             |
| No PDFs in lesson                | Skip ingestion, log info (not error)                                  |
| All PDFs have `ingestToKb=false` | Skip ingestion, log info (valid state, not error)                     |
| Empty/unreadable PDF             | Log warning, no items created, continue                               |
| CRON auth fails                  | Return 401, log security event                                        |
| Vector search fails              | Log error, return empty results, chat continues                       |

---

## 22. Quick Reference Card

```
LESSON KB INTEGRATION – QUICK CARD

SCOPE:
- Context-driven ingest: Only PDFs where contentFiles[].ingestToKb === true
- Shared lesson KB (scopeType='lesson_kb')
- Optional student memory (scopeType='student_memory')
- Kill switch: LESSON_KB_ENABLED env var

CONTEXT-DRIVEN INGESTION (CRITICAL):
- Ingestion is Lesson ↔ Media relationship, NOT Media property
- Media objects are neutral - same Media can be ingested in Lesson A, skipped in Lesson B
- MUST filter by ingestToKb === true before processing
- Zero ingestable files (all ingestToKb === false) is VALID - not an error

STORAGE:
- Lesson KB: lessonId scope, userId undefined/null/'', shared, filtered by ingestToKb
- Student Memory: userId + lessonId, personal

IDEMPOTENCY:
- fileHash (SHA-256) → Media.fileHash field
- Lock per (lessonId, fileId, fileHash)
- 45min TTL, no heartbeat in MVP

KB EXISTS CRITERIA:
1. Lock state=done + chunkCount>0
2. At least 1 active MemoryItem (indexed findOne)

STALENESS (ingestable files only):
- Current Media.fileHash ≠ stored sourceFileHash
- OR KB items exist but contentFiles no longer reference fileId
- OR ingestToKb toggled from true → false
- Action: Archive old, re-ingest with new hash (if still ingestToKb === true)

INGESTION FLOW (MVP):
PRIMARY:
- Lesson publish / ingestable PDF update → ingestion → chat-ready lesson
- Trigger: Lessons afterChange hook
- MUST filter: contentFiles.filter(f => f.ingestToKb === true)
- Chat assumes KB already exists

FALLBACK ONLY (Recovery):
- CRITICAL: DO NOT auto-ingest on first student message
- Chat-triggered ingestion for exceptional cases ONLY
- Legacy lessons, failed ingestion, data drift
- Fire-and-forget: void checkAndIngestLessonKb()
- Missing KB in chat = system error, not user flow
- Trigger conditions: Published + ingestable files + KB missing + lock not running + explicit recovery flag
- Monitor: Log fallback_ingestion_triggered=true, alert if frequent
- Phase 2: Add queue/worker

CHAT GUARD (REQUIRED):
- Hard guard: Block chat with 409 error if KB missing + ingestToKb=true files exist
- Error response: { error: 'lesson_kb_not_ready', statusCode: 409, retryAfter: 30 }
- Optionally trigger fallback on first detection (fire-and-forget)
- Never silently proceed without KB when KB expected

RETRY POLICY:
- Max 5 retries: 1m, 5m, 15m, 1h, 6h
- Vercel Cron + CRON_SECRET auth (explicit header config)
- status='pending_embedding' → retry, failed → permanent

RETRIEVAL FILTERS (HARDCODED):
Lesson KB: { scopeType: 'lesson_kb', lessonId, status: 'active' }
User: { scopeType: [...], userId, status: 'active', lessonId? }

SCHEMA CHANGES (BLOCKING):
1. Lessons.contentFiles[].ingestToKb (checkbox, defaultValue: false) ← NEW
2. Media.fileHash (text, index)
3. MemoryItems: scopeType, lessonId, userId optional, status options, retry fields, source metadata (REQUIRED fields)
   - CRITICAL: sourceFileId, sourceFileName, sourceFileHash, sourcePageNumber, sourceChunkIndex, sourceChunkHash MUST be populated
4. IngestionLocks collection (lockKey, state, expiresAt, metadata)
5. Run pnpm generate:types

DELIVERABLES ORDER:
Phase 0: Schema (BLOCKING - add Lessons.contentFiles[].ingestToKb)
Phase 1: Utilities (file-hash)
Phase 2: AI Services (MUST filter by ingestToKb === true + populate ALL required metadata fields)
Phase 3: Context updates (context-policy, vector-search)
Phase 4: Lesson Lifecycle Integration (afterChange hook checks ingestToKb + chat endpoint adds hard guard)
Phase 5: Cron setup (vercel.json, retry route)
Phase 6: Database (vector index, TTL index)
Phase 7: Tests (16 tests - includes metadata validation + no auto-ingest + hard guard tests)
Phase 8: Documentation

SECURITY CRITICAL:
- Always filter by scopeType
- Verify lesson access before KB retrieval
- Always pass req to nested Payload ops
- Hardcode filters in retrieval service (never expose)

TESTS (16):
1. Ingest PDFs when ingestToKb=true
2. Reuse existing KB (fileHash unchanged)
3. Retrieve KB chunks in lesson chat
4. Enforce 2000 char chunk limit
5. Skip when no PDFs
6. Skip when all ingestToKb=false
7. Handle empty/unreadable PDFs
8. Don't block chat on ingestion fail
9. Handle embedding failures (retry)
10. Enforce lesson access control
11. Prevent cross-lesson contamination
12. Fallback ingestion doesn't block chat
13. Cache extraction by fileHash
14. Same Media, different contexts
15. Toggle ingestToKb true → false
16. Toggle ingestToKb false → true

STOP CONDITIONS:
✓ All 16 tests pass
✓ Typecheck + lint + build pass
✓ Types regenerated
✓ Vector index updated + TTL index created
✓ No duplicates on rerun
✓ Filters enforce scopeType + lessonId
✓ Chat not blocked
✓ All ops logged
✓ Transactions safe (req passed)

VECTOR INDEX FIELDS:
embedding, userId, scopeType, lessonId, conversationId, status, sourceFileId, sourceFileHash

PRE-FLIGHT CHECKLIST:
□ Context-driven ingestion (MUST filter by ingestToKb === true)
□ Media neutrality (same Media can be ingested in one lesson, skipped in another)
□ Zero ingestable files is valid (all ingestToKb === false is OK, not error)
□ userId semantics (lesson_kb allows undefined/null/'', validation checks trim().length)
□ fileHash computation (buffer→beforeChange, fallback→fetch, legacy→lazy)
□ Lock TTL 45min, no heartbeat MVP (Phase 2)
□ KB exists check (lock + chunkCount + active item)
□ Primary ingestion (Lessons afterChange, check ingestToKb === true)
□ Fallback ingestion (chat-triggered recovery only, NOT on first message)
□ Hard chat guard (409 error if KB missing + ingestToKb=true files exist)
□ Required metadata (lessonId, sourceFileId, sourceFileName, sourceFileHash, sourceChunkIndex, sourceChunkHash)
□ CRON auth (explicit header in vercel.json + CRON_SECRET env)
□ Vector index future-proofing (sourceFileId, sourceFileHash)
```

---

## 23. References

- Original spec: `.tasks/lesson-document-chat-integration/spec.md`
- Memory system: `tests/int/memory-system.int.spec.ts`
- Context policy: `src/lib/ai/context-policy.ts`
- Vector search: `src/lib/ai/vector-search.ts`
- Exercise chat service: `src/lib/ai/services/exercise-chat-service.ts`
