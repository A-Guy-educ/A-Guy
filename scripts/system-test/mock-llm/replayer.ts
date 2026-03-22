/**
 * @fileType utility
 * @domain cody | system-test | mock-llm
 * @ai-summary Replay mode - serves recorded responses with hash-based request matching
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type { RecordedCall, ChatCompletionResponse, ErrorResponse } from './types.js'

export interface ReplayerOptions {
  recordingsDir: string
}

export interface Replayer {
  /**
   * Get current stats
   */
  getStats(): { callCount: number; totalRecordings: number }

  /**
   * Get the next recorded response for the given request
   */
  getNextResponse(request: { body: unknown }): ChatCompletionResponse | ErrorResponse

  /**
   * Reset the call counter to start from the beginning
   */
  reset(): void

  /**
   * Get all loaded recordings (for debugging)
   */
  getRecordings(): RecordedCall[]
}

/**
 * Compute a hash of the request body for matching
 * Uses MD5 for speed (not security) - recordings are just for testing
 */
function computeRequestHash(body: unknown): string {
  // Normalize by sorting keys at each level
  const normalized = normalizeAndSort(body)
  return crypto.createHash('md5').update(JSON.stringify(normalized)).digest('hex')
}

/**
 * Recursively normalize an object by sorting keys
 */
function normalizeAndSort(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(normalizeAndSort)
  const sorted: Record<string, unknown> = {}
  const keys = Object.keys(obj as Record<string, unknown>).sort()
  for (const key of keys) {
    sorted[key] = normalizeAndSort((obj as Record<string, unknown>)[key])
  }
  return sorted
}

/**
 * Normalize a chat completion request body to enable matching across runs
 * Removes non-deterministic fields while keeping the content intact
 */
function normalizeRequest(body: unknown): object {
  if (!body || typeof body !== 'object') return {} as object

  const obj = body as Record<string, unknown>

  // For chat completions, normalize the messages array
  if (Array.isArray(obj.messages)) {
    const normalizedMessages = obj.messages.map((msg: unknown) => {
      if (!msg || typeof msg !== 'object') return msg
      const msgObj = msg as Record<string, unknown>
      // Keep role and content (content is what we match on)
      return {
        role: msgObj.role,
        content: msgObj.content,
      }
    })
    // Normalize model name to strip provider prefix (e.g., "groq/llama..." -> "llama...")
    const model = normalizeModelName(obj.model as string)
    return {
      model,
      messages: normalizedMessages,
    }
  }

  return obj
}

/**
 * Normalize model name by stripping provider prefix
 * e.g., "groq/llama-3.3-70b-versatile" -> "llama-3.3-70b-versatile"
 */
function normalizeModelName(model: string): string {
  if (!model) return model
  // Strip provider prefix if present (e.g., "groq/", "openai/", etc.)
  const slashIndex = model.indexOf('/')
  return slashIndex >= 0 ? model.substring(slashIndex + 1) : model
}

export function createReplayer(options: ReplayerOptions): Replayer {
  const { recordingsDir } = options
  const recordings: RecordedCall[] = []
  const requestHashToIndex = new Map<string, number>()
  const usedIndices = new Set<number>()
  let sequentialIndex = 0

  // Load all recordings on startup
  function loadRecordings(): void {
    if (!fs.existsSync(recordingsDir)) {
      throw new Error(`Recordings directory does not exist: ${recordingsDir}`)
    }

    const files = fs.readdirSync(recordingsDir)
    const jsonFiles = files.filter((f) => f.endsWith('.json') && f !== 'metadata.json').sort()

    if (jsonFiles.length === 0) {
      throw new Error(`No recording files found in: ${recordingsDir}`)
    }

    for (const file of jsonFiles) {
      const filePath = path.join(recordingsDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(content) as RecordedCall
      recordings.push(parsed)

      // Build hash index for fast lookup
      const normalizedBody = normalizeRequest(parsed.request.body)
      const hash = computeRequestHash(normalizedBody)
      requestHashToIndex.set(hash, parsed.index)
    }

    console.log(
      `[mock-llm] Loaded ${recordings.length} recordings from ${path.basename(recordingsDir)}`,
    )
    console.log(`[mock-llm] Built hash index with ${requestHashToIndex.size} unique requests`)
  }

  loadRecordings()

  return {
    getStats(): { callCount: number; totalRecordings: number } {
      return {
        callCount: usedIndices.size + sequentialIndex,
        totalRecordings: recordings.length,
      }
    },

    getNextResponse(request: { body: unknown }): ChatCompletionResponse | ErrorResponse {
      const requestModel = (request.body as { model?: string })?.model || 'unknown'
      const normalizedBody = normalizeRequest(request.body)
      const requestHash = computeRequestHash(normalizedBody)

      // Try to find a matching recording by hash
      const matchedIndex = requestHashToIndex.get(requestHash)

      if (matchedIndex !== undefined) {
        const recording = recordings.find((r) => r.index === matchedIndex)
        if (recording) {
          // Hash match found - return it (even if already used, since request is identical)
          console.log(`[mock-llm] REPLAY ${requestModel} HASH_MATCH idx=${matchedIndex}`)
          return recording.response.body as ChatCompletionResponse
        }
      }

      // Fall back to sequential if no hash match
      while (usedIndices.has(sequentialIndex)) {
        sequentialIndex++
      }

      if (sequentialIndex >= recordings.length) {
        const error: ErrorResponse = {
          error: {
            message: `Mock LLM: No more recorded responses. All ${recordings.length} recordings exhausted.`,
            type: 'mock_exhausted',
            code: 'NEXT_EXCEEDS_TOTAL',
          },
        }
        console.error(`[mock-llm] ERROR: ${error.error.message}`)
        return error
      }

      const recording = recordings[sequentialIndex]
      usedIndices.add(sequentialIndex)
      sequentialIndex++
      const recordedModel = (recording.request.body as { model?: string })?.model || 'unknown'

      console.log(`[mock-llm] REPLAY ${requestModel} SEQUENTIAL idx=${sequentialIndex - 1}`)

      if (requestModel !== recordedModel) {
        console.warn(
          `[mock-llm] WARN: Request model "${requestModel}" differs from recorded model "${recordedModel}"`,
        )
      }

      return recording.response.body as ChatCompletionResponse
    },

    reset(): void {
      usedIndices.clear()
      sequentialIndex = 0
      console.log('[mock-llm] Replayer reset')
    },

    getRecordings(): RecordedCall[] {
      return [...recordings]
    },
  }
}
