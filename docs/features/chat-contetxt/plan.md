# Implementation Plan: Chat Context + Long-Term Memory

> **Target Audience**: Junior developers
> **Estimated Timeline**: Multiple phases (see breakdown below)
> **Prerequisites**: Familiarity with Payload CMS, Next.js, MongoDB, TypeScript

---

## Overview

This plan implements a three-layer context system for our AI chat:
1. **Working Context**: Recent messages (short-term)
2. **Running Summary**: Compressed history (medium-term)
3. **Long-Term Memory**: Vector-searchable facts per user (long-term)

We'll build this incrementally with feature flags to enable safe rollout.

---

## Phase 1: Foundation & Data Model (Week 1)

### 1.1 Extend Conversations Collection

**File**: `src/collections/Conversations/index.ts`

**What to do**:
1. Add new fields to the existing `conversations` collection schema:
   ```typescript
   {
     name: 'summary',
     type: 'textarea',
     admin: {
       description: 'Compressed history of older messages',
     },
     defaultValue: '',
   },
   {
     name: 'summaryUpdatedAt',
     type: 'date',
     admin: {
       description: 'When summary was last updated',
     },
   },
   {
     name: 'summaryUntilTimestamp',
     type: 'date',
     admin: {
       description: 'Summary includes messages up to this timestamp',
     },
   },
   {
     name: 'contextPolicyVersion',
     type: 'text',
     defaultValue: 'v1',
     required: true,
     admin: {
       description: 'Version of prompt composition policy',
     },
   }
   ```

**Why**: These fields enable conversation compression without losing context.

**Testing**:
- Run `pnpm generate:types` to regenerate TypeScript types
- Verify fields appear in admin panel at `/admin/collections/conversations`
- Check that existing conversations still load (new fields default correctly)

**Junior Tips**:
- The `summary` field will store compressed conversation history
- `summaryUntilTimestamp` helps us know which messages are already summarized
- `contextPolicyVersion` lets us change how prompts are built in the future without breaking old data

---

### 1.2 Create MemoryItems Collection

**File**: `src/collections/MemoryItems/index.ts` (new file)

**What to do**:
1. Create the collection file with proper structure
2. Define all required fields (see spec section 5.2)
3. Set up access control rules
4. Add database indexes

**Implementation checklist**:

```typescript
// src/collections/MemoryItems/index.ts
import type { CollectionConfig } from 'payload'

export const MemoryItems: CollectionConfig = {
  slug: 'memory_items',
  admin: {
    useAsTitle: 'text',
    defaultColumns: ['text', 'type', 'importance', 'status', 'createdAt'],
    group: 'Chat System',
  },
  access: {
    // Admin has full access
    read: ({ req }) => {
      if (req.user?.role === 'admin') return true
      // Users can only read their own memory items
      return {
        userId: { equals: req.user?.id }
      }
    },
    create: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => req.user?.role === 'admin',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    // Tenant isolation (CRITICAL)
    {
      name: 'userId',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'User ID for filtering (NOT a relationship)',
      },
    },
    {
      name: 'conversationId',
      type: 'text',
      index: true,
      admin: {
        description: 'Optional conversation scope (NOT a relationship)',
      },
    },

    // Core fields
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Preference', value: 'preference' },
        { label: 'Decision', value: 'decision' },
        { label: 'Fact', value: 'fact' },
        { label: 'Open Loop', value: 'open_loop' },
        { label: 'Profile', value: 'profile' },
        { label: 'Constraint', value: 'constraint' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'text',
      type: 'textarea',
      required: true,
      maxLength: 2000,
      admin: {
        description: 'The memory content',
      },
    },
    {
      name: 'embedding',
      type: 'json',
      required: true,
      admin: {
        description: 'Vector embedding (1536 dimensions)',
      },
      validate: (value) => {
        if (!Array.isArray(value)) {
          return 'Embedding must be an array'
        }
        if (value.length !== 1536) {
          return 'Embedding must have exactly 1536 dimensions'
        }
        if (!value.every((v) => typeof v === 'number')) {
          return 'Embedding must contain only numbers'
        }
        return true
      },
    },
    {
      name: 'importance',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
      admin: {
        description: 'Importance scale 1-5',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Deprecated', value: 'deprecated' },
      ],
      index: true,
    },

    // Source tracking
    {
      name: 'source',
      type: 'group',
      fields: [
        {
          name: 'sourceConversationId',
          type: 'text',
        },
        {
          name: 'sourceMessageTimestamp',
          type: 'date',
          required: true,
        },
        {
          name: 'sourceMessageRole',
          type: 'select',
          required: true,
          options: [
            { label: 'User', value: 'user' },
            { label: 'Model', value: 'model' },
          ],
        },
      ],
    },

    // Optional admin convenience (relationships)
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Convenience field - DO NOT use for filtering',
      },
    },
    {
      name: 'conversation',
      type: 'relationship',
      relationTo: 'conversations',
      admin: {
        description: 'Convenience field - DO NOT use for filtering',
      },
    },
  ],
  timestamps: true,
}
```

**Don't forget**:
1. Add to `src/collections/index.ts`:
   ```typescript
   export { MemoryItems } from './MemoryItems'
   ```
2. Import in `src/payload.config.ts`:
   ```typescript
   import { MemoryItems } from './collections/MemoryItems'
   // ... add to collections array
   ```

**Testing**:
- Run `pnpm generate:types`
- Check admin panel at `/admin/collections/memory_items`
- Try creating a test memory item manually
- Verify validation (try wrong embedding length - should fail)

**Junior Tips**:
- `userId` and `conversationId` are stored as plain text (not relationships) for performance
- The `embedding` field stores a vector (array of 1536 numbers) for semantic search
- We use `status: 'deprecated'` instead of deleting to preserve history
- Access control ensures users only see their own memories

---

### 1.3 Add Feature Flags

**File**: `src/lib/env.ts` or create `src/lib/feature-flags.ts`

**What to do**:
1. Define environment variables for feature flags
2. Create a typed config object
3. Add default values (all OFF initially)

**Implementation**:

