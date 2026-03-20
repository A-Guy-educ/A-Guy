/**
 * @fileType scenario
 * @domain cody | system-test
 * @ai-summary Minimal scenario for testing record/replay flow
 *
 * Steps:
 *   1. Create test version branch with cheap opencode.json
 *   2. Create GitHub issue (trivial task)
 *   3. Dispatch cody workflow (mode=full, complexity=5, version=branch)
 *   4. Poll for workflow completion
 *   5. Assert results (labels, PR, comments)
 *   6. Cleanup test version branch
 */

import { execFileSync } from 'child_process'
import * as fs from 'fs'

import { assertPRCreated, assertCommentExists } from '../lib'
import { CODY_WORKFLOW, SYSTEM_TEST_LABEL, ISSUE_TITLE_PREFIX } from '../lib/config'
import type { ScenarioContext, Scenario } from './types'
import type { ScenarioResult } from '../lib/report'

// Minimal issue - just add a comment to an existing file
const ISSUE_BODY = `Add a descriptive comment to \`src/infra/utils/logger/index.ts\` explaining its purpose.

The comment should say: "// Logger utility for structured JSON logging with Pino"

**This is a SYSTEM TEST. The PR should NOT be merged.**`

// Branch name for test version - use timestamp to ensure uniqueness
const TEST_VERSION_BRANCH = (() => {
  const now = new Date()
  return `cody-test-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
})()

export const scenario00: Scenario = {
  name: '00-minimal-test',
  description: 'Minimal scenario for testing record/replay flow - adds a single comment',
  timeoutMs: 20 * 60 * 1000, // 20 minutes

  async run(ctx: ScenarioContext): Promise<ScenarioResult> {
    const startTime = Date.now()
    const assertions: ScenarioResult['assertions'] = []

    let issueNumber: number | undefined = undefined
    let taskId: string | undefined
    let _workflowDispatchTime: string | undefined

    // Step 0: Create test version branch with opencode config
    const isReplayMode = process.env.MOCK_MODE === 'replay'
    const _isRecordMode = process.env.MOCK_MODE === 'record'
    const configFile = isReplayMode ? 'opencode.mock.json' : 'opencode.test.json'
    const configLabel = isReplayMode ? 'mock' : 'cheap'

    ctx.log.info(`Creating test version branch: ${TEST_VERSION_BRANCH} with ${configLabel} config`)
    try {
      // Clean up any stale remote/local branch from previous runs
      try {
        execFileSync('git', ['push', 'origin', '--delete', TEST_VERSION_BRANCH], { stdio: 'pipe' })
        ctx.log.info(`Deleted stale remote branch: ${TEST_VERSION_BRANCH}`)
      } catch {
        // Branch doesn't exist remotely — that's fine
      }
      try {
        execFileSync('git', ['branch', '-D', TEST_VERSION_BRANCH], { stdio: 'pipe' })
        ctx.log.info(`Deleted stale local branch: ${TEST_VERSION_BRANCH}`)
      } catch {
        // Branch doesn't exist locally — that's fine
      }

      // Backup current opencode.json
      const currentOpencode = fs.readFileSync('./opencode.json', 'utf-8')

      // Replace with test or mock version
      fs.copyFileSync(`./${configFile}`, './opencode.json')

      // Create branch and push
      execFileSync('git', ['checkout', '-b', TEST_VERSION_BRANCH], { stdio: 'pipe' })
      execFileSync('git', ['add', 'opencode.json'], { stdio: 'pipe' })
      execFileSync(
        'git',
        ['commit', `-m`, `test: ${configLabel} models for system test`, '--no-verify'],
        {
          stdio: 'pipe',
        },
      )
      execFileSync('git', ['push', '-u', 'origin', TEST_VERSION_BRANCH], { stdio: 'pipe' })

      // Switch back to original branch
      execFileSync('git', ['checkout', '-'], { stdio: 'pipe' })

      // Restore original opencode.json
      fs.writeFileSync('./opencode.json', currentOpencode)

      ctx.log.info(`Pushed test version branch: ${TEST_VERSION_BRANCH}`)
      assertions.push({
        name: 'Test version branch created',
        passed: true,
        detail: TEST_VERSION_BRANCH,
      })
    } catch (error) {
      ctx.log.error({ error }, 'Failed to create test version branch')
      assertions.push({ name: 'Test version branch created', passed: false, detail: String(error) })
    }

    try {
      // Step 1: Create issue
      ctx.log.info('Creating issue...')
      const title = `${ISSUE_TITLE_PREFIX} Add comment to logger utility`
      issueNumber = ctx.gh.createIssue(title, ISSUE_BODY, [SYSTEM_TEST_LABEL]) ?? undefined

      if (!issueNumber) {
        throw new Error('Failed to create issue')
      }
      assertions.push({ name: 'Issue created', passed: true, detail: `#${issueNumber}` })
      ctx.log.info(`Created issue #${issueNumber}`)

      // Step 2: Dispatch pipeline with minimal complexity
      const now = new Date()
      const yy = String(now.getFullYear()).slice(-2)
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      taskId = `${yy}${mm}${dd}-systest-${ctx.runId}`
      _workflowDispatchTime = now.toISOString()

      ctx.log.info(
        `Dispatching pipeline: task=${taskId}, complexity=5, version=${TEST_VERSION_BRANCH}`,
      )

      execFileSync(
        'gh',
        [
          'workflow',
          'run',
          CODY_WORKFLOW,
          '-f',
          `task_id=${taskId}`,
          '-f',
          'mode=full',
          '-f',
          `issue_number=${issueNumber}`,
          '-f',
          'complexity=5',
          '-f',
          'clarify=false',
          '-f',
          'dry_run=false',
          '-f',
          `version=${TEST_VERSION_BRANCH}`,
          '-f',
          `use_mock=${isReplayMode}`,
          '--repo',
          ctx.repo,
        ],
        { env: { ...process.env }, stdio: 'pipe' },
      )

      assertions.push({ name: 'Pipeline dispatched', passed: true, detail: taskId })
      ctx.log.info(`Dispatched pipeline for task ${taskId}`)

      // Step 3: Poll for pipeline completion via issue labels.
      ctx.log.info('Polling for pipeline completion via issue labels (up to 20 min)...')
      const terminalLabels = ['cody:done', 'cody:failed']
      const pollStart = Date.now()
      const maxWaitMs = 20 * 60 * 1000
      const pollIntervalMs = 30 * 1000
      let finalLabel: string | undefined
      let gateApproved = false

      while (Date.now() - pollStart < maxWaitMs) {
        const labelsOutput = execFileSync(
          'gh',
          [
            'issue',
            'view',
            String(issueNumber),
            '--repo',
            ctx.repo,
            '--json',
            'labels',
            '--jq',
            '[.labels[].name]',
          ],
          { encoding: 'utf-8', stdio: 'pipe' },
        ).trim()
        const labels: string[] = labelsOutput ? JSON.parse(labelsOutput) : []
        const terminal = labels.find((l: string) => terminalLabels.includes(l))
        if (terminal) {
          finalLabel = terminal
          break
        }
        // Auto-approve risk gate when detected
        if (labels.includes('risk-gated') && !gateApproved) {
          ctx.log.info('  Risk gate detected — posting @cody approve...')
          try {
            execFileSync(
              'gh',
              [
                'issue',
                'comment',
                String(issueNumber),
                '--repo',
                ctx.repo,
                '--body',
                '@cody approve',
              ],
              { env: { ...process.env }, stdio: 'pipe' },
            )
            gateApproved = true
            ctx.log.info('  Auto-approved risk gate')
          } catch (error) {
            ctx.log.warn({ error }, 'Failed to auto-approve risk gate')
          }
        }
        ctx.log.info(`  Labels: [${labels.join(', ')}] — waiting...`)
        await new Promise((r) => setTimeout(r, pollIntervalMs))
      }

      if (!finalLabel) {
        throw new Error(`Pipeline did not reach terminal state within ${maxWaitMs}ms`)
      }

      assertions.push({
        name: 'Pipeline completed',
        passed: true,
        detail: `Terminal label: ${finalLabel}`,
      })

      // Step 4: Assert results
      if (finalLabel === 'cody:done') {
        assertions.push({ name: 'Pipeline succeeded (cody:done)', passed: true })
      } else {
        assertions.push({
          name: 'Pipeline succeeded (cody:done)',
          passed: false,
          detail: `Expected cody:done, got: ${finalLabel}`,
        })
      }

      // Check task comment
      try {
        assertCommentExists(ctx.gh, issueNumber, /Task created:/)
        assertions.push({ name: 'Task marker comment', passed: true })
      } catch (error) {
        assertions.push({ name: 'Task marker comment', passed: false, detail: String(error) })
      }

      // Check PR created — match by issue number
      try {
        const pr = assertPRCreated(ctx.repo, new RegExp(String(issueNumber)))
        assertions.push({
          name: 'PR created',
          passed: true,
          detail: `PR #${pr.number}: ${pr.branch}`,
        })
      } catch (error) {
        assertions.push({ name: 'PR created', passed: false, detail: String(error) })
      }

      // Cleanup: delete test version branch
      ctx.log.info(`Cleaning up test version branch: ${TEST_VERSION_BRANCH}`)
      try {
        execFileSync('git', ['push', 'origin', '--delete', TEST_VERSION_BRANCH], { stdio: 'pipe' })
        execFileSync('git', ['branch', '-D', TEST_VERSION_BRANCH], { stdio: 'pipe' })
        assertions.push({ name: 'Test version branch cleanup', passed: true })
      } catch (error) {
        ctx.log.warn({ error }, 'Failed to cleanup test version branch')
        assertions.push({
          name: 'Test version branch cleanup',
          passed: false,
          detail: String(error),
        })
      }

      return {
        name: this.name,
        passed: assertions.every((a) => a.passed),
        duration: Date.now() - startTime,
        assertions,
      }
    } catch (error) {
      // Cleanup: delete test version branch on error too
      ctx.log.info(`Cleaning up test version branch after error: ${TEST_VERSION_BRANCH}`)
      try {
        execFileSync('git', ['push', 'origin', '--delete', TEST_VERSION_BRANCH], { stdio: 'pipe' })
        execFileSync('git', ['branch', '-D', TEST_VERSION_BRANCH], { stdio: 'pipe' })
      } catch {
        // Ignore cleanup errors
      }

      return {
        name: this.name,
        passed: false,
        duration: Date.now() - startTime,
        assertions,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}

export default scenario00
