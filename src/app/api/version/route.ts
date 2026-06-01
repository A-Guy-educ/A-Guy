import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

/**
 * Returns the app version from package.json
 * This endpoint is used by the admin footer to display the correct version
 */
export async function GET(): Promise<NextResponse> {
  try {
    const packageJson = await readFile(join(process.cwd(), 'package.json'), 'utf-8')
    const { version } = JSON.parse(packageJson)
    return NextResponse.json(
      { version: version || 'dev' },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch {
    return NextResponse.json(
      { version: 'dev' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }
}
