#!/usr/bin/env node
/**
 * @fileType script
 * @domain cody | brain
 * @ai-summary CLI for manually testing the brain server
 *
 * Usage:
 *   pnpm brain "Your question here"
 *   BRAIN_SERVER_URL=http://... pnpm brain "Question"
 *   pnpm brain --tools   # List available tools
 *   pnpm brain --test    # Run integration test
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

const BRAIN_URL = process.env.BRAIN_SERVER_URL || 'http://100.66.248.120:4097/sse'

interface Tool {
  name: string
  description?: string
  inputSchema: object
}

async function listTools(): Promise<Tool[]> {
  const transport = new SSEClientTransport(new URL(BRAIN_URL))
  const client = new Client({ name: 'brain-cli', version: '1.0.0' })
  await client.connect(transport)
  const { tools } = await client.listTools()
  await client.close()
  return tools
}

async function callTool(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const transport = new SSEClientTransport(new URL(BRAIN_URL))
  const client = new Client({ name: 'brain-cli', version: '1.0.0' })
  await client.connect(transport)
  const result = await client.callTool({ name, arguments: args })
  await client.close()
  return typeof result.content === 'string'
    ? result.content
    : JSON.stringify(result.content, null, 2)
}

async function testBrain(): Promise<void> {
  console.log(`🧠 Brain CLI Test\n`)
  console.log(`Connecting to: ${BRAIN_URL}\n`)

  // Test 1: List tools
  console.log('1️⃣ Fetching available tools...')
  const tools = await listTools()
  console.log(`   ✅ Found ${tools.length} tools:`)
  for (const tool of tools.slice(0, 5)) {
    console.log(`   - ${tool.name}`)
  }
  if (tools.length > 5) {
    console.log(`   ... and ${tools.length - 5} more`)
  }

  // Test 2: Get context tree
  console.log('\n2️⃣ Testing get_context_tree...')
  const contextTree = await callTool('get_context_tree', { path: '.', maxTokens: 5000 })
  console.log(`   ✅ Response (${contextTree.length} chars):`)
  console.log(contextTree.slice(0, 800) + (contextTree.length > 800 ? '\n...' : ''))

  // Test 3: Semantic search
  console.log('\n3️⃣ Testing semantic_code_search...')
  const search = await callTool('semantic_code_search', {
    query: 'authentication login user session',
    maxResults: 5,
  })
  console.log(`   ✅ Response (${search.length} chars):`)
  console.log(search.slice(0, 800) + (search.length > 800 ? '\n...' : ''))

  console.log('\n✅ Brain server is fully operational!')
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🧠 Brain CLI

Usage:
  pnpm brain "Your question"
  pnpm brain --tools    # List all available tools
  pnpm brain --test     # Run integration test
  pnpm brain <tool> <args>

Examples:
  pnpm brain "What files handle authentication?"
  pnpm brain get_context_tree '{"path": "src/server", "maxTokens": 3000}'
  pnpm brain semantic_code_search '{"query": "payment processing", "maxResults": 5}'

Environment:
  BRAIN_SERVER_URL   Brain server URL (default: http://100.66.248.120:4097/sse)
`)
    return
  }

  if (args.includes('--tools')) {
    console.log('📋 Available Brain Tools:\n')
    const tools = await listTools()
    for (const tool of tools) {
      console.log(`  ${tool.name}`)
      if (tool.description) {
        console.log(`    ${tool.description.split('\n')[0]}`)
      }
    }
    return
  }

  if (args.includes('--test')) {
    await testBrain()
    return
  }

  // Interactive prompt mode
  if (args.length === 0) {
    console.log('🧠 Brain CLI (interactive mode)')
    console.log('   Type your question or --help for usage')
    console.log('   Ctrl+C to exit\n')
  }

  const question = args.join(' ')
  if (!question) {
    console.error('❌ No question provided. Use --help for usage.')
    process.exit(1)
  }

  console.log(`\n🤔 Question: ${question}\n`)

  // Map common questions to tools
  const query = question.toLowerCase()
  if (query.includes('what files') || query.includes('structure') || query.includes('tree')) {
    console.log('Using: get_context_tree\n')
    const result = await callTool('get_context_tree', { path: '.', maxTokens: 10000 })
    console.log(result)
  } else if (query.includes('find') || query.includes('search') || query.includes('similar')) {
    console.log('Using: semantic_code_search\n')
    const result = await callTool('semantic_code_search', {
      query: question,
      maxResults: 10,
    })
    console.log(result)
  } else if (query.includes('blast') || query.includes('depend')) {
    console.log('Using: get_blast_radius\n')
    // Extract symbol name from question
    const match = question.match(/(\w+[\w.]+\w+)/)
    const symbol = match ? match[1] : 'main'
    const result = await callTool('get_blast_radius', { symbol })
    console.log(result)
  } else {
    // Default: semantic search
    console.log('Using: semantic_code_search\n')
    const result = await callTool('semantic_code_search', {
      query: question,
      maxResults: 10,
    })
    console.log(result)
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
