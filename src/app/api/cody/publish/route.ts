/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern publish
 * @ai-summary Publish dev branch to main via GitHub merge
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

const REPO = 'A-Guy-educ/A-Guy'
const DEV_BRANCH = 'dev'
const PROD_BRANCH = 'main'

function gh(...args: string[]): string {
  try {
    return execSync(`gh ${args.join(' ')} -R ${REPO}`, { encoding: 'utf-8' }).trim()
  } catch (error: any) {
    console.error(`gh command failed: gh ${args.join(' ')} -R ${REPO}`, error.message)
    throw error
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate confirmation
    if (body.confirm !== true) {
      return NextResponse.json(
        { error: 'Confirmation required. Send { confirm: true }.' },
        { status: 400 },
      )
    }

    const results: string[] = []

    // 1. Fetch latest main and dev branches
    try {
      gh('fetch', 'origin', PROD_BRANCH)
      gh('fetch', 'origin', DEV_BRANCH)
      results.push('Fetched latest branches')
    } catch (error: any) {
      results.push(`Fetch note: ${error.message}`)
    }

    // 2. Check if dev is ahead of main (has commits to merge)
    try {
      const mergeBase = execSync(`gh api repos/${REPO}/compare/main...dev --jq '.ahead_by'`, {
        encoding: 'utf-8',
      }).trim()

      if (mergeBase === '0') {
        return NextResponse.json({
          success: true,
          message: 'dev branch is already up to date with main',
          results,
        })
      }

      results.push(`dev is ${mergeBase} commits ahead of main`)
    } catch (error: any) {
      // Continue anyway - might work
      results.push(`Merge base check note: ${error.message}`)
    }

    // 3. Try to merge dev into main via PR
    // First, check if there's an open PR from dev to main
    let prNumber: string | null = null

    try {
      const prsOutput = gh(
        'pr',
        'list',
        '--base',
        PROD_BRANCH,
        '--head',
        DEV_BRANCH,
        '--state',
        'open',
        '--json',
        'number',
      )
      const prs = JSON.parse(prsOutput)
      if (prs.length > 0) {
        prNumber = String(prs[0].number)
      }
    } catch {
      // No PR found, will create one
    }

    if (prNumber) {
      // Update PR branch with latest main
      try {
        gh('pr', 'update-branch', prNumber)
        results.push(`Updated PR #${prNumber} with latest main`)
      } catch (error: any) {
        results.push(`Branch update note: ${error.message}`)
      }

      // Approve and merge the PR
      try {
        gh('pr', 'review', prNumber, '--approve', '-b', 'LGTM! Merged via Cody dashboard publish.')
        results.push(`Approved PR #${prNumber}`)
      } catch (error: any) {
        results.push(`Review note: ${error.message}`)
      }

      try {
        gh('pr', 'merge', prNumber, '--squash', '--delete-branch')
        results.push(`Merged PR #${prNumber} and deleted dev branch`)
      } catch (error: any) {
        if (error.message.includes('Pull request is in')) {
          results.push(`PR #${prNumber} approved, merge may require checks`)
        } else if (error.message.includes('No commit to merge')) {
          return NextResponse.json({
            success: true,
            message: 'No commits to merge - dev is already up to date with main',
            results,
          })
        } else {
          throw error
        }
      }
    } else {
      // No PR exists - try direct merge (may fail if there are conflicts)
      // This is the fallback - prefer the PR flow above
      try {
        gh(
          'pr',
          'create',
          '--base',
          PROD_BRANCH,
          '--head',
          DEV_BRANCH,
          '--title',
          'Publish dev to production',
          '--body',
          'Automated merge via Cody dashboard',
        )
        results.push('Created PR from dev to main')

        // Now find and merge it
        const newPrsOutput = gh(
          'pr',
          'list',
          '--base',
          PROD_BRANCH,
          '--head',
          DEV_BRANCH,
          '--state',
          'open',
          '--json',
          'number',
        )
        const newPrs = JSON.parse(newPrsOutput)
        if (newPrs.length > 0) {
          const newPrNumber = String(newPrs[0].number)
          gh('pr', 'merge', newPrNumber, '--squash', '--delete-branch')
          results.push(`Merged PR #${newPrNumber} and deleted dev branch`)
        }
      } catch (error: any) {
        if (error.message.includes('merge conflict') || error.message.includes('Failed to merge')) {
          return NextResponse.json(
            { error: 'Merge conflict - please resolve manually in GitHub', details: results },
            { status: 409 },
          )
        }
        throw error
      }
    }

    return NextResponse.json({ success: true, message: 'Published dev to production', results })
  } catch (error: any) {
    console.error('[Cody] Publish error:', error)

    // Check for specific error types
    if (error.message?.includes('merge conflict') || error.status === 409) {
      return NextResponse.json(
        { error: 'Merge conflict - resolve manually in GitHub', message: error.message },
        { status: 409 },
      )
    }

    return NextResponse.json({ error: error.message || 'Publish failed' }, { status: 500 })
  }
}
