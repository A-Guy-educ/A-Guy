#!/usr/bin/env node
/**
 * Diff-Scoped Auto-Fix Script
 *
 * Runs Prettier and ESLint --fix only on files that have been changed
 * by the agent, avoiding massive unrelated diffs in CI.
 */

import { execFileSync, execSync } from 'child_process'

// Get repo root using git (works even if executed from subfolder)
let REPO_ROOT
try {
  REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim()
} catch {
  console.error(
    '❌ Error: Not in a git repository. Please run this script from within a git repository.',
  )
  process.exit(1)
}

// Eligible file extensions
const ELIGIBLE_EXTENSIONS = ['.js', '.jsx', '.ts', '..tsx', '.json', '.md', '.yml', '.yaml', '.css']

// Lockfile names to exclude
const LOCKFILES = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']

/**
 * Detect the default branch for comparison
 */
function detectDefaultBranch() {
  // Try origin/main first
  try {
    execSync('git rev-parse --verify origin/main', { encoding: 'utf-8' })
    console.log('📌 Detected base branch: origin/main')
    return 'origin/main'
  } catch {
    // Fallback to origin/master
    try {
      execSync('git rev-parse --verify origin/master', { encoding: 'utf-8' })
      console.log('📌 Detected base branch: origin/master')
      return 'origin/master'
    } catch {
      // Try origin/HEAD
      try {
        const output = execSync('git symbolic-ref refs/remotes/origin/HEAD', { encoding: 'utf-8' })
        const branch = output.trim().replace('refs/remotes/origin/', '')
        console.log(`📌 Detected base branch: origin/${branch}`)
        return `origin/${branch}`
      } catch {
        // Final fallback to main
        console.log('📌 Using fallback base branch: main')
        return 'main'
      }
    }
  }
}

/**
 * Get list of changed files compared to default branch
 * Includes both committed and unstaged changes
 */
function getChangedFiles(baseBranch) {
  try {
    // Get committed changes: git diff --name-only <base>...HEAD
    // Use -- to separate revision from file paths
    const output = execSync(`git diff --name-only ${baseBranch}...HEAD --`, {
      encoding: 'utf-8',
      cwd: REPO_ROOT,
    })
    const committedFiles = output.trim().split('\n').filter(Boolean)

    // Also get unstaged changes: git diff --name-only --cached
    const unstagedOutput = execSync('git diff --name-only --cached', {
      encoding: 'utf-8',
      cwd: REPO_ROOT,
    })
    const unstagedFiles = unstagedOutput.trim().split('\n').filter(Boolean)

    // Also get working tree changes: git diff --name-only (no args)
    const workingOutput = execSync('git diff --name-only', {
      encoding: 'utf-8',
      cwd: REPO_ROOT,
    })
    const workingFiles = workingOutput.trim().split('\n').filter(Boolean)

    // Combine all unique files
    const allFiles = [...new Set([...committedFiles, ...unstagedFiles, ...workingFiles])]
    return allFiles
  } catch (err) {
    console.error('Error getting changed files:', err.message)
    return []
  }
}

/**
 * Check if a file has an eligible extension
 */
function hasEligibleExtension(filename) {
  const ext = filename.substring(filename.lastIndexOf('.'))
  return ELIGIBLE_EXTENSIONS.includes(ext)
}

/**
 * Check if a file is a lockfile (exact match)
 */
function isLockfile(filename) {
  const baseName = filename.split('/').pop()
  return LOCKFILES.includes(baseName)
}

/**
 * Check if a file is in an excluded directory
 */
function isInExcludedDir(filename) {
  const excludedDirs = [
    '.github/workflows/',
    '.next/',
    'dist/',
    'build/',
    'coverage/',
    'node_modules/',
  ]
  return excludedDirs.some((dir) => filename.startsWith(dir))
}

/**
 * Check if a file should be excluded
 */
function isExcluded(filename) {
  return isLockfile(filename) || isInExcludedDir(filename)
}

/**
 * Filter files to only include eligible ones
 */
function filterEligibleFiles(files) {
  return files.filter((filename) => {
    // Check extension
    if (!hasEligibleExtension(filename)) {
      return false
    }
    // Check exclusions
    if (isExcluded(filename)) {
      return false
    }
    return true
  })
}

/**
 * Run Prettier on specific files using execFileSync for safe argv handling
 */
function runPrettier(files) {
  if (files.length === 0) {
    console.log('  No eligible files for Prettier')
    return
  }

  console.log(`  Running Prettier on ${files.length} file(s)...`)

  try {
    execFileSync('pnpm', ['exec', 'prettier', '--write', ...files], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    })
  } catch (err) {
    console.error('  Prettier failed:', err.message)
    // Don't exit - ESLint might still succeed
  }
}

/**
 * Run ESLint fix on specific files using execFileSync for safe argv handling
 */
function runEslint(files) {
  if (files.length === 0) {
    console.log('  No eligible files for ESLint')
    return
  }

  console.log(`  Running ESLint on ${files.length} file(s)...`)

  try {
    // Run without --max-warnings to avoid failing on ignored file warnings
    // The goal is to fix issues, not enforce strict rules in auto-fix
    execFileSync('pnpm', ['exec', 'eslint', '--fix', '--', ...files], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    })
  } catch (_) {
    // ESLint may fail if there are real errors, but warnings are OK for auto-fix
    console.log('  ESLint completed with issues (may include warnings)')
  }
}

/**
 * Main function
 */
function main() {
  console.log('🔧 Running diff-scoped auto-fix...')
  console.log(`📂 Working directory: ${REPO_ROOT}`)

  // Detect default branch
  const defaultBranch = detectDefaultBranch()

  // Get changed files
  const changedFiles = getChangedFiles(defaultBranch)

  if (changedFiles.length === 0) {
    console.log('📝 No changed files detected')
    process.exit(0)
  }

  console.log(`📄 Found ${changedFiles.length} changed file(s)`)

  // Filter to eligible files
  const eligibleFiles = filterEligibleFiles(changedFiles)

  if (eligibleFiles.length === 0) {
    console.log('📝 No eligible files for auto-fix')
    process.exit(0)
  }

  console.log(`✅ ${eligibleFiles.length} eligible file(s) for auto-fix`)

  // Run Prettier first
  runPrettier(eligibleFiles)

  // Then run ESLint
  runEslint(eligibleFiles)

  // Show diff summary
  try {
    const diffOutput = execSync('git diff --name-only', {
      encoding: 'utf-8',
      cwd: REPO_ROOT,
    })
    const diffFiles = diffOutput.trim().split('\n').filter(Boolean)
    if (diffFiles.length > 0) {
      console.log(`\n📊 Files modified by auto-fix:`)
      diffFiles.forEach((f) => console.log(`   - ${f}`))
      console.log('')
    }
  } catch {
    // Ignore - no diffs or git error
  }

  console.log('✨ Diff-scoped auto-fix complete!')
}

main()
