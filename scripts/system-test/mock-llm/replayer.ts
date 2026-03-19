/**
 * @fileType utility
 * @domain cody | system-test | mock-llm
 * @ai-summary Replay mode - serves recorded responses in sequence
 */

import * as fs from 'fs'
import * as path from 'path'
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

export function createReplayer(options: ReplayerOptions): Replayer {
  const { recordingsDir } = options
  const recordings: RecordedCall[] = []
  let callCount = 0

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
    }

    console.log(
      `[mock-llm] Loaded ${recordings.length} recordings from ${path.basename(recordingsDir)}`,
    )
  }

  loadRecordings()

  return {
    getStats(): { callCount: number; totalRecordings: number } {
      return {
        callCount,
        totalRecordings: recordings.length,
      }
    },

    getNextResponse(request: { body: unknown }): ChatCompletionResponse | ErrorResponse {
      const currentIndex = callCount
      callCount++

      if (currentIndex >= recordings.length) {
        const error: ErrorResponse = {
          error: {
            message: `Mock LLM: No more recorded responses. Expected ${recordings.length} calls, got ${currentIndex + 1}.`,
            type: 'mock_exhausted',
            code: 'NEXT_EXCEEDS_TOTAL',
          },
        }
        console.error(`[mock-llm] ERROR: ${error.error.message}`)
        return error
      }

      const recording = recordings[currentIndex]

      // Log the replay
      const requestModel = (request.body as { model?: string })?.model || 'unknown'
      const recordedModel = (recording.request.body as { model?: string })?.model || 'unknown'

      if (requestModel !== recordedModel) {
        console.warn(
          `[mock-llm] WARN: Request model "${requestModel}" differs from recorded model "${recordedModel}"`,
        )
      }

      console.log(
        `[mock-llm] REPLAY #${currentIndex + 1}/${recordings.length} model=${recordedModel}`,
      )

      // Return the recorded response
      return recording.response.body as ChatCompletionResponse
    },

    reset(): void {
      callCount = 0
      console.log('[mock-llm] Replayer counter reset to 0')
    },

    getRecordings(): RecordedCall[] {
      return [...recordings]
    },
  }
}
