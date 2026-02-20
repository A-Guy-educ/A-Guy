import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { ChatRole } from '@/infra/llm/chat-message-role'
import type { Message } from '@/infra/llm/context-policy'
import { runSummaryMaintenance } from '@/infra/llm/maintenance'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { createContextHierarchy } from '../factories/context.factory'
import { createConversation } from '../factories/conversation.factory'
import { createTestUser } from '../factories/user.factory'

const generateSummary = vi.hoisted(() =>
  vi.fn(async (_existingSummary: string, messagesToSummarize: Message[]) => ({
    summary: `Summary for ${messagesToSummarize.length} messages`,
    summaryUntilTimestamp: new Date(messagesToSummarize[messagesToSummarize.length - 1].timestamp),
    tokensUsed: 20,
  })),
)

vi.mock('@/infra/llm/summary', () => ({
  generateSummary,
}))

let payload: Payload
let originalDatabaseUrl: string | undefined
let context: Awaited<ReturnType<typeof createContextHierarchy>>
let testUserId: string

const buildMessages = (count: number) => {
  const startTime = Date.now()
  return Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? ChatRole.User : ChatRole.Assistant,
    content: `Message ${index}`,
    timestamp: new Date(startTime + index * 1000).toISOString(),
  }))
}

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  const user = await createTestUser(payload)
  testUserId = user.id

  context = await createContextHierarchy(payload)
}, 120000)

beforeEach(async () => {
  generateSummary.mockClear()

  const conversations = await payload.find({
    collection: 'conversations',
    where: { user: { equals: testUserId } },
    limit: 1000,
    overrideAccess: true,
  })

  for (const conv of conversations.docs) {
    await payload.delete({
      collection: 'conversations',
      id: conv.id,
      overrideAccess: true,
    })
  }
})

afterAll(async () => {
  if (context?.cleanup) {
    await context.cleanup()
  }

  if (payload && testUserId) {
    await payload.delete({ collection: 'users', id: testUserId, overrideAccess: true })
  }

  // Close DB connection before stopping container
  if (payload?.db?.destroy) {
    await payload.db.destroy()
  }

  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
    delete process.env.DATABASE_URL
  }
}, 120000)

describe('summary maintenance thresholds', () => {
  it('does not run when messages are at threshold', async () => {
    const conversation = await createConversation(payload, {
      userId: testUserId,
      contextRef: { relationTo: 'exercises', value: context.exerciseId },
      messages: buildMessages(40),
    })

    const result = await runSummaryMaintenance(payload, conversation.id)
    expect(result.summaryUpdated).toBe(false)
    expect(result.messagesTrimmed).toBe(0)
    expect(generateSummary).not.toHaveBeenCalled()
  })

  it('runs when messages exceed 40 threshold and trims to 20', async () => {
    const conversation = await createConversation(payload, {
      userId: testUserId,
      contextRef: { relationTo: 'exercises', value: context.exerciseId },
      messages: buildMessages(41),
    })

    const result = await runSummaryMaintenance(payload, conversation.id)
    expect(result.summaryUpdated).toBe(true)
    expect(result.messagesTrimmed).toBe(21)
    expect(generateSummary).toHaveBeenCalledTimes(1)

    const updated = await payload.findByID({
      collection: 'conversations',
      id: conversation.id,
      overrideAccess: true,
    })

    expect(updated.summary).toContain('Summary for')
    expect(updated.messages?.length).toBe(20)
    expect(updated.summaryUntilTimestamp).toBeDefined()
  })

  it('runs when messages exceed 80 safety threshold', async () => {
    const conversation = await createConversation(payload, {
      userId: testUserId,
      contextRef: { relationTo: 'exercises', value: context.exerciseId },
      messages: buildMessages(81),
      summary: 'Existing summary',
    })

    const result = await runSummaryMaintenance(payload, conversation.id)
    expect(result.summaryUpdated).toBe(true)
    expect(generateSummary).toHaveBeenCalledWith('Existing summary', expect.any(Array))
  })
})
