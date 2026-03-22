/**
 * @fileType utility
 * @domain ci | cody | agent-execution
 * @pattern runner-backend
 * @ai-summary Pluggable runner backend for Cody: supports both local (ocode) and CI (opencode github run) modes
 */

import { spawn, type ChildProcess } from 'child_process'

import { getEnv } from './env'
import { resolveOpenCodeBinary } from './opencode-server'

// ============================================================================
// Types
// ============================================================================

/** Options passed to runner.spawn() for server mode */
export interface RunnerSpawnOptions {
  /** URL of running OpenCode server to attach to */
  serverUrl?: string
  /** Session ID to fork from (requires serverUrl) */
  sessionId?: string
  /** XDG_DATA_HOME directory — must match the server's data dir for instance lookup */
  dataDir?: string
}

export interface RunnerBackend {
  name: string
  spawn(
    stage: string,
    prompt: string,
    env: NodeJS.ProcessEnv,
    cwd: string,
    options?: RunnerSpawnOptions,
  ): ChildProcess
}

// ============================================================================
// GitHub Runner (CI mode)
// ============================================================================

export class GitHubRunner implements RunnerBackend {
  name = 'opencode-github'

  spawn(
    stage: string,
    prompt: string,
    env: NodeJS.ProcessEnv,
    cwd: string,
    options?: RunnerSpawnOptions,
  ): ChildProcess {
    // When attaching to a running server, use the real opencode binary directly.
    // `pnpm exec opencode` resolves to the old opencode-ai npm package which
    // doesn't support --agent + --attach properly. The real binary is installed
    // via `curl -fsSL https://opencode.ai/install | bash` to ~/.opencode/bin/.
    // XDG_DATA_HOME must match the server's data dir for instance lookup.
    if (options?.serverUrl) {
      const args = [
        'run',
        '--agent',
        stage,
        '--format',
        'json',
        '--attach',
        options.serverUrl,
        '--dir',
        cwd,
      ]
      if (options.sessionId) args.push('--session', options.sessionId, '--fork')
      args.push(prompt)
      return spawn(resolveOpenCodeBinary(), args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...env,
          ...(options.dataDir ? { XDG_DATA_HOME: options.dataDir } : {}),
        },
      })
    }

    // Without server: use pnpm exec for backward compatibility
    const args = ['exec', 'opencode', 'run', '--agent', stage, '--format', 'json']
    args.push(prompt)
    return spawn('pnpm', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    })
  }
}

// ============================================================================
// Local Runner (uses pnpm ocode run)
// ============================================================================

export class LocalRunner implements RunnerBackend {
  name = 'opencode-local'

  spawn(
    stage: string,
    prompt: string,
    env: NodeJS.ProcessEnv,
    cwd: string,
    options?: RunnerSpawnOptions,
  ): ChildProcess {
    // When attaching to a running server, use the real opencode binary directly.
    // `pnpm ocode` resolves to `pnpm exec opencode` which uses the old opencode-ai
    // npm package. The real binary supports --agent + --attach properly.
    // XDG_DATA_HOME must match the server's data dir for instance lookup.
    if (options?.serverUrl) {
      const args = [
        'run',
        '--agent',
        stage,
        '--format',
        'json',
        '--attach',
        options.serverUrl,
        '--dir',
        cwd,
      ]
      if (options.sessionId) args.push('--session', options.sessionId, '--fork')
      args.push(prompt)
      return spawn(resolveOpenCodeBinary(), args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...env,
          ...(options.dataDir ? { XDG_DATA_HOME: options.dataDir } : {}),
          AGENT: stage,
          MODEL: env.MODEL,
        },
      })
    }

    // Without server: use pnpm ocode for backward compatibility
    const args = ['ocode', 'run', '--agent', stage, '--format', 'json']
    args.push(prompt)
    return spawn('pnpm', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...env,
        AGENT: stage,
        MODEL: env.MODEL,
      },
    })
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a runner backend based on the environment.
 *
 * @param local - If true, uses local runner. If false, uses GitHub runner.
 *                If undefined, auto-detects: local when GITHUB_ACTIONS is not set.
 */
export function createRunner(local?: boolean): RunnerBackend {
  const env = getEnv()
  const useLocal = local ?? !env.GITHUB_ACTIONS

  if (useLocal) {
    return new LocalRunner()
  }
  return new GitHubRunner()
}
