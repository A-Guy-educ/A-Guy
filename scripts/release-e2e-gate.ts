#!/usr/bin/env tsx
/**
 * Self-contained E2E gate for kody release finalize.
 *
 * Owns all infra lifecycle:
 *   - Starts MongoDB (docker run -d --rm -p 27017:27017 mongo:6)
 *   - Installs Chromium (pnpm exec playwright install --with-deps chromium)
 *   - Runs Playwright tests with the gate config
 *   - Tears down MongoDB container on exit (finally + signal handlers)
 *
 * Usage:
 *   npx tsx scripts/release-e2e-gate.ts
 *
 * Exit codes:
 *   0  — all gate tests passed
 *   1  — MongoDB failed to start, Chromium install failed, or Playwright tests failed
 */

import { execFile } from 'child_process'
import type { ExecException } from 'child_process'

// Aligned with src/infra/utils/test/mongodb-container.ts (mongo:6) so the
// image is likely already present in the runner's Docker layer cache after
// other jobs, and so we share the same smaller image across test flows.
const MONGO_IMAGE = 'mongo:6'
const MONGO_PORT = 27017
const MONGO_DB_URL = `mongodb://localhost:${MONGO_PORT}/test?directConnection=true`
const PLAYWRIGHT_CONFIG = 'playwright.e2e-gate.config.ts'

let mongoContainerId: string | null = null

// ─── Docker helpers ────────────────────────────────────────────────────────────

function execFileAsync(
  cmd: string,
  args: string[],
  options?: { env?: NodeJS.ProcessEnv; signal?: AbortSignal },
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    const child = execFile(cmd, args, { env: { ...process.env, ...options?.env } })
    child.stdout?.on('data', (chunk) => {
      process.stdout.write(chunk)
      stdout += chunk
    })
    child.stderr?.on('data', (chunk) => {
      process.stderr.write(chunk)
      stderr += chunk
    })
    child.on('close', (code) => resolve({ stdout, stderr, code }))
    child.on('error', (err: ExecException) => {
      const msg = `[gate] ${cmd} ${args.join(' ')} failed: ${err.message}`
      process.stderr.write(msg + '\n')
      resolve({ stdout, stderr: msg, code: 1 })
    })
  })
}

async function startMongoDB(): Promise<void> {
  console.log('[gate] Starting MongoDB container...')
  const { stdout, code } = await execFileAsync('docker', [
    'run',
    '-d',
    '--rm',
    '-p',
    `${MONGO_PORT}:${MONGO_PORT}`,
    MONGO_IMAGE,
    '--storageEngine=wiredTiger',
  ])
  if (code !== 0) {
    throw new Error(`docker run failed (${code}): ${stdout.trim()}`)
  }
  mongoContainerId = stdout.trim()
  console.log(`[gate] MongoDB container started: ${mongoContainerId}`)
  await waitForMongoReady()
}

async function waitForMongoReady(timeoutMs = 30_000): Promise<void> {
  const { MongoClient } = await import('mongodb')
  const url = `mongodb://localhost:${MONGO_PORT}`
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const client = new MongoClient(url)
      await client.connect()
      await client.close()
      console.log('[gate] MongoDB is ready')
      return
    } catch {
      // Not ready yet — wait 1 s and retry
      await sleep(1000)
    }
  }
  throw new Error(`MongoDB did not become ready within ${timeoutMs}ms`)
}

async function stopMongoDB(): Promise<void> {
  if (!mongoContainerId) return
  console.log(`[gate] Stopping MongoDB container: ${mongoContainerId}`)
  await execFileAsync('docker', ['stop', '-t', '5', mongoContainerId])
  mongoContainerId = null
  console.log('[gate] MongoDB container stopped')
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Chromium installation ────────────────────────────────────────────────────

async function ensureChromium(): Promise<void> {
  console.log('[gate] Ensuring Chromium is installed...')
  const { code, stdout, stderr } = await execFileAsync('pnpm', [
    'exec',
    'playwright',
    'install',
    '--with-deps',
    'chromium',
  ])
  if (code !== 0) {
    throw new Error(`playwright install failed (${code}): ${stdout}${stderr}`)
  }
  console.log('[gate] Chromium ready')
}

// ─── Playwright test runner ───────────────────────────────────────────────────

async function runPlaywrightTests(): Promise<number> {
  console.log('[gate] Running E2E gate tests...')
  const env = {
    ...process.env,
    USE_MONGO_SERVICE: 'true',
    DATABASE_URL: MONGO_DB_URL,
    NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000',
    SKIP_BUILD: 'true',
  }
  return new Promise((resolve) => {
    const child = execFile('pnpm', ['exec', 'playwright', 'test', '--config', PLAYWRIGHT_CONFIG], {
      env,
    })
    let code = 1
    child.stdout?.on('data', (chunk) => process.stdout.write(chunk))
    child.stderr?.on('data', (chunk) => process.stderr.write(chunk))
    child.on('close', (c) => {
      code = c ?? 1
      resolve(code)
    })
    child.on('error', (err: ExecException) => {
      process.stderr.write(`[gate] Playwright spawn error: ${err.message}\n`)
      resolve(1)
    })
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await startMongoDB()
  await ensureChromium()
  const exitCode = await runPlaywrightTests()
  process.exit(exitCode)
}

// ─── Cleanup ───────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  try {
    await stopMongoDB()
  } catch (err) {
    console.error('[gate] Error during cleanup:', err)
  }
}

process.on('SIGINT', async () => {
  console.log('[gate] Received SIGINT — cleaning up...')
  await cleanup()
  process.exit(130)
})
process.on('SIGTERM', async () => {
  console.log('[gate] Received SIGTERM — cleaning up...')
  await cleanup()
  process.exit(143)
})

try {
  await main()
} catch (err) {
  console.error('[gate] Fatal:', err)
  process.exit(1)
} finally {
  // Ensures cleanup runs even if process.exit() is called inside main()
  cleanup().finally(() => process.exit())
}
