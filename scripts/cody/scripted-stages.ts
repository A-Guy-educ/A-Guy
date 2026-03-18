/**
 * @fileType utility
 * @domain ci | cody | pipeline
 * @pattern scripted-stages
 * @ai-summary Direct script execution for verify and PR stages — no LLM needed for mechanical tasks
 */

import { logger } from './logger'
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import ms from 'ms'
import * as path from 'path'
import { getDefaultBranch, commitAndPush } from './git-utils'
import { postComment, setLifecycleLabel } from './github-api'

// ============================================================================
// Verify Stage — run quality gates directly
// ============================================================================

interface VerifyResult {
  passed: boolean
  report: string
}

interface GateResult {
  name: string
  passed: boolean
  output: string
}

/** Default timeout per gate (2 minutes) */
const DEFAULT_GATE_TIMEOUT = ms('2m')

function runGate(
  name: string,
  program: string,
  args: string[],
  cwd: string,
  timeout: number = DEFAULT_GATE_TIMEOUT,
): GateResult {
  logger.info(`  Running ${name}...`)
  try {
    const output = execFileSync(program, args, { cwd, encoding: 'utf-8', timeout })
    logger.info(`  ✅ ${name} passed`)
    return { name, passed: true, output: output.slice(0, 1000) }
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    const output = (err.stdout || '') + (err.stderr || '') || err.message || 'Unknown error'
    logger.info(`  ❌ ${name} failed`)
    return { name, passed: false, output: output.slice(0, 5000) }
  }
}

export function runVerifyStage(
  outputFile: string,
  cwd: string = process.cwd(),
  timeout?: number,
  taskDir?: string,
): VerifyResult {
  logger.info('\n🔍 Running verification (scripted)...\n')

  // Aggregate timeout - total time allowed for all gates combined
  const startTime = Date.now()
  const aggregateTimeout = timeout ?? Infinity

  const gateDefinitions = [
    { name: 'TypeScript', program: 'pnpm', args: ['-s', 'tsc', '--noEmit'] },
    { name: 'Lint', program: 'pnpm', args: ['-s', 'lint'] },
    { name: 'Format', program: 'pnpm', args: ['-s', 'format:check'] },
    // Unit Tests gate removed — tests are deferred to inspector plugin (cody-deferred-tests)
  ]

  const gates: GateResult[] = []
  for (const gateDef of gateDefinitions) {
    const elapsed = Date.now() - startTime
    const remaining = aggregateTimeout - elapsed

    if (remaining <= 0) {
      // Aggregate timeout exceeded - skip remaining gates
      gates.push({
        name: gateDef.name,
        passed: false,
        output: 'SKIPPED: aggregate timeout exceeded',
      })
      continue
    }

    // Use smaller of remaining aggregate time or per-gate default
    const gateTimeout = Math.min(remaining, DEFAULT_GATE_TIMEOUT)
    gates.push(runGate(gateDef.name, gateDef.program, gateDef.args, cwd, gateTimeout))
  }

  const allPassed = gates.every((g) => g.passed)

  // Write individual gate output files for failed gates.
  // These files provide detailed error context to the fix stage agent
  // (state-machine.ts reads tsc-output.txt / lint-output.txt when building verify-failures.md).
  if (taskDir) {
    for (const gate of gates) {
      if (!gate.passed) {
        const slug = gate.name.toLowerCase().replace(/\s+/g, '-')
        const gateOutputPath = path.join(taskDir, `${slug}-output.txt`)
        try {
          fs.writeFileSync(gateOutputPath, gate.output.slice(0, 10000))
        } catch {
          // Non-critical — gate output is supplementary context
        }
      }
    }
  }

  const lines: string[] = ['# Verification Report\n']
  for (const gate of gates) {
    const icon = gate.passed
      ? 'PASS ✅'
      : gate.output.includes('SKIPPED')
        ? 'SKIPPED ❌'
        : 'FAIL ❌'
    lines.push(`## ${gate.name}: ${icon}\n`)
    if (!gate.passed) {
      lines.push('```')
      lines.push(gate.output)
      lines.push('```\n')
    }
  }

  lines.push(`\n## Result: ${allPassed ? 'PASS' : 'FAIL'}`)

  const report = lines.join('\n')
  fs.writeFileSync(outputFile, report)
  logger.info(`\n${allPassed ? '✅' : '❌'} Verification ${allPassed ? 'passed' : 'failed'}`)

  return { passed: allPassed, report }
}

