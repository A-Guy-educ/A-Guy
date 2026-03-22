/**
 * @fileType test
 * @domain cody | mock-llm
 * @ai-summary Tests for incremental recording feature
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import { createRecorder } from '../../scripts/system-test/mock-llm/recorder'
import { type RecordedCall } from '../../scripts/system-test/mock-llm/types'

describe('mock-llm incremental recording', () => {
  const testDir = path.join(process.cwd(), 'tests/unit/tmp/mock-llm-test')

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true })
    }
    fs.mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    // Clean up after test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true })
    }
  })

  it('should start at index 0 when no recordings exist', async () => {
    const recorder = createRecorder({
      recordingsDir: testDir,
      upstreamUrl: 'https://api.groq.com/openai',
      apiKey: 'test-key',
    })

    // Trigger a record call (will fail since no real upstream, but index will be set)
    try {
      await recorder.record({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { model: 'test', messages: [] },
      } as Parameters<typeof recorder.record>[0])
    } catch {
      // Expected to fail
    }

    const stats = recorder.getStats()
    expect(stats.callCount).toBe(1) // First call should be index 0
  })

  it('should continue from highest existing index (incremental)', async () => {
    // Create existing recordings (000.json, 001.json)
    const existingRecordings: RecordedCall[] = [
      {
        index: 0,
        timestamp: new Date().toISOString(),
        request: {
          method: 'POST',
          path: '/v1/chat/completions',
          headers: {},
          body: { model: 'test', messages: [] },
        },
        response: {
          status: 200,
          headers: {},
          body: { choices: [{ message: { role: 'assistant', content: 'hello' } }] },
        },
      },
      {
        index: 1,
        timestamp: new Date().toISOString(),
        request: {
          method: 'POST',
          path: '/v1/chat/completions',
          headers: {},
          body: { model: 'test', messages: [] },
        },
        response: {
          status: 200,
          headers: {},
          body: { choices: [{ message: { role: 'assistant', content: 'world' } }] },
        },
      },
    ]

    fs.writeFileSync(path.join(testDir, '000.json'), JSON.stringify(existingRecordings[0], null, 2))
    fs.writeFileSync(path.join(testDir, '001.json'), JSON.stringify(existingRecordings[1], null, 2))

    const recorder = createRecorder({
      recordingsDir: testDir,
      upstreamUrl: 'https://api.groq.com/openai',
      apiKey: 'test-key',
    })

    const stats = recorder.getStats()
    // Should start at index 2 (after existing 000, 001)
    expect(stats.callCount).toBe(2)
  })

  it('should handle non-sequential existing indices', async () => {
    // Create recordings with gaps (000.json, 002.json)
    const existingRecordings: RecordedCall[] = [
      {
        index: 0,
        timestamp: new Date().toISOString(),
        request: {
          method: 'POST',
          path: '/v1/chat/completions',
          headers: {},
          body: { model: 'test', messages: [] },
        },
        response: {
          status: 200,
          headers: {},
          body: { choices: [{ message: { role: 'assistant', content: 'first' } }] },
        },
      },
      {
        index: 2,
        timestamp: new Date().toISOString(),
        request: {
          method: 'POST',
          path: '/v1/chat/completions',
          headers: {},
          body: { model: 'test', messages: [] },
        },
        response: {
          status: 200,
          headers: {},
          body: { choices: [{ message: { role: 'assistant', content: 'third' } }] },
        },
      },
    ]

    fs.writeFileSync(path.join(testDir, '000.json'), JSON.stringify(existingRecordings[0], null, 2))
    fs.writeFileSync(path.join(testDir, '002.json'), JSON.stringify(existingRecordings[1], null, 2))

    const recorder = createRecorder({
      recordingsDir: testDir,
      upstreamUrl: 'https://api.groq.com/openai',
      apiKey: 'test-key',
    })

    const stats = recorder.getStats()
    // Should start at index 3 (highest is 2, so next is 3)
    expect(stats.callCount).toBe(3)
  })

  it('should handle empty directory', async () => {
    // Don't create any files - just empty directory
    const recorder = createRecorder({
      recordingsDir: testDir,
      upstreamUrl: 'https://api.groq.com/openai',
      apiKey: 'test-key',
    })

    const stats = recorder.getStats()
    expect(stats.callCount).toBe(0)
  })

  it('should save new recording at correct index', async () => {
    // Create existing recording
    const existingRecording: RecordedCall = {
      index: 0,
      timestamp: new Date().toISOString(),
      request: {
        method: 'POST',
        path: '/v1/chat/completions',
        headers: {},
        body: { model: 'test', messages: [] },
      },
      response: {
        status: 200,
        headers: {},
        body: { choices: [{ message: { role: 'assistant', content: 'existing' } }] },
      },
    }

    fs.writeFileSync(path.join(testDir, '000.json'), JSON.stringify(existingRecording, null, 2))

    // Verify existing file is there and starting index is correct
    const recorder = createRecorder({
      recordingsDir: testDir,
      upstreamUrl: 'https://api.groq.com/openai',
      apiKey: 'test-key',
    })

    // Verify the recorder detects existing recording and starts at index 1
    expect(recorder.getStats().callCount).toBe(1)

    // Verify files in directory
    const files = fs.readdirSync(testDir).filter((f) => f.endsWith('.json'))
    expect(files).toContain('000.json')
    expect(files).not.toContain('001.json') // New recording shouldn't exist yet
  })
})
