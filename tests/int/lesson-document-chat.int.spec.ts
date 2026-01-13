/**
 * Integration tests for lesson document chat integration
 *
 * Tests automatic document extraction and memory creation for lesson conversations
 *
 * Mocking:
 * - pdf-parse: Mock PDF text extraction
 * - Anthropic SDK: Mock Claude API responses
 * - OpenAI embeddings: Mock embedding generation
 * - File fetching: Mock Vercel Blob fetch
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import type { PayloadRequest } from 'payload'
import { agentChat } from '@/endpoints/agent/chat'
import sampleLessonExtraction from '../fixtures/ai-extractions/sample-lesson-extraction.json'
import longLessonExtraction from '../fixtures/ai-extractions/long-lesson-extraction.json'
import emptyExtraction from '../fixtures/ai-extractions/empty-extraction.json'

// Skip tests if DATABASE_URL is not set
const hasDatabaseUrl = !!process.env.DATABASE_URL

// Mock PDF parsing
const mockGetText = vi.fn()
vi.mock('pdf-parse', () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getText: mockGetText,
  })),
}))

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}))

// Mock OpenAI embeddings
vi.mock('@/lib/ai/embeddings', () => ({
  generateEmbedding: vi.fn(async () => ({
    embedding: new Array(1536).fill(0.1),
    model: 'text-embedding-3-small',
    tokensUsed: 10,
  })),
  generateEmbeddings: vi.fn(async (texts: string[]) =>
    texts.map(() => ({
      embedding: new Array(1536).fill(0.1),
      model: 'text-embedding-3-small',
      tokensUsed: 10,
    })),
  ),
}))

// Mock exercise chat service
vi.mock('@/lib/ai/services/exercise-chat-service', () => ({
  chatWithExerciseHelper: vi.fn(async () => ({
    success: true,
    message: 'Mock assistant response',
  })),
  getSystemPrompt: vi.fn(() => 'You are a helpful assistant.'),
}))

// Mock vector search
vi.mock('@/lib/ai/vector-index-check', () => ({
  isVectorIndexAvailable: vi.fn(async () => true),
}))

vi.mock('@/lib/ai/vector-search', () => ({
  retrieveMemoryItems: vi.fn(async () => ({
    items: [],
    latencyMs: 0,
    localCount: 0,
    globalCount: 0,
  })),
}))

// Mock memory extraction
vi.mock('@/lib/ai/memory-extraction', () => ({
  extractMemoryCandidates: vi.fn(async () => []),
  persistMemoryItems: vi.fn(async () => 0),
}))

// Mock maintenance
vi.mock('@/lib/ai/maintenance', () => ({
  runSummaryMaintenance: vi.fn(async () => ({
    summaryUpdated: false,
    messagesTrimmed: 0,
  })),
}))

// Mock feature flags
vi.mock('@/lib/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/feature-flags')>()
  return {
    ...actual,
    featureFlags: {
      SUMMARY_MAINTENANCE_ENABLED: true,
      MEMORY_EXTRACTION_ENABLED: true,
      MEMORY_RETRIEVAL_ENABLED: true,
    },
  }
})

// Mock global fetch
global.fetch = vi.fn()

let payload: Payload
let testUserId: string
let testLessonId: string | undefined
let testChapterId: string | undefined
let testCourseId: string | undefined

// Helper function to create a media file without file processing
// This bypasses Payload's file processing which tries to read from disk
// and may fail in test environments. We create the record with metadata only.
async function createMediaFileWithFile(
  payload: Payload,
  filename: string,
  content: Buffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 0\ntrailer\n<<\n/Size 1\n/Root 1 0 R\n>>\nstartxref\n9\n%%EOF'),
): Promise<{ id: string }> {
  // Create media record without file parameter to bypass file processing
  // This avoids FileRetrievalError: ENOENT errors in test environments
  // The URL is set manually to match what would be generated
  const mediaFile = await payload.create({
    collection: 'media',
    data: {
      filename,
      mimeType: 'application/pdf',
      filesize: content.length,
      url: `/media/${filename}`, // Set URL manually
      width: undefined,
      height: undefined,
    } as any,
    // Don't pass file parameter - this bypasses file processing
  })
  
  return { id: mediaFile.id }
}

beforeAll(
  async () => {
    payload = await getPayload({ config })

    // Create test user
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `lesson-doc-chat-${Date.now()}@example.com`,
        password: 'test123456',
        role: 'student',
      },
    })
    testUserId = user.id

    // Find or create a test course
    const existingCourses = await payload.find({
      collection: 'courses',
      limit: 1,
    })

    if (existingCourses.docs.length > 0) {
      testCourseId = existingCourses.docs[0].id
    } else {
      // Find or create a category for the course
      const existingCategories = await payload.find({
        collection: 'categories',
        limit: 1,
      })

      let categoryId: string | undefined
      if (existingCategories.docs.length > 0) {
        categoryId = existingCategories.docs[0].id
      } else {
        const category = await payload.create({
          collection: 'categories',
          data: {
            title: 'Test Category',
            slug: `test-category-${Date.now()}`,
          } as any,
        })
        categoryId = category.id
      }

      const course = await payload.create({
        collection: 'courses',
        data: {
          courseLabel: 'TEST',
          title: 'Test Course',
          slug: `test-course-${Date.now()}`,
          status: 'published',
          isActive: true,
          categories: categoryId ? [categoryId] : [],
          order: 0,
        } as any,
      })
      testCourseId = course.id
    }

    // Create test chapter
    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        course: testCourseId,
        title: 'Test Chapter',
        slug: `test-chapter-${Date.now()}`,
        order: 0,
        status: 'published',
        isActive: true,
      } as any,
    })
    testChapterId = chapter.id

    // Create test lesson
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        chapter: testChapterId,
        title: 'Test Lesson',
        slug: `test-lesson-${Date.now()}`,
        order: 0,
        status: 'published',
        isActive: true,
      } as any,
    })
    testLessonId = lesson.id
  },
  60000,
)

afterAll(async () => {
  if (!payload) return

  if (testLessonId) {
    await payload.delete({ collection: 'lessons', id: testLessonId })
  }
  if (testChapterId) {
    await payload.delete({ collection: 'chapters', id: testChapterId })
  }
  // Only delete course if we created it (not if we reused an existing one)
  // For now, we'll leave courses as they might be shared
  if (testUserId) {
    await payload.delete({ collection: 'users', id: testUserId })
  }
}, 30000)

describe.skipIf(!hasDatabaseUrl)('Lesson Document Chat Integration', () => {
  it('should extract and store document content when user sends first message in lesson conversation', async () => {
    if (!testLessonId) {
      throw new Error('testLessonId was not initialized')
    }

    // Create a media file (PDF) for the lesson
    const { id: mediaFileId } = await createMediaFileWithFile(
      payload,
      'sample-lesson.pdf',
    )
    const mediaFile = { id: mediaFileId }

    // Update lesson with contentFiles
    await payload.update({
      collection: 'lessons',
      id: testLessonId,
      data: {
        contentFiles: [mediaFile.id],
      } as any,
    })

    // Mock pdf-parse to return sample text
    vi.mocked(mockGetText).mockResolvedValue({
      text: 'Introduction to Algebra\n\nBasic Concepts\n\nAlgebra is a branch of mathematics...',
      pages: [{ text: 'Introduction to Algebra\n\nBasic Concepts\n\nAlgebra is a branch of mathematics...' }],
    } as any)

    // Mock Anthropic API response
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const mockAnthropic = new Anthropic()
    vi.mocked(mockAnthropic.messages.create).mockResolvedValue({
      content: [
        {
          type: 'text',
          text: sampleLessonExtraction.structuredContent,
        },
      ],
    } as any)

    // Mock file fetch
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
    } as Response)

    const req = {
      payload,
      user: { id: testUserId } as any,
      url: 'http://localhost:3000/api/agent/chat',
      headers: new Headers(),
      json: async () => ({
        message: 'What is algebra?',
        acknowledgment: 'ack-1',
        lessonId: testLessonId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.conversationId).toBeDefined()

    // Wait a bit for async document extraction
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Check that document memories were created
    const memories = await payload.find({
      collection: 'memory_items',
      where: {
        and: [
          { userId: { equals: testUserId } },
          { conversationId: { equals: body.conversationId } },
          { type: { equals: 'document' } },
        ],
      },
    })

    expect(memories.docs.length).toBeGreaterThan(0)
    expect(memories.docs[0].type).toBe('document')
    expect(memories.docs[0].importance).toBe(5)
    expect(memories.docs[0].text.length).toBeLessThanOrEqual(2000)

    // Cleanup
    await payload.delete({ collection: 'media', id: mediaFile.id })
  }, 60000)

  it('should skip document extraction when lesson has no PDF files', async () => {
    if (!testLessonId) {
      throw new Error('testLessonId was not initialized')
    }

    // Update lesson with no contentFiles
    await payload.update({
      collection: 'lessons',
      id: testLessonId,
      data: {
        contentFiles: [],
      } as any,
    })

    const req = {
      payload,
      user: { id: testUserId } as any,
      url: 'http://localhost:3000/api/agent/chat',
      headers: new Headers(),
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'ack-1',
        lessonId: testLessonId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // Wait a bit for async processing
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Check that no document memories were created
    const memories = await payload.find({
      collection: 'memory_items',
      where: {
        and: [
          { userId: { equals: testUserId } },
          { conversationId: { equals: body.conversationId } },
          { type: { equals: 'document' } },
        ],
      },
    })

    expect(memories.docs.length).toBe(0)
  }, 60000)

  it('should skip document extraction when conversation already has document memories', async () => {
    if (!testLessonId) {
      throw new Error('testLessonId was not initialized')
    }

    // Create a conversation with existing document memories
    const conversation = await payload.create({
      collection: 'conversations',
      data: {
        user: testUserId,
        lesson: testLessonId,
        messages: [],
        lastMessageAt: new Date().toISOString(),
      } as any,
    })

    // Create a document memory item
    await payload.create({
      collection: 'memory_items',
      data: {
        userId: testUserId,
        conversationId: conversation.id,
        type: 'document',
        text: 'Existing document content',
        embedding: new Array(1536).fill(0.1),
        importance: 5,
        status: 'active',
        source: {
          sourceConversationId: conversation.id,
          sourceMessageTimestamp: new Date().toISOString(),
          sourceMessageRole: 'assistant',
        },
      } as any,
      overrideAccess: true,
    })

    const req = {
      payload,
      user: { id: testUserId } as any,
      url: 'http://localhost:3000/api/agent/chat',
      headers: new Headers(),
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'ack-1',
        lessonId: testLessonId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)

    expect(res.status).toBe(200)

    // Wait a bit for async processing
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Check that no new document memories were created (count should still be 1)
    const memories = await payload.find({
      collection: 'memory_items',
      where: {
        and: [
          { userId: { equals: testUserId } },
          { conversationId: { equals: conversation.id } },
          { type: { equals: 'document' } },
        ],
      },
    })

    expect(memories.docs.length).toBe(1) // Still only the original one

    // Cleanup
    await payload.delete({ collection: 'conversations', id: conversation.id })
  }, 60000)

  it('should handle empty or unreadable PDFs gracefully', async () => {
    if (!testLessonId) {
      throw new Error('testLessonId was not initialized')
    }

    // Create a media file for empty PDF
    const { id: mediaFileId } = await createMediaFileWithFile(
      payload,
      'empty.pdf',
      Buffer.from('%PDF-1.4\n'),
    )
    const mediaFile = { id: mediaFileId }

    await payload.update({
      collection: 'lessons',
      id: testLessonId,
      data: {
        contentFiles: [mediaFile.id],
      } as any,
    })

    // Mock pdf-parse to return empty text
    vi.mocked(mockGetText).mockResolvedValue({
      text: '',
      pages: [],
    } as any)

    // Mock file fetch
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
    } as Response)

    const req = {
      payload,
      user: { id: testUserId } as any,
      url: 'http://localhost:3000/api/agent/chat',
      headers: new Headers(),
      json: async () => ({
        message: 'Hello',
        acknowledgment: 'ack-1',
        lessonId: testLessonId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // Wait a bit for async processing
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Check that no document memories were created
    const memories = await payload.find({
      collection: 'memory_items',
      where: {
        and: [
          { userId: { equals: testUserId } },
          { conversationId: { equals: body.conversationId } },
          { type: { equals: 'document' } },
        ],
      },
    })

    expect(memories.docs.length).toBe(0)

    // Cleanup
    await payload.delete({ collection: 'media', id: mediaFile.id })
  }, 60000)

  it('should chunk large documents into multiple memory items', async () => {
    if (!testLessonId) {
      throw new Error('testLessonId was not initialized')
    }

    // Create a media file for long PDF
    const { id: mediaFileId } = await createMediaFileWithFile(
      payload,
      'long-lesson.pdf',
    )
    const mediaFile = { id: mediaFileId }

    await payload.update({
      collection: 'lessons',
      id: testLessonId,
      data: {
        contentFiles: [mediaFile.id],
      } as any,
    })

    // Mock pdf-parse to return long text
    vi.mocked(mockGetText).mockResolvedValue({
      text: 'A'.repeat(10000), // 10,000 characters
      pages: Array.from({ length: 10 }, () => ({ text: 'A'.repeat(1000) })),
    } as any)

    // Mock Anthropic API response with long content
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const mockAnthropic = new Anthropic()
    vi.mocked(mockAnthropic.messages.create).mockResolvedValue({
      content: [
        {
          type: 'text',
          text: longLessonExtraction.structuredContent,
        },
      ],
    } as any)

    // Mock file fetch
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
    } as Response)

    const req = {
      payload,
      user: { id: testUserId } as any,
      url: 'http://localhost:3000/api/agent/chat',
      headers: new Headers(),
      json: async () => ({
        message: 'Tell me about this lesson',
        acknowledgment: 'ack-1',
        lessonId: testLessonId,
      }),
    } as unknown as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    // Wait a bit for async document extraction
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Check that multiple memory items were created
    const memories = await payload.find({
      collection: 'memory_items',
      where: {
        and: [
          { userId: { equals: testUserId } },
          { conversationId: { equals: body.conversationId } },
          { type: { equals: 'document' } },
        ],
      },
    })

    expect(memories.docs.length).toBeGreaterThan(1)
    // Each chunk should be <= 2000 chars
    for (const memory of memories.docs) {
      expect(memory.text.length).toBeLessThanOrEqual(2000)
    }

    // Cleanup
    await payload.delete({ collection: 'media', id: mediaFile.id })
  }, 60000)
})