// ============================================================================
// PR Stage — create PR directly via gh CLI
// ============================================================================

interface PrResult {
  created: boolean
  url: string
  report: string
}

function getBranchName(cwd: string): string {
  const branch = execFileSync('git', ['branch', '--show-current'], {
    cwd,
    encoding: 'utf-8',
  }).trim()
  if (!branch) {
    // Detached HEAD — use short commit hash as fallback
    return (
      execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd,
        encoding: 'utf-8',
      }).trim() || 'detached'
    )
  }
  return branch
}

function getExistingPr(branch: string, cwd: string): string | null {
  // BUG-F fix: Use GH_PAT if non-empty, fall back to GH_TOKEN (don't use empty string)
  const ghToken = process.env.GH_PAT?.trim() || process.env.GH_TOKEN
  try {
    const output = execFileSync(
      'gh',
      ['pr', 'list', '--head', branch, '--json', 'url', '--jq', '.[0].url'],
      {
        cwd,
        encoding: 'utf-8',
        env: { ...process.env, GH_TOKEN: ghToken },
      },
    ).trim()
    return output || null
  } catch {
    return null
  }
}

function getCommitSummary(defaultBranch: string, cwd: string): string {
  try {
    // Use execFileSync to prevent shell injection via branch names
    return execFileSync('git', ['log', '--oneline', `${defaultBranch}..HEAD`], {
      cwd,
      encoding: 'utf-8',
    }).trim()
  } catch {
    return ''
  }
}

/**
 * Create a fresh branch with incremented version suffix for --fresh flag.
 * Lists remote branches matching pattern, finds highest -vN suffix, creates -v(N+1).
 * Strips existing -vN suffix to prevent chains like branch-v2-v3.
 */
export function createFreshBranch(currentBranch: string, cwd: string = process.cwd()): string {
  // Strip existing -vN suffix to prevent chains (e.g., feat/260225-task-v2 -> feat/260225-task)
  const baseBranch = currentBranch.replace(/-v\d+$/, '')

  // List remote branches matching the pattern
  let maxVersion = 1
  try {
    const output = execFileSync('git', ['branch', '-r', '--list', `${baseBranch}-v*`], {
      cwd,
      encoding: 'utf-8',
    }).trim()

    if (output) {
      // Extract version numbers from branch names
      const versions = output.split('\n').map((b) => {
        const match = b.trim().match(/-v(\d+)$/)
        return match ? parseInt(match[1], 10) : 0
      })
      maxVersion = Math.max(...versions, 1)
    }
  } catch {
    // No matching branches, start at v2
    maxVersion = 1
  }

  const newBranch = `${baseBranch}-v${maxVersion + 1}`

  // Create the new branch locally from current HEAD (carries all commits)
  try {
    execFileSync('git', ['checkout', '-b', newBranch], {
      cwd,
      encoding: 'utf-8',
    })
    logger.info(`  Created fresh branch: ${newBranch}`)
  } catch (error) {
    // If branch already exists locally, checkout to it
    if (String(error).includes('already exists')) {
      execFileSync('git', ['checkout', newBranch], { cwd, encoding: 'utf-8' })
      logger.info(`  Checked out existing fresh branch: ${newBranch}`)
    } else {
      throw error
    }
  }

  return newBranch
}