```typescript
// src/lib/feature-flags.ts
export const featureFlags = {
  // Chat context features (all OFF by default)
  SUMMARY_MAINTENANCE_ENABLED: process.env.SUMMARY_MAINTENANCE_ENABLED === 'true',
  MEMORY_EXTRACTION_ENABLED: process.env.MEMORY_EXTRACTION_ENABLED === 'true',
  MEMORY_RETRIEVAL_ENABLED: process.env.MEMORY_RETRIEVAL_ENABLED === 'true',
} as const

export type FeatureFlags = typeof featureFlags

// Helper for logging flag status
export function logFeatureFlags() {
  console.log('[Feature Flags]', {
    summaryMaintenance: featureFlags.SUMMARY_MAINTENANCE_ENABLED,
    memoryExtraction: featureFlags.MEMORY_EXTRACTION_ENABLED,
    memoryRetrieval: featureFlags.MEMORY_RETRIEVAL_ENABLED,
  })
}
```

**Update `.env.example`**:
```bash
# Chat Context Feature Flags (default: false)
SUMMARY_MAINTENANCE_ENABLED=false
MEMORY_EXTRACTION_ENABLED=false
MEMORY_RETRIEVAL_ENABLED=false
```

**Testing**:
- Import and log flags in your app to verify they're read correctly
- Try toggling them in `.env.local` and restarting the server

**Junior Tips**:
- Feature flags let us deploy code without activating it
- We'll enable these in order: summary → extraction → retrieval
- Never use feature flags directly in code - always import from this file

---

## Phase 2: Infrastructure Setup (Week 2)

### 2.1 Create Vector Index Definition

**File**: `infra/atlas/vector-index.memory_items.v1.json` (new file)

**What to do**:
1. Create the `infra/atlas` directory
2. Define the vector search index configuration

**Implementation**:

```json
{
  "name": "memory_items_embedding_v1",
  "type": "vectorSearch",
  "definition": {
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
}
```

**Junior Tips**:
- This defines how MongoDB Atlas will index our embeddings
- `numDimensions: 1536` matches OpenAI's embedding size
- `cosine` similarity works best for text embeddings
- Filter fields let us search within a user's data only

---

### 2.2 Create Index Provisioning Script

**File**: `scripts/provision-vector-index.ts` (new file)

**What to do**:
1. Create a script that provisions the vector index in Atlas
2. Make it idempotent (safe to run multiple times)
3. Add error handling and validation

**Implementation outline** (you'll need to complete this):

```typescript
// scripts/provision-vector-index.ts
import { MongoClient } from 'mongodb'
import { readFileSync } from 'fs'
import { join } from 'path'

interface VectorIndexDefinition {
  name: string
  type: string
  definition: {
    fields: Array<{
      type: string
      path: string
      numDimensions?: number
      similarity?: string
    }>
  }
}

async function provisionVectorIndex() {
  // 1. Validate environment variables
  const requiredVars = [
    'MONGODB_URI',
    'ATLAS_PROJECT_ID',
    'ATLAS_PUBLIC_KEY',
    'ATLAS_PRIVATE_KEY',
  ]

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required env var: ${varName}`)
    }
  }

  // 2. Load index definition
  const indexDefPath = join(__dirname, '../infra/atlas/vector-index.memory_items.v1.json')
  const indexDef: VectorIndexDefinition = JSON.parse(readFileSync(indexDefPath, 'utf-8'))

  // 3. Connect to MongoDB
  const client = new MongoClient(process.env.MONGODB_URI!)
  await client.connect()

  try {
    const db = client.db()
    const collection = db.collection('memory_items')

    // 4. Check if index exists
    const indexes = await collection.listSearchIndexes().toArray()
    const existingIndex = indexes.find((idx) => idx.name === indexDef.name)

    if (existingIndex) {
      console.log(`✓ Vector index "${indexDef.name}" already exists`)

      // TODO: Compare definitions and fail if they differ
      // For now, we assume matching name = matching definition
      return
    }

    // 5. Create index
    console.log(`Creating vector index "${indexDef.name}"...`)
    await collection.createSearchIndex({
      name: indexDef.name,
      type: 'vectorSearch',
      definition: indexDef.definition,
    })

    // 6. Poll until ready (max 10 minutes)
    const maxWaitMs = 10 * 60 * 1000
    const pollIntervalMs = 20 * 1000
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      const indexes = await collection.listSearchIndexes().toArray()
      const index = indexes.find((idx) => idx.name === indexDef.name)

      if (index?.status === 'READY') {
        console.log(`✓ Vector index "${indexDef.name}" is READY`)
        return
      }

      console.log(`  Index status: ${index?.status || 'UNKNOWN'}, waiting...`)
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }

    throw new Error(`Index creation timed out after ${maxWaitMs / 1000}s`)
  } finally {
    await client.close()
  }
}

// Run if called directly
if (require.main === module) {
  provisionVectorIndex()
    .then(() => {
      console.log('✓ Vector index provisioning complete')
      process.exit(0)
    })
    .catch((error) => {
      console.error('✗ Vector index provisioning failed:', error)
      process.exit(1)
    })
}

export { provisionVectorIndex }
```

**Add to `package.json`**:
```json
{
  "scripts": {
    "provision:vector-index": "tsx scripts/provision-vector-index.ts"
  }
}
```

**Testing**:
- Test locally against your MongoDB Atlas instance
- Verify it's idempotent (run twice, second run should skip creation)
- Test error cases (missing env vars, wrong credentials)

**Junior Tips**:
- This script runs during deployment, not during normal app operation
- Idempotent means "safe to run multiple times with same result"
- The polling loop waits for Atlas to finish building the index
- Never run this during user requests - it's too slow

---

### 2.3 Update Environment Variables

**Files**: `.env.example`, documentation

**What to add**:

```bash
# MongoDB Atlas Vector Search (deployment only)
ATLAS_PROJECT_ID=
ATLAS_PUBLIC_KEY=
ATLAS_PRIVATE_KEY=

