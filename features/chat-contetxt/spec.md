# Spec: Chat Context + Long-Term Memory (Payload + MongoDB Atlas Vector Search)

## 1) Goal
Upgrade the current “stored chat history” into a reliable **context + memory system** for the model:
- **Short-term continuity** inside a conversation (working context)
- **Compression** of older turns (running summary)
- **Long-term memory** per **userId**, optionally scoped by **conversationId**, retrieved via **MongoDB Atlas $vectorSearch**
- **Deterministic prompt composition** (same order, same budgets, predictable behavior)
- **Payload remains the single source of truth** for chat messages

## 2) Non-Goals
- No agentic workflow orchestration (LangGraph) in this iteration
- No UI redesign required (admin UI changes optional)
- No “memory of everything” (we explicitly avoid storing noisy/ephemeral content)

## 3) Current State (as-is)
You have:
- `conversations` collection
- `messages` stored as an **array** inside each conversation (`maxRows=100`)
- `lastMessageAt` updated via hook

Limitations:
- The model has no “memory” unless we **inject** context at inference time.
- With `maxRows=100`, older context gets truncated unless we compress it.

## 4) Target Architecture (to-be)
We implement three layers:

### 4.1 Working Context (Short-Term)
Always include:
- System instructions (static)
- Conversation running summary (if exists)
- Last N messages from the conversation (window)

### 4.2 Running Summary (Compression)
- A single rolling text summary stored on the conversation.
- Updated periodically (threshold-based) to prevent context loss.

### 4.3 Long-Term Memory (Selective Recall)
- New collection: `memory_items`
- Memory is stored per **userId** and optionally by **conversationId**
- For each user query:
  - retrieve Top-K relevant memory items using **$vectorSearch**
  - inject retrieved memory into the prompt before the recent message window

## 5) Data Model Changes (Payload)

### 5.1 Conversations (extend existing)
Add fields to `conversations`:

1) `summary` (textarea)
- Purpose: compressed state of older messages
- Default: empty string

2) `summaryUpdatedAt` (date)
- Purpose: observability + debugging
- Default: null

3) `summaryUntilTimestamp` (date)
- Meaning: summary includes all messages with `timestamp <= summaryUntilTimestamp`
- Default: null

4) `contextPolicyVersion` (text)
- Purpose: future-proof prompt composition changes
- Default: "v1"

No breaking changes to the existing `messages[]` in this phase.

### 5.2 MemoryItems (new collection)
Create `memory_items` collection.

#### Required fields
- `userId` (text, required, indexed)
  - Canonical scalar identifier used for filtering (NOT a relationship field)
- `conversationId` (text, optional, indexed)
  - Canonical scalar identifier for optional local scope filtering
- `type` (select, required)
  - Allowed: `preference`, `decision`, `fact`, `open_loop`, `profile`, `constraint`, `other`
- `text` (textarea, required, maxLength: 2000)
- `embedding` (json / array of numbers, required)
  - Must be a flat numeric array
  - Must have exact length `numDimensions = 1536`
- `importance` (number, required)
  - Scale: 1–5
- `status` (select, required)
  - `active`, `deprecated`
- `source` (group, required)
  - `sourceConversationId` (text, optional)
  - `sourceMessageTimestamp` (date, required)
  - `sourceMessageRole` (select: `user` | `model`, required)
- `createdAt`, `updatedAt` (timestamps)

#### Optional fields (admin convenience)
- `user` (relationship to `users`, optional)
- `conversation` (relationship to `conversations`, optional)

**Important:** runtime filtering and vector search MUST use `userId` / `conversationId` scalar fields.

#### Indexes
- Index on `userId`
- Index on `conversationId` (optional but recommended)
- (Optional) compound index on `(userId, conversationId, status)`

#### Access Control
- Admin: full access
- User:
  - read: only items where `userId == req.user.id`
  - create/update/delete: server-only (no direct client writes)

## 6) Atlas Configuration (Automated via Deployment Script)

### 6.1 Principle
Vector Search index MUST be provisioned automatically as part of deployment / environment setup.
Index creation is NOT allowed during normal user request handling.

### 6.2 Provisioning Strategy (Pick One)
**Option A (Recommended): Atlas Admin API**
- A dedicated CI/deployment script provisions the Vector Search index on `memory_items`.
- Script is idempotent:
  - If index exists and matches expected definition → no-op
  - If missing → create
  - If exists but differs → fail hard (manual intervention required)