function buildPrTitle(
  taskDir: string,
  defaultBranch: string,
  cwd: string,
  issueNumber?: number,
): string {
  // Read task.md for context
  const taskMdPath = path.join(taskDir, 'task.md')
  let taskDescription = ''
  let issueTitle = ''
  if (fs.existsSync(taskMdPath)) {
    const taskMdContent = fs.readFileSync(taskMdPath, 'utf-8')

    // First try to extract ## Issue Title section (highest priority)
    // More forgiving regex: accepts variable whitespace between heading and value
    const issueTitleMatch = taskMdContent.match(/^##\s*Issue\s*Title\s*\n+([^\n]+)/im)
    if (issueTitleMatch) {
      issueTitle = issueTitleMatch[1].trim()
    }

    // Then get the rest of the description (strip both # Task and ## Issue Title sections)
    taskDescription = taskMdContent
      .replace(/^#\s*Task\s*/i, '')
      .replace(/^##\s*Issue\s*Title\s*\n+[^\n]*\n*/gim, '')
      .trim()
  }

  // Read task.json for type
  const taskJsonPath = path.join(taskDir, 'task.json')
  let taskType = 'feat'
  if (fs.existsSync(taskJsonPath)) {
    try {
      const taskJson = JSON.parse(fs.readFileSync(taskJsonPath, 'utf-8'))
      const typeMap: Record<string, string> = {
        fix_bug: 'fix',
        implement_feature: 'feat',
        refactor: 'refactor',
        docs: 'docs',
        ops: 'chore',
        research: 'chore',
      }
      taskType = typeMap[taskJson.task_type] || 'feat'
    } catch {
      // ignore
    }
  }

  // Priority: 1) Issue title from task.md, 2) First content line from task.md, 3) Commit messages

  // Strip severity tags from issue title (e.g., [MEDIUM], [HIGH], [LOW], [BUG], etc.)
  const cleanedIssueTitle = issueTitle.replace(/^\[[^\]]+\]\s*/, '')

  // Get first non-empty, non-heading line of task description as summary
  // More robust heading detection: track lines that were originally markdown headings
  const commonHeadings = ['description', 'summary', 'overview', 'details', 'background']
  const firstLine =
    taskDescription
      .split('\n')
      .map((l) => {
        const originalLine = l

        // Strip conventional commit prefix first (fix:, feat:, etc.)
        let cleaned = l.replace(
          /^(fix|feat|refactor|docs|chore|test|style|perf|ci|build)(\([^)]*\))?:/i,
          '',
        )
        // Trim leading space left by prefix removal
        cleaned = cleaned.trim()
        // Then strip markdown heading markers
        cleaned = cleaned.replace(/^#+\s*/, '').trim()

        return { original: originalLine, cleaned }
      })
      // Exclude lines that were headings (matched /^#+\s*\S/) AND ended up as common heading words
      .filter(({ original, cleaned }) => {
        const isCommonHeading = commonHeadings.includes(cleaned.toLowerCase())
        const wasHeading = /^#+\s*\S/.test(original.trim())
        return cleaned.length > 0 && !(wasHeading && isCommonHeading)
      })[0]?.cleaned ?? ''

  // Use issue title if available, otherwise fall back to first content line
  const titleSource = cleanedIssueTitle || firstLine

  // Use commit messages as fallback
  if (!titleSource) {
    const commits = getCommitSummary(defaultBranch, cwd)
    const firstCommit = commits.split('\n')[0] || 'implement changes'
    // Strip commit hash
    return `${taskType}: ${firstCommit.replace(/^[a-f0-9]+\s+/, '')}`
  }

  // Truncate to reasonable length
  const summary = titleSource.length > 72 ? titleSource.slice(0, 69) + '...' : titleSource

  // Add issue reference to title for GitHub auto-linking
  const issueRef = issueNumber ? ` - Closes #${issueNumber}` : ''

  return `${taskType}: ${summary.toLowerCase()}${issueRef}`
}

function buildPrBody(
  taskDir: string,
  defaultBranch: string,
  cwd: string,
  issueNumber?: number,
): string {
  const commits = getCommitSummary(defaultBranch, cwd)

  // Read spec for context — extract ## Overview section if present
  const specPath = path.join(taskDir, 'spec.md')
  let specSummary = ''
  if (fs.existsSync(specPath)) {
    const spec = fs.readFileSync(specPath, 'utf-8')
    // Try to extract the ## Overview section
    const overviewMatch = spec.match(/##\s*Overview\n([\s\S]*?)(?=\n##\s|$)/)
    if (overviewMatch) {
      specSummary = overviewMatch[1].trim()
    } else {
      // Fallback: first paragraph (up to first blank line or 500 chars)
      const firstPara = spec.split(/\n\n/)[0] || ''
      specSummary = firstPara.slice(0, 500).trim()
    }
  }

  const lines = ['## Summary\n']

  if (specSummary) {
    lines.push(specSummary)
    lines.push('')
  }

  if (commits) {
    lines.push('## Commits\n')
    lines.push('```')
    lines.push(commits)
    lines.push('```')
  }

  if (issueNumber) {
    lines.push(`\nCloses #${issueNumber}`)
  }

  lines.push('\n---\n🤖 Generated by Cody pipeline')
  lines.push('<!-- TODO: update docs -->')

  return lines.join('\n')
}

export async function runPrStage(
  taskDir: string,
  outputFile: string,
  cwd: string = process.cwd(),
  issueNumber?: number,
  options?: {
    fresh?: boolean // Force create new PR (new branch)
  },
): Promise<PrResult> {
  logger.info('\n📝 Creating PR (scripted)...\n')

  const branch = getBranchName(cwd)
  const defaultBranch = getDefaultBranch(cwd)

  // Step 1: Check for existing PR (unless --fresh is set)
  const existingUrl = !options?.fresh ? getExistingPr(branch, cwd) : null
  if (existingUrl && !options?.fresh) {
    logger.info(`  PR already exists: ${existingUrl}`)
    const report = `# PR Stage\n\nExisting PR found: ${existingUrl}\n`
    fs.writeFileSync(outputFile, report)
    return { created: false, url: existingUrl, report }
  }

  if (options?.fresh && existingUrl) {
    logger.info(`  --fresh flag: creating new PR (ignoring existing: ${existingUrl})`)
  }

  // Step 2: Push branch (skip pre-push hooks to avoid blocking on unrelated checks)
  logger.info('  Pushing branch ' + branch + '...')
  let pushSuccess = false
  try {
    execFileSync('git', ['push', '-u', 'origin', branch], {
      cwd,
      stdio: 'inherit',
      timeout: 120_000,
      env: { ...process.env, HUSKY: '0', SKIP_HOOKS: '1' },
    })
    pushSuccess = true
  } catch (_error) {
    // Push was rejected - remote has changes, try pull --rebase and retry
    logger.info('  Push rejected, pulling and rebasing...')
    try {
      execFileSync('git', ['pull', '--rebase', 'origin', branch], {
        cwd,
        stdio: 'inherit',
        timeout: 120_000,
        env: { ...process.env, HUSKY: '0', SKIP_HOOKS: '1' },
      })
      // Retry push after rebase
      execFileSync('git', ['push', '-u', 'origin', branch], {
        cwd,
        stdio: 'inherit',
        timeout: 120_000,
        env: { ...process.env, HUSKY: '0', SKIP_HOOKS: '1' },
      })
      pushSuccess = true
      logger.info('  Push succeeded after rebase')
    } catch (_rebaseError) {
      logger.info('  Push failed even after rebase')
    }
  }

  if (!pushSuccess) {
    // R3-FIX #1: Abort PR creation if push failed — GitHub API will reject the PR
    // with "branch not reachable" since the branch doesn't exist on the remote.
    logger.error('  ❌ Push failed — cannot create PR for unpushed branch')
    const report =
      '# PR Stage\n\nFailed to create PR: git push failed. Branch not available on remote.\n'
    fs.writeFileSync(outputFile, report)
    return { created: false, url: '', report }
  }
  // Step 3: Build title and body
  const title = buildPrTitle(taskDir, defaultBranch, cwd, issueNumber)
  const body = buildPrBody(taskDir, defaultBranch, cwd, issueNumber)

  logger.info(`  Title: ${title}`)

  // Step 4: Create PR via GitHub REST API (more reliable than gh CLI in CI)
  // BUG-F fix: Use GH_PAT if non-empty, fall back to GH_TOKEN (don't use empty string)
  const ghToken = process.env.GH_PAT?.trim() || process.env.GH_TOKEN

  if (!ghToken) {
    logger.error('  ❌ No GitHub token found (GH_PAT or GH_TOKEN)')
    const report = `# PR Stage\n\nFailed to create PR: No GitHub token found. Set GH_PAT or GH_TOKEN.\n`
    fs.writeFileSync(outputFile, report)
    return { created: false, url: '', report }
  }

  // Extract owner and repo from git remote
  let owner = ''
  let repo = ''
  try {
    const remoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd,
      encoding: 'utf-8',
    }).trim()
    // Parse from: https://github.com/owner/repo.git or git@github.com:owner/repo.git
    const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/)
    if (match) {
      owner = match[1]
      repo = match[2]
    }
  } catch {
    logger.error('  ❌ Could not determine repo from git remote')
    const report = `# PR Stage\n\nFailed to determine repository from git remote\n`
    fs.writeFileSync(outputFile, report)
    return { created: false, url: '', report }
  }

  let prUrl = ''
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        head: branch,
        base: defaultBranch,
        draft: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GitHub API error: ${response.status} - ${errorText}`)
    }

    const prData = (await response.json()) as { html_url: string }
    prUrl = prData.html_url
    logger.info(`  ✅ PR created: ${prUrl}`)

    // Post comment to issue linking to PR
    if (issueNumber) {
      const cleanUrl = prUrl.replace(/\n/g, '').trim()
      postComment(issueNumber, `🎉 PR created: ${cleanUrl}`)
      logger.info(`  ✅ Commented on issue #${issueNumber}`)
    }

    // Set lifecycle label to review
    if (issueNumber) {
      setLifecycleLabel(issueNumber, 'cody:review')
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    const msg = err.message || 'Unknown error'
    logger.error(`  ❌ PR creation failed: ${msg}`)
    const report = `# PR Stage

Failed to create PR: ${msg}

Title: ${title}

${body}
`
    fs.writeFileSync(outputFile, report)
    return { created: false, url: '', report }
  }

  const report = `# PR Stage

PR created: ${prUrl}

Title: ${title}

${body}
`
  fs.writeFileSync(outputFile, report)
  return { created: true, url: prUrl, report }
}

