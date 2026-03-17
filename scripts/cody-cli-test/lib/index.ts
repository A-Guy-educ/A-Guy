/**
 * @fileType utility
 * @domain cody | cody-cli-test
 * @ai-summary Shared utilities for Cody CLI system test
 */

import { execFileSync } from 'child_process'
import pino from 'pino'

export { createSystemTestClient } from '../../system-test/lib/gh-client'

/**
 * Run the Cody CLI locally with given arguments
 */
export function runCodyCli(
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> },
): {
  stdout: string
  stderr: string
  exitCode: number
} {
  const defaultEnv = {
    ...process.env,
    ...options?.env,
  }

  try {
    const stdout = execFileSync('pnpm', ['tsx', 'scripts/cody/entry.ts', ...args], {
      cwd: options?.cwd || process.cwd(),
      env: defaultEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300_000, // 5 min timeout
    })
    return {
      stdout: stdout.toString(),
      stderr: '',
      exitCode: 0,
    }
  } catch (error: unknown) {
    const err = error as { stdout?: Buffer; stderr?: Buffer; status?: number; code?: string }
    return {
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || '',
      exitCode: (err.status ?? err.code === 'ENOENT') ? 127 : 1,
    }
  }
}

/**
 * Assert that a CLI command succeeds
 */
export function assertCliSuccess(
  result: { stdout: string; stderr: string; exitCode: number },
  context: string,
): void {
  if (result.exitCode !== 0) {
    throw new Error(
      `${context}: CLI failed with exit code ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    )
  }
}

/**
 * Assert that a CLI command fails with expected error
 */
export function assertCliFailure(
  result: { stdout: string; stderr: string; exitCode: number },
  expectedError: string | RegExp,
): void {
  if (result.exitCode === 0) {
    throw new Error(`Expected CLI to fail but it succeeded\nstdout: ${result.stdout}`)
  }

  const output = result.stdout + result.stderr
  if (typeof expectedError === 'string') {
    if (!output.includes(expectedError)) {
      throw new Error(`Expected error "${expectedError}" not found in output: ${output}`)
    }
  } else {
    if (!expectedError.test(output)) {
      throw new Error(`Expected error pattern ${expectedError} not found in output: ${output}`)
    }
  }
}

/**
 * Create a simple logger for CLI tests
 */
export function createTestLogger(name: string) {
  return pino({ name, level: 'info' })
}
