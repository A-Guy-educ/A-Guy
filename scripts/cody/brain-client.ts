/**
 * @fileType utility
 * @domain cody | brain
 * @pattern mcp-client | claude-api
 * @ai-summary MCP client + Claude API wrapper for remote brain server communication
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import Anthropic from '@anthropic-ai/sdk'

export interface BrainResult {
  output: string
  toolCalls: number
  tokensUsed: number
}

/**
 * Connect to a remote brain server via SSE MCP.
 * The serverUrl should be the SSE endpoint, e.g. http://100.x.x.x:4097/sse
 */
export async function connectBrain(serverUrl: string): Promise<Client> {
  const transport = new SSEClientTransport(new URL(serverUrl))
  const client = new Client({ name: 'cody-brain', version: '1.0.0' })
  await client.connect(transport)
  return client
}

/**
 * Check if brain server is reachable (HTTP health check with 5s timeout).
 */
export async function isBrainHealthy(serverUrl: string): Promise<boolean> {
  try {
    // Strip /sse suffix if present to get base URL for health check
    const baseUrl = serverUrl.replace(/\/sse$/, '')
    const resp = await fetch(baseUrl, { signal: AbortSignal.timeout(5000) })
    return resp.ok
  } catch {
    return false
  }
}

/**
 * Run a brain task: connect to MCP, convert tools to Anthropic format,
 * then execute a tool-use loop with Claude API.
 */
export async function runBrain(
  serverUrl: string,
  systemPrompt: string,
  userMessage: string,
  model: string = 'claude-opus-4-20250514',
): Promise<BrainResult> {
  // 1. Connect to Context+ MCP
  const mcpClient = await connectBrain(serverUrl)
  const { tools } = await mcpClient.listTools()

  // 2. Convert MCP tools to Anthropic tool format
  // The MCP inputSchema is JSON Schema compatible with Anthropic's tool format.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anthropicTools: any[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description || '',
    input_schema: tool.inputSchema,
  }))

  // 3. Call Claude with tools
  const anthropic = new Anthropic()
  type MessageRole = 'user' | 'assistant'
  type MessageContent = string | unknown
  const messages: Array<{ role: MessageRole; content: MessageContent }> = [
    { role: 'user', content: userMessage },
  ]
  let toolCalls = 0
  let totalTokens = 0

  // 4. Tool-use loop
  while (true) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: messages as never,
      tools: anthropicTools,
    })

    totalTokens += response.usage.input_tokens + response.usage.output_tokens

    // If no tool use, we're done
    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b) => b.type === 'text')
      await mcpClient.close()
      return {
        output: textBlock?.text || '',
        toolCalls,
        tokensUsed: totalTokens,
      }
    }

    // Execute tool calls against Context+ MCP
    const toolResults: Array<{
      type: 'tool_result'
      tool_use_id: string
      content: Array<{ type: 'text'; text: string }>
    }> = []
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        toolCalls++
        const result = await mcpClient.callTool({
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        })
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: [{ type: 'text', text: String(result.content) }],
        })
      }
    }

    // Add assistant response + tool results to conversation
    messages.push({ role: 'assistant', content: response.content as never })
    messages.push({ role: 'user', content: toolResults })
  }
}