# OpenAI for embeddings
OPENAI_API_KEY=
```

**Junior Tips**:
- Atlas API keys are different from database connection strings
- These credentials should have minimal permissions (index management only)
- Never commit real credentials to git

---

## Phase 3: Core Utility Functions (Week 3)

### 3.1 Embeddings Service

**File**: `src/lib/ai/embeddings.ts` (new file)

**What to do**:
1. Create a service to generate embeddings using OpenAI
2. Add validation for output dimensions
3. Add error handling and retries

**Implementation**:

```typescript
// src/lib/ai/embeddings.ts
import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const EMBEDDING_MODEL = 'text-embedding-3-small' // 1536 dimensions
const EXPECTED_DIMENSIONS = 1536

export interface EmbeddingResult {
  embedding: number[]
  model: string
  tokensUsed: number
}

export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text')
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim(),
    })

    const embedding = response.data[0].embedding

    // Validate dimensions (critical guardrail)
    if (embedding.length !== EXPECTED_DIMENSIONS) {
      throw new Error(
        `Embedding dimension mismatch: expected ${EXPECTED_DIMENSIONS}, got ${embedding.length}`
      )
    }

    return {
      embedding,
      model: response.model,
      tokensUsed: response.usage.total_tokens,
    }
  } catch (error) {
    console.error('[Embeddings] Generation failed:', error)
    throw error
  }
}

export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  // Batch multiple texts for efficiency
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts.map((t) => t.trim()),
  })

  return response.data.map((item) => ({
    embedding: item.embedding,
    model: response.model,
    tokensUsed: response.usage.total_tokens / texts.length, // approximate
  }))
}
```

**Testing**:
- Test with sample text: `generateEmbedding("Hello world")`
- Verify output has 1536 dimensions
- Test error cases (empty string, API key issues)

**Junior Tips**:
- Embeddings are vector representations of text
- Similar texts have similar vectors (measured by cosine similarity)
- Always validate dimensions before storing

---

### 3.2 Vector Search Service

**File**: `src/lib/ai/vector-search.ts` (new file)

**What to do**:
1. Create functions to query MongoDB Atlas vector search
2. Implement the "prefer-local" policy (conversation-scoped first)
3. Add fallback handling

**Implementation**:

```typescript
// src/lib/ai/vector-search.ts
import type { Db } from 'mongodb'
import { generateEmbedding } from './embeddings'

const VECTOR_INDEX_NAME = 'memory_items_embedding_v1'
const NUM_CANDIDATES = 200
const TOP_K_LOCAL = 4
const TOP_K_GLOBAL = 4

export interface MemoryItem {
  _id: string
  userId: string
  conversationId?: string
  type: string
  text: string
  importance: number
  status: string
  source: {
    sourceConversationId?: string
    sourceMessageTimestamp: Date
    sourceMessageRole: 'user' | 'model'
  }
  createdAt: Date
  updatedAt: Date
}

export interface RetrievalResult {
  items: MemoryItem[]
  localCount: number
  globalCount: number
  latencyMs: number
}

/**
 * Retrieve relevant memory items for a user query
 * Implements prefer-local policy: 4 conversation-scoped + 4 global
 */
