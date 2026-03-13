/**
 * @fileType utility
 * @domain cody | infrastructure
 * @pattern opencode-server
 * @ai-summary Manages OpenCode server lifecycle for persistent sessions across pipeline stages
 */

import { spawn, execFileSync, type ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { logger } from './logger'

// ============================================================================
// Types
// ============================================================================

export interface OpenCodeServer {
  process: ChildProcess
  url: string
  port: number
  dataDir: string
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PORT = 4097
const HEALTH_CHECK_TIMEOUT_MS = 30_000
const HEALTH_CHECK_INTERVAL_MS = 500
const SHUTDOWN_GRACE_MS = 5_000

// ============================================================================
// Binary Resolution
// ============================================================================

/**
 * Resolve the path to the real opencode binary (v1.2.x installed via curl).
 *
 * When running inside `pnpm tsx`, `node_modules/.bin/opencode` shadows the
 * real binary because pnpm prepends `./node_modules/.bin` to PATH. The npm
 * package (opencode-ai@0.0.0-dev) doesn't support --agent + --attach properly.
 *
 * Resolution order:
 * 1. ~/.opencode/bin/opencode (standard curl install location)
 * 2. 'opencode' (fall back to PATH — works in CI where npm shadow doesn't exist)
 */
export function resolveOpenCodeBinary(): string {
  const installDir = path.join(os.homedir(), '.opencode', 'bin', 'opencode')
  if (fs.existsSync(installDir)) {
    return installDir
  }
  return 'opencode'
}
/**
 * Verify that `opencode run --attach` can find the server instance.
 * Returns true if the client can connect, false otherwise.
 * This catches the "No context found for instance" error early.
 */
export function verifyClientAttach(url: string, dataDir: string): boolean {
  try {
    const binary = resolveOpenCodeBinary()
    // Use a minimal prompt that will immediately error with a model issue
    // (which is fine — we just need to confirm it doesn't fail with
    // "No context found for instance")
    const result = execFileSync(binary, ['run', '--attach', url, '--format', 'json', 'ping'], {
      env: { ...process.env, XDG_DATA_HOME: dataDir },
      timeout: 15_000,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
    })
    // If we get here, the command ran (it will likely error with model config issues, but that's fine)
    const output = result.toString()
    return !output.includes('No context found for instance')
  } catch (err: unknown) {
    // The command will exit non-zero (model errors etc), check stderr for the specific instance error
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString() || ''
    const stdout = (err as { stdout?: Buffer })?.stdout?.toString() || ''
    const combined = stderr + stdout

    // Fail on known indicators that the server instance is not accessible
    if (
      combined.includes('No context found for instance') ||
      combined.includes('Unexpected error, check log file')
    ) {
      return false
    }

    // Also fail if the command timed out (15s) — the attach should respond quickly
    const errObj = err as { killed?: boolean; signal?: string; code?: string }
    if (errObj.killed || errObj.signal === 'SIGTERM' || errObj.code === 'ETIMEDOUT') {
      return false
    }

    // Any other error means the attach itself worked (model/agent errors are expected)
    return true
  }
}

// ============================================================================
// Server Lifecycle
// ============================================================================

/**
 * Start an OpenCode server with an isolated data directory for this task.
 * The data dir is set via XDG_DATA_HOME so the SQLite DB and snapshots
 * are scoped per-task and don't interfere with other runs.
 *
 * @param taskDir - The .tasks/<taskId> directory
 * @param port - Port to listen on (default: 4097)
 * @returns The running server, or null if startup failed
 */
export async function startServer(
  taskDir: string,
  port: number = DEFAULT_PORT,
): Promise<OpenCodeServer | null> {
  const dataDir = path.join(taskDir, 'opencode-data')
  const opencodeSub = path.join(dataDir, 'opencode')

  // Ensure the data directory structure exists
  fs.mkdirSync(opencodeSub, { recursive: true })

  // Copy auth.json from the global data dir if it exists and we don't have one
  // (needed for provider authentication in isolated data dirs)
  const localAuth = path.join(opencodeSub, 'auth.json')
  if (!fs.existsSync(localAuth)) {
    const globalDataDir = process.env.XDG_DATA_HOME
      ? path.join(process.env.XDG_DATA_HOME, 'opencode')
      : path.join(os.homedir(), '.local', 'share', 'opencode')
    const globalAuth = path.join(globalDataDir, 'auth.json')
    if (fs.existsSync(globalAuth)) {
      try {
        fs.copyFileSync(globalAuth, localAuth)
        // Restrict permissions: auth.json contains API credentials
        fs.chmodSync(localAuth, 0o600)
        logger.info('  Copied auth.json to task data dir')
      } catch {
        // Non-fatal: CI uses env vars for auth
      }
    }
  }

  const url = `http://127.0.0.1:${port}`
  logger.info(`  🚀 Starting OpenCode server on port ${port}...`)

  try {
    const binary = resolveOpenCodeBinary()

    // Log version for diagnostics (helps debug CI issues)
    try {
      const ver = execFileSync(binary, ['--version'], { encoding: 'utf-8', timeout: 5000 }).trim()
      logger.info(`  OpenCode binary: ${binary} (v${ver})`)
    } catch {
      logger.info(`  OpenCode binary: ${binary} (version unknown)`)
    }
    const child = spawn(
      binary,
      ['serve', '--port', String(port), '--print-logs', '--log-level', 'WARN'],
      {
        env: {
          ...process.env,
          XDG_DATA_HOME: dataDir,
        },
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      },
    )

    // Drain stdout/stderr to prevent buffer overflow
    child.stdout?.resume()
    child.stderr?.resume()

    // Race the health check against a spawn-error rejection so we fail fast
    // if the binary is not found or the process exits immediately (e.g. port in use).
    const spawnErrorPromise = new Promise<never>((_, reject) => {
      child.on('error', (err) => reject(err))
      child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`opencode serve exited with code ${code}`))
        }
      })
    })

    const healthy = await Promise.race([
      waitForHealthy(url, HEALTH_CHECK_TIMEOUT_MS),
      spawnErrorPromise.then(
        () => false as boolean,
        () => false as boolean,
      ),
    ])

    if (!healthy) {
      logger.warn('OpenCode server failed to start (health check failed or process exited)')
      if (!child.killed) child.kill('SIGTERM')
      return null
    }

    logger.info(`  ✅ OpenCode server ready at ${url}`)

    // Smoke-test the client attach to ensure the instance record is accessible.
    // Some environments (CI with older opencode versions) may have the server healthy
    // but the client can't find the instance context via XDG_DATA_HOME.
    const attachOk = verifyClientAttach(url, dataDir)
    if (!attachOk) {
      logger.warn('  ⚠️ Client --attach smoke test failed, falling back to non-server mode')
      await stopServer({ process: child, url, port, dataDir })
      return null
    }

    return { process: child, url, port, dataDir }
  } catch (err) {
    logger.warn({ err }, 'Failed to start OpenCode server')
    return null
  }
}

