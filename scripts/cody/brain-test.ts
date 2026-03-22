#!/usr/bin/env node
/**
 * @fileType script
 * @domain cody | brain
 * @ai-summary Stable CLI to query the brain server with auto-reconnect
 *
 * Usage:
 *   pnpm brain "What files handle authentication?"
 *   pnpm brain path/to/prompt.md
 *   pnpm brain --tools      # List available tools
 *   pnpm brain --test      # Run integration test
 *
 * Environment:
 *   BRAIN_SERVER_URL   Brain server URL (default: http://100.66.248.120:4097/mcp)
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { readFileSync, existsSync } from 'fs'

const BRAIN_URL = process.env.BRAIN_SERVER_URL || 'http://100.66.248.120:4097/mcp'
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 3000 // Longer delay to allow server to clean up

interface Tool {
  name: string
  description?: string
  inputSchema: object
}

/**
 * Stable brain client with auto-reconnect and keep-alive.
 */
class BrainClient {
  private client: Client | null = null
  private transport: StreamableHTTPClientTransport | null = null
  private sessionId: string | null = null

  /**
   * Check if brain server is reachable (lightweight health check).
   */
  async isHealthy(): Promise<boolean> {
    try {
      const baseUrl = BRAIN_URL.replace(/\/mcp$/, '')
      const resp = await fetch(baseUrl, {
        signal: AbortSignal.timeout(3000),
      })
      return resp.ok
    } catch {
      return false
    }
  }

  /**
   * Connect to brain with auto-retry.
   */
  async connect(): Promise<void> {
    // If already connected, check if still alive
    if (this.client && this.sessionId) {
      try {
        await this.client.listTools()
        return // Still alive
      } catch {
        // Connection dead, need to reconnect
        await this.close()
      }
    }

    let lastError: Error | null = null
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // Ensure clean slate before connecting
      await this.close()

      try {
        console.log(`🔌 Connecting to brain (attempt ${attempt}/${MAX_RETRIES})...`)

        this.transport = new StreamableHTTPClientTransport(new URL(BRAIN_URL))
        this.client = new Client({ name: 'brain-cli', version: '1.0.0' })
        await this.client.connect(this.transport)

        // Verify connection by listing tools
        await this.client.listTools()
        console.log('✅ Connected to brain')
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.warn(`⚠️ Connection attempt ${attempt} failed: ${lastError.message}`)

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * attempt
          console.log(`   Retrying in ${delay}ms...`)
          await this.sleep(delay)
        }
      }
    }

    throw new Error(`Failed to connect after ${MAX_RETRIES} attempts: ${lastError?.message}`)
  }

  /**
   * List available tools.
   */
  async listTools(): Promise<Tool[]> {
    await this.connect()
    const { tools } = await this.client!.listTools()
    return tools
  }

  /**
   * Call a tool with auto-reconnect on failure.
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<string> {
    await this.connect()

    try {
      const result = await this.client!.callTool({ name, arguments: args })
      return typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content, null, 2)
    } catch (_err) {
      // If tool call fails, try reconnecting once and retry
      console.warn(`⚠️ Tool call failed, reconnecting...`)
      await this.close()
      await this.connect()
      const result = await this.client!.callTool({ name, arguments: args })
      return typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content, null, 2)
    }
  }

  /**
   * Close the connection gracefully.
   */
  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close()
      } catch {
        // Ignore close errors
      }
      this.client = null
    }
    this.transport = null
    this.sessionId = null
    // Wait a bit for server to clean up
    await this.sleep(500)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