export async function retrieveMemoryItems(
  db: Db,
  userId: string,
  queryText: string,
  conversationId?: string
): Promise<RetrievalResult> {
  const startTime = Date.now()

  try {
    // Generate query embedding
    const { embedding: queryVector } = await generateEmbedding(queryText)

    const collection = db.collection<MemoryItem>('memory_items')
    const results: MemoryItem[] = []
    let localCount = 0
    let globalCount = 0

    // Query A: Conversation-scoped memory (if conversationId provided)
    if (conversationId) {
      const localResults = await collection
        .aggregate([
          {
            $vectorSearch: {
              index: VECTOR_INDEX_NAME,
              path: 'embedding',
              queryVector,
              numCandidates: NUM_CANDIDATES,
              limit: TOP_K_LOCAL,
              filter: {
                userId: { $eq: userId },
                conversationId: { $eq: conversationId },
                status: { $eq: 'active' },
              },
            },
          },
          {
            $project: {
              embedding: 0, // Don't return embeddings (large)
              score: { $meta: 'vectorSearchScore' },
            },
          },
        ])
        .toArray()

      results.push(...localResults)
      localCount = localResults.length
    }

    // Query B: User-global memory
    const globalResults = await collection
      .aggregate([
        {
          $vectorSearch: {
            index: VECTOR_INDEX_NAME,
            path: 'embedding',
            queryVector,
            numCandidates: NUM_CANDIDATES,
            limit: TOP_K_GLOBAL,
            filter: {
              userId: { $eq: userId },
              status: { $eq: 'active' },
            },
          },
        },
        {
          $project: {
            embedding: 0,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ])
      .toArray()

    // Deduplicate: prefer local results over global
    const seenIds = new Set(results.map((r) => r._id.toString()))
    for (const item of globalResults) {
      if (!seenIds.has(item._id.toString())) {
        results.push(item)
        globalCount++
      }
    }

    // Enforce total limit
    const finalResults = results.slice(0, TOP_K_LOCAL + TOP_K_GLOBAL)

    const latencyMs = Date.now() - startTime

    return {
      items: finalResults,
      localCount,
      globalCount,
      latencyMs,
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    console.error('[VectorSearch] Retrieval failed:', error)

    // Fallback: return empty (system continues without memory)
    return {
      items: [],
      localCount: 0,
      globalCount: 0,
      latencyMs,
    }
  }
}

/**
 * Find similar memory items (for deduplication during extraction)
 */
export async function findSimilarMemoryItem(
  db: Db,
  userId: string,
  queryEmbedding: number[],
  similarityThreshold: number = 0.9
): Promise<MemoryItem | null> {
  const collection = db.collection<MemoryItem>('memory_items')

  const results = await collection
    .aggregate([
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: 50,
          limit: 1,
          filter: {
            userId: { $eq: userId },
            status: { $eq: 'active' },
          },
        },
      },
      {
        $project: {
          embedding: 0,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ])
    .toArray()

  if (results.length === 0) {
    return null
  }

  const topResult = results[0]

  // Check if similarity meets threshold
  if ((topResult as any).score >= similarityThreshold) {
    return topResult
  }

  return null
}
```

**Testing**:
- Test retrieval with sample user and query
- Verify conversation-scoped results come first
- Test deduplication (same item shouldn't appear twice)
- Test fallback (disconnect DB, should return empty array)

**Junior Tips**:
- `$vectorSearch` must be the first stage in the aggregation pipeline
- We exclude `embedding` from results to save bandwidth (it's large)
- The deduplication ensures we don't show the same memory twice
- Fallback means the system keeps working even if vector search fails

---

### 3.3 Context Policy (Prompt Composition)

**File**: `src/lib/ai/context-policy.ts` (new file)

**What to do**:
1. Implement deterministic prompt composition
2. Follow the exact order from the spec
3. Add token budget management (optional for v1)

**Implementation**:

```typescript
// src/lib/ai/context-policy.ts
import type { Message } from '@/payload-types'
import type { MemoryItem } from './vector-search'

export const CONTEXT_POLICY_VERSION = 'v1'

export const CONTEXT_POLICY_V1 = {
  recentWindowSize: 20,
  memoryTopK: 8,
  vectorCandidates: 200,
  summaryThreshold: 40,
  safetyThreshold: 80,
} as const

export interface ContextComponents {
  systemMessage: string
  summary?: string
  memoryItems: MemoryItem[]
  recentMessages: Message[]
}

export interface ComposedPrompt {
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  metadata: {
    policyVersion: string
    summaryLength: number
    memoryCount: number
    messageCount: number
  }
}

/**
 * Compose a deterministic prompt following Context Policy V1
 *
 * Order (MUST be maintained):
 * 1. System message (static)
 * 2. Conversation summary (if exists)
 * 3. Retrieved memory items (Top-K)
 * 4. Recent messages window
 */
export function composePrompt(
  systemInstructions: string,
  components: ContextComponents
): ComposedPrompt {
  const messages: ComposedPrompt['messages'] = []

  // 1. System message
  let systemContent = systemInstructions

  // 2. Append summary to system message (if exists)
  if (components.summary && components.summary.trim().length > 0) {
    systemContent += '\n\n## Conversation Summary\n' + components.summary
  }

  // 3. Append memory items to system message (if any)
  if (components.memoryItems.length > 0) {
    systemContent += '\n\n## Relevant Context from Past Conversations\n'
    systemContent += components.memoryItems
      .map((item, idx) => {
        return `${idx + 1}. [${item.type}] ${item.text} (importance: ${item.importance}/5)`
      })
      .join('\n')
  }

  messages.push({
    role: 'system',
    content: systemContent,
  })

  // 4. Recent messages window
  for (const msg of components.recentMessages) {
    messages.push({
      role: msg.role === 'model' ? 'assistant' : 'user',
      content: msg.text,
    })
  }

  return {
    messages,
    metadata: {
      policyVersion: CONTEXT_POLICY_VERSION,
      summaryLength: components.summary?.length || 0,
      memoryCount: components.memoryItems.length,
      messageCount: components.recentMessages.length,
    },
  }
}

/**
 * Get the last N messages (recent window)
 */
export function getRecentWindow(messages: Message[], windowSize: number = CONTEXT_POLICY_V1.recentWindowSize): Message[] {
  return messages.slice(-windowSize)
}

/**
 * Get older messages that should be summarized
 */
export function getMessagesToSummarize(
  messages: Message[],
  windowSize: number = CONTEXT_POLICY_V1.recentWindowSize
): Message[] {
  if (messages.length <= windowSize) {
    return []
  }
  return messages.slice(0, -windowSize)
}

/**
 * Build query text for vector retrieval
 * Uses the newest user message(s)
 */
export function buildRetrievalQuery(messages: Message[]): string {
  // Get last 3 user messages
  const userMessages = messages
    .filter((m) => m.role === 'user')
    .slice(-3)

  if (userMessages.length === 0) {
    return ''
  }

  // Combine recent user messages for context-aware retrieval
  return userMessages.map((m) => m.text).join(' ')
}
```

**Testing**:
- Test prompt composition with various combinations
- Verify order is always: system → summary → memory → messages
- Test edge cases (no summary, no memory, no messages)

**Junior Tips**:
- "Deterministic" means same input = same output every time
- We append summary and memory to the system message to save on message count
- The order matters for model performance
- Never duplicate the latest user message

---

## Phase 4: Summary Maintenance (Week 4)

### 4.1 Summary Generation Service

**File**: `src/lib/ai/summary.ts` (new file)

**What to do**:
1. Create a function to generate/update conversation summaries
2. Use the AI model to compress message history
3. Handle edge cases (empty summary, first summary, etc.)

**Implementation**:

```typescript
// src/lib/ai/summary.ts
import type { Message } from '@/payload-types'
import { openai } from './openai-client' // You'll need to create this

export interface SummaryResult {
  summary: string
  summaryUntilTimestamp: Date
  tokensUsed: number
}

const SUMMARY_SYSTEM_PROMPT = `You are a conversation summarizer for an educational chat system.

Your task is to create a concise, factual summary that preserves:
- Key decisions made
- User preferences and constraints
- Important facts and context
- Open loops (unresolved questions)
- Learning progress

Keep the summary under 500 words. Use clear, structured format.
Omit greetings, small talk, and ephemeral content.`

/**
 * Generate or update conversation summary
 */
export async function generateSummary(
  existingSummary: string,
  messagesToSummarize: Message[]
): Promise<SummaryResult> {
  if (messagesToSummarize.length === 0) {
    throw new Error('Cannot summarize empty message list')
  }

  // Build prompt
  const messagesText = messagesToSummarize
    .map((msg) => {
      const timestamp = new Date(msg.timestamp).toISOString()
      return `[${timestamp}] ${msg.role}: ${msg.text}`
    })
    .join('\n\n')

  let userPrompt = ''
  if (existingSummary && existingSummary.trim().length > 0) {
    userPrompt = `Here is the existing summary:\n\n${existingSummary}\n\n---\n\nHere are new messages to incorporate:\n\n${messagesText}\n\n---\n\nPlease update the summary to include the new information.`
  } else {
    userPrompt = `Here are the messages to summarize:\n\n${messagesText}\n\n---\n\nPlease create a summary.`
  }

  // Call model
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // Cheaper model is fine for summaries
    messages: [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3, // More deterministic
    max_tokens: 1000,
  })

  const summary = response.choices[0].message.content || ''
  const lastMessage = messagesToSummarize[messagesToSummarize.length - 1]

  return {
    summary,
    summaryUntilTimestamp: new Date(lastMessage.timestamp),
    tokensUsed: response.usage?.total_tokens || 0,
  }
}
```

**Junior Tips**:
- Summaries should be factual, not conversational
- We use a cheaper model (gpt-4o-mini) because summaries don't need the best model
- `summaryUntilTimestamp` tracks which messages are included

---

### 4.2 Summary Maintenance Hook

**File**: `src/lib/ai/maintenance.ts` (new file)

**What to do**:
1. Create a function that checks if summary maintenance is needed
2. Trigger summary generation when thresholds are met
3. Update the conversation with new summary and trim messages

**Implementation**:

```typescript
// src/lib/ai/maintenance.ts
import type { Payload } from 'payload'
import type { Conversation } from '@/payload-types'
import { featureFlags } from '../feature-flags'
import { CONTEXT_POLICY_V1 } from './context-policy'
import { generateSummary } from './summary'
import { getMessagesToSummarize, getRecentWindow } from './context-policy'

export interface MaintenanceResult {
  summaryUpdated: boolean
  messagesTrimmed: number
  tokensUsed: number
}

/**
 * Run summary maintenance if needed
 *
 * Triggers:
 * - Normal: messages.length > 40
 * - Safety: messages.length > 80
 */
export async function runSummaryMaintenance(
  payload: Payload,
  conversationId: string
): Promise<MaintenanceResult> {
  // Check feature flag
  if (!featureFlags.SUMMARY_MAINTENANCE_ENABLED) {
    return {
      summaryUpdated: false,
      messagesTrimmed: 0,
      tokensUsed: 0,
    }
  }

  // Load conversation
  const conversation = await payload.findByID({
    collection: 'conversations',
    id: conversationId,
  })

  const messages = conversation.messages || []
  const messageCount = messages.length

  // Check if maintenance is needed
  const needsMaintenance =
    messageCount > CONTEXT_POLICY_V1.summaryThreshold ||
    messageCount > CONTEXT_POLICY_V1.safetyThreshold

  if (!needsMaintenance) {
    return {
      summaryUpdated: false,
      messagesTrimmed: 0,
      tokensUsed: 0,
    }
  }

  console.log(`[Maintenance] Running summary maintenance for conversation ${conversationId}`)

  // Get messages to summarize (all except last 20)
  const messagesToSummarize = getMessagesToSummarize(messages)
  const recentWindow = getRecentWindow(messages)

  // Generate summary
  const { summary, summaryUntilTimestamp, tokensUsed } = await generateSummary(
    conversation.summary || '',
    messagesToSummarize
  )

  // Update conversation
  await payload.update({
    collection: 'conversations',
    id: conversationId,
    data: {
      summary,
      summaryUpdatedAt: new Date().toISOString(),
      summaryUntilTimestamp: summaryUntilTimestamp.toISOString(),
      messages: recentWindow, // Keep only recent window
    },
  })

  const messagesTrimmed = messages.length - recentWindow.length

  console.log(`[Maintenance] Summary updated, ${messagesTrimmed} messages trimmed`)

  return {
    summaryUpdated: true,
    messagesTrimmed,
    tokensUsed,
  }
}
```

**Testing**:
- Create a conversation with 50+ messages
- Enable `SUMMARY_MAINTENANCE_ENABLED=true`
- Call maintenance function
- Verify summary is created and messages are trimmed

**Junior Tips**:
- Maintenance runs after user messages, not during model generation
- We always keep the last 20 messages for immediate context
- The summary accumulates over time (old summary + new messages)

---

## Phase 5: Memory Extraction (Week 5)

### 5.1 Memory Extraction Service

**File**: `src/lib/ai/memory-extraction.ts` (new file)

**What to do**:
1. Use AI to identify important information worth remembering
2. Extract structured memory items from conversations
3. Apply filtering rules to avoid noise

**Implementation** (simplified - you'll need to expand):

```typescript
// src/lib/ai/memory-extraction.ts
import type { Message } from '@/payload-types'
import type { Payload } from 'payload'
import { openai } from './openai-client'
import { generateEmbedding } from './embeddings'
import { findSimilarMemoryItem } from './vector-search'
import { featureFlags } from '../feature-flags'

const MEMORY_EXTRACTION_PROMPT = `You are a memory extraction assistant for an educational platform.

Analyze the conversation and extract important information worth remembering long-term.

Focus on:
- User preferences (learning style, pace, topics of interest)
- Decisions made (chose X over Y, wants to focus on Z)
- Important facts (user's background, goals, constraints)
- Open loops (questions to follow up on later)
- Profile information (skill level, prior knowledge)

Output format (JSON):
{
  "memories": [
    {
      "type": "preference|decision|fact|open_loop|profile|constraint|other",
      "text": "Concise statement (max 200 chars)",
      "importance": 1-5,
      "scope": "user|conversation",
      "reason": "Why this is worth remembering"
    }
  ]
}

Filtering rules:
- Omit greetings, acknowledgments, small talk
- Omit temporary/ephemeral content
- Be selective: quality over quantity (max 3-5 items per extraction)
- Each item must be actionable or informative`

interface MemoryCandidate {
  type: 'preference' | 'decision' | 'fact' | 'open_loop' | 'profile' | 'constraint' | 'other'
  text: string
  importance: number
  scope: 'user' | 'conversation'
  reason: string
}

interface ExtractionResult {
  memories: MemoryCandidate[]
}

/**
 * Extract memory candidates from recent messages
 */
export async function extractMemoryCandidates(
  recentMessages: Message[],
  existingSummary?: string
): Promise<MemoryCandidate[]> {
  // Build context
  const messagesText = recentMessages
    .slice(-10) // Last 10 messages
    .map((msg) => `${msg.role}: ${msg.text}`)
    .join('\n\n')

  let userPrompt = `Recent messages:\n\n${messagesText}`
  if (existingSummary) {
    userPrompt = `Conversation summary:\n${existingSummary}\n\n---\n\n${userPrompt}`
  }

  // Call model
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: MEMORY_EXTRACTION_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  })

  const result: ExtractionResult = JSON.parse(response.choices[0].message.content || '{}')

  // Apply server-side filtering
  const filtered = (result.memories || []).filter((mem) => {
    // Reject too short
    if (mem.text.length < 10) return false
    // Reject too long
    if (mem.text.length > 2000) return false
    // Validate importance range
    if (mem.importance < 1 || mem.importance > 5) return false
    // Validate type
    const validTypes = ['preference', 'decision', 'fact', 'open_loop', 'profile', 'constraint', 'other']
    if (!validTypes.includes(mem.type)) return false

    return true
  })

  return filtered
}

