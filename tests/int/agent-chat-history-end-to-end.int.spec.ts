/**
 * Reproduces issue #1403: Student chat ignores conversation history.
 *
 * Strategy: do NOT mock streamChatWithExerciseHelper or the Genkit adapter.
 * Mock at the Genkit-instance level so we capture exactly what reaches
 * `ai.generateStream`. Run two sequential agentChatStream calls in the same
 * lesson context and verify turn 2 sees turn 1's user+assistant messages.
 *
 * On the pre-fix code (PR #1404 not applied) the adapter passed `prompt: <string>`
 * with messages concatenated — turn 2 had no structured history. This test fails
 * on that build. On the post-fix code it passes IFF persistence is also working.
 *
 * If this test passes locally but the production preview still ignores history,
 * the prod failure is environmental (cookies, conversation lookup), not adapter.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { agentChatStream } from '@/server/payload/endpoints/agent/chat-stream'
import config from '@payload-config'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

// ---- Capture what the adapter passes to Genkit ----
type CapturedGenerateStreamCall = {
  model: unknown
  messages?: Array<{ role: string; content: Array<{ text: string }> }>
  prompt?: unknown
  config?: unknown
}
const generateStreamCalls: CapturedGenerateStreamCall[] = []
const generateCalls: CapturedGenerateStreamCall[] = []

function makeFakeStream(text: string) {
  const chunks = [text]
  return {
    stream: (async function* () {
      for (const c of chunks) yield { text: c }
    })(),
    response: Promise.resolve({ text }),
  }
}

// Mock getGenkitInstance: the adapter still runs (incl. buildGenkitMessages),
// we just intercept the underlying ai.generate / ai.generateStream calls.
let turn = 0
const turnReplies = ['Reply to turn 1: noted the number 42.', 'Reply to turn 2: it was 42.']

vi.mock('@/infra/llm/genkit/genkit-instance', () => ({
  getGenkitInstance: vi.fn(async () => ({
    generate: vi.fn(async (input: CapturedGenerateStreamCall) => {
      generateCalls.push(input)
      return { text: turnReplies[Math.min(turn, turnReplies.length - 1)], raw: {} }
    }),
    generateStream: vi.fn(async (input: CapturedGenerateStreamCall) => {
      generateStreamCalls.push(input)
      const reply = turnReplies[Math.min(turn, turnReplies.length - 1)]
      return makeFakeStream(reply)
    }),
  })),
}))

// Resolve to a stable model name without hitting tenant config
vi.mock('@/infra/llm/genkit/config-resolver', () => ({
  resolveGenkitConfig: vi.fn(async () => ({
    model: 'fake-model',
    temperature: 0.7,
  })),
}))

// Don't talk to vector / memory / maintenance subsystems
vi.mock('@/infra/llm/vector-index-check', () => ({
  isVectorIndexAvailable: vi.fn(async () => false),
}))
vi.mock('@/infra/llm/vector-search', () => ({
  retrieveMemoryItems: vi.fn(async () => ({
    items: [],
    latencyMs: 0,
    localCount: 0,
    contextCount: 0,
    globalCount: 0,
    parentCount: 0,
    hierarchyKeys: [],
  })),
}))
vi.mock('@/infra/llm/memory-extraction', () => ({
  extractMemoryCandidates: vi.fn(async () => []),
  persistMemoryItems: vi.fn(async () => 0),
}))
vi.mock('@/infra/llm/maintenance', () => ({
  runSummaryMaintenance: vi.fn(async () => ({ summaryUpdated: false, messagesTrimmed: 0 })),
}))

// Force authenticated path; suppress guest/rate concerns
vi.mock('@/server/services/guest-session', () => ({
  getGuestSessionCookie: vi.fn(() => null),
  getGuestSessionByToken: vi.fn(async () => null),
  createGuestSession: vi.fn(async () => ({ session: null, token: '' })),
  buildGuestSessionCookieHeader: vi.fn(async () => ''),
  checkAndIncrementGuestMessageCount: vi.fn(async () => ({
    allowed: true,
    remaining: 5,
    current: 0,
    max: 5,
  })),
  hashIP: vi.fn(() => ''),
  hashUserAgent: vi.fn(() => ''),
  GUEST_SESSION_COOKIE_NAME: 'guest_session',
}))
vi.mock('@/server/services/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 10,
    resetAt: Date.now() + 60000,
  })),
}))

let payload: Payload
let testUserId: string
let testLessonId: string
let createdConvIds: string[] = []

async function drainSse(response: Response): Promise<{ text: string; conversationId?: string }> {
  expect(response.status).toBe(200)
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let raw = ''
  let done = false
  while (!done) {
    const { value, done: d } = await reader.read()
    raw += decoder.decode(value || new Uint8Array(), { stream: true })
    done = d
  }
  let text = ''
  let conversationId: string | undefined
  for (const block of raw.split('\n\n')) {
    const lines = block.split('\n')
    const event = lines
      .find((l) => l.startsWith('event: '))
      ?.slice(7)
      .trim()
    const dataLine = lines.find((l) => l.startsWith('data: '))?.slice(6)
    if (!event || !dataLine) continue
    try {
      const data = JSON.parse(dataLine)
      if (event === 'chunk' && typeof data.text === 'string') text += data.text
      if (event === 'done' && data.conversationId) conversationId = data.conversationId
    } catch {
      // skip
    }
  }
  return { text, conversationId }
}

function buildReq(
  message: string,
  lessonId: string,
): PayloadRequest & { json: () => Promise<unknown> } {
  return {
    payload,
    headers: new Headers(),
    user: { id: testUserId } as PayloadRequest['user'],
    json: async () => ({ message, acknowledgment: 'ack', lessonId }),
  } as unknown as PayloadRequest & { json: () => Promise<unknown> }
}

describe.skipIf(!hasDatabaseUrl)(
  'agentChatStream — multi-turn history reaches the model (#1403)',
  () => {
    beforeAll(async () => {
      payload = await getPayload({ config })

      const user = await payload.create({
        collection: 'users',
        data: {
          email: `chat-history-${Date.now()}@example.com`,
          password: 'test-password-123',
          roles: ['user'],
        },
        draft: true,
      } as any)
      testUserId = user.id

      const category = await payload.create({
        collection: 'categories',
        data: { title: 'History Test Cat', slug: `hist-cat-${Date.now()}` },
        user: { id: testUserId },
      } as any)

      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: 'HST',
          title: 'History Test Course',
          slug: `hist-course-${Date.now()}`,
          categories: [category.id],
          order: 1,
          status: 'published',
          isActive: true,
        },
        draft: true,
      } as any)

      const chapter = await payload.create({
        collection: 'chapters',
        data: {
          chapterLabel: '1',
          title: 'History Test Chapter',
          slug: `hist-chap-${Date.now()}`,
          course: course.id,
          order: 1,
          status: 'published',
          isActive: true,
        },
        draft: true,
      } as any)

      const lesson = await payload.create({
        collection: 'lessons',
        data: {
          title: 'History Test Lesson',
          slug: `hist-lesson-${Date.now()}`,
          chapter: chapter.id,
          order: 1,
          status: 'published',
        },
        draft: true,
      } as any)
      testLessonId = lesson.id
    }, 60000)

    afterAll(async () => {
      if (!payload) return
      try {
        for (const id of createdConvIds) {
          await payload
            .delete({ collection: 'conversations', id, overrideAccess: true } as any)
            .catch(() => {})
        }
        await payload
          .delete({ collection: 'users', id: testUserId, overrideAccess: true } as any)
          .catch(() => {})
      } finally {
        if (payload.db?.destroy) await payload.db.destroy()
      }
    }, 60000)

    it('turn 2 receives turn 1 as structured history (not concatenated string)', async () => {
      // Turn 1
      turn = 0
      generateStreamCalls.length = 0
      generateCalls.length = 0
      const r1 = await agentChatStream(buildReq('Remember the number 42.', testLessonId))
      const out1 = await drainSse(r1)
      if (out1.conversationId) createdConvIds.push(out1.conversationId)
      expect(out1.text).toContain('42')
      expect(generateStreamCalls).toHaveLength(1)

      // Adapter MUST send structured messages, never a `prompt` string.
      const call1 = generateStreamCalls[0]
      expect(call1.prompt).toBeUndefined()
      expect(Array.isArray(call1.messages)).toBe(true)
      // Turn 1 has only system + the new user question
      const t1Roles = call1.messages!.map((m) => m.role)
      expect(t1Roles[0]).toBe('system')
      const t1Last = call1.messages![call1.messages!.length - 1]
      expect(t1Last.role).toBe('user')
      expect(t1Last.content[0].text).toContain('Remember the number 42')
      // No assistant turns yet
      expect(t1Roles.filter((r) => r === 'model')).toHaveLength(0)

      // Conversation should now contain user + assistant
      const convId = out1.conversationId!
      expect(convId).toBeTruthy()
      const conv1 = (await payload.findByID({
        collection: 'conversations',
        id: convId,
        overrideAccess: true,
      })) as any
      const persisted1 = (conv1.messages || []) as Array<{ role: string; content: string }>
      expect(persisted1.map((m) => m.role)).toEqual(['user', 'assistant'])
      expect(persisted1[0].content).toContain('Remember the number 42')
      expect(persisted1[1].content).toContain('42')

      // Turn 2 — same lesson context, same user
      turn = 1
      const r2 = await agentChatStream(buildReq('What number did I just tell you?', testLessonId))
      const out2 = await drainSse(r2)
      expect(out2.conversationId).toBe(convId) // same conversation
      expect(generateStreamCalls).toHaveLength(2)

      const call2 = generateStreamCalls[1]
      expect(call2.prompt).toBeUndefined()
      expect(Array.isArray(call2.messages)).toBe(true)
      const msgs2 = call2.messages!
      const flat = msgs2.map((m) => `${m.role}:${m.content[0]?.text ?? ''}`)

      // Order: system, user(t1), model(t1 reply), user(t2)
      expect(msgs2[0].role).toBe('system')
      const turn1User = msgs2.find(
        (m, i) =>
          i > 0 && m.role === 'user' && m.content[0]?.text.includes('Remember the number 42'),
      )
      expect(
        turn1User,
        `expected turn-1 user message in turn-2 history; got: ${flat.join(' | ')}`,
      ).toBeTruthy()
      const turn1Assistant = msgs2.find(
        (m) => m.role === 'model' && m.content[0]?.text.includes('42'),
      )
      expect(
        turn1Assistant,
        `expected turn-1 assistant ('model') message in turn-2 history; got: ${flat.join(' | ')}`,
      ).toBeTruthy()
      const last = msgs2[msgs2.length - 1]
      expect(last.role).toBe('user')
      expect(last.content[0].text).toContain('What number did I just tell you?')

      // Conversation now has 4 messages
      const conv2 = (await payload.findByID({
        collection: 'conversations',
        id: convId,
        overrideAccess: true,
      })) as any
      const persisted2 = (conv2.messages || []) as Array<{ role: string }>
      expect(persisted2.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    }, 90000)
  },
)
