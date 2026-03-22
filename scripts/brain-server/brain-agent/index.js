/**
 * Brain Agent - Claude + Context+ Integration
 *
 * Receives queries via MCP, processes with Claude Opus 4.6,
 * uses Context+ tools for code analysis.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Client as Anthropic } from '@anthropic-ai/sdk'
import express from 'express'
import http from 'http'

// Load environment
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const BRAIN_SERVER_URL = process.env.BRAIN_SERVER_URL || 'http://127.0.0.1:4097'
const LOCAL_PORT = parseInt(process.env.LOCAL_PORT || '4099', 10)
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-6'

if (!ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY environment variable is required')
  process.exit(1)
}

// Anthropic client
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
})

// Context+ MCP client
let contextPlusClient = null

// System prompt for brain
const SYSTEM_PROMPT = `You are Brain - an expert code analyst and architect.

You have access to Context+ tools for code analysis:
- get_context_tree: Get project structure with file/function names
- semantic_code_search: Search codebase by meaning
- get_blast_radius: Find code dependencies
- get_file_skeleton: Get function signatures
- semantic_identifier_search: Find functions/classes by intent
- run_static_analysis: Run linter/compiler
- search_memory_graph: Search memory/knowledge graph
- upsert_memory_node: Add to memory
- get_feature_hub: Navigate via feature hubs

Use these tools to analyze code thoroughly.
Provide clear, actionable insights.
When tools are needed, make tool calls to gather information.
Be concise but thorough.`

// Initialize Context+ connection
async function initContextPlus() {
  const transport = new StreamableHTTPClientTransport(new URL(BRAIN_SERVER_URL))
  contextPlusClient = new Client({ name: 'brain-agent', version: '1.0.0' }, { capabilities: {} })

  await contextPlusClient.connect(transport)
  console.log('Connected to Context+ at', BRAIN_SERVER_URL)

  // Get available tools
  const tools = await contextPlusClient.listTools()
  console.log('Context+ tools available:', tools.tools.length)

  return tools.tools
}

// Convert Context+ tools to Claude format
function convertTools(contextPlusTools) {
  return contextPlusTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema || { type: 'object', properties: {} },
  }))
}

// Call Context+ tool
async function callContextPlusTool(toolName, args) {
  if (!contextPlusClient) {
    throw new Error('Context+ not connected')
  }

  const result = await contextPlusClient.callTool({
    name: toolName,
    arguments: args || {},
  })

  return result
}

// Process query with Claude + Context+
async function processQuery(query) {
  if (!contextPlusClient) {
    await initContextPlus()
  }

  const tools = await contextPlusClient.listTools()
  const convertedTools = convertTools(tools.tools)

  // Build conversation with tools
  const messages = [{ role: 'user', content: query }]

  // Claude API call with tools
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: messages,
    tools: convertedTools.length > 0 ? convertedTools : undefined,
  })

  // Handle tool calls
  let finalText = ''

  for (const content of response.content) {
    if (content.type === 'text') {
      finalText += content.text
    } else if (content.type === 'tool_use') {
      const toolName = content.name
      const toolArgs = content.input

      console.log('Calling tool:', toolName, toolArgs)

      try {
        const toolResult = await callContextPlusTool(toolName, toolArgs)

        // Continue conversation with tool result
        messages.push({ role: 'assistant', content: [content] })
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: content.id,
              content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
            },
          ],
        })

        // Get next response
        const followUp = await anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: messages,
          tools: convertedTools.length > 0 ? convertedTools : undefined,
        })

        for (const fc of followUp.content) {
          if (fc.type === 'text') {
            finalText += fc.text
          }
        }
      } catch (error) {
        console.error('Tool call error:', error)
        finalText += `\n[Tool error: ${error.message}]`
      }
    }
  }

  return finalText
}

// Create MCP server
function createServer() {
  const app = express()
  app.use(express.json())

  // Health endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'brain-agent',
      model: CLAUDE_MODEL,
      contextplus: contextPlusClient ? 'connected' : 'disconnected',
    })
  })

  // Query endpoint
  app.post('/query', async (req, res) => {
    const { query } = req.body

    if (!query) {
      return res.status(400).json({ error: 'query is required' })
    }

    try {
      console.log('Processing query:', query)
      const result = await processQuery(query)
      res.json({ result })
    } catch (error) {
      console.error('Query error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  return app
}

// Main
async function main() {
  console.log('Starting Brain Agent...')
  console.log('Model:', CLAUDE_MODEL)

  // Initialize Context+
  await initContextPlus()

  // Start server
  const app = createServer()
  const server = http.createServer(app)

  server.listen(LOCAL_PORT, () => {
    console.log(`Brain agent listening on port ${LOCAL_PORT}`)
  })
}

main().catch(console.error)
