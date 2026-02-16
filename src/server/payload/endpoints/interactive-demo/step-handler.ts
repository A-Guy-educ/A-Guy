/**
 * Step Handler for Interactive Demo
 *
 * Core state machine handling start, answer, next, and reset actions.
 * Implements idempotency, persistence, and history tracking.
 */

import type { LessonSession } from '@/payload-types'
import { apiError } from '@/server/api/responses'
import { getInteractiveDemoConfig } from '@/server/config/interactive-demo-config'
import type { Payload, User } from 'payload'
import { z } from 'zod'
import type { ScriptBlock } from '../../collections/Lessons/interactive-demo-schema'
import { LessonScriptSchema } from '../../collections/Lessons/interactive-demo-schema'
import { buildHistoryEntry } from './build-history-entry'
import { evaluateMcq, evaluateOpen, getMcqFeedback, getOpenFeedback } from './evaluate'
import { sanitizeBlockForClient } from './sanitize-block'
import { StepRequestSchema, StepResponse } from './schemas'

/**
 * Get the initial phase based on the first block type
 */
function getInitialPhase(blockType: string): 'awaiting_input' | 'awaiting_continue' {
  if (blockType === 'mcq' || blockType === 'open') {
    return 'awaiting_input'
  }
  return 'awaiting_continue'
}

/**
 * Check if duplicate key error
 */
function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>
    if (e.code === 11000) return true
    if (e.cause && typeof e.cause === 'object') {
      const cause = e.cause as Record<string, unknown>
      if (cause.code === 11000) return true
    }
  }
  return false
}

/**
 * Check if action was already processed (idempotency)
 */
function findProcessedAction(
  session: Pick<LessonSession, 'processedActions'>,
  clientActionId: string,
): NonNullable<LessonSession['processedActions']>[number] | null {
  if (!session.processedActions) return null
  return session.processedActions.find((a) => a.actionId === clientActionId) || null
}

/**
 * Build step response
 */
function buildStepResponse(
  sessionId: string,
  status: 'active' | 'completed',
  currentBlockIndex: number,
  currentPhase: 'awaiting_input' | 'awaiting_continue',
  block: ReturnType<typeof sanitizeBlockForClient> | null,
  skillScore: number,
  schemaVersion: number,
  isCorrect?: boolean,
  feedback?: string,
  remediation?: string,
): StepResponse {
  return {
    sessionId,
    status,
    currentBlockIndex,
    currentPhase,
    block,
    skillScore,
    schemaVersion,
    ...(isCorrect !== undefined && { isCorrect }),
    ...(feedback !== undefined && { feedback }),
    ...(remediation !== undefined && { remediation }),
  }
}

/**
 * Main step handler function
 */
export async function handleStep(
  payload: Payload,
  user: User,
  request: z.infer<typeof StepRequestSchema>,
): Promise<StepResponse> {
  const { lessonId, sessionId, action, answer, selectedOptionIds, clientActionId } = request

  // Load lesson
  const lesson = await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 0,
    overrideAccess: true,
  })

  if (!lesson) {
    throw apiError('LESSON_NOT_FOUND', 'Lesson not found', 404)
  }

  if (lesson.type !== 'interactive_demo') {
    throw apiError('LESSON_NOT_INTERACTIVE', 'Lesson is not an interactive demo', 400)
  }

  // Feature flag gate
  const config = await getInteractiveDemoConfig()
  if (!config.enabled) {
    throw apiError('FEATURE_DISABLED', 'Interactive demo feature is disabled', 403)
  }

  // Parse lesson script
  const script = lesson.lessonScript ? LessonScriptSchema.parse(lesson.lessonScript) : null

  if (!script) {
    throw apiError('VALIDATION_ERROR', 'Lesson has no script', 400)
  }

  // Handle different actions
  switch (action) {
    case 'start':
      return handleStart(payload, user, lessonId, script)

    case 'answer':
      if (!sessionId) {
        throw apiError('SESSION_NOT_FOUND', 'Session ID required', 400)
      }
      return handleAnswer(payload, sessionId, script, answer, selectedOptionIds, clientActionId)

    case 'next':
      if (!sessionId) {
        throw apiError('SESSION_NOT_FOUND', 'Session ID required', 400)
      }
      return handleNext(payload, sessionId, script, clientActionId)

    case 'reset':
      return handleReset(payload, user, lessonId, script)

    default:
      throw apiError('VALIDATION_ERROR', 'Invalid action', 400)
  }
}

