/**
 * @fileType utility
 * @domain remote-agent
 * @pattern auth-middleware
 * @ai-summary Bearer token authentication middleware for the remote agent server
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { REMOTE_AGENT_KEY } from './config'

/**
 * Validates the Authorization: Bearer <key> header.
 * Returns true if valid, false otherwise.
 */
export function isAuthorized(req: IncomingMessage): boolean {
  const authHeader = req.headers['authorization']
  if (!authHeader) return false

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return false

  const token = parts[1]
  if (!token) return false

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(token, REMOTE_AGENT_KEY)
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still compare to prevent length-based timing
    let _diff = 0
    for (let i = 0; i < a.length; i++) {
      _diff |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) ?? 0)
    }
    return false
  }

  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Sends a 401 Unauthorized response and returns false.
 * Use to gate protected routes.
 */
export function rejectUnauthorized(res: ServerResponse): void {
  res.writeHead(401, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Unauthorized' }))
}
