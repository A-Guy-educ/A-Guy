#!/usr/bin/env tsx
/**
 * OpenCode Pipeline State Detector & Orchestrator
 * Detects artifacts, resolves pipeline state, and optionally invokes agents.
 * Phases: 1=Read-only detection, 2=Git state, 3=Agent invocation with BUILD-VERIFY loop
 */

import { readFileSync, existsSync, readdirSync, lstatSync, writeFileSync } from 'fs'
import { join } from 'path'
import { execSync, spawn } from 'child_process'

type PipelineState =
  | 'NO_TASK'
  | 'TASK_ONLY'
  | 'SPEC_READY'
  | 'BUILD'
  | 'VERIFY'
  | 'DONE'
  | 'BLOCKED'

interface ArtifactSnapshot {
  taskId: string
  taskDirExists: boolean
  taskFileExists: boolean
  specFileExists: boolean
  planFileExists: boolean
  latestVerify: VerifyReportSummary | null
  gitState: GitStateSummary | null
}

interface VerifyReportSummary {
  filePath: string
  timestamp: string
  hardGate: 'PASS' | 'FAIL' | 'BLOCKED'
  finalResult: 'PASS' | 'FAIL' | 'COMPLIANT'
}

interface GitStateSummary {
  currentBranch: string
  hasUncommittedChanges: boolean
  lastCommitHash: string
  lastCommitMessage: string
  commitsSinceVerify: number
  verifyCommitHash: string | null
}

interface DriverOutput {
  currentState: PipelineState
  blockingCondition: string | null
  nextAgent: string | null
  instruction: string | null
  artifacts: ArtifactSnapshot
}

interface PipelineConfig {
  maxBuildVerifyIterations: number
  agentsDir: string
  opencodeBinary: string
}

const TASK_FILE_NAMES = ['task.md', 'prd.md', 'hls.md', 'llp.md', 'gap.md']
const DEFAULT_CONFIG: PipelineConfig = {
  maxBuildVerifyIterations: 5,
  agentsDir: '.opencode/agents',
  opencodeBinary: 'opencode',
}

function buildPaths(projectRoot: string, taskId: string): Record<string, string> {
  const taskDir = join(projectRoot, '.tasks', taskId)
  return {
    taskDir,
    specFile: join(taskDir, 'spec.md'),
    planFile: join(taskDir, 'plan.md'),
    taskFile:
      TASK_FILE_NAMES.map((name) => join(taskDir, name)).find((p) => existsSync(p)) ||
      join(taskDir, 'task.md'),
    verifyDir: taskDir,
    agentsDir: join(projectRoot, '.opencode/agents'),
  }
}

function runGitCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return ''
  }
}

function getGitState(paths: Record<string, string>): GitStateSummary | null {
  const cwd = paths.taskDir
  if (!existsSync(cwd)) return null

  const currentBranch = runGitCommand('git rev-parse --abbrev-ref HEAD')
  const hasUncommittedChanges = runGitCommand('git status --porcelain') !== ''
  const lastCommitHash = runGitCommand('git rev-parse HEAD')
  const lastCommitMessage = runGitCommand('git log -1 --pretty=%s')

  let commitsSinceVerify = 0
  const latestVerify = getLatestVerify(paths.verifyDir)
  if (latestVerify) {
    try {
      const afterDate = new Date(
        latestVerify.timestamp.slice(0, 4) +
          '-' +
          latestVerify.timestamp.slice(4, 6) +
          '-' +
          latestVerify.timestamp.slice(6, 8),
      )
      commitsSinceVerify =
        parseInt(
          runGitCommand(
            `git log --oneline --since="${afterDate.toISOString()}" 2>/dev/null | wc -l`,
          ),
        ) || 0
    } catch {
      commitsSinceVerify = 0
    }
  }

  return {
    currentBranch,
    hasUncommittedChanges,
    lastCommitHash,
    lastCommitMessage,
    commitsSinceVerify,
    verifyCommitHash: null,
  }
}