/**
 * Persist memory items with deduplication
 */
export async function persistMemoryItems(
  payload: Payload,
  userId: string,
  conversationId: string,
  candidates: MemoryCandidate[],
  sourceTimestamp: Date,
  sourceRole: 'user' | 'model'
): Promise<number> {
  if (!featureFlags.MEMORY_EXTRACTION_ENABLED) {
    return 0
  }

  let persisted = 0
  const db = payload.db.connection.db // Access MongoDB directly for vector search

  for (const candidate of candidates) {
    // Generate embedding
    const { embedding } = await generateEmbedding(candidate.text)

    // Check for duplicates
    const similar = await findSimilarMemoryItem(db, userId, embedding, 0.9)

    if (similar) {
      // Update existing
      await payload.update({
        collection: 'memory_items',
        id: similar._id.toString(),
        data: {
          text: candidate.text, // Update with new phrasing
          importance: Math.max(similar.importance, candidate.importance), // Take higher importance
          embedding,
          updatedAt: new Date().toISOString(),
        },
      })
      console.log(`[MemoryExtraction] Updated existing memory item: ${similar._id}`)
    } else {
      // Create new
      await payload.create({
        collection: 'memory_items',
        data: {
          userId,
          conversationId: candidate.scope === 'conversation' ? conversationId : undefined,
          type: candidate.type,
          text: candidate.text,
          embedding,
          importance: candidate.importance,
          status: 'active',
          source: {
            sourceConversationId: conversationId,
            sourceMessageTimestamp: sourceTimestamp.toISOString(),
            sourceMessageRole: sourceRole,
          },
        },
      })
      console.log(`[MemoryExtraction] Created new memory item: ${candidate.text.slice(0, 50)}...`)
    }

    persisted++
  }

  return persisted
}
```

**Testing**:
- Create conversations with clear preferences/decisions
- Run extraction
- Verify memory items are created
- Test deduplication (same info shouldn't create duplicates)

**Junior Tips**:
- We ask the model to output JSON for structured data
- Server-side filtering ensures quality (don't trust model 100%)
- Deduplication uses vector similarity to find near-duplicates
- Scope determines if memory is user-global or conversation-local

---

## Phase 6: Context Building & Model Integration (Week 6)

### 6.1 Update Chat Endpoint

**File**: `src/app/api/chat/route.ts` (or wherever your chat endpoint is)

**What to do**:
1. Integrate all context components
2. Build prompt using context policy
3. Add logging for observability
4. Handle errors gracefully

**Implementation outline**:

```typescript
// Simplified example - adapt to your actual endpoint
import { retrieveMemoryItems } from '@/lib/ai/vector-search'
import { composePrompt, buildRetrievalQuery, getRecentWindow } from '@/lib/ai/context-policy'
import { runSummaryMaintenance } from '@/lib/ai/maintenance'
import { extractMemoryCandidates, persistMemoryItems } from '@/lib/ai/memory-extraction'
import { featureFlags } from '@/lib/feature-flags'

