/**
 * External Integration Tests: AI Model Responses
 *
 * Tests real AI model API calls to validate response format and schema compliance.
 * These tests call external APIs and are gated behind RUN_EXTERNAL_TESTS=true.
 *
 * Run with: pnpm test:external
 * Requires: GEMINI_API_KEY or OPENAI_API_KEY environment variables
 *
 * @fileType integration-test
 * @domain ai.external
 * @pattern external-integration, ai-model-validation
 */

import { describe, expect, it } from 'vitest'

const hasExternalTests = process.env.RUN_EXTERNAL_TESTS === 'true'
const hasGeminiKey = !!process.env.GEMINI_API_KEY
const hasOpenAIKey = !!process.env.OPENAI_API_KEY

describe.runIf(hasExternalTests && hasGeminiKey)('Gemini Model Responses', () => {
  it('should return a valid text response from Gemini', async () => {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent('Say "hello" and nothing else.')
    const text = result.response.text()

    expect(text).toBeTruthy()
    expect(typeof text).toBe('string')
    expect(text.toLowerCase()).toContain('hello')
  }, 30000)

  it('should handle multimodal input with base64 image', async () => {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    // 1x1 red pixel PNG
    const testImageBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

    const result = await model.generateContent([
      { text: 'Describe this image in one sentence.' },
      {
        inlineData: {
          mimeType: 'image/png',
          data: testImageBase64,
        },
      },
    ])

    const text = result.response.text()
    expect(text).toBeTruthy()
    expect(typeof text).toBe('string')
  }, 30000)
})

describe.runIf(hasExternalTests && hasOpenAIKey)('OpenAI Model Responses', () => {
  it('should generate embeddings with correct dimensions', async () => {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: 'Test embedding for dimension validation',
      }),
    })

    expect(response.ok).toBe(true)
    const data = await response.json()

    expect(data.data).toHaveLength(1)
    expect(data.data[0].embedding).toBeInstanceOf(Array)
    // text-embedding-3-small returns 1536 dimensions by default
    expect(data.data[0].embedding.length).toBe(1536)
    // Each value should be a number
    expect(typeof data.data[0].embedding[0]).toBe('number')
  }, 30000)
})

describe.runIf(hasExternalTests && !hasGeminiKey && !hasOpenAIKey)(
  'External Tests - No API Keys',
  () => {
    it('should skip when no API keys are configured', () => {
      expect(true).toBe(true)
    })
  },
)
