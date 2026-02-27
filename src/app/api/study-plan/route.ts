/**
 * Study Plan API
 *
 * GET /api/study-plan?gradeLevel=<grade>&courseId=<courseId>
 * PUT /api/study-plan - Body: { action: 'generate' | 'markComplete', ... }
 */
import configPromise from '@payload-config'
import { format, startOfDay } from 'date-fns'
import { nanoid } from 'nanoid'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { z } from 'zod'

import type { StudyPlanSnapshot, TopicInput } from '@/lib/study-plan'
import { generateStudyPlan } from '@/lib/study-plan'
import { queryUserProgressByGrade } from '@/server/repos/queries/userProgress'

// Zod validation schemas
const TopicInputSchema = z.object({
  topicId: z.string().min(1),
  topicLabel: z.string().min(1),
  mastery: z.enum(['weak', 'medium', 'strong']),
})

const GenerateRequestSchema = z.object({
  action: z.literal('generate'),
  courseId: z.string().min(1),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  topics: z.array(TopicInputSchema).min(1),
  gradeLevel: z.string().min(1),
})

const ToggleStatusSchema = z.object({
  action: z.literal('toggleStatus'),
  dayId: z.string().min(1),
  courseId: z.string().min(1),
  gradeLevel: z.string().min(1),
})

const EditDaySchema = z.object({
  action: z.literal('editDay'),
  dayId: z.string().min(1),
  courseId: z.string().min(1),
  gradeLevel: z.string().min(1),
  userTopicIds: z.array(z.string()).optional(),
  userDurationMinutes: z.number().min(0).optional(),
  userStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
})

const RequestSchema = z.discriminatedUnion('action', [
  GenerateRequestSchema,
  ToggleStatusSchema,
  EditDaySchema,
])

type GenerateRequest = z.infer<typeof GenerateRequestSchema>
type ToggleStatusRequest = z.infer<typeof ToggleStatusSchema>
type EditDayRequest = z.infer<typeof EditDaySchema>
type RequestBody = z.infer<typeof RequestSchema>

/**
 * GET /api/study-plan?gradeLevel=<grade>&courseId=<courseId>
 * Fetch existing study plan for a course
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const gradeLevel = searchParams.get('gradeLevel')
    const courseId = searchParams.get('courseId')

    if (!gradeLevel || !courseId) {
      return NextResponse.json({ error: 'gradeLevel and courseId are required' }, { status: 400 })
    }

    // Find UserProgress doc
    const userProgress = await queryUserProgressByGrade({
      userId: user.id,
      gradeLevel,
    })

    if (!userProgress) {
      return NextResponse.json({ success: true, data: null })
    }

    // Find matching plan in studyPlans array
    const plan = userProgress.studyPlans?.find((p) => p.courseId === courseId) || null

    // Validate topicIds as defensive parse
    if (plan && plan.days) {
      const validatedPlan = {
        ...plan,
        days: plan.days.map((day) => ({
          ...day,
          topicIds: z.array(z.string()).parse(day.topicIds),
        })),
      }

      return NextResponse.json({ success: true, data: validatedPlan })
    }

    return NextResponse.json({ success: true, data: plan })
  } catch (error) {
    console.error('Error fetching study plan:', error)
    return NextResponse.json({ error: 'Failed to fetch study plan' }, { status: 500 })
  }
}

/**
 * PUT /api/study-plan
 * Generate or update study plan
 */
