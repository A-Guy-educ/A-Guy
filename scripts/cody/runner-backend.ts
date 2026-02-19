/**
 * @fileType utility
 * @domain ci | cody | agent-execution
 * @pattern runner-backend
 * @ai-summary Pluggable runner backend for Cody: supports both local (ocode) and CI (opencode github run) modes
 */

import { spawn, type ChildProcess } from 'child_process'

// ============================================================================
// Types
// ============================================================================

export interface RunnerBackend {
  name: string
  spawn(stage: string, prompt: string, env: NodeJS.ProcessEnv, cwd: string): ChildProcess
}

// ============================================================================
// GitHub Runner (CI mode)
// ============================================================================

export class GitHubRunner implements RunnerBackend {
  name = 'opencode-github'

  spawn(stage: string, prompt: string, env: NodeJS.ProcessEnv, cwd: string): ChildProcess {
    // Pass stage as AGENT and prompt as PROMPT env vars
    // The opencode github run command handles OIDC auth internally
    return spawn('opencode', ['github', 'run'], {
      cwd,
      stdio: 'inherit',
      env: {
        ...env,
        AGENT: stage,
        PROMPT: prompt,
      },
    })
  }
}

// ============================================================================
// Local Runner (uses pnpm ocode run)
// ============================================================================

export class LocalRunner implements RunnerBackend {
  name = 'opencode-local'

  spawn(stage: string, prompt: string, env: NodeJS.ProcessEnv, cwd: string): ChildProcess {
    // Local runner uses pnpm ocode run --agent <stage> "<prompt>"
    const fullPrompt = `Execute ${stage} for this task. ${prompt}`
    return spawn('pnpm', ['ocode', 'run', '--agent', stage, fullPrompt], {
      cwd,
      stdio: 'inherit',
      env: {
        ...env,
        // Also set the standard env vars for consistency
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
  const useLocal = local ?? !process.env.GITHUB_ACTIONS

  if (useLocal) {
    return new LocalRunner()
  }
  return new GitHubRunner()
}
