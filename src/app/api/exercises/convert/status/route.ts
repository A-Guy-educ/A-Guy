import { TASK_SLUG } from '@/server/config/constants'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Auth: Admin Session OR Vercel Cron
    const { user } = await payload.auth({ headers: request.headers })
    const authHeader = request.headers.get('authorization')

    const isAdmin = user?.role === 'admin' || authHeader === `Bearer ${process.env.CRON_SECRET}`
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const lessonId = searchParams.get('lessonId')
    const mediaId = searchParams.get('mediaId')
    const limit = parseInt(searchParams.get('limit') || '1')

    if (!lessonId || !mediaId) {
      return NextResponse.json({ error: 'lessonId and mediaId are required' }, { status: 400 })
    }

    // Use MongoDB native query via Payload's db adapter
    // Payload's query API doesn't support dot notation for JSON fields (input.ctx.*)
    const db = payload.db as any
    const collection = db.connection.collection('payload-jobs')

    const docs = await collection
      .find({
        taskSlug: TASK_SLUG,
        'input.ctx.lessonId': lessonId,
        'input.ctx.sourceDocId': mediaId,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    // Compute status from raw MongoDB fields
    const docsWithStatus = docs.map((doc) => ({
      ...doc,
      id: doc._id?.toString() || doc._id, // Map MongoDB _id to id
      status: doc.processing
        ? 'running'
        : doc.hasError
          ? 'failed'
          : doc.completedAt
            ? 'completed'
            : 'queued',
    }))

    return NextResponse.json({ docs: docsWithStatus })
  } catch (error: any) {
    console.error('[JobStatus] Error:', error)
    // Return empty docs on error instead of 500
    return NextResponse.json({ docs: [] })
  }
}
