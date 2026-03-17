/**
 * @fileType utility
 * @domain cody | cli
 * @pattern cli-parser
 * @ai-summary CLI argument parsing and GitHub comment body parsing for the Cody pipeline
 */

import { Command } from 'commander'
import { randomInt } from 'crypto'

import * as path from 'path'

import type { CodyInput } from './cody-utils'
import { isValidMode, isValidStage, validateTaskId, VALID_MODES, VALID_STAGES } from './validation'
import { discoverTaskIdFromIssue } from './github-api'
import { logger } from './logger'

// ============================================================================
// CLI Argument Parsing
// ============================================================================

export function parseCliArgs(argv: string[]): CodyInput {
  // Create Commander program with all CLI options
  const program = new Command()
    .allowUnknownOption()
    .allowExcessArguments()
    .option('--task-id <id>', 'Task ID')
    .option('--mode <mode>', 'Pipeline mode (spec, impl, rerun, full, status)')
    .option('--file <path>', 'Task file path')
    .option('--dry-run', 'Dry run mode')
    .option('--issue-number <n>', 'GitHub issue number')
    .option('--from <stage>', 'Resume from stage')
    .option('--feedback <text>', 'Rerun feedback')
    .option('--auto', 'Autonomous mode')
    .option('--gate', 'Risk-gated mode')
    .option('--hard-stop', 'Hard stop mode')
    .option('--local', 'Local mode')
    .option('--github', 'Use GitHub-hosted runner')
    .option('--ci', 'Use GitHub-hosted runner (alias for --github)')
    .option('--clarify', 'Run clarify stage')
    .option('--complexity <n>', 'Complexity score (1-100)')
    .option('--is-pull-request', 'Comment was on a PR')
    .option('--fresh', 'Force new PR')
    .option('--comment-body <text>', 'Comment body')
    .option('--comment-body-env <var>', 'Env var for comment body')
    .option('--version <ver>', 'Pipeline version')
    .option('--trigger-type <type>', 'Trigger type')
    .option('--run-id <id>', 'CI run ID')
    .option('--run-url <url>', 'CI run URL')
    .exitOverride() // Don't exit on --help, throw instead
    .configureOutput({
      writeOut: () => {}, // Suppress output during parsing
      writeErr: () => {},
    })

  let commanderOpts: Record<string, unknown> = {}
  try {
    // Commander handles both --key value and --key=value formats
    program.parse(['node', 'entry.ts', ...argv])
    commanderOpts = program.opts()
  } catch {
    // Commander throws on --help, --version, or unknown options
    // We suppress the error and continue with defaults
  }

  const input: CodyInput = {
    mode: 'full',
    taskId: '',
    dryRun: false,
  }

  // Track which fields were explicitly set via CLI args
  // Env vars should only be used as fallback when CLI arg wasn't provided
  const cliSet = new Set<string>()

  // Map Commander options to CodyInput
  // NOTE: --mode is processed LAST to preserve original behavior where
  // later args override earlier ones (e.g., --mode after --comment-body)
  // Commander returns undefined for options that weren't provided

  if (commanderOpts.taskId !== undefined) {
    input.taskId = commanderOpts.taskId as string
    cliSet.add('taskId')
  }

  // Process --mode initially (always) so comment-body can override it when appropriate
  // If --mode comes AFTER --comment-body in argv, we'll process it again at the end
  if (commanderOpts.mode !== undefined) {
    const mode = commanderOpts.mode as string
    if (!isValidMode(mode)) {
      throw new Error(`Invalid mode: ${mode}. Valid: ${VALID_MODES.join(', ')}`)
    }
    input.mode = mode
    cliSet.add('mode')
  }

  if (commanderOpts.dryRun !== undefined) {
    input.dryRun = true
    cliSet.add('dryRun')
  }

  if (commanderOpts.feedback !== undefined) {
    input.feedback = commanderOpts.feedback as string
    cliSet.add('feedback')
  }

  if (commanderOpts.from !== undefined) {
    const stage = commanderOpts.from as string
    if (!isValidStage(stage)) {
      throw new Error(`Invalid stage: ${stage}. Valid: ${VALID_STAGES.join(', ')}`)
    }
    input.fromStage = stage
    cliSet.add('fromStage')
  }

  // Control mode flags
  if (commanderOpts.auto !== undefined) {
    input.controlMode = 'auto'
    cliSet.add('controlMode')
  } else if (commanderOpts.gate !== undefined) {
    input.controlMode = 'risk-gated'
    cliSet.add('controlMode')
  } else if (commanderOpts.hardStop !== undefined) {
    input.controlMode = 'hard-stop'
    cliSet.add('controlMode')
  }

  if (commanderOpts.issueNumber !== undefined) {
    input.issueNumber = parseInt(commanderOpts.issueNumber as string, 10)
    cliSet.add('issueNumber')
  }

  if (commanderOpts.triggerType !== undefined) {
    input.triggerType = commanderOpts.triggerType as 'dispatch' | 'comment'
    cliSet.add('triggerType')
  }

  if (commanderOpts.runId !== undefined) {
    input.runId = commanderOpts.runId as string
    cliSet.add('runId')
  }

  if (commanderOpts.runUrl !== undefined) {
    input.runUrl = commanderOpts.runUrl as string
    cliSet.add('runUrl')
  }

  if (commanderOpts.version !== undefined) {
    input.version = commanderOpts.version as string
    cliSet.add('version')
  }

  if (commanderOpts.isPullRequest !== undefined) {
    input.isPullRequest = true
    cliSet.add('isPullRequest')
  }

  if (commanderOpts.fresh !== undefined) {
    input.fresh = true
    cliSet.add('fresh')
  }

  // Handle --comment-body-env=<var> (Commander may not parse this with --key=value pattern)
  const commentBodyEnvArg = argv.find((arg) => arg.startsWith('--comment-body-env='))
  if (commentBodyEnvArg) {
    const envVarName = commentBodyEnvArg.slice('--comment-body-env='.length)
    const commentBodyFromEnv = process.env[envVarName]
    if (commentBodyFromEnv) {
      const parsed = parseCommentBody(commentBodyFromEnv, undefined)
      if (!parsed.success) {
        throw new Error(parsed.error || 'Failed to parse comment body from env var')
      }
      if (parsed.input) {
        input.mode = parsed.input.mode
        cliSet.add('mode')
        if (parsed.input.taskId) {
          input.taskId = parsed.input.taskId
          cliSet.add('taskId')
        }
        input.dryRun = parsed.input.dryRun
        cliSet.add('dryRun')
        if (parsed.input.feedback) {
          input.feedback = parsed.input.feedback
          cliSet.add('feedback')
        }
        if (parsed.input.fromStage) {
          input.fromStage = parsed.input.fromStage
          cliSet.add('fromStage')
        }
        input.triggerType = 'comment'
        cliSet.add('triggerType')
        if (parsed.input.controlMode) {
          input.controlMode = parsed.input.controlMode
          cliSet.add('controlMode')
        }
        if (parsed.input.issueNumber) {
          input.issueNumber = parsed.input.issueNumber
          cliSet.add('issueNumber')
        }
      }
    }
  }

  if (commanderOpts.commentBody !== undefined) {
    const commentBody = commanderOpts.commentBody as string
    input.commentBody = commentBody
    const parsed = parseCommentBody(commentBody, undefined)

    if (!parsed.success) {
      throw new Error(parsed.error || 'Failed to parse comment body')
    }

    if (parsed.input) {
      input.mode = parsed.input.mode
      cliSet.add('mode')
      if (parsed.input.taskId) {
        input.taskId = parsed.input.taskId
        cliSet.add('taskId')
      }
      input.dryRun = parsed.input.dryRun
      cliSet.add('dryRun')
      if (parsed.input.feedback) {
        input.feedback = parsed.input.feedback
        cliSet.add('feedback')
      }
      if (parsed.input.fromStage) {
        input.fromStage = parsed.input.fromStage
        cliSet.add('fromStage')
      }
      input.triggerType = 'comment'
      cliSet.add('triggerType')
      if (parsed.input.controlMode) {
        input.controlMode = parsed.input.controlMode
        cliSet.add('controlMode')
      }
      if (parsed.input.issueNumber) {
        input.issueNumber = parsed.input.issueNumber
        cliSet.add('issueNumber')
      }
    }
  }

  if (commanderOpts.file !== undefined) {
    input.file = commanderOpts.file as string
    cliSet.add('file')
    // --file triggers taskId auto-generation, so don't let env var override
    cliSet.add('taskId')
  }

  if (commanderOpts.local !== undefined) {
    input.local = true
    cliSet.add('local')
  } else if (commanderOpts.github !== undefined || commanderOpts.ci !== undefined) {
    // --github or --ci explicitly sets local = false
    input.local = false
    cliSet.add('local')
  }

  if (commanderOpts.clarify !== undefined) {
    input.clarify = true
    cliSet.add('clarify')
  }

  if (commanderOpts.complexity !== undefined) {
    const val = parseInt(commanderOpts.complexity as string, 10)
    if (!isNaN(val) && val >= 1 && val <= 100) {
      input.complexityOverride = val
      cliSet.add('complexityOverride')
    } else {
      throw new Error(`Invalid --complexity value: ${commanderOpts.complexity}. Must be 1-100`)
    }
  }

  // Also handle positional arguments (non -- options) and determine arg processing order
  // We need to process --mode AFTER --comment-body ONLY when --mode actually comes AFTER --comment-body in argv
  // to preserve original CLI behavior where later args override earlier ones
  // (run-cody.sh puts --mode BEFORE --comment-body, so comment-body should win)
  const modeArgIndex = argv.findIndex((a) => a.startsWith('--mode'))
  const commentBodyArgIndex = argv.findIndex((a) => a.startsWith('--comment-body'))
  // Only process --mode at the end when it comes AFTER --comment-body
  const processModeLast = modeArgIndex > commentBodyArgIndex && commentBodyArgIndex >= 0

  // Options that consume the next arg as their value (--key <value> format)
  const optionsWithValues = new Set([
    '--task-id',
    '--mode',
    '--file',
    '--issue-number',
    '--from',
    '--feedback',
    '--complexity',
    '--comment-body',
    '--comment-body-env',
    '--version',
    '--trigger-type',
    '--run-id',
    '--run-url',
  ])

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    // Skip values that belong to --key <value> options
    if (arg.startsWith('--') && optionsWithValues.has(arg) && i + 1 < argv.length) {
      i++ // skip the next arg (option value)
      continue
    }
    // Skip flags and unknown options
    if (arg.startsWith('-')) continue

    // Check if it's a valid mode
    if (isValidMode(arg)) {
      input.mode = arg
      cliSet.add('mode')
      continue
    }
    // Otherwise treat as file path (if it looks like a path)
    if (arg.includes('/') || arg.includes('.') || arg.includes('-')) {
      input.file = arg
      cliSet.add('file')
      cliSet.add('taskId') // --file triggers taskId auto-generation
      continue
    }
  }

  // Process --mode AFTER --comment-body only when it appears later in argv
  // This preserves the original CLI behavior where later args override earlier ones
  if (processModeLast) {
    if (commanderOpts.mode !== undefined) {
      const mode = commanderOpts.mode as string
      if (!isValidMode(mode)) {
        throw new Error(`Invalid mode: ${mode}. Valid: ${VALID_MODES.join(', ')}`)
      }
      input.mode = mode
      cliSet.add('mode')
    }
  }

  // Read from environment variables (for CI workflow)
  // CLI args take precedence over env vars - only use env var if field wasn't CLI-set
  // Use process.env directly (not getEnv()) for test compatibility
  if (!cliSet.has('taskId') && process.env.TASK_ID) {
    input.taskId = process.env.TASK_ID
  }
  if (!cliSet.has('mode') && process.env.MODE && isValidMode(process.env.MODE)) {
    input.mode = process.env.MODE
  }
  if (!cliSet.has('dryRun') && process.env.DRY_RUN === 'true') {
    input.dryRun = true
  }
  if (!cliSet.has('feedback') && process.env.FEEDBACK) {
    input.feedback = process.env.FEEDBACK
  }
  if (!cliSet.has('fromStage') && process.env.FROM_STAGE) {
    input.fromStage = process.env.FROM_STAGE
  }
  if (!cliSet.has('clarify') && process.env.CLARIFY === 'true') {
    input.clarify = true
  }
  if (!cliSet.has('issueNumber') && process.env.ISSUE_NUMBER) {
    input.issueNumber = parseInt(process.env.ISSUE_NUMBER, 10)
  }
  if (!cliSet.has('triggerType') && process.env.TRIGGER_TYPE) {
    input.triggerType = process.env.TRIGGER_TYPE as 'dispatch' | 'comment'
  }
  if (!cliSet.has('runId') && process.env.RUN_ID) {
    input.runId = process.env.RUN_ID
  }
  if (!cliSet.has('runUrl') && process.env.RUN_URL) {
    input.runUrl = process.env.RUN_URL
  }
  if (!cliSet.has('version') && process.env.VERSION) {
    input.version = process.env.VERSION
  }
  if (!cliSet.has('fresh') && process.env.FRESH === 'true') {
    input.fresh = true
  }
  if (!cliSet.has('complexityOverride') && process.env.COMPLEXITY) {
    const val = parseInt(process.env.COMPLEXITY, 10)
    if (!isNaN(val) && val >= 1 && val <= 100) {
      input.complexityOverride = val
    }
  }
  // Store raw comment body for gate approval detection (only for comment triggers)
  if (!input.commentBody && process.env.COMMENT_BODY && input.triggerType === 'comment') {
    input.commentBody = process.env.COMMENT_BODY
  }

  // Read IS_PULL_REQUEST from env (set by workflow for PR comments and PR review triggers)
  if (!cliSet.has('isPullRequest') && process.env.IS_PULL_REQUEST === 'true') {
    input.isPullRequest = true
  }

  // Read GITHUB_ACTOR — the GitHub login of the person who triggered the workflow
  if (!cliSet.has('actor') && process.env.GITHUB_ACTOR) {
    input.actor = process.env.GITHUB_ACTOR
  }

  // Read ISSUE_CREATOR — the GitHub login of the person who created the issue
  if (!cliSet.has('issueCreator') && process.env.ISSUE_CREATOR) {
    input.issueCreator = process.env.ISSUE_CREATOR
  }

  // Determine local mode: explicitly set or auto-detect from GITHUB_ACTIONS
  // Use process.env directly (not getEnv()) for test compatibility
  if (input.local === undefined) {
    input.local = !process.env.GITHUB_ACTIONS
  }

  // Auto-generate taskId if not provided
  if (!input.taskId) {
    // Try to discover task-id from previous bot comments on the issue
    // Skip discovery when --fresh flag is set — we want a brand-new task ID
    if (input.issueNumber && input.triggerType === 'comment' && !input.fresh) {
      const discovered = discoverTaskIdFromIssue(input.issueNumber)
      if (discovered) {
        input.taskId = discovered
        logger.info(`Discovered task ID from issue: ${input.taskId}`)
      }
    }
    if (input.fresh && input.issueNumber) {
      logger.info(`--fresh flag: skipping task ID discovery for issue #${input.issueNumber}`)
    }

    // If still no task-id, generate one
    if (!input.taskId) {
      if (input.file) {
        // Generate from filename: --file path/to/feature.md -> 260218-feature
        const stem = path.basename(input.file, path.extname(input.file))
        const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, '')
        input.taskId = `${datePrefix}-${stem.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()}`
      } else {
        // Fallback: auto-generate from date
        const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, '')
        const counter = randomInt(100, 999)
        input.taskId = `${datePrefix}-auto-${counter}`
      }
      logger.info(`Auto-generated task ID: ${input.taskId}`)
    }
  }

  if (!validateTaskId(input.taskId)) {
    throw new Error(`Invalid task-id format: ${input.taskId}. Expected: YYMMDD-description`)
  }

  return input
}