/**
 * Handle start action
 */
async function handleStart(
  payload: Payload,
  user: User,
  lessonId: string,
  script: { blocks: ScriptBlock[] },
): Promise<StepResponse> {
  const userId = String(user.id)

  // Look for existing active session
  const existingSessions = await payload.find({
    collection: 'lesson-sessions',
    where: {
      user: { equals: userId },
      lesson: { equals: lessonId },
      status: { equals: 'active' },
    },
    limit: 1,
    overrideAccess: true,
  })

  if (existingSessions.docs.length > 0) {
    const session = existingSessions.docs[0]
    const currentBlock = script.blocks[session.currentBlockIndex]
    return buildStepResponse(
      session.id,
      session.status,
      session.currentBlockIndex,
      session.currentPhase,
      currentBlock ? sanitizeBlockForClient(currentBlock) : null,
      session.skillScore,
      session.schemaVersion,
    )
  }

  // Create new session
  const firstBlock = script.blocks[0]
  const initialPhase = getInitialPhase(firstBlock.type)
  const now = new Date()

  try {
    const newSession = await payload.create({
      collection: 'lesson-sessions',
      // Tenant auto-populated by beforeValidate hook on tenantField
      data: {
        user: userId,
        lesson: lessonId,
        status: 'active' as const,
        currentBlockIndex: 0,
        currentPhase: initialPhase,
        skillScore: 0,
        history: [],
        startedAt: now.toISOString(),
        remediationCounts: { perBlock: {}, total: 0 },
        processedActions: [],
        version: 1,
        schemaVersion: 1,
      } as unknown as Omit<LessonSession, 'id' | 'updatedAt' | 'createdAt'>,
      draft: false,
      overrideAccess: true,
    })

    return buildStepResponse(
      newSession.id as string,
      'active',
      0,
      initialPhase,
      sanitizeBlockForClient(firstBlock),
      0,
      1,
    )
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      // Fetch concurrent session
      const concurrentSessions = await payload.find({
        collection: 'lesson-sessions',
        where: {
          user: { equals: userId },
          lesson: { equals: lessonId },
          status: { equals: 'active' },
        },
        limit: 1,
        overrideAccess: true,
      })

      if (concurrentSessions.docs.length > 0) {
        const session = concurrentSessions.docs[0]
        const currentBlock = script.blocks[session.currentBlockIndex]
        return buildStepResponse(
          session.id,
          session.status,
          session.currentBlockIndex,
          session.currentPhase,
          currentBlock ? sanitizeBlockForClient(currentBlock) : null,
          session.skillScore,
          session.schemaVersion,
        )
      }
    }
    throw err
  }
}

/**
 * Handle answer action
 */