export async function POST(req: Request) {
  const { message, conversationId } = await req.json()
  const userId = req.user.id // Assuming auth middleware

  // 1. Load conversation
  const conversation = await payload.findByID({
    collection: 'conversations',
    id: conversationId,
  })

  // 2. Append user message
  const userMessage = {
    role: 'user',
    text: message,
    timestamp: new Date().toISOString(),
  }

  await payload.update({
    collection: 'conversations',
    id: conversationId,
    data: {
      messages: [...(conversation.messages || []), userMessage],
      lastMessageAt: new Date().toISOString(),
    },
  })

  // Reload to get updated messages
  const updatedConversation = await payload.findByID({
    collection: 'conversations',
    id: conversationId,
  })

  // 3. Build context
  const recentMessages = getRecentWindow(updatedConversation.messages)
  const summary = updatedConversation.summary

  // 4. Retrieve memory (if enabled)
  let memoryItems = []
  if (featureFlags.MEMORY_RETRIEVAL_ENABLED) {
    const queryText = buildRetrievalQuery(recentMessages)
    const retrieval = await retrieveMemoryItems(
      payload.db.connection.db,
      userId,
      queryText,
      conversationId
    )
    memoryItems = retrieval.items
  }

  // 5. Compose prompt
  const prompt = composePrompt(SYSTEM_INSTRUCTIONS, {
    systemMessage: SYSTEM_INSTRUCTIONS,
    summary,
    memoryItems,
    recentMessages,
  })

  // 6. Call model
  const modelResponse = await callModel(prompt.messages)

  // 7. Persist model response
  const modelMessage = {
    role: 'model',
    text: modelResponse.content,
    timestamp: new Date().toISOString(),
  }

  await payload.update({
    collection: 'conversations',
    id: conversationId,
    data: {
      messages: [...updatedConversation.messages, modelMessage],
      lastMessageAt: new Date().toISOString(),
    },
  })

  // 8. Background: Run maintenance
  runSummaryMaintenance(payload, conversationId).catch(console.error)

  // 9. Background: Extract and persist memories
  if (featureFlags.MEMORY_EXTRACTION_ENABLED) {
    extractAndPersist(payload, userId, conversationId, updatedConversation).catch(console.error)
  }

  return Response.json({ reply: modelResponse.content })
}

