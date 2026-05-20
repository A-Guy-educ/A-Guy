/**
 * GET /api/exercise-generations/:id/record
 *
 * Returns the ExerciseGenerations record with related lesson and exercise data.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })

    const record = await payload.findByID({
      collection: 'exercise-generations',
      id,
      depth: 1,
      overrideAccess: true,
    })

    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Fetch lesson title if available
    let lessonTitle: string | undefined
    try {
      const lessonId =
        typeof record.lesson === 'string' ? record.lesson : (record.lesson as { id?: string })?.id
      if (lessonId) {
        const lesson = await payload.findByID({
          collection: 'lessons',
          id: lessonId,
          depth: 0,
          select: { title: true },
          overrideAccess: true,
        })
        lessonTitle = (lesson as { title?: string })?.title
      }
    } catch {
      // Ignore lesson fetch errors
    }

    // Resolve lesson to object with title
    const resolvedLesson = lessonTitle
      ? {
          id:
            typeof record.lesson === 'string'
              ? record.lesson
              : (record.lesson as { id: string })?.id,
          title: lessonTitle,
        }
      : record.lesson

    return NextResponse.json({
      data: {
        ...record,
        lesson: resolvedLesson,
      },
    })
  } catch (error) {
    console.error('Error fetching exercise-generation record:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