/**
 * Poll the health endpoint until the server reports healthy.
 */
export async function waitForHealthy(
  url: string,
  timeoutMs: number = HEALTH_CHECK_TIMEOUT_MS,
): Promise<boolean> {
  const start = Date.now()
  const healthUrl = `${url}/global/health`

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) })
      if (response.ok) {
        const body = (await response.json()) as { healthy?: boolean }
        if (body.healthy) return true
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, HEALTH_CHECK_INTERVAL_MS))
  }
  return false
}

/**
 * Stop the OpenCode server gracefully.
 */
export async function stopServer(server: OpenCodeServer): Promise<void> {
  if (!server.process || server.process.killed) return

  logger.info('  🛑 Stopping OpenCode server...')

  return new Promise<void>((resolve) => {
    const forceKillTimer = setTimeout(() => {
      if (!server.process.killed) {
        server.process.kill('SIGKILL')
      }
      resolve()
    }, SHUTDOWN_GRACE_MS)

    server.process.on('exit', () => {
      clearTimeout(forceKillTimer)
      resolve()
    })

    server.process.kill('SIGTERM')
  })
}

/**
 * Checkpoint the SQLite WAL into the main DB file.
 * This ensures the .db file is self-contained for git commits.
 * Must be called AFTER stopping the server.
 */
export function checkpointDb(taskDir: string): void {
  const dbPath = path.join(taskDir, 'opencode-data', 'opencode', 'opencode.db')
  if (!fs.existsSync(dbPath)) {
    logger.debug('No OpenCode DB to checkpoint')
    return
  }

  try {
    execFileSync('sqlite3', [dbPath, 'PRAGMA wal_checkpoint(TRUNCATE);'], {
      stdio: 'pipe',
      timeout: 10_000,
    })
    logger.info('  ✅ OpenCode DB checkpoint complete')
  } catch (err) {
    // Non-fatal: WAL files will just be larger but DB still works
    logger.warn({ err }, 'Failed to checkpoint OpenCode DB (non-fatal)')
  }
}

/**
 * Find the sessionId of the last completed agent stage.
 * Used on rerun to resume from the last known session.
 */
export function findLastSessionId(
  stages: Record<string, { state: string; sessionId?: string }>,
  pipelineOrder: string[],
): string | undefined {
  // Walk pipeline order in reverse to find the last completed stage with a sessionId
  for (let i = pipelineOrder.length - 1; i >= 0; i--) {
    const stageName = pipelineOrder[i]
    const stage = stages[stageName]
    if (
      stage?.sessionId &&
      (stage.state === 'completed' || stage.state === 'failed' || stage.state === 'timeout')
    ) {
      return stage.sessionId
    }
  }
  return undefined
}