async function extractAndPersist(payload, userId, conversationId, conversation) {
  const candidates = await extractMemoryCandidates(
    conversation.messages,
    conversation.summary
  )

  if (candidates.length > 0) {
    await persistMemoryItems(
      payload,
      userId,
      conversationId,
      candidates,
      new Date(),
      'model'
    )
  }
}
```

**Junior Tips**:
- We reload the conversation after updating to ensure we have latest data
- Maintenance and extraction run in background (don't block response)
- Feature flags control what runs
- Always log context metadata for debugging

---

### 6.2 Add Logging

**File**: `src/lib/ai/observability.ts` (new file)

**What to do**:
1. Create structured logging for context operations
2. Log important metrics (latency, counts, etc.)
3. Add optional context snapshots for debugging

**Implementation**:

```typescript
// src/lib/ai/observability.ts
import type { ComposedPrompt } from './context-policy'

export interface ContextLog {
  timestamp: string
  conversationId: string
  userId: string
  policyVersion: string
  summary: {
    present: boolean
    length: number
  }
  memory: {
    localCount: number
    globalCount: number
    totalCount: number
    retrievalLatencyMs: number
  }
  messages: {
    windowSize: number
    totalCount: number
  }
  featureFlags: {
    summaryEnabled: boolean
    extractionEnabled: boolean
    retrievalEnabled: boolean
  }
  modelLatencyMs?: number
}

export function logContextUsage(log: ContextLog) {
  console.log('[Context Usage]', JSON.stringify(log, null, 2))
}

export function logPromptSnapshot(conversationId: string, prompt: ComposedPrompt) {
  // Only in development
  if (process.env.NODE_ENV !== 'development') return

  console.log(`[Prompt Snapshot] Conversation: ${conversationId}`)
  console.log('System message length:', prompt.messages[0]?.content.length)
  console.log('Total messages:', prompt.messages.length)
  console.log('Metadata:', prompt.metadata)
}
```

**Junior Tips**:
- Structured logging (JSON) makes it easy to analyze later
- Never log sensitive user content in production
- Latency metrics help identify bottlenecks

---

## Phase 7: Testing & Validation (Week 7)

### 7.1 Integration Tests

**File**: `tests/int/memory-system.int.spec.ts` (new file)

**What to test**:
1. Collection creation and access control
2. Embedding generation and validation
3. Vector search functionality
4. Summary generation
5. Memory extraction and deduplication
6. Context composition
7. End-to-end chat flow

**Test structure**:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { generateEmbedding } from '@/lib/ai/embeddings'
// ... other imports

describe('Memory System Integration', () => {
  describe('Embeddings', () => {
    it('should generate 1536-dimensional embeddings', async () => {
      const result = await generateEmbedding('test text')
      expect(result.embedding).toHaveLength(1536)
      expect(result.embedding.every(n => typeof n === 'number')).toBe(true)
    })

    it('should reject empty text', async () => {
      await expect(generateEmbedding('')).rejects.toThrow()
    })
  })

  describe('Vector Search', () => {
    // Test retrieval, deduplication, etc.
  })

  describe('Summary Maintenance', () => {
    // Test threshold triggering, message trimming, etc.
  })

  describe('Memory Extraction', () => {
    // Test extraction, filtering, persistence
  })

  describe('Context Composition', () => {
    it('should follow deterministic order', async () => {
      // Verify: system → summary → memory → messages
    })

    it('should not duplicate user message', async () => {
      // Critical test!
    })
  })
})
```

**Junior Tips**:
- Integration tests verify components work together
- Mock external APIs (OpenAI) to avoid costs during testing
- Test error paths, not just happy paths

---

### 7.2 E2E Tests

**File**: `tests/e2e/chat-memory.spec.ts` (new file)

**What to test**:
1. Full conversation flow with memory
2. Memory retrieval across conversations
3. Summary maintenance after many messages
4. User isolation (can't see other users' memories)

**Junior Tips**:
- E2E tests run against real database
- Test from user perspective (API calls, not internal functions)
- Clean up test data after each test

---

### 7.3 Manual Testing Checklist

Create `docs/features/chat-context/testing-checklist.md`:

```markdown
# Manual Testing Checklist

## Phase 1: Summary Maintenance
- [ ] Create conversation with 50 messages
- [ ] Verify summary is generated
- [ ] Verify messages are trimmed to 20
- [ ] Check summaryUntilTimestamp is correct

## Phase 2: Memory Extraction
- [ ] Have conversation with clear preferences
- [ ] Check memory_items collection for new items
- [ ] Verify deduplication (similar info not duplicated)
- [ ] Verify user isolation (other users can't see)

## Phase 3: Memory Retrieval
- [ ] Create memory in conversation A
- [ ] Start new conversation B
- [ ] Verify model remembers info from A
- [ ] Test conversation-scoped vs user-global

## Phase 4: Full Flow
- [ ] Long conversation (100+ messages)
- [ ] Multiple conversations with same user
- [ ] Verify model has continuity across sessions
- [ ] Test with memory retrieval OFF (should still work)

## Security
- [ ] User A cannot access User B's memories
- [ ] Vector search filters by userId
- [ ] Admin panel respects access rules
```

---

## Phase 8: Deployment (Week 8)

### 8.1 Pre-Deployment Checklist

1. **Environment Variables**:
   ```bash
   # Required for production
   OPENAI_API_KEY=...
   ATLAS_PROJECT_ID=...
   ATLAS_PUBLIC_KEY=...
   ATLAS_PRIVATE_KEY=...

   # Feature flags (start with all OFF)
   SUMMARY_MAINTENANCE_ENABLED=false
   MEMORY_EXTRACTION_ENABLED=false
   MEMORY_RETRIEVAL_ENABLED=false
   ```

2. **Provision vector index**:
   ```bash
   pnpm provision:vector-index
   ```
   - Verify index status is READY
   - Takes ~5-10 minutes

3. **Run all tests**:
   ```bash
   pnpm ci:local
   ```

4. **Generate types**:
   ```bash
   pnpm generate:types
   ```

---

### 8.2 Phased Rollout

**Week 1: Deploy with flags OFF**
- Deploy all code
- Verify no regressions
- Monitor error logs

**Week 2: Enable Summary Maintenance**
```bash
SUMMARY_MAINTENANCE_ENABLED=true
```
- Monitor conversations with 40+ messages
- Check summary quality
- Verify trimming works

**Week 3: Enable Memory Extraction**
```bash
MEMORY_EXTRACTION_ENABLED=true
```
- Monitor memory_items growth
- Check deduplication is working
- Verify no duplicates or noise

