import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

/**
 * Returns the app version from package.json and build date
 * This endpoint is used by the admin footer to display the correct version
 */
export async function GET(): Promise<NextResponse> {
  try {
    const packageJson = await readFile(join(process.cwd(), 'package.json'), 'utf-8')
    const { version } = JSON.parse(packageJson)
    const builtAt = new Date().toISOString().split('T')[0]
    return NextResponse.json(
      { version: version || 'dev', builtAt },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch {
    return NextResponse.json(
      { version: 'dev', builtAt: 'unknown' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }
}
