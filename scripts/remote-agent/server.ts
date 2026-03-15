/**
 * @fileType utility
 * @domain remote-agent
 * @pattern http-server
 * @ai-summary Minimal HTTP server for the remote dev agent — no Express, Node.js built-ins only
 */

import http from 'http'
import { isAuthorized, rejectUnauthorized } from './auth'
import { handleExec, handleRead, handleWrite, handleLs } from './handlers'
import { REMOTE_AGENT_PORT, REMOTE_AGENT_KEY } from './config'

function jsonResponse(res: http.ServerResponse, status: number, body: object): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

export function createServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '/'
    const method = req.method ?? 'GET'

    // Health endpoint — no auth required
    if (url === '/health' && method === 'GET') {
      jsonResponse(res, 200, { status: 'ok', timestamp: new Date().toISOString() })
      return
    }

    // All other routes require Bearer auth
    if (!isAuthorized(req)) {
      rejectUnauthorized(res)
      return
    }

    // Parse body for POST routes
    let body: Record<string, unknown> = {}
    if (method === 'POST') {
      try {
        const raw = await readBody(req)
        body = raw ? JSON.parse(raw) : {}
      } catch {
        jsonResponse(res, 400, { error: 'Invalid JSON body' })
        return
      }
    }

    // Route dispatch
    try {
      if (url === '/exec' && method === 'POST') {
        const result = await handleExec(body)
        jsonResponse(res, 200, result)
      } else if (url === '/read' && method === 'POST') {
        const result = await handleRead(body)
        jsonResponse(res, 200, result)
      } else if (url === '/write' && method === 'POST') {
        const result = await handleWrite(body)
        jsonResponse(res, 200, result)
      } else if (url === '/ls' && method === 'POST') {
        const result = await handleLs(body)
        jsonResponse(res, 200, result)
      } else {
        jsonResponse(res, 404, { error: 'Not found' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      jsonResponse(res, 500, { error: message })
    }
  })

  return server
}

// Start server when run directly
if (process.env.NODE_ENV !== 'test') {
  if (!REMOTE_AGENT_KEY) {
    console.error('❌ REMOTE_AGENT_KEY is not set. Refusing to start without auth key.')
    process.exit(1)
  }

  const server = createServer()
  server.listen(REMOTE_AGENT_PORT, '127.0.0.1', () => {
    console.log(`🤖 Remote agent listening on http://127.0.0.1:${REMOTE_AGENT_PORT}`)
    console.log(`   Health: http://127.0.0.1:${REMOTE_AGENT_PORT}/health`)
  })

  const shutdown = () => {
    console.log('\n🛑 Shutting down remote agent...')
    server.close(() => process.exit(0))
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