async function runTest(client: BrainClient): Promise<void> {
  console.log(`\n🧠 Brain Integration Test\n`)

  try {
    // Test 1: List tools
    console.log('1️⃣ Fetching available tools...')
    const tools = await client.listTools()
    console.log(`   ✅ Found ${tools.length} tools:`)
    for (const tool of tools.slice(0, 5)) {
      console.log(`   - ${tool.name}`)
    }
    if (tools.length > 5) {
      console.log(`   ... and ${tools.length - 5} more`)
    }

    // Test 2: Get context tree
    console.log('\n2️⃣ Testing get_context_tree...')
    const contextTree = await client.callTool('get_context_tree', { path: '.', maxTokens: 5000 })
    console.log(`   ✅ Response (${contextTree.length} chars)`)
    console.log(contextTree.slice(0, 300) + (contextTree.length > 300 ? '\n...' : ''))

    // Test 3: Semantic search
    console.log('\n3️⃣ Testing semantic_code_search...')
    const search = await client.callTool('semantic_code_search', {
      query: 'authentication login user session',
      maxResults: 3,
    })
    console.log(`   ✅ Response (${search.length} chars)`)
    console.log(search.slice(0, 300) + (search.length > 300 ? '\n...' : ''))

    console.log('\n✅ Brain server is fully operational!')
  } finally {
    await client.close()
  }
}

async function runPrompt(client: BrainClient, prompt: string): Promise<void> {
  console.log(`\n🤔 Prompt: ${prompt}\n`)

  const query = prompt.toLowerCase()

  try {
    if (query.includes('what files') || query.includes('structure') || query.includes('tree')) {
      console.log('Using: get_context_tree\n')
      const result = await client.callTool('get_context_tree', { path: '.', maxTokens: 10000 })
      console.log(result)
    } else if (query.includes('find') || query.includes('search') || query.includes('similar')) {
      console.log('Using: semantic_code_search\n')
      const result = await client.callTool('semantic_code_search', {
        query: prompt,
        maxResults: 10,
      })
      console.log(result)
    } else if (query.includes('blast') || query.includes('depend')) {
      console.log('Using: get_blast_radius\n')
      const match = prompt.match(/(\w+[\w.]+\w+)/)
      const symbol = match ? match[1] : 'main'
      const result = await client.callTool('get_blast_radius', { symbol })
      console.log(result)
    } else if (query.includes('skeleton') || query.includes('signature')) {
      console.log('Using: get_file_skeleton\n')
      const match = prompt.match(/[\w/.-]+\.\w+/)
      const file = match ? match[0] : 'src/index.ts'
      const result = await client.callTool('get_file_skeleton', { file })
      console.log(result)
    } else {
      // Default: semantic search
      console.log('Using: semantic_code_search\n')
      const result = await client.callTool('semantic_code_search', {
        query: prompt,
        maxResults: 10,
      })
      console.log(result)
    }
  } finally {
    await client.close()
  }
}

async function main() {
  const client = new BrainClient()
  const args = process.argv.slice(2)

  // Handle SIGINT for graceful cleanup
  const cleanup = async () => {
    console.log('\n👋 Closing connection...')
    await client.close()
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🧠 Brain CLI

Usage:
  pnpm brain "Your question"
  pnpm brain path/to/prompt.md   # Read prompt from file
  pnpm brain --tools             # List all available tools
  pnpm brain --test              # Run integration test

Environment:
  BRAIN_SERVER_URL   Brain server URL (default: http://100.66.248.120:4097/sse)

Examples:
  pnpm brain "What files handle authentication?"
  pnpm brain "Find code related to payment processing"
  pnpm brain docs/brain-server/05-claude-mcp-option.md
`)
    return
  }

  try {
    // Check health first
    console.log(`Checking brain health...`)
    const healthy = await client.isHealthy()
    if (!healthy) {
      console.warn('⚠️ Brain server may be unreachable, attempting to connect anyway...')
    } else {
      console.log('✅ Brain server is healthy\n')
    }

    if (args.includes('--tools')) {
      console.log('📋 Available Brain Tools:\n')
      const tools = await client.listTools()
      for (const tool of tools) {
        console.log(`  ${tool.name}`)
        if (tool.description) {
          const firstLine = tool.description.split('\n')[0]
          console.log(`    ${firstLine}`)
        }
      }
      await client.close()
      return
    }

    if (args.includes('--test')) {
      await runTest(client)
      return
    }

    if (args.length === 0) {
      console.error('❌ No prompt provided. Use --help for usage.')
      process.exit(1)
    }

    let prompt = args.join(' ')

    if (existsSync(prompt)) {
      console.log(`📄 Reading prompt from file: ${prompt}`)
      prompt = readFileSync(prompt, 'utf-8')
    }

    await runPrompt(client, prompt)
  } catch (err) {
    console.error('\n❌ Error:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

main()