function parseVerifyReport(filePath: string): VerifyReportSummary | null {
  if (!existsSync(filePath)) return null

  try {
    const content = readFileSync(filePath, 'utf-8')
    const timestampMatch = filePath.match(/verify-(\d{8}-\d{6})\.md/)
    const timestamp = timestampMatch ? timestampMatch[1] : ''

    const hardGateMatch = content.match(/\*\*Status:\*\*\s*([✅❌])/)
    const hardGateEmoji = hardGateMatch ? hardGateMatch[1] : null
    let hardGate: 'PASS' | 'FAIL' | 'BLOCKED' = 'FAIL'
    if (hardGateEmoji === '✅') hardGate = 'PASS'
    else if (hardGateEmoji === '❌') {
      hardGate = content.includes('BLOCKED') ? 'BLOCKED' : 'FAIL'
    }

    const finalResultMatch = content.match(
      /Hard Gate.*?\|\s*([✅❌🛑])\s*(PASS|FAIL|BLOCKED|COMPLIANT)/i,
    )
    let finalResult: 'PASS' | 'FAIL' | 'COMPLIANT' = 'FAIL'
    if (finalResultMatch) {
      const status = finalResultMatch[2]?.toUpperCase()
      if (status === 'PASS' || status === 'COMPLIANT') finalResult = status as 'PASS' | 'COMPLIANT'
    }

    return { filePath, timestamp, hardGate, finalResult }
  } catch {
    return null
  }
}

function getLatestVerify(verifyDir: string): VerifyReportSummary | null {
  if (!existsSync(verifyDir)) return null

  try {
    const files = readdirSync(verifyDir)
      .filter((f) => f.startsWith('verify-') && f.endsWith('.md'))
      .sort()
      .reverse()

    for (const file of files) {
      const report = parseVerifyReport(join(verifyDir, file))
      if (report) return report
    }
    return null
  } catch {
    return null
  }
}

function detectArtifacts(paths: Record<string, string>): ArtifactSnapshot {
  const taskDirExists = existsSync(paths.taskDir) && lstatSync(paths.taskDir).isDirectory()
  const latestVerify = getLatestVerify(paths.verifyDir)
  const gitState = getGitState(paths)

  return {
    taskId: paths.taskDir.split('/').pop() || '',
    taskDirExists,
    taskFileExists:
      taskDirExists && TASK_FILE_NAMES.some((n) => existsSync(join(paths.taskDir, n))),
    specFileExists: existsSync(paths.specFile),
    planFileExists: existsSync(paths.planFile),
    latestVerify,
    gitState,
  }
}

function resolveState(artifacts: ArtifactSnapshot, _config: PipelineConfig): PipelineState {
  if (
    !artifacts.taskDirExists ||
    (!artifacts.taskFileExists && !artifacts.specFileExists && !artifacts.planFileExists)
  ) {
    return 'NO_TASK'
  }
  if (!artifacts.specFileExists) return 'TASK_ONLY'
  if (!artifacts.planFileExists) return 'SPEC_READY'

  const verify = artifacts.latestVerify

  if (!verify) return 'BUILD'

  if (verify.finalResult === 'PASS' || verify.finalResult === 'COMPLIANT') return 'DONE'

  const git = artifacts.gitState
  if (git && git.commitsSinceVerify > 0) return 'VERIFY'

  return 'BUILD'
}

function buildOutput(state: PipelineState, artifacts: ArtifactSnapshot): DriverOutput {
  const stateConfig: Record<
    PipelineState,
    { agent: string | null; instruction: string | null; blocking: string | null }
  > = {
    NO_TASK: { agent: null, instruction: null, blocking: 'No task artifacts found' },
    TASK_ONLY: {
      agent: 'spec',
      instruction: 'Create spec.md defining requirements and acceptance criteria',
      blocking: 'Missing spec.md',
    },
    SPEC_READY: {
      agent: 'plan',
      instruction: 'Create plan.md with implementation steps',
      blocking: 'Missing plan.md',
    },
    BUILD: { agent: 'build', instruction: 'Implement changes according to plan', blocking: null },
    VERIFY: {
      agent: 'verify',
      instruction: 'Run verify agent to validate implementation',
      blocking: null,
    },
    DONE: { agent: null, instruction: null, blocking: null },
    BLOCKED: { agent: null, instruction: null, blocking: 'Clarification required' },
  }

  const config = stateConfig[state]
  return {
    currentState: state,
    blockingCondition: config.blocking,
    nextAgent: config.agent,
    instruction: config.instruction,
    artifacts,
  }
}

