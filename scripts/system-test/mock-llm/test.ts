/**
 * @fileType test
 * @domain cody | system-test | mock-llm
 * @pattern mocked-integration | record-replay
 * @ai-summary Integration tests for the LLM mock tool - runs standalone via tsx
 */

import * as fs from 'fs'
import * as path from 'path'
import { createReplayer } from './replayer'
import { createServer } from './server'
import type { RecordedCall, ChatCompletionResponse } from './types'

// Test constants
const TEST_RECORDINGS_DIR = '/tmp/mock-llm-test-recordings'

// Helper to create a mock chat completion response
function createMockResponse(
  content: string,
  model = 'llama-3.3-70b-versatile',
): ChatCompletionResponse {
  return {
    id: `chatcmpl-${Math.random().toString(36).slice(2, 10)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: content.split(' ').length,
      total_tokens: 10 + content.split(' ').length,
    },
  }
}

// Helper to create a recorded call
function createRecordedCall(
  index: number,
  requestBody: unknown,
  response: ChatCompletionResponse,
): RecordedCall {
  return {
    index,
    timestamp: new Date().toISOString(),
    request: {
      method: 'POST',
      path: '/v1/chat/completions',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-key',
      },
      body: requestBody,
    },
    response: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: response,
    },
  }
}

// ============================================================================
// Replayer Tests
// ============================================================================

async function runReplayerTests() {
  console.log('\n=== Running Replayer Tests ===\n')

  // Setup
  if (!fs.existsSync(TEST_RECORDINGS_DIR)) {
    fs.mkdirSync(TEST_RECORDINGS_DIR, { recursive: true })
  }

  // Test 1: Load recordings from directory
  console.log('Test: should load recordings from directory')
  const recording1 = createRecordedCall(
    0,
    { model: 'test-model', messages: [] },
    createMockResponse('Hello'),
  )
  const recording2 = createRecordedCall(
    1,
    { model: 'test-model', messages: [] },
    createMockResponse('World'),
  )

  fs.writeFileSync(path.join(TEST_RECORDINGS_DIR, '000.json'), JSON.stringify(recording1))
  fs.writeFileSync(path.join(TEST_RECORDINGS_DIR, '001.json'), JSON.stringify(recording2))

  const replayer = createReplayer({ recordingsDir: TEST_RECORDINGS_DIR })
  const stats = replayer.getStats()
  console.assert(stats.totalRecordings === 2, `Expected 2 recordings, got ${stats.totalRecordings}`)
  console.log('✓ Passed\n')

  // Test 2: Return responses in sequence
  console.log('Test: should return responses in sequence')
  const response1 = replayer.getNextResponse({ body: { model: 'test-model' } })
  const response2 = replayer.getNextResponse({ body: { model: 'test-model' } })

  console.assert(
    (response1 as ChatCompletionResponse).choices[0].message.content === 'Hello',
    `Expected 'Hello', got '${(response1 as ChatCompletionResponse).choices[0].message.content}'`,
  )
  console.assert(
    (response2 as ChatCompletionResponse).choices[0].message.content === 'World',
    `Expected 'World', got '${(response2 as ChatCompletionResponse).choices[0].message.content}'`,
  )
  console.log('✓ Passed\n')

  // Test 3: Increment call count
  console.log('Test: should increment call count')
  console.assert(
    replayer.getStats().callCount === 2,
    `Expected 2 calls, got ${replayer.getStats().callCount}`,
  )
  console.log('✓ Passed\n')

  // Test 4: Return error when recordings exhausted
  console.log('Test: should return error when recordings exhausted')
  const response3 = replayer.getNextResponse({ body: { model: 'test-model' } })
  console.assert(
    (response3 as { error: { type: string } }).error.type === 'mock_exhausted',
    'Expected mock_exhausted error',
  )
  console.log('✓ Passed\n')

  // Test 5: Throw error when directory does not exist
  console.log('Test: should throw error when directory does not exist')
  try {
    createReplayer({ recordingsDir: '/nonexistent/path' })
    console.assert(false, 'Should have thrown')
  } catch (e) {
    console.assert(
      (e as Error).message.includes('does not exist'),
      'Should contain "does not exist"',
    )
  }
  console.log('✓ Passed\n')

  // Cleanup
  fs.rmSync(TEST_RECORDINGS_DIR, { recursive: true, force: true })

  console.log('=== Replayer Tests Complete ===\n')
}

// ============================================================================
// Server Tests
// ============================================================================

async function runServerTests() {
  console.log('\n=== Running Server Tests ===\n')

  const serverRecordingsDir = '/tmp/mock-llm-server-test'
  const serverPort = 19998

  // Setup
  if (!fs.existsSync(serverRecordingsDir)) {
    fs.mkdirSync(serverRecordingsDir, { recursive: true })
  }

  // Create sample recordings
  const recording = createRecordedCall(
    0,
    { model: 'llama-3.3-70b-versatile', messages: [] },
    createMockResponse('Hello from mock!'),
  )
  fs.writeFileSync(path.join(serverRecordingsDir, '000.json'), JSON.stringify(recording))

  // Test 1: Start and stop server
  console.log('Test: should start and stop server')
  const replayer = createReplayer({ recordingsDir: serverRecordingsDir })
  const server = createServer({
    config: { mode: 'replay', port: serverPort, recordingsDir: serverRecordingsDir },
    replayer,
  })

  await server.start()
  console.log('✓ Server started\n')

  // Test 2: Health check
  console.log('Test: should return health check')
  const healthResponse = await fetch(`http://localhost:${serverPort}/health`)
  const healthData = await healthResponse.json()
  console.assert(healthData.status === 'ok', `Expected ok, got ${healthData.status}`)
  console.assert(healthData.mode === 'replay', `Expected replay, got ${healthData.mode}`)
  console.log('✓ Passed\n')

  // Test 3: Stats endpoint
  console.log('Test: should return stats')
  const statsResponse = await fetch(`http://localhost:${serverPort}/stats`)
  const statsData = await statsResponse.json()
  console.assert(statsData.mode === 'replay', `Expected replay, got ${statsData.mode}`)
  console.assert(statsData.totalRecordings === 1, `Expected 1, got ${statsData.totalRecordings}`)
  console.log('✓ Passed\n')

  // Test 4: Model list
  console.log('Test: should return model list')
  const modelsResponse = await fetch(`http://localhost:${serverPort}/v1/models`)
  const modelsData = await modelsResponse.json()
  console.assert(modelsData.data.length === 1, `Expected 1 model, got ${modelsData.data.length}`)
  console.assert(
    modelsData.data[0].id === 'llama-3.3-70b-versatile',
    `Expected llama-3.3-70b-versatile, got ${modelsData.data[0].id}`,
  )
  console.log('✓ Passed\n')

  // Test 5: Chat completions
  console.log('Test: should handle chat completions request')
  const chatResponse = await fetch(`http://localhost:${serverPort}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Hello' }],
    }),
  })
  const chatData = await chatResponse.json()
  console.assert(
    chatData.choices[0].message.content === 'Hello from mock!',
    `Expected 'Hello from mock!', got '${chatData.choices[0].message.content}'`,
  )
  console.log('✓ Passed\n')

  // Test 6: Unknown route
  console.log('Test: should return 404 for unknown routes')
  const unknownResponse = await fetch(`http://localhost:${serverPort}/unknown`)
  console.assert(unknownResponse.status === 404, `Expected 404, got ${unknownResponse.status}`)
  console.log('✓ Passed\n')

  // Test 7: CORS preflight
  console.log('Test: should handle CORS preflight')
  const corsResponse = await fetch(`http://localhost:${serverPort}/health`, { method: 'OPTIONS' })
  console.assert(corsResponse.status === 204, `Expected 204, got ${corsResponse.status}`)
  console.log('✓ Passed\n')

  // Cleanup
  await server.stop()
  fs.rmSync(serverRecordingsDir, { recursive: true, force: true })

  console.log('=== Server Tests Complete ===\n')
}

// ============================================================================
// End-to-End Tests
// ============================================================================

async function runE2ETests() {
  console.log('\n=== Running E2E Tests ===\n')

  const e2eRecordingsDir = '/tmp/mock-llm-e2e-test'
  const e2ePort = 19997

  // Setup
  if (!fs.existsSync(e2eRecordingsDir)) {
    fs.mkdirSync(e2eRecordingsDir, { recursive: true })
  }

  // Create multiple recordings
  const rec1 = createRecordedCall(
    0,
    { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'First' }] },
    createMockResponse('Response 1'),
  )
  const rec2 = createRecordedCall(
    1,
    { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'Second' }] },
    createMockResponse('Response 2'),
  )
  const rec3 = createRecordedCall(
    2,
    { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'Third' }] },
    createMockResponse('Response 3'),
  )

  fs.writeFileSync(path.join(e2eRecordingsDir, '000.json'), JSON.stringify(rec1))
  fs.writeFileSync(path.join(e2eRecordingsDir, '001.json'), JSON.stringify(rec2))
  fs.writeFileSync(path.join(e2eRecordingsDir, '002.json'), JSON.stringify(rec3))

  // Create server
  const replayer = createReplayer({ recordingsDir: e2eRecordingsDir })
  const server = createServer({
    config: { mode: 'replay', port: e2ePort, recordingsDir: e2eRecordingsDir },
    replayer,
  })

  await server.start()

  // Test: Multiple sequential requests
  console.log('Test: should handle multiple sequential requests')
  const responses = []
  for (let i = 0; i < 3; i++) {
    const response = await fetch(`http://localhost:${e2ePort}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: `Request ${i + 1}` }],
      }),
    })
    const data = await response.json()
    responses.push(data.choices[0].message.content)
  }

  console.assert(responses[0] === 'Response 1', `Expected 'Response 1', got '${responses[0]}'`)
  console.assert(responses[1] === 'Response 2', `Expected 'Response 2', got '${responses[1]}'`)
  console.assert(responses[2] === 'Response 3', `Expected 'Response 3', got '${responses[2]}'`)
  console.log('✓ Passed\n')

  // Test: Exhausted recordings
  console.log('Test: should return error when recordings exhausted')
  const failResponse = await fetch(`http://localhost:${e2ePort}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Too many' }],
    }),
  })
  const errorData = await failResponse.json()
  console.assert(
    errorData.error.type === 'mock_exhausted',
    `Expected mock_exhausted, got ${errorData.error.type}`,
  )
  console.log('✓ Passed\n')

  // Cleanup
  await server.stop()
  fs.rmSync(e2eRecordingsDir, { recursive: true, force: true })

  console.log('=== E2E Tests Complete ===\n')
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('Starting Mock LLM Integration Tests...\n')

  let passed = 0
  let failed = 0

  try {
    await runReplayerTests()
    passed++
  } catch (e) {
    console.error('Replayer tests failed:', e)
    failed++
  }

  try {
    await runServerTests()
    passed++
  } catch (e) {
    console.error('Server tests failed:', e)
    failed++
  }

  try {
    await runE2ETests()
    passed++
  } catch (e) {
    console.error('E2E tests failed:', e)
    failed++
  }

  console.log('\n========================================')
  console.log(`Results: ${passed} passed, ${failed} failed`)
  console.log('========================================\n')

  process.exit(failed > 0 ? 1 : 0)
}

main()