// ============================================================================
// Comment Body Parsing
// ============================================================================

interface ParseCommentResult {
  success: boolean
  input?: CodyInput
  error?: string
  errorComment?: string // Error message to post back to the issue
}

/**
 * Parse a GitHub issue comment body in the format:
 *   /cody <subcommand> <task-id> [options]
 *
 * Examples:
 *   /cody 260218-user-metrics           -> full mode, task 260218-user-metrics
 *   /cody spec 260218-user-metrics      -> spec mode
 *   /cody impl 260218-user-metrics      -> impl mode
 *   /cody rerun 260218-user-metrics --feedback "fix this"
 *   /cody                               -> full mode, auto-generate task-id
 */
export function parseCommentBody(body: string, issueNumber?: number): ParseCommentResult {
  // Decode JSON-encoded body from YAML (jq -Rs . wraps in quotes and escapes)
  let decoded = body
  if (decoded.startsWith('"') && decoded.endsWith('"')) {
    try {
      decoded = JSON.parse(decoded)
    } catch {
      // Use raw value if JSON.parse fails
    }
  }

  // Normalize literal \n sequences to real newlines
  // (double-escaping from the GitHub Actions → shell → pnpm → Node.js pipeline
  //  can leave literal backslash-n instead of actual newlines)
  decoded = decoded.replace(/\\n/g, '\n')

  // Only parse the first line — /cody commands live on line 1;
  // trailing lines are just whitespace or comment noise
  const firstLine = decoded.split('\n')[0]
  const cmd = firstLine.replace(/^\/cody\s*/, '').trim()

  // Extract subcommand (first word)
  const spaceIdx = cmd.indexOf(' ')
  const subCmd = spaceIdx === -1 ? cmd : cmd.slice(0, spaceIdx)
  const rest = spaceIdx === -1 ? '' : cmd.slice(spaceIdx + 1).trim()

  // Handle empty command: /cody with no subcommand defaults to full
  let mode: CodyInput['mode'] = 'full'
  let taskId = rest
  let implicitFeedback: string | undefined

  // Handle task-id as subcommand: /cody 260218-task defaults to full with that task
  const isTaskId = /^[0-9]{6}-[a-zA-Z0-9-]+$/.test(subCmd)
  if (isTaskId) {
    mode = 'full'
    taskId = `${subCmd}${rest ? ' ' + rest : ''}`.trim()
    // When task-id is the subcommand, we need to track what was "rest" for options parsing
    // The reconstructed taskId now contains both the ID and options, so use it as original
  } else if (subCmd) {
    // Handle approve/reject specially - these are for gate approval, not mode selection
    const lowerSubCmd = subCmd.toLowerCase()
    if (
      lowerSubCmd === 'approve' ||
      lowerSubCmd === 'reject' ||
      lowerSubCmd === 'yes' ||
      lowerSubCmd === 'no' ||
      lowerSubCmd === 'go' ||
      lowerSubCmd === 'proceed'
    ) {
      // Keep existing mode - gate approval logic will detect these keywords
      // Don't change mode, just pass through. The gate check will handle approval detection.
      // If no mode is set yet, default to full for resuming gated tasks
      if (!mode) mode = 'full'
    } else if (isValidMode(subCmd)) {
      // Validate subcommand
      mode = subCmd as CodyInput['mode']
    } else {
      // Unrecognized subcommand: treat as rerun with implicit feedback
      // e.g., "/cody adjust tests" → rerun mode, feedback = "adjust tests"
      mode = 'rerun'
      // Capture both the subcommand and rest as implicit feedback
      implicitFeedback = rest ? `${subCmd} ${rest}`.trim() : subCmd
    }
  }

  // Extract task-id — ONLY if it matches the task-id pattern (YYMMDD-description)
  // If it doesn't match, for rerun mode treat remaining text as implicit feedback
  // For other modes, leave task-id empty (will be auto-discovered from issue)
  const taskIdPattern = /^[0-9]{6}-[a-zA-Z0-9-]+$/

  if (taskId) {
    const firstWord = taskId.split(' ')[0]
    if (taskIdPattern.test(firstWord)) {
      // First word is a valid task-id
      taskId = firstWord
    } else {
      // First word is NOT a task-id
      if (mode === 'rerun' || mode === 'fix') {
        // For rerun/fix: treat all remaining text as implicit feedback
        // This handles "@cody fix the button isn't showing" → feedback = "the button isn't showing"
        implicitFeedback = taskId
      }
      taskId = '' // will be auto-discovered from issue
    }
  }

  // Don't auto-generate task-id here — let parseCliArgs handle discovery + fallback generation
  // This allows discoverTaskIdFromIssue to find the task-id from previous bot comments

  // Parse remaining options (--feedback, --from, --dry-run)
  // rest contains: for isTaskId case: "options", for explicit mode case: "task-id options"
  let optionsStr = ''
  if (isTaskId) {
    // Task-id as subcommand: rest has only options (after task-id)
    optionsStr = rest.trim()
  } else if (taskId) {
    // Explicit mode: rest = "task-id options...", skip past the task-id to get options
    const taskIdLen = taskId.length
    optionsStr = rest.slice(taskIdLen).trim()
  } else {
    // No task-id provided: rest is all options
    optionsStr = rest.trim()
  }

  const options = optionsStr.split(/\s+/)
  let dryRun = false
  let feedback: string | undefined
  let fromStage: string | undefined
  let controlMode: CodyInput['controlMode'] = undefined
  let fresh = false

  let i = 0
  while (i < options.length) {
    const opt = options[i]
    if (opt === '--dry-run') {
      dryRun = true
      i++
    } else if (opt === '--auto') {
      controlMode = 'auto'
      i++
    } else if (opt === '--gate') {
      controlMode = 'risk-gated'
      i++
    } else if (opt === '--hard-stop') {
      controlMode = 'hard-stop'
      i++
    } else if (opt === '--feedback' && options[i + 1]) {
      // Capture all remaining words until the next --flag as feedback
      const feedbackParts: string[] = []
      let j = i + 1
      while (j < options.length && !options[j].startsWith('--')) {
        feedbackParts.push(options[j])
        j++
      }
      feedback = feedbackParts.join(' ')
      i = j
    } else if (opt === '--fresh') {
      fresh = true
      i++
    } else if (opt === '--from' && options[i + 1]) {
      fromStage = options[i + 1]
      // Validate from stage
      if (!isValidStage(fromStage)) {
        return {
          success: false,
          error: `Invalid stage: ${fromStage}`,
          errorComment: `Invalid stage: \`${fromStage}\`. Valid: \`${VALID_STAGES.join(', ')}\``,
        }
      }
      i += 2
    } else {
      // Skip unknown options
      i++
    }
  }

  // Use implicit feedback if no explicit --feedback was provided (for rerun mode)
  const finalFeedback = feedback || implicitFeedback

  return {
    success: true,
    input: {
      mode,
      taskId,
      dryRun,
      feedback: finalFeedback,
      fromStage,
      issueNumber,
      triggerType: 'comment',
      fresh,
      controlMode,
    },
  }
}