function getAgentPath(agentsDir: string, agentName: string): string | null {
  const agentFile = join(agentsDir, `${agentName}.md`)
  if (existsSync(agentFile)) return agentFile
  return null
}

function getTaskContext(paths: Record<string, string>, taskId: string): string {
  const contextParts: string[] = [`Task ID: ${taskId}`]

  const taskDir = paths.taskDir
  for (const fileName of TASK_FILE_NAMES) {
    const taskFile = join(taskDir, fileName)
    if (existsSync(taskFile)) {
      try {
        contextParts.push(`\n## TASK FILE (${fileName})\n${readFileSync(taskFile, 'utf-8')}`)
        break
      } catch {
        // Continue
      }
    }
  }

  if (existsSync(paths.specFile)) {
    try {
      contextParts.push(`\n## SPEC FILE (spec.md)\n${readFileSync(paths.specFile, 'utf-8')}`)
    } catch {
      // Continue
    }
  }

  if (existsSync(paths.planFile)) {
    try {
      contextParts.push(`\n## PLAN FILE (plan.md)\n${readFileSync(paths.planFile, 'utf-8')}`)
    } catch {
      // Continue
    }
  }

  return contextParts.join('\n')
}

function invokeAgentViaOpencode(
  agentPath: string,
  taskId: string,
  projectRoot: string,
): Promise<number> {
  return new Promise((resolve) => {
    console.log(
      `\n🚀 Invoking agent via OpenCode: ${agentPath.split('/').pop()} for task: ${taskId}`,
    )

    const contextFile = join(projectRoot, '.tasks', taskId, '.agent-context.md')
    const taskContext = getTaskContext(buildPaths(projectRoot, taskId), taskId)
    writeFileSync(contextFile, taskContext)

    const opencodeInfo = checkOpencodeAvailable()
    const opencodeBin = opencodeInfo.path

    const proc = spawn(opencodeBin, ['--agent', agentPath, '--project', projectRoot], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        OPENCODE_AGENT_CONTEXT: contextFile,
      },
    })

    proc.on('close', (code) => {
      try {
        if (existsSync(contextFile)) {
          // Keep context for debugging
        }
      } catch {
        // Ignore
      }
      resolve(code || 0)
    })

    proc.on('error', (err) => {
      console.error('Failed to invoke OpenCode agent:', err)
      resolve(1)
    })
  })
}