**Option B: DB-side tooling**
- Use mongosh/driver capabilities if supported.
- Same idempotency requirements.

### 6.3 Required Secrets / Permissions (Deployment Only)
Deployment environment MUST provide:
- Atlas Project ID
- Database name
- Collection name: `memory_items`
- Vector index name (e.g. `memory_items_embedding_v1`)
- Atlas API credentials (API Key / Service Account)
- Least privilege:
  - credentials limited to index management
  - never reuse runtime app DB credentials

### 6.4 Index Definition (Source of Truth)
Repository contains a versioned definition file, e.g.:
- `infra/atlas/vector-index.memory_items.v1.json`

Definition MUST include:
- `path`: `embedding`
- `numDimensions`: **1536**
- `similarity`: `cosine`
- filterable fields:
  - `userId` (required)
  - `conversationId` (optional)
  - `status` (required; default filter is `active`)

### 6.5 Provisioning Flow (Idempotent)
On deploy (CI step) run:
1) Validate required env vars exist
2) Fetch current search/vector indexes on `memory_items`
3) If index missing:
   - Create index with exact definition
   - Poll until index is READY (max 10 minutes; poll every 20 seconds)
4) If index exists:
   - Compare expected definition hash vs current definition hash
   - If match → success
   - If mismatch → FAIL with explicit diff instructions

### 6.6 Environment Guardrails
- Provisioning MUST run only on `staging` and `production`
- Preview/PR deployments MUST NOT attempt provisioning

### 6.7 Failure Behavior
- If provisioning fails → deployment fails
- App must handle missing vector index gracefully (skip retrieval)
- Production rollout requires index READY before use

### 6.8 Index Versioning
- Any change to embeddings model or `numDimensions` requires a new index version (`..._v2`)
- Rollout strategy:
  1) create v2
  2) dual-write embeddings to v1+v2 (temporary)
  3) switch reads to v2
  4) deprecate v1

## 7) Runtime Contracts

### 7.1 Feature Flags Removed
Summary maintenance, extraction, and retrieval run by default.

### 7.2 Prompt Composition Contract (Deterministic)
For every model call, prompt MUST be composed in this exact order:

1) System message (static)
2) Conversation summary (if non-empty)
3) Retrieved memory items (Top-K)
4) Recent messages window (last N messages, INCLUDING the latest user message if it was persisted before call)
5) (No duplicate insertion of the new user message)

No ad-hoc insertions. No reordering.

### Policy v1 Defaults
- Recent window N: **20**
- Memory Top-K: **8**
- Vector candidates: **200**
- Summary threshold: when `messages.length > 40`
- Hard safety: must run summary maintenance before hitting `maxRows=100` (e.g. when `messages.length > 80`)

### 7.3 Embedding Validation (Hard Guardrail)
- If `embedding.length !== 1536` → reject write (do not store MemoryItem)

### 7.4 Single Source of Truth
- Payload `conversations.messages[]` remains canonical for the current window.
- No message persistence in LangChain stores.
- `memory_items` is derived and independent.

## 8) Core Flows

### 8.1 Persist Turn Flow (No duplication)
When user sends a message:
1) Append user message into `conversation.messages`
2) Update `lastMessageAt`
3) Call `buildContextAndRunModel()` using the conversation’s messages (which already include the new user message)
4) Append model reply into `conversation.messages`
5) Update `lastMessageAt`
6) Run maintenance (summary/memory) according to thresholds

### 8.2 buildContextAndRunModel()
Inputs:
- `conversationId`
- `userId`

Steps:
1) Load conversation (`summary`, `messages`)
2) Build retrieval query text:
   - Use the newest user message + optionally last 1–2 user turns
3) If vector index is available:
   - Retrieve memory items via `$vectorSearch` (see Section 9)
4) Compose prompt strictly per Section 7.2
5) Call model
6) Return model reply

### 8.3 Running Summary Maintenance
Triggers:
- If `messages.length > 40` (normal threshold)
- OR if `messages.length > 80` (safety threshold before maxRows=100)

Process:
1) Select “older segment” to summarize:
   - All messages except last 20
2) Generate updated summary:
   - Input: existing `summary` + older segment
   - Output: updated `summary` (concise, factual, includes decisions + open loops)
