import type { MCPToolResult } from '@/server/repos/mcp/client/types'

const TOOL_COLLECTION_MAP: Record<string, string> = {
  findCourses: 'courses',
  findChapters: 'chapters',
  findLessons: 'lessons',
  findExercises: 'exercises',
  findMedia: 'media',
}

type RelationValue = string | { id?: string; title?: string } | null | undefined

export interface TransformedToolResult {
  collection: string
  items: unknown[]
  text: string
}

export function transformToolResult(
  toolName: string,
  result: MCPToolResult,
): TransformedToolResult {
  const collection = TOOL_COLLECTION_MAP[toolName] || 'unknown'
  const text = extractResultText(result)
  const docs = parseDocsFromText(text)
  const transformer = COLLECTION_TRANSFORMS[collection]
  const items = transformer ? docs.map((doc) => transformer(doc)) : docs

  return {
    collection,
    items,
    text: JSON.stringify({ collection, items }, null, 2),
  }
}

const COLLECTION_TRANSFORMS: Record<string, (doc: Record<string, unknown>) => unknown> = {
  courses: (doc) => ({
    id: doc.id,
    title: doc.title,
    slug: doc.slug,
    status: doc.status,
    updatedAt: doc.updatedAt,
  }),
  chapters: (doc) => ({
    id: doc.id,
    title: doc.title,
    slug: doc.slug,
    status: doc.status,
    order: doc.order,
    course: normalizeRelation(doc.course as RelationValue),
    updatedAt: doc.updatedAt,
  }),
  lessons: (doc) => ({
    id: doc.id,
    title: doc.title,
    slug: doc.slug,
    status: doc.status,
    order: doc.order,
    chapter: normalizeRelation(doc.chapter as RelationValue),
    updatedAt: doc.updatedAt,
  }),
  exercises: (doc) => ({
    id: doc.id,
    title: doc.title,
    status: doc.status,
    lesson: normalizeRelation(doc.lesson as RelationValue),
    updatedAt: doc.updatedAt,
  }),
  media: (doc) => ({
    id: doc.id,
    filename: doc.filename,
    mimeType: doc.mimeType,
    filesize: doc.filesize,
    url: doc.url,
    updatedAt: doc.updatedAt,
  }),
}

function extractResultText(result: MCPToolResult): string {
  const content = result?.content || []
  const textPart = content.find((part) => part.type === 'text' && typeof part.text === 'string')
  return textPart?.text || ''
}

function parseDocsFromText(text: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = []
  const codeFenceRegex = /```json\s*([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = codeFenceRegex.exec(text)) !== null) {
    const json = safeParse(match[1])
    if (json) {
      blocks.push(json)
    }
  }

  if (blocks.length > 0) {
    return blocks
  }

  const inlineJsonStart = text.indexOf('{')
  if (inlineJsonStart >= 0) {
    const candidate = text.slice(inlineJsonStart)
    const json = safeParse(candidate)
    if (json) {
      return [json]
    }
  }

  return []
}

function safeParse(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return null
  }

  return null
}

function normalizeRelation(value: RelationValue) {
  if (!value) {
    return undefined
  }

  if (typeof value === 'string') {
    return { id: value }
  }

  return {
    id: value.id,
    title: value.title,
  }
}