**Week 4: Enable Memory Retrieval**
```bash
MEMORY_RETRIEVAL_ENABLED=true
```
- Monitor vector search latency
- Test memory recall quality
- Check for any leakage (users seeing others' data)

---

### 8.3 Monitoring

**Key metrics to watch**:
1. **Vector search latency**: Should be < 100ms
2. **Memory items per user**: Should grow slowly (not exponentially)
3. **Summary generation frequency**: Should trigger at thresholds
4. **Error rates**: Any spikes in embedding/vector search errors
5. **User isolation**: Zero cross-user memory leaks (CRITICAL)

**Set up alerts for**:
- Vector search errors > 1% of requests
- Embedding generation failures
- Memory items with wrong dimensions
- Access control violations

---

## Common Pitfalls & How to Avoid Them

### 1. Duplicate User Message in Prompt
**Problem**: Adding the user's message twice (once in messages array, once manually)
**Solution**: The new user message is already in `conversation.messages` after we append it. Don't add it again.

### 2. Wrong Embedding Dimensions
**Problem**: Storing embeddings that aren't 1536 dimensions
**Solution**: Always validate in `generateEmbedding()` before returning. Add collection-level validation too.

### 3. Missing userId Filter
**Problem**: Vector search returning other users' memories
**Solution**: ALWAYS include `userId: { $eq: userId }` in vector search filter. Test this extensively.

### 4. Forgetting to Trim Messages
**Problem**: Conversation grows forever, hitting maxRows=100
**Solution**: Summary maintenance MUST trim to recent window (20 messages). Test with 100+ message conversations.

### 5. Index Not Ready
**Problem**: Deploying before vector index is built
**Solution**: Provision script must poll until status=READY. Add fallback in retrieval code.

### 6. Noisy Memory Extraction
**Problem**: Storing too many low-value memories
**Solution**: Be strict in server-side filtering. Prefer quality over quantity. Review extracted memories regularly.

### 7. Hardcoded Values
**Problem**: Magic numbers scattered across code
**Solution**: Define all thresholds in `CONTEXT_POLICY_V1` constant. Makes tuning easy.

### 8. Missing Feature Flag Checks
**Problem**: Code runs even when flag is OFF
**Solution**: Check flags at the start of each major function. Make flags easy to toggle.

---

## Success Criteria

You'll know the implementation is successful when:

### Functional
- ✅ Model remembers facts from earlier in long conversations (via summary)
- ✅ Model recalls user preferences across different conversations (via memory)
- ✅ Conversations never "forget" even after 100+ messages
- ✅ Vector search returns relevant context quickly (< 100ms)

### Quality
- ✅ Summaries are concise and preserve key information
- ✅ Memory items are high-signal, not noisy
- ✅ No duplicate memories for the same information
- ✅ Context composition follows deterministic order

### Security
- ✅ Users can only access their own memories (zero leakage)
- ✅ Vector search always filters by userId
- ✅ Access control rules enforced in admin panel

### Performance
- ✅ Chat latency increase < 200ms
- ✅ Summary maintenance completes in < 5s
- ✅ Memory extraction doesn't block user response
- ✅ System works even if vector search fails (graceful degradation)

### Observability
- ✅ Context usage logged for every model call
- ✅ Metrics tracked (latency, counts, etc.)
- ✅ Easy to debug context issues
- ✅ Can sample prompts for quality review

---

## Next Steps After V1

Once the basic system is working, consider:

1. **Tune retrieval parameters**: Adjust K, numCandidates based on usage
2. **Improve memory extraction**: Better prompts, more selective filtering
3. **Add memory management UI**: Let users view/edit their memories
4. **Implement memory deprecation**: Auto-deprecate outdated memories
5. **Move to dedicated messages collection**: For unlimited history
6. **Add analytics**: Track memory usefulness, retrieval quality
7. **Multi-modal memories**: Store code snippets, images, etc.

---

## Questions? Common Issues?

### Q: How do I test vector search locally?
A: You need MongoDB Atlas (free tier works). Local MongoDB doesn't support vector search.

### Q: What if OpenAI API fails during extraction?
A: Memory extraction is non-blocking. Log the error and continue. User's chat still works.

### Q: How do I debug context composition?
A: Use `logPromptSnapshot()` in development. Review logged context metadata.

### Q: Can I change embedding model later?
A: Yes, but requires new index version and backfill. Plan carefully.

### Q: How do I handle very long conversations?
A: Summary compression is automatic. System designed for unlimited length via trimming + summary.

---

## Resources

- [Payload CMS Docs](https://payloadcms.com/docs)
- [MongoDB Atlas Vector Search](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-overview/)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [AGENTS.md](../../../AGENTS.md) - Project patterns and conventions

---

## Estimated Effort Breakdown

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| 1. Data Model | Collections, fields, feature flags | 3-5 days |
| 2. Infrastructure | Vector index, provisioning script | 3-4 days |
| 3. Core Utils | Embeddings, vector search, context policy | 5-7 days |
| 4. Summary | Summary generation, maintenance | 3-5 days |
| 5. Memory | Extraction, persistence, deduplication | 5-7 days |
| 6. Integration | Chat endpoint updates, logging | 3-5 days |
| 7. Testing | Integration tests, E2E tests, manual | 5-7 days |
| 8. Deployment | Provisioning, rollout, monitoring | 3-5 days |

**Total: 6-8 weeks for junior developer**

**Parallelization opportunities**:
- Phases 3-5 can partially overlap (different files)
- Testing can start as soon as each component is done

---

## Final Notes for Junior Developers

**Take your time**: This is a complex system with many moving parts. It's okay to not understand everything at once.

**Ask questions**: If something is unclear, ask! Especially about:
- Vector embeddings and similarity search
- MongoDB aggregation pipelines
- Feature flag patterns
- Access control rules

**Test thoroughly**: Security (user isolation) and correctness (no message duplication) are critical. Write tests early.

**Start simple**: Get one piece working before moving to the next. Don't try to build everything at once.

**Read the code**: Look at existing Payload collections and API endpoints for patterns.

**Use the tools**: `pnpm typecheck`, `pnpm lint`, and tests will catch many mistakes early.

Good luck! 🚀