async function handleAnswer(
  payload: Payload,
  sessionId: string,
  script: { blocks: ScriptBlock[] },
  answer: string | undefined,
  selectedOptionIds: string[] | undefined,
  clientActionId: string,
): Promise<StepResponse> {
  const session = await payload.findByID({
    collection: 'lesson-sessions',
    id: sessionId,
    depth: 0,
    overrideAccess: true,
  })

  if (!session) {
    throw apiError('SESSION_NOT_FOUND', 'Session not found', 404)
  }

  // Check idempotency
  const cachedAction = findProcessedAction(session, clientActionId)
  if (cachedAction) {
    // Return cached response verbatim
    return cachedAction.response as unknown as StepResponse
  }

  if (session.currentPhase !== 'awaiting_input') {
    throw apiError('INVALID_STATE_TRANSITION', 'Not awaiting input', 400)
  }

  const currentBlock = script.blocks[session.currentBlockIndex]
  if (!currentBlock) {
    throw apiError('VALIDATION_ERROR', 'Invalid block index', 400)
  }

  // Evaluate answer
  let isCorrect = false
  let feedback = ''
  let userAnswerContent = ''

  if (currentBlock.type === 'mcq' && selectedOptionIds?.length === 1) {
    const selectedId = selectedOptionIds[0]
    const correctId = currentBlock.correctOptionIds[0]
    isCorrect = evaluateMcq(selectedId, correctId)
    feedback = getMcqFeedback(isCorrect)
    userAnswerContent = selectedId
  } else if (currentBlock.type === 'open' && answer) {
    isCorrect = evaluateOpen(answer, currentBlock.acceptedAnswers)
    feedback = getOpenFeedback(isCorrect, currentBlock.answerFormatHint)
    userAnswerContent = answer
  } else {
    throw apiError('VALIDATION_ERROR', 'Invalid answer format', 400)
  }

  const newSkillScore = session.skillScore + (isCorrect ? 1 : 0)
  const now = new Date()
  const newHistory = [
    ...(session.history || []),
    buildHistoryEntry({
      role: 'user',
      blockType: currentBlock.type as 'mcq' | 'open',
      content: userAnswerContent,
      metadata: {
        isCorrect,
        selectedOptionIds,
      },
    }),
    buildHistoryEntry({
      role: 'assistant',
      blockType: currentBlock.type as 'mcq' | 'open',
      content: feedback,
      metadata: { isCorrect },
    }),
  ]

  // Persist state
  const updatedSession = await payload.update({
    collection: 'lesson-sessions',
    id: sessionId,
    data: {
      skillScore: newSkillScore,
      currentPhase: 'awaiting_continue' as const,
      history: newHistory as NonNullable<LessonSession['history']>,
      processedActions: [
        ...(session.processedActions || []),
        {
          actionId: clientActionId,
          createdAt: now.toISOString(),
          response: buildStepResponse(
            sessionId,
            session.status,
            session.currentBlockIndex,
            'awaiting_continue',
            sanitizeBlockForClient(currentBlock),
            newSkillScore,
            session.schemaVersion,
            isCorrect,
            feedback,
          ),
        },
      ] as NonNullable<LessonSession['processedActions']>,
      version: (session.version || 0) + 1,
    },
    overrideAccess: true,
  })

  return buildStepResponse(
    sessionId,
    updatedSession.status,
    updatedSession.currentBlockIndex,
    'awaiting_continue',
    sanitizeBlockForClient(currentBlock),
    updatedSession.skillScore,
    updatedSession.schemaVersion,
    isCorrect,
    feedback,
  )
}

/**
 * Handle next action
 */
