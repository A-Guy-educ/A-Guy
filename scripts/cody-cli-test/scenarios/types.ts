/**
 * @fileType types
 * @domain cody | cody-cli-test
 */

export interface CliScenarioContext {
  workingDir: string
  gh: {
    createIssue: (title: string, body: string, labels?: string[]) => number | null
    listWorkflowRuns: (
      workflow: string,
      options?: Record<string, unknown>,
    ) => { id: number; conclusion: string }[]
  }
  runId: string
  log: {
    info: (msg: string, ...args: unknown[]) => void
    error: (msg: string, ...args: unknown[]) => void
    debug: (msg: string, ...args: unknown[]) => void
  }
}

export interface CliScenario {
  name: string
  description: string
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
