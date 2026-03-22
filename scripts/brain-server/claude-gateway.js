#!/usr/bin/env node
/**
 * Claude Code Gateway - MCP server that delegates to Claude Code CLI
 *
 * Claude Code orchestrates everything including Context+ tools.
 *
 * Usage: node claude-gateway.js
 *
 * Environment:
 *   ANTHROPIC_API_KEY - Claude API key (required)
 *   PORT - Listen port (default: 4100)
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http')
const { spawn } = require('child_process')

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
const PORT = parseInt(process.env.PORT || '4100', 10)

if (!ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY environment variable is required')
  process.exit(1)
}

// =============================================================================
// MCP Protocol Helpers
// =============================================================================

function parseMcpRequest(body) {
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

function mcpResponse(id, result) {
  return {
    jsonrpc: '2.0',
    id: id,
    result: result,
  }
}

function mcpError(id, code, message) {
  return {
    jsonrpc: '2.0',
    id: id,
    error: { code, message },
  }
}

// =============================================================================
// Claude Code CLI
// =============================================================================

/**
 * Call Claude Code CLI with a prompt
 * Claude Code will use Context+ tools automatically
 */
function callClaudeCode(prompt) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ANTHROPIC_API_KEY }

    const proc = spawn('claude', ['-p', '--print', '--dangerously-skip-permissions'], {
      env,
      cwd: '/opt/repo',
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Write prompt to stdin
    proc.stdin.write(prompt)
    proc.stdin.end()

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(`Claude Code exited with code ${code}: ${stderr}`))
      }
    })

    proc.on('error', reject)

    // Timeout after 5 minutes
    setTimeout(() => {
      proc.kill()
      reject(new Error('Claude Code timed out'))
    }, 300000)
  })
}

// =============================================================================
// MCP Server
// =============================================================================

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'claude-gateway' }))
    return
  }

  // MCP endpoint
  if (req.method === 'POST' && url.pathname === '/mcp') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', async () => {
      const mcpReq = parseMcpRequest(body)

      if (!mcpReq) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(mcpError(null, -32700, 'Parse error')))
        return
      }

      const { id, method, params } = mcpReq

      try {
        switch (method) {
          case 'initialize': {
            const result = {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: { name: 'claude-gateway', version: '1.0.0' },
            }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(mcpResponse(id, result)))
            break
          }

          case 'tools/list': {
            // Claude Code's tools are dynamic - we don't expose them here
            // Claude Code will handle tool calls directly
            const result = { tools: [] }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(mcpResponse(id, result)))
            break
          }

          case 'tools/call': {
            const { name, arguments: args } = params || {}

            if (name === 'claude_ask') {
              // Main entry point - ask Claude Code to do something
              const question = args?.question || args?.prompt || ''
              console.log('[gateway] claude_ask:', question.substring(0, 100))

              try {
                const answer = await callClaudeCode(question)
                const result = {
                  content: [
                    {
                      type: 'text',
                      text: answer,
                    },
                  ],
                }
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify(mcpResponse(id, result)))
              } catch (err) {
                console.error('[gateway] Claude Code error:', err.message)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify(mcpError(id, -32603, err.message)))
              }
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(mcpError(id, -32602, `Unknown tool: ${name}`)))
            }
            break
          }

          case 'ping': {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(mcpResponse(id, null)))
            break
          }

          default: {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(mcpError(id, -32601, `Method not found: ${method}`)))
          }
        }
      } catch (err) {
        console.error('[gateway] Error:', err.message)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(mcpError(id, -32603, err.message)))
      }
    })
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Claude Code Gateway listening on port ${PORT}`)
  console.log('Claude Code will orchestrate Context+ tools directly')
})

server.on('error', (err) => {
  console.error('Server error:', err)
  process.exit(1)
})
