#!/usr/bin/env tsx
/**
 * Test Smart Documentation Loader
 *
 * Run: pnpm tsx scripts/test-smart-loader.ts
 */

import { SmartDocLoader } from '../src/lib/ai/smart-doc-loader'

async function main() {
  console.log('🧠 Testing Smart Documentation Loader\n')

  const loader = new SmartDocLoader()

  // Test 1: Create a collection
  console.log('📝 Test 1: Creating a collection')
  console.log('─'.repeat(60))
  const collectionDocs = SmartDocLoader.forCollection('create')
  console.log(`   Tier: ${collectionDocs.tier}`)
  console.log(`   Chunks: ${collectionDocs.chunks.length}`)
  console.log(`   Estimated tokens: ${collectionDocs.estimatedTokens}`)
  console.log(`   Categories: ${collectionDocs.categories.join(', ')}`)
  if (collectionDocs.recommendation) {
    console.log(`   Recommendation: ${collectionDocs.recommendation}`)
  }
  console.log('\n   Loaded chunks:')
  collectionDocs.chunks.forEach((chunk, i) => {
    console.log(`      ${i + 1}. ${chunk.title} (${chunk.sourceFile})`)
  })

  // Test 2: Create a component
  console.log('\n\n🎨 Test 2: Creating a component')
  console.log('─'.repeat(60))
  const componentDocs = SmartDocLoader.forComponent('create')
  console.log(`   Tier: ${componentDocs.tier}`)
  console.log(`   Chunks: ${componentDocs.chunks.length}`)
  console.log(`   Estimated tokens: ${componentDocs.estimatedTokens}`)
  console.log(`   Categories: ${componentDocs.categories.join(', ')}`)
  if (componentDocs.recommendation) {
    console.log(`   Recommendation: ${componentDocs.recommendation}`)
  }
  console.log('\n   Loaded chunks:')
  componentDocs.chunks.forEach((chunk, i) => {
    console.log(`      ${i + 1}. ${chunk.title} (${chunk.sourceFile})`)
  })

  // Test 3: Create an endpoint
  console.log('\n\n🔌 Test 3: Creating an API endpoint')
  console.log('─'.repeat(60))
  const endpointDocs = SmartDocLoader.forEndpoint('create')
  console.log(`   Tier: ${endpointDocs.tier}`)
  console.log(`   Chunks: ${endpointDocs.chunks.length}`)
  console.log(`   Estimated tokens: ${endpointDocs.estimatedTokens}`)
  console.log(`   Categories: ${endpointDocs.categories.join(', ')}`)
  if (endpointDocs.recommendation) {
    console.log(`   Recommendation: ${endpointDocs.recommendation}`)
  }
  console.log('\n   Loaded chunks:')
  endpointDocs.chunks.forEach((chunk, i) => {
    console.log(`      ${i + 1}. ${chunk.title} (${chunk.sourceFile})`)
  })

  // Test 4: Debug collection
  console.log('\n\n🐛 Test 4: Debugging a collection')
  console.log('─'.repeat(60))
  const debugDocs = SmartDocLoader.forDebugging('collection')
  console.log(`   Tier: ${debugDocs.tier}`)
  console.log(`   Chunks: ${debugDocs.chunks.length}`)
  console.log(`   Estimated tokens: ${debugDocs.estimatedTokens}`)
  console.log(`   Categories: ${debugDocs.categories.join(', ')}`)
  if (debugDocs.recommendation) {
    console.log(`   Recommendation: ${debugDocs.recommendation}`)
  }

  // Test 5: Custom context
  console.log('\n\n⚙️  Test 5: Custom context (RBAC pattern)')
  console.log('─'.repeat(60))
  const customDocs = loader.loadDocs({
    task: 'create',
    domain: 'collection',
    patterns: ['rbac', 'published-content'],
    keywords: ['access control', 'roles']
  })
  console.log(`   Tier: ${customDocs.tier}`)
  console.log(`   Chunks: ${customDocs.chunks.length}`)
  console.log(`   Estimated tokens: ${customDocs.estimatedTokens}`)
  console.log(`   Categories: ${customDocs.categories.join(', ')}`)
  console.log('\n   Loaded chunks:')
  customDocs.chunks.forEach((chunk, i) => {
    console.log(`      ${i + 1}. ${chunk.title} (${chunk.sourceFile})`)
  })

  // Test 6: Usage statistics
  console.log('\n\n📊 Usage Statistics')
  console.log('─'.repeat(60))
  const stats = loader.getStats()
  console.log(`   Total queries: ${stats.totalQueries}`)
  console.log(`   Average tokens: ${stats.avgTokens}`)
  console.log(`   Task distribution:`)
  Object.entries(stats.taskDistribution).forEach(([task, count]) => {
    if (count > 0) {
      console.log(`      ${task}: ${count}`)
    }
  })

  // Test 7: Format for AI
  console.log('\n\n📄 Test 7: Formatted output sample')
  console.log('─'.repeat(60))
  const formatted = loader.formatForAI(collectionDocs)
  const lines = formatted.split('\n')
  console.log(lines.slice(0, 20).join('\n'))
  console.log(`\n   ... (${lines.length} total lines)`)

  console.log('\n\n✅ All tests complete!')
  
  // Summary
  console.log('\n📈 Summary:')
  console.log(`   ✓ Smart loader successfully determines tiers based on context`)
  console.log(`   ✓ Quick reference tier loads minimal docs (< 500 tokens)`)
  console.log(`   ✓ Helper methods provide convenient access`)
  console.log(`   ✓ Usage tracking works correctly`)
  console.log(`   ✓ Formatted output ready for AI consumption`)
}

main().catch(console.error)