function checkOpencodeAvailable(): { available: boolean; path: string } {
  const localPath = `${process.env.HOME || '/root'}/.opencode/bin/opencode`
  if (existsSync(localPath)) {
    return { available: true, path: localPath }
  }
  try {
    execSync('which opencode || npx opencode --version', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return { available: true, path: 'opencode' }
  } catch {
    return { available: false, path: '' }
  }
}

async function runBuildVerifyLoop(
  paths: Record<string, string>,
  config: PipelineConfig,
): Promise<{ success: boolean; iterations: number }> {
  const opencodeAvailable = checkOpencodeAvailable()

  if (!opencodeAvailable.available) {
    console.log('\n⚠️  OpenCode CLI not found. Install with:')
    console.log('   curl -fsSL https://opencode.ai/install | bash')
    console.log('   Falling back to read-only mode.\n')
  }

  let iterations = 0
  const maxIterations = config.maxBuildVerifyIterations

  while (iterations < maxIterations) {
    iterations++
    const artifacts = detectArtifacts(paths)
    const state = resolveState(artifacts, config)
    const output = buildOutput(state, artifacts)

    console.log(`\n📍 Iteration ${iterations}/${maxIterations}: ${state}`)

    if (state === 'DONE') {
      return { success: true, iterations }
    }

    if (
      state === 'NO_TASK' ||
      state === 'TASK_ONLY' ||
      state === 'SPEC_READY' ||
      state === 'BLOCKED'
    ) {
      if (!opencodeAvailable) {
        console.log(`📋 Agent '${output.nextAgent}' needed but OpenCode not available.`)
        console.log('   Run with OpenCode installed to enable agent invocation.')
        return { success: false, iterations }
      }

      const agentPath = output.nextAgent ? getAgentPath(paths.agentsDir, output.nextAgent) : null
      if (agentPath) {
        const code = await invokeAgentViaOpencode(
          agentPath,
          artifacts.taskId,
          paths.taskDir.replace('/.tasks/' + artifacts.taskId, ''),
        )
        if (code !== 0) {
          console.error('Agent execution failed with code:', code)
          return { success: false, iterations }
        }
      } else {
        console.log('No agent available for current state')
        return { success: false, iterations }
      }
    } else if (state === 'BUILD' || state === 'VERIFY') {
      if (!opencodeAvailable) {
        console.log(`📋 Agent '${state}' needed but OpenCode not available.`)
        console.log('   Run with OpenCode installed to enable agent invocation.')
        return { success: false, iterations }
      }

      const agentName = state === 'BUILD' ? 'build' : 'verify'
      const agentPath = getAgentPath(paths.agentsDir, agentName)
      if (agentPath) {
        const code = await invokeAgentViaOpencode(
          agentPath,
          artifacts.taskId,
          paths.taskDir.replace('/.tasks/' + artifacts.taskId, ''),
        )
        if (code !== 0) {
          console.error('Agent execution failed with code:', code)
          return { success: false, iterations }
        }
      } else {
        console.log(`Agent '${agentName}' not found at ${paths.agentsDir}`)
        return { success: false, iterations }
      }
    }
  }

  console.error(`\n⚠️  Max iterations (${maxIterations}) reached`)
  return { success: false, iterations }
}

function formatMarkdown(output: DriverOutput): string {
  const { currentState, blockingCondition, nextAgent, instruction, artifacts } = output

  const stateEmoji: Record<PipelineState, string> = {
    NO_TASK: '❓',
    TASK_ONLY: '📋',
    SPEC_READY: '✍️',
    BUILD: '🔨',
    VERIFY: '🧪',
    DONE: '✅',
    BLOCKED: '🚫',
  }

  const lines = [
    `# Pipeline State Report`,
    ``,
    `## Overview`,
    ``,
    `| Property | Value |`,
    `|----------|-------|`,
    `| **Task ID** | \`${artifacts.taskId}\` |`,
    `| **Current State** | \`${stateEmoji[currentState]} ${currentState}\` |`,
    `| **Next Agent** | \`${nextAgent || 'none'}\` |`,
    `| **Instruction** | ${instruction || '—'} |`,
    ``,
    `## Artifacts`,
    ``,
    `| Artifact | Status |`,
    `|----------|--------|`,
    `| Task Directory | ${artifacts.taskDirExists ? '✅' : '❌'} |`,
    `| Task File | ${artifacts.taskFileExists ? '✅' : '❌'} |`,
    `| spec.md | ${artifacts.specFileExists ? '✅' : '❌'} |`,
    `| plan.md | ${artifacts.planFileExists ? '✅' : '❌'} |`,
    `| Latest Verify | ${artifacts.latestVerify ? `✅ ${artifacts.latestVerify.timestamp}` : '❌ None'} |`,
  ]

  if (artifacts.gitState) {
    lines.push(
      ``,
      `## Git State`,
      ``,
      `| Property | Value |`,
      `|----------|-------|`,
      `| **Branch** | \`${artifacts.gitState.currentBranch}\` |`,
      `| **Last Commit** | \`${artifacts.gitState.lastCommitHash.slice(0, 7)}\` - ${artifacts.gitState.lastCommitMessage} |`,
      `| **Uncommitted Changes** | ${artifacts.gitState.hasUncommittedChanges ? '⚠️ Yes' : '✅ No'} |`,
      `| **Commits Since Verify** | ${artifacts.gitState.commitsSinceVerify} |`,
    )
  }

  if (artifacts.latestVerify) {
    lines.push(
      ``,
      `### Latest Verify Report`,
      ``,
      `| Metric | Value |`,
      `|-------|-------|`,
      `| Hard Gate | ${artifacts.latestVerify.hardGate} |`,
      `| Final Result | ${artifacts.latestVerify.finalResult} |`,
      ``,
      `**File:** \`${artifacts.latestVerify.filePath.split('/').pop()}\``,
    )
  }

  if (blockingCondition) {
    lines.push(``, `## Blocking Condition`, ``, `> ${blockingCondition}`)
  }

  return lines.join('\n')
}

function formatJson(output: DriverOutput): string {
  return JSON.stringify(
    {
      currentState: output.currentState,
      blockingCondition: output.blockingCondition,
      nextAgent: output.nextAgent,
      instruction: output.instruction,
      artifacts: {
        taskId: output.artifacts.taskId,
        taskDirExists: output.artifacts.taskDirExists,
        taskFileExists: output.artifacts.taskFileExists,
        specFileExists: output.artifacts.specFileExists,
        planFileExists: output.artifacts.planFileExists,
        latestVerify: output.artifacts.latestVerify,
        gitState: output.artifacts.gitState,
      },
    },
    null,
    2,
  )
}

function listTasks(projectRoot: string): string[] {
  const tasksDir = join(projectRoot, '.tasks')
  if (!existsSync(tasksDir)) return []
  return readdirSync(tasksDir).filter((f) => {
    const path = join(tasksDir, f)
    return lstatSync(path).isDirectory()
  })
}

async function watchMode(paths: Record<string, string>, config: PipelineConfig): Promise<void> {
  console.log('👀 Starting pipeline watch mode...')
  console.log('Press Ctrl+C to exit\n')

  let previousState: PipelineState | null = null

  const interval = setInterval(() => {
    const artifacts = detectArtifacts(paths)
    const state = resolveState(artifacts, config)
    const output = buildOutput(state, artifacts)

    if (state !== previousState) {
      console.clear()
      console.log(formatMarkdown(output))
      previousState = state
    }
  }, 2000)

  process.on('SIGINT', () => {
    clearInterval(interval)
    console.log('\n👋 Watch mode stopped')
    process.exit(0)
  })

  return new Promise(() => {})
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const taskIdArg = args.find((a) => a.startsWith('--task-id='))
  const formatArg = args.find((a) => a.startsWith('--format='))
  const listArg = args.includes('--list')
  const watchArg = args.includes('--watch')
  const runArg = args.includes('--run')

  const projectRoot = process.cwd()
  const format = (formatArg?.split('=')[1] || 'markdown') as 'markdown' | 'json'
  const config = { ...DEFAULT_CONFIG }

  if (listArg) {
    const tasks = listTasks(projectRoot)
    console.log(tasks.length ? tasks.join('\n') : 'No tasks found in .tasks/')
    return
  }

  if (!taskIdArg) {
    console.error('Usage: pnpm pipeline --task-id=<id> [--format=json] [--watch] [--run]')
    console.error('       pnpm pipeline --list')
    process.exit(1)
  }

  const taskId = taskIdArg.split('=')[1]
  const paths = buildPaths(projectRoot, taskId)

  if (watchArg) {
    await watchMode(paths, config)
    return
  }

  const artifacts = detectArtifacts(paths)
  const state = resolveState(artifacts, config)
  const output = buildOutput(state, artifacts)

  if (runArg) {
    if (!output.nextAgent) {
      console.log('No agent to run for current state:', state)
      return
    }

    const opencodeAvailable = checkOpencodeAvailable()
    if (!opencodeAvailable.available) {
      console.log('\n⚠️  OpenCode CLI not found.')
      console.log('Install: curl -fsSL https://opencode.ai/install | bash')
      process.exit(1)
    }

    const agentPath = getAgentPath(paths.agentsDir, output.nextAgent)
    if (!agentPath) {
      console.error(`Agent '${output.nextAgent}' not found at ${paths.agentsDir}`)
      process.exit(1)
    }

    const code = await invokeAgentViaOpencode(agentPath, taskId, projectRoot)
    process.exit(code)
    return
  }

  if (runArg && (state === 'BUILD' || state === 'VERIFY')) {
    const result = await runBuildVerifyLoop(paths, config)
    console.log(
      `\n🏁 Build-VERIFY loop completed: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.iterations} iterations)`,
    )
    process.exit(result.success ? 0 : 1)
    return
  }

  if (format === 'json') {
    console.log(formatJson(output))
  } else {
    console.log(formatMarkdown(output))
  }
}

main()