3) Persist:
   - Update `summary`
   - Update `summaryUpdatedAt`
   - Set `summaryUntilTimestamp` to last timestamp included in the summarized segment
4) Trim:
   - Keep only last 20 messages in `conversation.messages`

Outcome:
- Conversation never “forgets”; old context is compressed into `summary`.

### 8.4 Memory Extraction (Create/Update MemoryItems)
Triggers:
- After model reply (recommended)
- Or when stable signals detected (preferences, decisions, constraints)

Extraction method:
1) Provide the model:
   - Last X messages (small window)
   - Current summary (optional)
2) Ask it to output candidate memory items:
   - { type, text, importance(1–5), scope(user|conversation), reason }
3) Server filtering rules (must apply):
   - Reject generic/ephemeral items
   - Enforce maxLength
   - Enforce allowed types only
4) Compute embeddings for accepted items
5) Dedup/Upsert policy:
   - Run `$vectorSearch` with `{ userId, status: 'active' }` and limit 1
   - If similarity >= threshold (configurable, e.g. 0.9) → update that existing item
   - Else insert a new MemoryItem
6) Set scope fields:
   - Always set `userId`
   - If scope is conversation → also set `conversationId`
7) Persist `source` metadata

## 9) MongoDB Atlas Vector Retrieval (Implementation Rules)

### 9.1 Query Rules
- Use aggregation pipeline with `$vectorSearch` as the FIRST stage.
- Use:
  - `index`: vector index name (e.g. `memory_items_embedding_v1`)
  - `path`: `embedding`
  - `queryVector`: embedding(queryText)
  - `numCandidates`: 200
  - `limit`: K (8)
  - `filter`: must include `userId` and `status: 'active'`

### 9.2 Retrieval Policy (Prefer-local)
We will prefer local (conversation-scoped) memory when available:

- Query A (local): Top 4 with filter:
  - `{ userId, conversationId, status: 'active' }`
- Query B (global): Top 4 with filter:
  - `{ userId, status: 'active' }`

Combine results:
- Merge A then B, deduplicate by MemoryItem ID
- Total max K = 8

### 9.3 Fallback Behavior
If vector retrieval fails (index not READY, errors, timeouts):
- Continue without memory items (summary + recent window only)
- Log retrieval failure event

## 10) Security & Guardrails

### 10.1 Tenant Isolation (Critical)
- Every memory retrieval MUST filter by `userId`.
- Conversations access stays as-is (owner/admin rule).

### 10.2 Data Minimization
- Store only information that improves tutoring behavior.
- Avoid storing sensitive personal data unless required by product.

### 10.3 Memory Quality Controls
- Only store allowed types
- Bound importance to 1–5
- Use `status=deprecated` rather than delete

## 11) Observability & Debugging
Log (server-side) per model call:
- conversationId, userId
- contextPolicyVersion
- selected memory item IDs (and counts local/global)
- summary length, message window size
- retrieval latency + model latency
- flags enabled

Optional:
- Store sampled “context snapshots” for debugging (OFF by default)

## 12) Scaling Considerations

### 12.1 Now
- Keep messages embedded in conversation with trimming + summary.
- Store long-term memory in `memory_items` with vector search.

### 12.2 Later
- Move messages to dedicated `messages` collection for unlimited history + analytics.
- Keep summary on conversation regardless.
- Keep `memory_items` unchanged.

## 13) Acceptance Criteria

### Context Behavior
- Model can refer to earlier conversation facts after trimming (via summary).
- Model can recall stable user preferences across conversations (via memory_items on userId).

### Isolation
- Vector retrieval never returns memory items from another user.

### Robustness
- If vector retrieval fails, chat still works with summary + recent window.

### Data Integrity
- No duplicate user message insertion in prompt.
- Embedding length validation enforced (1536).

## 14) Rollout Plan
1) Add conversation summary fields
2) Add `memory_items` collection
3) Add provisioning script + index definition (IaC)
4) Verify vector index readiness
5) Deploy with memory features enabled by default
6) Monitor: latency, relevance, leakage checks

## 15) Open Configuration Values (Final)
- Embeddings model (must output 1536 dims)
- Vector index name: `memory_items_embedding_v1`
- Similarity: cosine
- Defaults:
  - N_recent=20
  - K_memory=8 (4 local + 4 global)
  - numCandidates=200
  - summaryThreshold=40
  - safetyThreshold=80
  - dedupSimilarityThreshold (start ~0.9; tune)

