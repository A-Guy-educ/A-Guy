#!/usr/bin/env node
/**
 * Token Manager API - Simple API to set/update tokens for MCP servers
 *
 * Usage: node token-manager.js
 *
 * Endpoints:
 *   POST /token/github - Set GitHub token
 *   GET  /token/github - Get current GitHub token (masked)
 *   POST /token/anthropic - Set Anthropic API key
 *   GET  /token/anthropic - Get current Anthropic key (masked)
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http')
const fs = require('fs')

const PORT = process.env.PORT || 4096
const TOKEN_FILE = '/opt/brain-server/tokens.json'

// Load existing tokens
function loadTokens() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'))
    }
  } catch (_e) {
    /* continue */
  }
  return { github: null, anthropic: null }
}

// Save tokens
function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2))
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  // GET /token/github - Get masked token
  if (req.method === 'GET' && url.pathname === '/token/github') {
    const tokens = loadTokens()
    const masked = tokens.github
      ? tokens.github.substring(0, 7) + '...' + tokens.github.substring(tokens.github.length - 4)
      : null
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ token: masked, set: !!tokens.github }))
    return
  }

  // POST /token/github - Set token
  if (req.method === 'POST' && url.pathname === '/token/github') {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      try {
        const { token } = JSON.parse(body)
        if (!token || typeof token !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Token required' }))
          return
        }
        const tokens = loadTokens()
        tokens.github = token
        saveTokens(tokens)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, masked: token.substring(0, 7) + '...' }))
      } catch (_e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
    return
  }

  // GET /token/anthropic - Get masked key
  if (req.method === 'GET' && url.pathname === '/token/anthropic') {
    const tokens = loadTokens()
    const masked = tokens.anthropic
      ? tokens.anthropic.substring(0, 7) +
        '...' +
        tokens.anthropic.substring(tokens.anthropic.length - 4)
      : null
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ key: masked, set: !!tokens.anthropic }))
    return
  }

  // POST /token/anthropic - Set Anthropic key
  if (req.method === 'POST' && url.pathname === '/token/anthropic') {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      try {
        const { key } = JSON.parse(body)
        if (!key || typeof key !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Key required' }))
          return
        }
        const tokens = loadTokens()
        tokens.anthropic = key
        saveTokens(tokens)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch (_e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
    return
  }

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'token-manager' }))
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Token Manager API listening on port ${PORT}`)
})

// Load tokens on startup
const tokens = loadTokens()
if (tokens.github) {
  console.log('GitHub token: ' + tokens.github.substring(0, 7) + '...')
}
if (tokens.anthropic) {
  console.log('Anthropic key: ' + tokens.anthropic.substring(0, 7) + '...')
}
