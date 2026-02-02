/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit Tests for MCP Client
 *
 * Tests the MCP client that handles communication with the MCP server,
 * including authentication header forwarding, per-request initialization,
 * and event-stream response parsing.
 */
import { MCPClient } from '@/server/repos/mcp/client/mcp-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock crypto.randomUUID
const mockRandomUUID = vi.fn(() => 'test-uuid-123')
vi.spyOn(crypto, 'randomUUID').mockImplementation(mockRandomUUID)

describe('MCPClient', () => {
  let client: MCPClient

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    client = new MCPClient('http://localhost:3000')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('stores base URL correctly', () => {
      const client = new MCPClient('https://example.com')
      expect((client as unknown as { baseUrl: string }).baseUrl).toBe('https://example.com')
    })
  })

  describe('listTools', () => {
    it('initializes before listing tools', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: { tools: [] },
          }),
      })

      await client.listTools()

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('sends correct headers to MCP endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: { tools: [] },
          }),
      })

      await client.listTools({ cookie: 'session=abc123' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            cookie: 'session=abc123',
            'MCP-Protocol-Version': '2025-11-25',
          }),
        }),
      )
    })

    it('forwards custom headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: { tools: [] },
          }),
      })

      await client.listTools({
        Authorization: 'Bearer token123',
        'X-Custom-Header': 'custom-value',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
            'X-Custom-Header': 'custom-value',
          }),
        }),
      )
    })

    it('returns empty array when no tools in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: { tools: [] },
          }),
      })

      const tools = await client.listTools()

      expect(tools).toEqual([])
    })

    it('returns tools from response', async () => {
      const mockTools = [
        { name: 'findCourses', description: 'Query courses' },
        { name: 'findChapters', description: 'Query chapters' },
      ]

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: { tools: mockTools },
          }),
      })

      const tools = await client.listTools()

      expect(tools).toEqual(mockTools)
    })

    it('handles missing tools property in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: {},
          }),
      })

      const tools = await client.listTools()

      expect(tools).toEqual([])
    })
  })

  describe('callTool', () => {
    it('initializes before calling tool', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: { content: [] },
          }),
      })

      await client.callTool('findCourses', { limit: 10 })

      expect(mockFetch).toHaveBeenCalledTimes(2) // initialize + callTool
    })

    it('sends correct tool name and arguments', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: { content: [{ type: 'text', text: 'Result' }] },
          }),
      })

      await client.callTool('findCourses', { limit: 10, where: '{"status": "published"}' })

      const fetchCall = mockFetch.mock.calls[1]
      const body = JSON.parse(fetchCall[1].body as string)

      expect(body.method).toBe('tools/call')
      expect(body.params.name).toBe('findCourses')
      expect(body.params.arguments).toEqual({ limit: 10, where: '{"status": "published"}' })
    })

    it('forwards auth headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: { content: [] },
          }),
      })

      await client.callTool('findCourses', {}, { cookie: 'session=abc' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ cookie: 'session=abc' }),
        }),
      )
    })

    it('returns tool result', async () => {
      const mockResult = { content: [{ type: 'text', text: 'Found 5 courses' }] }

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: mockResult,
          }),
      })

      const result = await client.callTool('findCourses', { limit: 5 })

      expect(result).toEqual(mockResult)
    })
  })

  describe('error handling', () => {
    it('throws error on 401 Unauthorized', async () => {
      // First call (initialize) succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: {},
          }),
      })

      // Second call (listTools) returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      })

      await expect(client.listTools()).rejects.toThrow('MCP request failed with status 401')
    })

    it('throws error on 500 Internal Server Error', async () => {
      // First call (initialize) succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: {},
          }),
      })

      // Second call (listTools) returns 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })

      await expect(client.listTools()).rejects.toThrow('MCP request failed with status 500')
    })

    it('throws error on JSON-RPC error response', async () => {
      // First call (initialize) succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: {},
          }),
      })

      // Second call (listTools) returns JSON-RPC error
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            error: { code: -32600, message: 'Invalid Request' },
          }),
      })

      await expect(client.listTools()).rejects.toThrow('Invalid Request')
    })

    it('throws error on missing result', async () => {
      // First call (initialize) succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: {},
          }),
      })

      // Second call (listTools) returns response without result
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
          }),
      })

      await expect(client.listTools()).rejects.toThrow('MCP response missing result')
    })
  })

  describe('event-stream response parsing', () => {
    it('parses event-stream response correctly', async () => {
      const mockTools = [{ name: 'findCourses', description: 'Query courses' }]

      // First call (initialize) returns normal JSON response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: {},
          }),
      })

      // Second call (listTools) returns event-stream
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        text: () =>
          Promise.resolve(
            `data: ${JSON.stringify({ jsonrpc: '2.0', id: 'test-uuid-123', result: { tools: mockTools } })}`,
          ),
      })

      const tools = await client.listTools()

      expect(tools).toEqual(mockTools)
    })

    it('handles empty event-stream', async () => {
      // First call (initialize)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: {},
          }),
      })

      // Second call (listTools) returns empty event-stream
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        text: () => Promise.resolve(''),
      })

      await expect(client.listTools()).rejects.toThrow('No data found in event-stream response')
    })

    it('handles event-stream with multiple data lines', async () => {
      const mockTools = [{ name: 'findCourses' }]

      // First call (initialize)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: {},
          }),
      })

      // Second call (listTools) returns event-stream with multiple lines
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        text: () =>
          Promise.resolve(
            `data: some text\ndata: more text\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 'test-uuid-123', result: { tools: mockTools } })}`,
          ),
      })

      const tools = await client.listTools()

      expect(tools).toEqual(mockTools)
    })
  })

  describe('initialization', () => {
    it('sends correct initialize request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 'test-uuid-123',
            result: {},
          }),
      })

      await client.listTools()

      const initCall = mockFetch.mock.calls[0]
      const body = JSON.parse(initCall[1].body as string)

      expect(body.method).toBe('initialize')
      expect(body.params.protocolVersion).toBe('2025-11-25')
      expect(body.params.clientInfo).toEqual({
        name: 'admin-chat-backend',
        version: '1.0.0',
      })
    })
  })
})