async function handleNext(
  payload: Payload,
  sessionId: string,
  script: { blocks: ScriptBlock[] },
  clientActionId: string,
): Promise<StepResponse> {
  const session = await payload.findByID({
    collection: 'lesson-sessions',
    id: sessionId,
    depth: 0,
    overrideAccess: true,
  })

  if (!session) {
    throw apiError('SESSION_NOT_FOUND', 'Session not found', 404)
  }

  // Check idempotency
  const cachedAction = findProcessedAction(session, clientActionId)
  if (cachedAction) {
    // Return cached response verbatim
    return cachedAction.response as unknown as StepResponse
  }

  if (session.currentPhase !== 'awaiting_continue') {
    throw apiError('INVALID_STATE_TRANSITION', 'Not ready for next', 400)
  }

  const nextIndex = session.currentBlockIndex + 1
  let newStatus: 'active' | 'completed' = 'active'
  let newPhase: 'awaiting_input' | 'awaiting_continue' = 'awaiting_continue'
  let completedAt: string | undefined

  if (nextIndex >= script.blocks.length) {
    newStatus = 'completed'
    completedAt = new Date().toISOString()
  } else {
    const nextBlock = script.blocks[nextIndex]
    newPhase = getInitialPhase(nextBlock.type)
  }

  const now = new Date()
  const newHistory = [
    ...(session.history || []),
    buildHistoryEntry({
      role: 'system',
      blockType: 'content',
      content: `Proceeded to block ${nextIndex}`,
      metadata: { blockIndex: nextIndex },
    }),
  ]

  // Build update data
  const updateData: Partial<Omit<LessonSession, 'id' | 'updatedAt' | 'createdAt'>> = {
    currentBlockIndex: nextIndex,
    currentPhase: newPhase,
    status: newStatus,
    history: newHistory as NonNullable<LessonSession['history']>,
    processedActions: [
      ...(session.processedActions || []),
      {
        actionId: clientActionId,
        createdAt: now.toISOString(),
        response: buildStepResponse(
          sessionId,
          newStatus,
          nextIndex,
          newPhase,
          newStatus === 'completed' ? null : sanitizeBlockForClient(script.blocks[nextIndex]),
          session.skillScore,
          session.schemaVersion,
        ),
      },
    ] as NonNullable<LessonSession['processedActions']>,
    version: (session.version || 0) + 1,
  }

  if (completedAt) {
    updateData.completedAt = completedAt
  }

  // Persist state
  const updatedSession = await payload.update({
    collection: 'lesson-sessions',
    id: sessionId,
    data: updateData,
    overrideAccess: true,
  })

  return buildStepResponse(
    sessionId,
    updatedSession.status,
    updatedSession.currentBlockIndex,
    updatedSession.currentPhase,
    newStatus === 'completed' ? null : sanitizeBlockForClient(script.blocks[nextIndex]),
    updatedSession.skillScore,
    updatedSession.schemaVersion,
  )
}

/**
 * Handle reset action
 */
async function handleReset(
  payload: Payload,
  user: User,
  lessonId: string,
  script: { blocks: ScriptBlock[] },
): Promise<StepResponse> {
  const userId = String(user.id)

  // Best-effort complete existing session
  const existingSessions = await payload.find({
    collection: 'lesson-sessions',
    where: {
      user: { equals: userId },
      lesson: { equals: lessonId },
      status: { equals: 'active' },
    },
    limit: 1,
    overrideAccess: true,
  })

  if (existingSessions.docs.length > 0) {
    try {
      await payload.update({
        collection: 'lesson-sessions',
        id: existingSessions.docs[0].id as string,
        data: { status: 'completed', completedAt: new Date().toISOString() },
        overrideAccess: true,
      })
    } catch {
      // Best-effort
    }
  }

  // Create new session
  const firstBlock = script.blocks[0]
  const initialPhase = getInitialPhase(firstBlock.type)
  const now = new Date()

  try {
    await payload.create({
      collection: 'lesson-sessions',
      // Tenant auto-populated by beforeValidate hook on tenantField
      data: {
        user: userId,
        lesson: lessonId,
        status: 'active' as const,
        currentBlockIndex: 0,
        currentPhase: initialPhase,
        skillScore: 0,
        history: [],
        startedAt: now.toISOString(),
        remediationCounts: { perBlock: {}, total: 0 },
        processedActions: [],
        version: 1,
        schemaVersion: 1,
      } as unknown as Omit<LessonSession, 'id' | 'updatedAt' | 'createdAt'>,
      draft: false,
      overrideAccess: true,
    })
  } catch (err) {
    if (!isDuplicateKeyError(err)) {
      throw err
    }
  }

  // Fetch active session
  const activeSessions = await payload.find({
    collection: 'lesson-sessions',
    where: {
      user: { equals: userId },
      lesson: { equals: lessonId },
      status: { equals: 'active' },
    },
    limit: 1,
    overrideAccess: true,
  })

  if (activeSessions.docs.length === 0) {
    throw apiError('SESSION_NOT_FOUND', 'Failed to create session', 500)
  }

  return buildStepResponse(
    activeSessions.docs[0].id as string,
    'active',
    0,
    initialPhase,
    sanitizeBlockForClient(firstBlock),
    0,
    1,
  )
}
