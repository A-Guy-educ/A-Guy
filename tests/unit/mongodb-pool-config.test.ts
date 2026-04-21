import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

/**
 * Guardrail test for MongoDB connection pool configuration.
 *
 * WHY THIS EXISTS:
 * Atlas Flex tier has a 500-connection limit. Each serverless instance opens
 * up to maxPoolSize connections. If maxPoolSize is too high, fewer concurrent
 * instances can run before exhausting Atlas.
 *
 * HISTORY OF INCIDENTS:
 * - maxPoolSize=100: Only 5 instances fit → outage
 * - maxPoolSize=10:  Only 50 instances fit → Atlas alert at 100%
 * - maxPoolSize=3:   166 instances fit → safe headroom
 *
 * This test WILL FAIL if someone increases the default above 5
 * or adds parallel DB operations that exceed the pool size.
 * That is intentional. Read the history above before changing it.
 */

const ATLAS_CONNECTION_LIMIT = 500
const SAFE_MAX_POOL_SIZE = 5
const RECOMMENDED_DEFAULT = 3
const MIN_SAFE_INSTANCES = 100

describe('MongoDB Connection Pool Guardrail', () => {
  describe('source code guardrail', () => {
    it('production default in payload.config.ts must not exceed safe limit', () => {
      const configPath = resolve(__dirname, '../../src/payload.config.ts')
      const configSource = readFileSync(configPath, 'utf-8')

      // Match the fallback pattern: process.env.VITEST ? '5' : '<NUMBER>'
      const match = configSource.match(/VITEST\s*\?\s*'5'\s*:\s*'(\d+)'/)
      expect(match, 'Could not find maxPoolSize pattern in payload.config.ts').not.toBeNull()

      const productionDefault = parseInt(match![1], 10)
      expect(
        productionDefault,
        `Production maxPoolSize is ${productionDefault}, must be <= ${SAFE_MAX_POOL_SIZE}. ` +
          `At ${productionDefault}, only ${Math.floor(ATLAS_CONNECTION_LIMIT / productionDefault)} ` +
          `concurrent instances can run before exhausting Atlas (limit: ${ATLAS_CONNECTION_LIMIT}).`,
      ).toBeLessThanOrEqual(SAFE_MAX_POOL_SIZE)
    })

    it('production default matches recommended value', () => {
      const configPath = resolve(__dirname, '../../src/payload.config.ts')
      const configSource = readFileSync(configPath, 'utf-8')
      const match = configSource.match(/VITEST\s*\?\s*'5'\s*:\s*'(\d+)'/)
      expect(match).not.toBeNull()
      expect(parseInt(match![1], 10)).toBe(RECOMMENDED_DEFAULT)
    })
  })

  describe('capacity calculations', () => {
    it('default pool size must support at least 100 concurrent instances', () => {
      const maxInstances = Math.floor(ATLAS_CONNECTION_LIMIT / RECOMMENDED_DEFAULT)
      expect(maxInstances).toBeGreaterThanOrEqual(MIN_SAFE_INSTANCES)
    })

    it('100 instances at default pool size stays under 80% of Atlas limit', () => {
      const totalConnections = MIN_SAFE_INSTANCES * RECOMMENDED_DEFAULT
      const threshold = ATLAS_CONNECTION_LIMIT * 0.8
      expect(totalConnections).toBeLessThanOrEqual(threshold)
    })

    it('pool size of 10 is unsafe (only 50 instances)', () => {
      const maxInstances = Math.floor(ATLAS_CONNECTION_LIMIT / 10)
      expect(maxInstances).toBe(50)
      expect(maxInstances).toBeLessThan(MIN_SAFE_INSTANCES)
    })

    it('pool size of 100 is catastrophic (only 5 instances)', () => {
      const maxInstances = Math.floor(ATLAS_CONNECTION_LIMIT / 100)
      expect(maxInstances).toBe(5)
    })
  })

  describe('pool size resolution logic', () => {
    let originalEnv: NodeJS.ProcessEnv

    beforeEach(() => {
      originalEnv = { ...process.env }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    /** Mirrors the exact expression in payload.config.ts */
    function resolvePoolSize(): number {
      return parseInt(process.env.MONGODB_MAX_POOL_SIZE ?? (process.env.VITEST ? '5' : '3'), 10)
    }

    it('uses 3 for production default', () => {
      delete process.env.VITEST
      delete process.env.MONGODB_MAX_POOL_SIZE
      expect(resolvePoolSize()).toBe(3)
    })

    it('uses 5 for test environment', () => {
      process.env.VITEST = 'true'
      delete process.env.MONGODB_MAX_POOL_SIZE
      expect(resolvePoolSize()).toBe(5)
    })

    it('MONGODB_MAX_POOL_SIZE overrides all defaults', () => {
      delete process.env.VITEST
      process.env.MONGODB_MAX_POOL_SIZE = '4'
      expect(resolvePoolSize()).toBe(4)
    })

    it('MONGODB_MAX_POOL_SIZE takes precedence over VITEST', () => {
      process.env.VITEST = 'true'
      process.env.MONGODB_MAX_POOL_SIZE = '7'
      expect(resolvePoolSize()).toBe(7)
    })
  })

  describe('concurrency limits must not exceed pool size', () => {
    /**
     * WHY THIS EXISTS:
     * Even with maxPoolSize=3, code that runs more parallel DB operations
     * than the pool can handle will saturate connections. This happened with
     * CONCURRENCY_LIMIT=5 in memory-extraction.ts and 3 parallel vector
     * search queries — each chat message could consume 8+ connections from
     * a pool of 3, causing cascading exhaustion across instances.
     *
     * This test scans source files for known concurrency patterns and
     * ensures none exceed the pool size.
     */

    function findConcurrencyLimits(dir: string): Array<{ file: string; value: number }> {
      const results: Array<{ file: string; value: number }> = []
      const pattern = /CONCURRENCY_LIMIT\s*=\s*(\d+)/g

      function walk(dirPath: string) {
        for (const entry of readdirSync(dirPath)) {
          const full = join(dirPath, entry)
          if (entry === 'node_modules' || entry === '.next') continue
          const stat = statSync(full)
          if (stat.isDirectory()) {
            walk(full)
          } else if (
            full.endsWith('.ts') &&
            !full.endsWith('.test.ts') &&
            !full.endsWith('.spec.ts')
          ) {
            const content = readFileSync(full, 'utf-8')
            let match
            while ((match = pattern.exec(content)) !== null) {
              results.push({ file: full, value: parseInt(match[1], 10) })
            }
            pattern.lastIndex = 0
          }
        }
      }

      walk(dir)
      return results
    }

    it('no CONCURRENCY_LIMIT in source exceeds maxPoolSize', () => {
      const srcDir = resolve(__dirname, '../../src')
      const limits = findConcurrencyLimits(srcDir)

      for (const { file, value } of limits) {
        const relPath = file.replace(resolve(__dirname, '../..') + '/', '')
        expect(
          value,
          `${relPath} has CONCURRENCY_LIMIT=${value}, which exceeds maxPoolSize=${RECOMMENDED_DEFAULT}. ` +
            `Parallel DB operations beyond pool size cause connection exhaustion. ` +
            `Reduce to ${RECOMMENDED_DEFAULT} or lower.`,
        ).toBeLessThanOrEqual(RECOMMENDED_DEFAULT)
      }
    })

    it('connection timeout settings are configured for serverless', () => {
      const configPath = resolve(__dirname, '../../src/payload.config.ts')
      const configSource = readFileSync(configPath, 'utf-8')

      expect(configSource, 'serverSelectionTimeoutMS must be set to fail fast').toContain(
        'serverSelectionTimeoutMS',
      )
      expect(configSource, 'waitQueueTimeoutMS must be set to prevent pile-up').toContain(
        'waitQueueTimeoutMS',
      )
    })
  })
})
