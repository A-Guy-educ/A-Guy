import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

interface HealthResponse {
  ok: boolean
  gitSha: string
  payloadVersion: string
  projectVersion: string
  timestamp: string
}

function getGitSha(): string {
  if (process.env.GIT_SHA) {
    return process.env.GIT_SHA
  }
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

function getPayloadVersion(): string {
  try {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    return packageJson.dependencies?.payload || packageJson.devDependencies?.payload || 'unknown'
  } catch {
    return 'unknown'
  }
}

function getProjectVersion(): string {
  try {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    return packageJson.version || 'unknown'
  } catch {
    return 'unknown'
  }
}

export async function GET(): Promise<
  NextResponse<HealthResponse> | NextResponse<{ error: string }>
> {
  try {
    const gitSha = getGitSha()
    const payloadVersion = getPayloadVersion()
    const projectVersion = getProjectVersion()
    const timestamp = new Date().toISOString()

    const response: HealthResponse = {
      ok: true,
      gitSha,
      payloadVersion,
      projectVersion,
      timestamp,
    }

    return NextResponse.json(response, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 })
  }
}
