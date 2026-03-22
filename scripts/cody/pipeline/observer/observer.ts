/**
 * @fileType observer
 * @domain cody | pipeline | observer
 * @pattern observer
 * @ai-summary Pipeline Observer - delegates complex failures to OpenCode agent
 */

import * as fs from 'fs'
import * as path from 'path'

import { logger } from '../../logger'
import { createRunner, type RunnerBackend } from '../../runner-backend'
import type { StageName } from '../../stages/registry'
import {
  type StageFailure,
  type ObserverResult,
  type ObserverDecision,
  type ObserverContext,
} from './types'
import { updateStage, loadState, writeState } from '../../engine/status'
import type { PipelineStateV2 } from '../../engine/types'

// ============================================================================
// Constants
// ============================================================================

const MAX_OBSERVER_ATTEMPTS = 1
const OBSERVER_TIMEOUT_MS = 120_000 // 120 seconds

// ============================================================================
// Observer Class
// ============================================================================

export class PipelineObserver {
  private readonly backend: RunnerBackend

  constructor(
    private readonly taskId: string,
    private readonly taskDir: string,
    private readonly serverUrl: string,
    private readonly sessionId: string,
    private readonly dataDir: string,
  ) {
    this.backend = createRunner()
  }

  /**
   * Handle a stage failure by delegating to the same OpenCode agent.
   * Pipeline is PAUSED while we wait for the agent to decide.
   */
  async handle(failure: StageFailure): Promise<ObserverResult> {
    const observerAttempt = this.getObserverAttempt(failure)

    // Check recursion cap
    if (observerAttempt > MAX_OBSERVER_ATTEMPTS) {
      logger.info(`[Observer] Max attempts (${MAX_OBSERVER_ATTEMPTS}) exceeded, auto-escalating`)
      return this.autoEscalate(failure, 'Max Observer attempts exceeded')
    }

    logger.info(
      `[Observer] Handling failure for stage '${failure.stageName}' (Observer attempt ${observerAttempt}/${MAX_OBSERVER_ATTEMPTS})`,
    )

    // Mark stage as observing
    const state = loadState(this.taskId)
    if (state) {
      const updatedState = updateStage(state, failure.stageName, {
        state: 'observing',
        error: `Observer handling: ${failure.error.message}`,
      })
      writeState(this.taskId, updatedState)
    }

    // Delegate to agent with timeout
    try {
      const result = await this.withTimeout(
        this.delegateToAgent(failure, observerAttempt),
        OBSERVER_TIMEOUT_MS,
      )

      // Log decision
      this.logDecision(failure, result, observerAttempt)

      return { ...result, observerAttempt }
    } catch (error) {
      logger.error({ err: error }, `[Observer] Error during agent delegation`)

      // Timeout or error - auto-escalate
      const reason = error instanceof Error ? error.message : 'Unknown error'
      return this.autoEscalate(failure, reason)
    }
  }

  /**
   * Delegate failure handling to the same OpenCode agent that ran the stage.
   */
  private async delegateToAgent(
    failure: StageFailure,
    observerAttempt: number,
  ): Promise<ObserverResult> {
    // Write context file for the agent to read
    const contextFile = path.join(this.taskDir, '.observer-context.json')
    const context: ObserverContext = {
      stageName: failure.stageName,
      error: {
        message: failure.error.message,
        stack: failure.error.stack,
      },
      attempt: failure.attempt,
      maxAttempts: failure.maxAttempts,
      taskDir: this.taskDir,
      observerAttempt,
    }
    fs.writeFileSync(contextFile, JSON.stringify(context, null, 2))

    // Decision file path
    const decisionFile = path.join(this.taskDir, '.observer-decision.json')

    // Delete any existing decision file
    if (fs.existsSync(decisionFile)) {
      fs.unlinkSync(decisionFile)
    }

    // Build the prompt for the agent
    const prompt = this.buildFailureHandlingPrompt(failure, context)

    // Spawn agent process that attaches to existing session (forks it)
    logger.info(`[Observer] Spawning agent '${failure.stageName}' to handle failure`)

    const agentProcess = this.backend.spawn(failure.stageName, prompt, process.env, this.taskDir, {
      serverUrl: this.serverUrl,
      sessionId: this.sessionId,
      dataDir: this.dataDir,
    })

    // Wait for the agent to complete
    await this.waitForAgent(agentProcess)

    // Read decision file
    if (!fs.existsSync(decisionFile)) {
      throw new Error(`Agent did not write decision file: ${decisionFile}`)
    }

    const decisionContent = fs.readFileSync(decisionFile, 'utf-8')
    const decision: ObserverDecision = JSON.parse(decisionContent)

    // Validate decision
    if (!decision.action || !['retry', 'escalate', 'halt'].includes(decision.action)) {
      throw new Error(`Invalid decision action: ${decision.action}`)
    }

    logger.info(`[Observer] Agent returned: ${decision.action} - ${decision.reason}`)

    return {
      action: decision.action,
      reason: decision.reason,
      fix: decision.fix,
      observerAttempt,
    }
  }

