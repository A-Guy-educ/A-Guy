/**
 * @fileType utility
 * @domain cody | cody-cli-test
 */

import { execFileSync } from 'child_process'
import pino from 'pino'

export function runCodyCli(
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> },
): { stdout: string; stderr: string; exitCode: number } {
  const defaultEnv = { ...process.env, ...options?.env }
  try {
    const stdout = execFileSync('pnpm', ['tsx', 'scripts/cody/entry.ts', ...args], {
      cwd: options?.cwd || process.cwd(),
      env: defaultEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 600_000,
    })
    return { stdout: stdout.toString(), stderr: '', exitCode: 0 }
  } catch (error: unknown) {
    const err = error as { stdout?: Buffer; stderr?: Buffer; status?: number; code?: string }
    return {
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || '',
      exitCode: (err.status ?? err.code === 'ENOENT') ? 127 : 1,
    }
  }
}

export function assertCliSuccess(
  result: { stdout: string; stderr: string; exitCode: number },
  context: string,
): void {
  if (result.exitCode !== 0)
    throw new Error(
      `${context}: CLI failed with exit code ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    )
}

export function createTestLogger(name: string) {
  return pino({ name, level: 'info' })
}