export async function PUT(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: RequestBody = await request.json()
    const parsedBody = RequestSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsedBody.error },
        { status: 400 },
      )
    }

    const { action } = parsedBody.data

    if (action === 'generate') {
      return handleGenerate(payload, user, parsedBody.data as GenerateRequest)
    } else if (action === 'toggleStatus') {
      return handleToggleStatus(payload, user, parsedBody.data as ToggleStatusRequest)
    } else if (action === 'editDay') {
      return handleEditDay(payload, user, parsedBody.data as EditDayRequest)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in study-plan API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleGenerate(
  payload: Awaited<ReturnType<typeof getPayload>>,
  user: { id: string },
  data: GenerateRequest,
) {
  const { courseId, examDate, topics, gradeLevel } = data

  // Get today in YYYY-MM-DD format
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd')

  // Find or create UserProgress doc
  const userProgress = await queryUserProgressByGrade({
    userId: user.id,
    gradeLevel,
  })

  // Generate plan input
  const generateInput = {
    today,
    examDate,
    topics: topics as TopicInput[],
    idGenerator: () => nanoid(),
  }

  // Regeneration always produces a fresh plan (clears completion + overrides)
  const days = generateStudyPlan(generateInput)

  // Validate all topicIds are string[]
  const validatedDays = days.map((day: any) => ({
    ...day,
    topicIds: z.array(z.string()).parse(day.topicIds),
  }))

  // Build the plan snapshot
  const generatedAt = format(startOfDay(new Date()), 'yyyy-MM-dd')
  const newPlan: StudyPlanSnapshot = {
    courseId,
    examDate,
    generatedAt,
    topics: topics as TopicInput[],
    days: validatedDays,
  }

  // Upsert the plan in the studyPlans array
  const studyPlans: StudyPlanSnapshot[] = userProgress?.studyPlans
    ? [...userProgress.studyPlans]
    : []

  // Find existing index
  const existingIndex = studyPlans.findIndex((p) => p.courseId === courseId)
  if (existingIndex >= 0) {
    studyPlans[existingIndex] = newPlan
  } else {
    studyPlans.push(newPlan)
  }

  // Create or update UserProgress
  if (userProgress) {
    // Update existing
    await payload.update({
      collection: 'user-progress',
      id: userProgress.id,
      data: { studyPlans },
      overrideAccess: false,
      user,
    } as any)
  } else {
    // Create new
    await payload.create({
      collection: 'user-progress',
      data: {
        user: user.id,
        gradeLevel,
        studyPlans,
      },
    } as any)
  }

  return NextResponse.json({ success: true, data: newPlan })
}

async function handleToggleStatus(
  payload: Awaited<ReturnType<typeof getPayload>>,
  user: { id: string },
  data: ToggleStatusRequest,
) {
  const { dayId, courseId, gradeLevel } = data

  // Find UserProgress doc
  const userProgress = await queryUserProgressByGrade({
    userId: user.id,
    gradeLevel,
  })

  if (!userProgress?.studyPlans) {
    return NextResponse.json({ error: 'Study plan not found' }, { status: 404 })
  }

  const planIndex = userProgress.studyPlans.findIndex((p) => p.courseId === courseId)
  if (planIndex < 0) {
    return NextResponse.json({ error: 'Study plan not found' }, { status: 404 })
  }

  const plan = userProgress.studyPlans[planIndex]

  // Toggle: if completed → planned, else → completed
  const days = plan.days.map((day) => {
    if (day.dayId === dayId) {
      return {
        ...day,
        status: day.status === 'completed' ? ('planned' as const) : ('completed' as const),
      }
    }
    return day
  })

  const updatedPlan: StudyPlanSnapshot = { ...plan, days }
  const studyPlans = [...userProgress.studyPlans]
  studyPlans[planIndex] = updatedPlan

  await payload.update({
    collection: 'user-progress',
    id: userProgress.id,
    data: { studyPlans },
    overrideAccess: false,
    user,
  } as any)

  return NextResponse.json({ success: true, data: updatedPlan })
}

async function handleEditDay(
  payload: Awaited<ReturnType<typeof getPayload>>,
  user: { id: string },
  data: EditDayRequest,
) {
  const { dayId, courseId, gradeLevel, userTopicIds, userDurationMinutes, userStartTime } = data

  const userProgress = await queryUserProgressByGrade({ userId: user.id, gradeLevel })
  if (!userProgress?.studyPlans) {
    return NextResponse.json({ error: 'Study plan not found' }, { status: 404 })
  }

  const planIndex = userProgress.studyPlans.findIndex((p) => p.courseId === courseId)
  if (planIndex < 0) {
    return NextResponse.json({ error: 'Study plan not found' }, { status: 404 })
  }

  const plan = userProgress.studyPlans[planIndex]
  const days = plan.days.map((day) => {
    if (day.dayId === dayId) {
      return {
        ...day,
        ...(userTopicIds !== undefined && { userTopicIds }),
        ...(userDurationMinutes !== undefined && { userDurationMinutes }),
        ...(userStartTime !== undefined && { userStartTime }),
      }
    }
    return day
  })

  const updatedPlan: StudyPlanSnapshot = { ...plan, days }
  const studyPlans = [...userProgress.studyPlans]
  studyPlans[planIndex] = updatedPlan

  await payload.update({
    collection: 'user-progress',
    id: userProgress.id,
    data: { studyPlans },
    overrideAccess: false,
    user,
  } as any)

  return NextResponse.json({ success: true, data: updatedPlan })
}
