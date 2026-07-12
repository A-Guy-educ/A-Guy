/**
 * POST /api/course-selections
 *
 * Public fire-and-forget endpoint that logs a course selection. Used by the
 * web app (start page, homepage greeting, course card) so admins can report
 * on course popularity.
 *
 * Wrapper exists because Payload 3.x custom endpoints do not auto-create
 * Next routes — see src/server/payload/endpoints/course-selections/log-selection.ts
 * for the actual handler. Mirrors the pattern in
 * src/app/api/agent/message/persist/route.ts.
 */
import { logCourseSelection } from '@/server/payload/endpoints/course-selections/log-selection'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  return logCourseSelection(request)
}