  /**
   * Build the prompt for the agent to handle the failure.
   */
  private buildFailureHandlingPrompt(failure: StageFailure, context: ObserverContext): string {
    return `## Task: Handle Stage Failure

Stage "${failure.stageName}" failed during pipeline execution.

### Error Context
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

### Context File
Full context is available at: ${this.taskDir}/.observer-context.json

### Decision File
Write your decision to: ${this.taskDir}/.observer-decision.json

### Your Task

1. Read .observer-context.json to understand the failure
2. Investigate the error - read relevant files, understand root cause
3. If fixable:
   - Apply the fix to the relevant files
   - Write .observer-decision.json with action: "retry"
4. If not fixable:
   - Write .observer-decision.json with action: "escalate" and reason
5. If fundamentally broken:
   - Write .observer-decision.json with action: "halt" and reason

### Decision File Format
Write to ${this.taskDir}/.observer-decision.json:
\`\`\`json
{
  "action": "retry",
  "reason": "Fixed TypeScript error in src/foo.ts",
  "fix": {
    "description": "Fixed type mismatch in calculateTotal function",
    "filesModified": ["src/foo.ts"]
  }
}
\`\`\`

Or for escalation:
\`\`\`json
{
  "action": "escalate",
  "reason": "Context overflow - needs human to simplify requirements"
}
\`\`\`

Or for halt:
\`\`\`json
{
  "action": "halt",
  "reason": "Invalid task.json - fundamental data quality issue"
}
\`\`\`

### Rules
- Do NOT write partial JSON - write complete valid JSON to the decision file
- If you cannot fix, escalate - don't guess
- You have 120 seconds before timeout
- Write the decision file BEFORE exiting
- The pipeline is PAUSED waiting for your decision
`
  }

  /**
   * Wait for agent process to complete.
   */
  private waitForAgent(agentProcess: {
    on: (event: string, cb: (...args: unknown[]) => void) => void
    kill?: () => void
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        logger.warn(`[Observer] Agent timed out after ${OBSERVER_TIMEOUT_MS}ms`)
        try {
          agentProcess.kill?.()
        } catch {
          // ignore
        }
        reject(new Error('Observer timeout'))
      }, OBSERVER_TIMEOUT_MS)

      // Agent process emits 'exit' when done
      agentProcess.on('exit', (...args: unknown[]) => {
        clearTimeout(timeout)
        const code = args[0] as number | undefined
        logger.info(`[Observer] Agent exited with code: ${code}`)
        resolve()
      })

      // Fallback if no explicit exit event
      setTimeout(() => {
        clearTimeout(timeout)
        resolve()
      }, OBSERVER_TIMEOUT_MS + 1000)
    })
  }

  /**
   * Wrap promise with timeout.
   */
  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Observer timeout')), ms)),
    ])
  }

  /**
   * Auto-escalate when max attempts reached or error occurs.
   */
  private autoEscalate(failure: StageFailure, reason: string): ObserverResult {
    return {
      action: 'escalate',
      reason: `Auto-escalated: ${reason}`,
      observerAttempt: this.getObserverAttempt(failure),
    }
  }

  /**
   * Get current Observer attempt number for this stage.
   */
  private getObserverAttempt(failure: StageFailure): number {
    const state = loadState(this.taskId)
    if (!state) return 1

    const stageState = state.stages[failure.stageName]
    if (!stageState) return 1

    // Count previous observer attempts in history
    const history =
      (state as PipelineStateV2 & { observerHistory?: Array<{ stage: string }> }).observerHistory ||
      []
    const stageHistory = history.filter((e) => e.stage === failure.stageName)
    return stageHistory.length + 1
  }

  /**
   * Log decision to status.json observerHistory.
   */
  private logDecision(
    failure: StageFailure,
    result: {
      action: string
      reason: string
      fix?: { description: string; filesModified: string[] }
    },
    observerAttempt: number,
  ): void {
    const state = loadState(this.taskId)
    if (!state) return

    const historyEntry = {
      stage: failure.stageName,
      observerAttempt,
      error: failure.error.message,
      action: result.action,
      reason: result.reason,
      wasAgent: true,
      agentName: failure.stageName,
      timestamp: new Date().toISOString(),
      fixApplied: result.fix,
    }

    const observerHistory = [
      ...((state as PipelineStateV2 & { observerHistory?: unknown[] }).observerHistory || []),
      historyEntry,
    ]

    const updatedState = {
      ...state,
      observerHistory,
    } as PipelineStateV2

    writeState(this.taskId, updatedState)
  }
}

// ============================================================================
// Factory function
// ============================================================================

export function createPipelineObserver(
  taskId: string,
  taskDir: string,
  serverUrl: string,
  sessionId: string,
  dataDir: string,
): PipelineObserver {
  return new PipelineObserver(taskId, taskDir, serverUrl, sessionId, dataDir)
}
