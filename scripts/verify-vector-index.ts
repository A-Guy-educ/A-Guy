#!/usr/bin/env tsx
/**
 * Verify Vector Search Index Setup
 *
 * This script checks if MongoDB Atlas vector search index is properly configured
 * and ready for use with the memory system.
 *
 * Usage:
 *   pnpm tsx scripts/verify-vector-index.ts
 */

// CRITICAL: Load env vars FIRST before any imports that rely on them
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

import type { Db } from 'mongodb'
import { getPayload } from 'payload'

const INDEX_NAME = 'memory_items_embedding_v1'
const COLLECTION_NAME = 'memory_items'

interface IndexInfo {
  name: string
  type?: string
  status?: string
  queryable?: boolean
  latestDefinition?: {
    fields?: Array<{
      type: string
      path: string
      numDimensions?: number
      similarity?: string
    }>
  }
}

async function verifyVectorIndex() {
  console.log('🔍 Verifying MongoDB Atlas Vector Search Index...\n')

  try {
    // Load Payload config AFTER env vars are available
    const { default: config } = await import('@payload-config')

    // Initialize Payload
    console.log('1️⃣  Connecting to database...')
    const payload = await getPayload({ config })
    const db = (payload.db as { connection?: { db?: Db } }).connection?.db

    if (!db) {
      console.error('❌ Failed to get database connection')
      console.error('   Make sure DATABASE_URI is set correctly in .env')
      process.exit(1)
    }

    console.log('✅ Connected to database\n')

    // Check if collection exists
    console.log(`2️⃣  Checking if collection "${COLLECTION_NAME}" exists...`)
    const collections = await db.listCollections({ name: COLLECTION_NAME }).toArray()

    if (collections.length === 0) {
      console.log(`⚠️  Collection "${COLLECTION_NAME}" does not exist yet`)
      console.log("   This is OK if you haven't created any memories yet")
      console.log('   The collection will be created automatically on first use\n')
    } else {
      console.log(`✅ Collection "${COLLECTION_NAME}" exists\n`)
    }

    // Check for search indexes
    console.log('3️⃣  Checking for vector search indexes...')
    const collection = db.collection(COLLECTION_NAME)

    let indexes: IndexInfo[] = []
    try {
      indexes = (await collection.listSearchIndexes().toArray()) as IndexInfo[]
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes('not supported') || error.message.includes('SearchNotEnabled'))
      ) {
        console.error('❌ Vector search is not supported on this cluster')
        console.error('   You need MongoDB Atlas with M10+ cluster tier')
        console.error(
          '   Free tier (M0) and shared clusters (M2/M5) do not support vector search\n',
        )
        console.error('Solutions:')
        console.error('   1. Upgrade to M10+ cluster in MongoDB Atlas')
        process.exit(1)
      }
      throw error
    }

    if (indexes.length === 0) {
      console.error('❌ No search indexes found')
      console.error(`   Expected index: "${INDEX_NAME}"`)
      console.error(`   On collection: "${COLLECTION_NAME}"\n`)
      console.error('Next steps:')
      console.error('   1. Go to MongoDB Atlas → Atlas Search')
      console.error('   2. Create a new search index')
      console.error('   3. Use the definition from: infra/atlas/vector-index.memory_items.v1.json')
      console.error('   4. See docs/VECTOR-SEARCH-SETUP.md for detailed instructions')
      process.exit(1)
    }

    console.log(`✅ Found ${indexes.length} search index(es)\n`)

    // Find our specific index
    const vectorIndex = indexes.find((idx) => idx.name === INDEX_NAME)

    if (!vectorIndex) {
      console.error(`❌ Vector search index "${INDEX_NAME}" not found`)
      console.error(`   Found indexes: ${indexes.map((i) => i.name).join(', ')}\n`)
      console.error('Next steps:')
      console.error('   1. Create the index with exact name: memory_items_embedding_v1')
      console.error('   2. Use definition from: infra/atlas/vector-index.memory_items.v1.json')
      console.error('   3. See docs/VECTOR-SEARCH-SETUP.md for instructions')
      process.exit(1)
    }

    console.log(`4️⃣  Checking index "${INDEX_NAME}" status...`)

    // Check index status
    const status = vectorIndex.status || (vectorIndex.queryable ? 'READY' : 'UNKNOWN')

    if (status === 'READY' || vectorIndex.queryable === true) {
      console.log('✅ Index status: READY\n')
    } else if (status === 'BUILDING' || status === 'PENDING') {
      console.warn('⚠️  Index status: BUILDING')
      console.warn('   The index is being built, this can take 5-10 minutes')
      console.warn('   Wait for status to change to READY before using memory retrieval')
      console.warn('   Check status in MongoDB Atlas → Atlas Search\n')
      process.exit(1)
    } else {
      console.error(`❌ Index status: ${status}`)
      console.error('   Expected status: READY')
      console.error('   Check MongoDB Atlas → Atlas Search for details')
      process.exit(1)
    }

    // Verify index configuration
    console.log('5️⃣  Verifying index configuration...')

    const fields = vectorIndex.latestDefinition?.fields || []
    const vectorField = fields.find((f) => f.type === 'vector')

    if (!vectorField) {
      console.error('❌ No vector field found in index definition')
      console.error('   Expected field type: vector')
      process.exit(1)
    }

    // Check dimensions
    if (vectorField.numDimensions !== 1536) {
      console.error(`❌ Wrong vector dimensions: ${vectorField.numDimensions}`)
      console.error('   Expected: 1536 (for text-embedding-3-small)')
      console.error('   You need to recreate the index with correct dimensions')
      process.exit(1)
    }

    // Check similarity metric
    if (vectorField.similarity !== 'cosine') {
      console.warn(`⚠️  Unexpected similarity metric: ${vectorField.similarity}`)
      console.warn('   Expected: cosine')
      console.warn('   This may affect search quality\n')
    }

    // Check filter fields
    const filterFields = fields.filter((f) => f.type === 'filter').map((f) => f.path)
    const expectedFilters = ['userId', 'conversationId', 'status']

    for (const expected of expectedFilters) {
      if (!filterFields.includes(expected)) {
        console.warn(`⚠️  Missing filter field: ${expected}`)
        console.warn('   This may affect search performance and tenant isolation\n')
      }
    }

    console.log('✅ Index configuration looks good\n')

    // Check OpenAI API key
    console.log('6️⃣  Checking OpenAI API key...')
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not set in environment')
      console.error('   Required for generating embeddings')
      console.error('   Add to .env file: OPENAI_API_KEY=sk-...')
      process.exit(1)
    }

    if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
      console.warn('⚠️  OPENAI_API_KEY format looks unusual')
      console.warn('   Expected format: sk-...')
      console.warn('   Verify your API key is correct\n')
    }

    console.log('✅ OpenAI API key is set\n')

    console.log('7️⃣  Finalizing...\n')
    console.log('='.repeat(60))
    console.log('✅ Vector Search Setup Complete!')
    console.log('='.repeat(60))
    console.log('\nIndex Details:')
    console.log(`  Name: ${INDEX_NAME}`)
    console.log(`  Collection: ${COLLECTION_NAME}`)
    console.log(`  Status: READY`)
    console.log(`  Dimensions: 1536`)
    console.log(`  Similarity: ${vectorField.similarity}`)
    console.log(`  Filter fields: ${filterFields.join(', ')}\n`)

    console.log('🎉 Memory retrieval is ready to use!')

    console.log('\nNext steps:')
    console.log('  • Test the system: pnpm test:int tests/int/memory-system.int.spec.ts')
    console.log('  • Monitor logs for vector search operations')
    console.log('  • See docs/VECTOR-SEARCH-SETUP.md for more info\n')

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Verification failed:')
    console.error(error)
    console.error('\nFor help, see: docs/VECTOR-SEARCH-SETUP.md')
    process.exit(1)
  }
}

// Run verification
verifyVectorIndex()
