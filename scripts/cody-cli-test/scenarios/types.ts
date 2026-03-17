/**
 * @fileType types
 * @domain cody | cody-cli-test
 * @ai-summary Type definitions for Cody CLI system test
 */

export interface CliScenarioContext {
  /** Working directory for the test */
  workingDir: string
  /** GitHub client for assertions */
  gh: {
    createIssue: (title: string, body: string, labels?: string[]) => number | null
    listWorkflowRuns: (
      workflow: string,
      options?: Record<string, unknown>,
    ) => { id: number; conclusion: string }[]
  }
  /** Test run ID */
  runId: string
  /** Logger */
  log: {
    info: (msg: string, ...args: unknown[]) => void
    error: (msg: string, ...args: unknown[]) => void
    debug: (msg: string, ...args: unknown[]) => void
  }
}

export interface CliScenario {
  name: string
  description: string
  /** Timeout in milliseconds */
  timeoutMs: number
  run: (ctx: CliScenarioContext) => Promise<CliScenarioResult>
}

export interface CliAssertion {
  name: string
  passed: boolean
  detail?: string
}

export interface CliScenarioResult {
  name: string
  passed: boolean
  duration: number
  assertions: CliAssertion[]
  error?: string
}
