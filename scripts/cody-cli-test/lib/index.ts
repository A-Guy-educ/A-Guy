import { execFileSync } from 'child_process'
import { existsSync, renameSync, copyFileSync, unlinkSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pino from 'pino'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// Use opencode.test.json from project root (same as cody-system-test)
const TEST_OPENCODE_CONFIG = join(__dirname, '..', '..', 'opencode.test.json')

export function runCodyCli(
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> },
): { stdout: string; stderr: string; exitCode: number } {
  const cwd = options?.cwd || process.cwd()
  const opencodePath = join(cwd, 'opencode.json')
  const backupPath = join(cwd, 'opencode.json.backup')

  // Backup existing opencode.json and use opencode.test.json
  if (existsSync(opencodePath)) {
    try {
      renameSync(opencodePath, backupPath)
      copyFileSync(TEST_OPENCODE_CONFIG, opencodePath)
    } catch {
      /* ignore - continue without override */
    }
  }

  const defaultEnv = { ...process.env, ...options?.env }
  let result: { stdout: string; stderr: string; exitCode: number }

  try {
    const stdout = execFileSync('pnpm', ['tsx', 'scripts/cody/entry.ts', ...args], {
      cwd,
      env: defaultEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 600_000,
    })
    result = { stdout: stdout.toString(), stderr: '', exitCode: 0 }
  } catch (error: unknown) {
    const err = error as { stdout?: Buffer; stderr?: Buffer; status?: number; code?: string }
    result = {
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || '',
      exitCode: err.status ?? 1,
    }
  }

  // Restore original opencode.json
  try {
    if (existsSync(backupPath)) {
      unlinkSync(opencodePath)
      renameSync(backupPath, opencodePath)
    }
  } catch {
    /* ignore */
  }

  return result
}

export function assertCliSuccess(
  result: { stdout: string; stderr: string; exitCode: number },
  context: string,
): void {
  if (result.exitCode !== 0) throw new Error(`${context}: failed`)
}

export function createTestLogger(name: string) {
  return pino({ name, level: 'info' })
}
