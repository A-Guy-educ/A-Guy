/**
 * @fileType utility
 * @domain cody | system-test | mock-llm
 * @ai-summary HTTP server with routing for record/replay modes
 */

import * as http from 'http'
import type { MockLLMConfig, ServerStats } from './types.js'
import type { Replayer } from './replayer.js'
import type { Recorder } from './recorder.js'

export interface MockServer {
  /**
   * Get server stats
   */
  getStats(): ServerStats

  /**
   * Start the server
   */
  start(): Promise<void>

  /**
   * Stop the server
   */
  stop(): Promise<void>
}

export interface MockServerOptions {
  config: MockLLMConfig
  replayer?: Replayer
  recorder?: Recorder
}

export function createServer(options: MockServerOptions): MockServer {
  const { config, replayer, recorder } = options
  const { mode, port } = config

  let server: http.Server | null = null
  const startTime = new Date().toISOString()

  async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://localhost:${port}`)
    const pathname = url.pathname

    // CORS headers for flexibility
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // GET /health - health check
    if (pathname === '/health' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json')
      res.writeHead(200)
      res.end(JSON.stringify({ status: 'ok', mode }))
      return
    }

    // GET /stats - return stats
    if (pathname === '/stats' && req.method === 'GET') {
      const stats: ServerStats = {
        mode,
        callCount: replayer?.getStats().callCount || recorder?.getStats().callCount || 0,
        totalRecordings: replayer?.getStats().totalRecordings || 0,
        startTime,
      }
      res.setHeader('Content-Type', 'application/json')
      res.writeHead(200)
      res.end(JSON.stringify(stats))
      return
    }

    // GET /v1/models - dummy model list (some clients call this)
    if (pathname === '/v1/models' && req.method === 'GET') {
      const modelsResponse = {
        object: 'list',
        data: [
          {
            id: 'llama-3.3-70b-versatile',
            object: 'model',
            created: 1700000000,
            owned_by: 'groq',
          },
        ],
      }
      res.setHeader('Content-Type', 'application/json')
      res.writeHead(200)
      res.end(JSON.stringify(modelsResponse))
      return
    }

    // POST /v1/chat/completions - main endpoint
    if (pathname === '/v1/chat/completions' && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) {
        body += chunk
      }

      let parsedBody: unknown
      try {
        parsedBody = JSON.parse(body)
      } catch {
        res.setHeader('Content-Type', 'application/json')
        res.writeHead(400)
        res.end(
          JSON.stringify({
            error: { message: 'Invalid JSON body', type: 'invalid_request_error' },
          }),
        )
        return
      }

      // Strip stream: true from body (we always return non-streaming)
      if (parsedBody && typeof parsedBody === 'object' && 'stream' in parsedBody) {
        ;(parsedBody as { stream?: boolean }).stream = false
      }

      const request = {
        method: req.method || 'POST',
        path: pathname,
        headers: req.headers as Record<string, string>,
        body: parsedBody,
      }

      const requestModel = (parsedBody as { model?: string })?.model || 'unknown'
      console.log(
        `[mock-llm] #${(replayer?.getStats().callCount || 0) + 1} POST ${pathname} model=${requestModel}`,
      )

      let response: unknown

      if (mode === 'replay' && replayer) {
        response = replayer.getNextResponse(request)
      } else if (mode === 'record' && recorder) {
        response = await recorder.record(request)
      } else {
        res.setHeader('Content-Type', 'application/json')
        res.writeHead(500)
        res.end(
          JSON.stringify({
            error: { message: 'Server not configured correctly', type: 'server_error' },
          }),
        )
        return
      }

      res.setHeader('Content-Type', 'application/json')
      res.writeHead(200)
      res.end(JSON.stringify(response))
      return
    }

    // 404 for everything else
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(404)
    res.end(JSON.stringify({ error: { message: `Not found: ${pathname}`, type: 'not_found' } }))
  }

  return {
    getStats(): ServerStats {
      return {
        mode,
        callCount: replayer?.getStats().callCount || recorder?.getStats().callCount || 0,
        totalRecordings: replayer?.getStats().totalRecordings || 0,
        startTime,
      }
    },

    async start(): Promise<void> {
      return new Promise((resolve, reject) => {
        server = http.createServer(handleRequest)

        server.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            reject(new Error(`Port ${port} is already in use`))
          } else {
            reject(err)
          }
        })

        server.listen(port, () => {
          console.log(`[mock-llm] Started in ${mode} mode on port ${port}`)
          if (replayer) {
            console.log(`[mock-llm] ${replayer.getStats().totalRecordings} recordings loaded`)
          }
          resolve()
        })
      })
    },

    async stop(): Promise<void> {
      return new Promise((resolve) => {
        if (server) {
          server.close(() => {
            console.log('[mock-llm] Server stopped')
            server = null
            resolve()
          })
        } else {
          resolve()
        }
      })
    },
  }
}
