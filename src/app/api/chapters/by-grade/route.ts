import '@/infra/config/server-init'

import { NextRequest, NextResponse } from 'next/server'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'
import { fetchStudyData } from '@/server/repos/queries/study-data'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const grade = searchParams.get('grade')
  const localeParam = searchParams.get('locale')

  if (!grade) {
    return NextResponse.json({ error: 'Grade parameter is required' }, { status: 400 })
  }

  const locale = localeParam && isValidContentLocale(localeParam) ? localeParam : undefined

  try {
    const data = await fetchStudyData({ gradeLevel: grade, locale })

    if (!data) {
      return NextResponse.json({ chapters: [] })
    }

    const response = NextResponse.json(data)
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    return response
  } catch (error) {
    const { captureAndRespond } = await import('@/server/api/capture-and-respond')
    return captureAndRespond(error, { route: '/api/chapters/by-grade' })
  }
}