// ============================================================================
// Commit Stage — commit and push changes via git-utils
// ============================================================================

interface CommitResult {
  success: boolean
  hash: string
  branch: string
  message: string
  report: string
}

export function runCommitStage(
  taskDir: string,
  outputFile: string,
  cwd: string = process.cwd(),
): CommitResult {
  logger.info('\n📦 Committing changes (scripted)...\n')

  // Extract task ID from taskDir path
  const taskId = path.basename(taskDir)

  const result = commitAndPush(taskId, taskDir, cwd)

  const lines = [`# Commit Stage\n`]

  if (result.success) {
    lines.push(`✅ **Committed and pushed**\n`)
    lines.push(`- **Branch:** ${result.branch}`)
    lines.push(`- **Hash:** ${result.hash}`)
    logger.info(`  ✅ ${result.message}`)
  } else {
    lines.push(`⚠️ **Commit status:** ${result.message}\n`)
    if (result.message.includes('No changes')) {
      logger.info(`  ℹ️ ${result.message}`)
    } else {
      logger.error(`  ❌ ${result.message}`)
    }
  }

  const report = lines.join('\n')
  fs.writeFileSync(outputFile, report)

  return {
    success: result.success,
    hash: result.hash,
    branch: result.branch,
    message: result.message,
    report,
  }
}
