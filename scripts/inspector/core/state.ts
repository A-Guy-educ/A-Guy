/**
 * @fileType utility
 * @domain inspector
 * @pattern state-store
 * @ai-summary JSON-backed key-value store persisted to disk
 */

import * as fs from 'fs'
import * as path from 'path'

import type { StateStore } from './types'

/**
 * JSON-backed state store that persists to disk.
 * Uses atomic writes (write to temp, then rename) for safety.
 */
export class JsonStateStore implements StateStore {
  private data: Record<string, unknown> = {}
  private filePath: string
  private dirty = false

  constructor(filePath: string) {
    this.filePath = filePath
    this.load()
  }

  /**
   * Load state from disk. Handles missing/corrupt files gracefully.
   */
  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(content)
        if (parsed && typeof parsed === 'object') {
          this.data = parsed as Record<string, unknown>
        }
      }
    } catch {
      // If file is corrupt or can't be read, start with empty state
      this.data = {}
    }
  }

  get<T>(key: string): T | undefined {
    return this.data[key] as T | undefined
  }

  set<T>(key: string, value: T): void {
    this.data[key] = value
    this.dirty = true
  }

  /**
   * Persist state to disk atomically.
   * Writes to a temp file first, then renames to target.
   */
  save(): void {
    if (!this.dirty) return

    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const tempPath = `${this.filePath}.tmp`
    const json = JSON.stringify(this.data, null, 2)

    try {
      // Write to temp file
      fs.writeFileSync(tempPath, json, 'utf-8')
      // Atomic rename
      fs.renameSync(tempPath, this.filePath)
      this.dirty = false
    } catch (error) {
      // Clean up temp file on failure
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath)
      }
      throw error
    }
  }

  /**
   * Create a new store, loading existing state if available.
   */
  static load(filePath: string): JsonStateStore {
    return new JsonStateStore(filePath)
  }
}

/**
 * Create a fresh empty store (useful for testing).
 */
export function createEmptyStateStore(): JsonStateStore {
  return new JsonStateStore('/dev/null')
}
