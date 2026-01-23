#!/usr/bin/env tsx
/**
 * Test Documentation Search
 *
 * Run: pnpm tsx scripts/test-doc-search.ts
 */

import { DocSearch } from '../src/infra/llm/doc-search'

const QUERIES = [
  'How do I create a published collection?',
  'Component styling with Tailwind',
  'Access control and security',
  'API endpoint authentication',
  'Test patterns for collections',
  'Hooks lifecycle',
  'RBAC patterns',
]

async function main() {
  console.log('🔍 Testing Documentation Search\n')

  const search = new DocSearch()

  // Print stats
  const stats = search.getStats()
  console.log('📊 Index Statistics:')
  console.log(`   Total chunks: ${stats.totalChunks}`)
  console.log(`   Total keywords: ${stats.totalKeywords}`)
  console.log(`   Categories:`)
  stats.categories.forEach((cat) => {
    console.log(`      - ${cat.name}: ${cat.count} chunks`)
  })
  console.log()

  // Test each query
  for (const query of QUERIES) {
    console.log(`\n🔎 Query: "${query}"`)
    console.log('─'.repeat(60))

    const results = search.query(query, { limit: 3, includeContent: false })

    if (results.length === 0) {
      console.log('   ❌ No results found')
      continue
    }

    results.forEach((result, index) => {
      console.log(`\n   ${index + 1}. ${result.chunk.title}`)
      console.log(`      Relevance: ${result.relevance.toUpperCase()} (score: ${result.score})`)
      console.log(`      Source: ${result.chunk.sourceFile}`)
      console.log(`      Category: ${result.chunk.category}`)
      if (result.matchedKeywords.length > 0) {
        console.log(`      Keywords: ${result.matchedKeywords.slice(0, 5).join(', ')}`)
      }
    })
  }

  console.log('\n\n✅ Test complete!')
}

main().catch(console.error)
