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
    // Use opencode run --agent instead of opencode github run
    // opencode github run does NOT support --agent flag and ignores AGENT env var
    // opencode run supports --agent which loads correct agent from opencode.json
    // OIDC auth still works in CI (reads ACTIONS_ID_TOKEN_REQUEST_TOKEN from env)
    return spawn('pnpm', ['exec', 'opencode', 'run', '--agent', stage, prompt], {
      cwd,
      stdio: 'inherit',
      env,
    })
  }
}

// ============================================================================
// Local Runner (uses pnpm ocode run)
// ============================================================================

export class LocalRunner implements RunnerBackend {
  name = 'opencode-local'

  spawn(stage: string, prompt: string, env: NodeJS.ProcessEnv, cwd: string): ChildProcess {
    // Local runner uses pnpm ocode run --agent <stage>
    // Prompt is passed via PROMPT env var to avoid ARG_MAX limits on large prompts
    return spawn('pnpm', ['ocode', 'run', '--agent', stage], {
      cwd,
      stdio: 'inherit',
      env: {
        ...env,
        // Pass via env vars to avoid E2BIG on large prompts
        AGENT: stage,
        PROMPT: prompt,
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
