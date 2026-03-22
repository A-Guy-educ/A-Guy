/**
 * @fileType utility
 * @domain inspector
 * @pattern state-store
 * @ai-summary State stores: JSON file (local/test) and GitHub Actions variable (CI persistence)
 *
 * The original JsonStateStore writes to disk, which is ephemeral in CI — the cycle counter
 * and dedup entries reset to zero on every run. GhVariableStateStore persists state across
 * CI runs by reading/writing a single GitHub Actions repository variable (INSPECTOR_STATE).
 */

import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'

import type { StateStore } from './types'

// ============================================================================
// JSON File State Store (local dev / testing)
// ============================================================================

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

  save(): void {
    if (!this.dirty) return

    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const tempPath = `${this.filePath}.tmp`
    const json = JSON.stringify(this.data, null, 2)

    try {
      fs.writeFileSync(tempPath, json, 'utf-8')
      fs.renameSync(tempPath, this.filePath)
      this.dirty = false
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath)
      }
      throw error
    }
  }

  static load(filePath: string): JsonStateStore {
    return new JsonStateStore(filePath)
  }
}

// ============================================================================
// GitHub Actions Variable State Store (CI persistence)
// ============================================================================

const GH_VARIABLE_NAME = 'INSPECTOR_STATE'

/**
 * State store backed by a GitHub Actions repository variable.
 *
 * Reads/writes a single variable `INSPECTOR_STATE` containing the full
 * state as a JSON string. This survives across ephemeral CI runners.
 *
 * Requires:
 * - `gh` CLI available on PATH
 * - `GH_TOKEN` env var with `actions:write` + `variables:write` permissions
 * - `REPO` env var (e.g. "owner/repo")
 */
export class GhVariableStateStore implements StateStore {
  private data: Record<string, unknown> = {}
  private dirty = false
  private repo: string

  constructor(repo: string) {
    this.repo = repo
    this.loadFromGh()
  }

  private loadFromGh(): void {
    try {
      const output = execFileSync(
        'gh',
        ['variable', 'get', GH_VARIABLE_NAME, '--repo', this.repo],
        {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, GH_TOKEN: process.env.GH_PAT || process.env.GH_TOKEN || '' },
        },
      ).trim()

      if (output) {
        const parsed = JSON.parse(output)
        if (parsed && typeof parsed === 'object') {
          this.data = parsed as Record<string, unknown>
          console.log(
            `[GhVariableStateStore] Loaded state with ${Object.keys(this.data).length} keys`,
          )
          return
        }
      }
      console.log('[GhVariableStateStore] Variable empty or invalid — starting fresh')
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      // Check if it's a "not found" error (which is expected for first run)
      if (msg.includes('HTTP 404') || msg.includes('variable not found')) {
        console.log('[GhVariableStateStore] Variable not found — starting fresh (first run)')
      } else {
        console.warn(`[GhVariableStateStore] Failed to load state: ${msg} — starting fresh`)
      }
    }
    this.data = {}
  }

  get<T>(key: string): T | undefined {
    return this.data[key] as T | undefined
  }

  set<T>(key: string, value: T): void {
    this.data[key] = value
    this.dirty = true
  }

  save(): void {
    if (!this.dirty) return

    const json = JSON.stringify(this.data)

    try {
      execFileSync(
        'gh',
        ['variable', 'set', GH_VARIABLE_NAME, '--repo', this.repo, '--body', json],
        {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, GH_TOKEN: process.env.GH_PAT || process.env.GH_TOKEN || '' },
        },
      )
      this.dirty = false
    } catch (error) {
      // Log but don't crash — the inspector should still complete even if state persistence fails
      const msg = error instanceof Error ? error.message : String(error)

      console.error(`[GhVariableStateStore] Failed to save state: ${msg}`)
    }
  }

  /**
   * Create a GH variable-backed store for CI use.
   */
  static load(repo: string): GhVariableStateStore {
    return new GhVariableStateStore(repo)
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create the appropriate state store based on environment.
 *
 * - In GitHub Actions (`GITHUB_ACTIONS=true`): uses GhVariableStateStore
 * - Locally: uses JsonStateStore at the given file path
 */
export function createStateStore(repo: string, localFilePath: string): StateStore {
  if (process.env.GITHUB_ACTIONS === 'true') {
    return GhVariableStateStore.load(repo)
  }
  return JsonStateStore.load(localFilePath)
}

/**
 * Create a fresh empty store (useful for testing).
 */
export function createEmptyStateStore(): JsonStateStore {
  return new JsonStateStore('/dev/null')
}
