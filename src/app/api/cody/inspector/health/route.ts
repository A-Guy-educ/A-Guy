/**
 * @fileType api-endpoint
 * @domain cody
 * @pattern inspector-health-api
 * @ai-summary API route to fetch inspector health status and metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCodyAuth } from '@/ui/cody/auth'
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Get inspector state - reads from GitHub Actions variable in CI, or local file otherwise
 */
function getInspectorState(): Record<string, unknown> {
  // In CI, try to read from GH variable
  if (process.env.GITHUB_ACTIONS) {
    try {
      const output = execFileSync(
        'gh',
        ['variable', 'get', 'INSPECTOR_STATE', '--repo', process.env.GITHUB_REPOSITORY || ''],
        {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'ignore'],
        },
      ).trim()
      if (output) {
        return JSON.parse(output)
      }
    } catch {
      // Fall through to local file
    }
  }

  // Local file fallback
  const statePath = path.join(process.cwd(), '.inspector/state.json')
  if (fs.existsSync(statePath)) {
    try {
      return JSON.parse(fs.readFileSync(statePath, 'utf-8'))
    } catch {
      return {}
    }
  }

  return {}
}

/**
 * Get basic inspector health info
 */
async function GET(req: NextRequest) {
  // Auth check
  const authResult = await requireCodyAuth(req)
  if (authResult instanceof NextResponse) {
    return authResult
  }

  try {
    const state = getInspectorState()

    // Extract key metrics
    const cycleNumber = state['system:cycleNumber'] as number | undefined
    const evaluatedTasks = state['cody:evaluatedTasks'] as
      | Array<{
          taskId: string
          health: string
          healthDetail: string
        }>
      | undefined

    // Count by health status
    const healthCounts: Record<string, number> = {}
    if (evaluatedTasks) {
      for (const task of evaluatedTasks) {
        healthCounts[task.health] = (healthCounts[task.health] || 0) + 1
      }
    }

    // Get retry stats
    const retryAttempts = state['cody:retry-attempts'] as
      | Array<{
          fromStage: string
        }>
      | undefined
    const stageStats: Record<string, { attempts: number }> = {}
    if (retryAttempts) {
      for (const attempt of retryAttempts) {
        if (!stageStats[attempt.fromStage]) {
          stageStats[attempt.fromStage] = { attempts: 0 }
        }
        stageStats[attempt.fromStage].attempts++
      }
    }

    return NextResponse.json({
      cycleNumber,
      healthCounts,
      stageStats,
      lastUpdated: state['system:lastRun'] as string | undefined,
    })
  } catch (error) {
    console.error('Failed to get inspector health:', error)
    return NextResponse.json({ error: 'Failed to fetch inspector health' }, { status: 500 })
  }
}

export { GET }
