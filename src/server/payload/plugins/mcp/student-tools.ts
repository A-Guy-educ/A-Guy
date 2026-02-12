/**
 * Student MCP Tools
 *
 * Custom MCP tools for student chat context grounding.
 * These tools fetch sanitized exercise content for the AI to help students.
 *
 * @fileType mcp-tool
 * @domain mcp
 * @pattern tool-calling, student-access, context-grounding
 */

import { z } from 'zod'
import type { PayloadRequest } from 'payload'

import { sanitizeExerciseContentForStudent } from '@/infra/llm/services/exercise-content/sanitize'
import type {
  SanitizedExerciseContent,
  ContentData,
} from '@/infra/llm/services/exercise-content/sanitize'

/**
 * Tool parameters schema for getActiveExerciseContext
 */
const GetActiveExerciseContextParamsSchema = {
  exerciseId: z.string(),
  activeBlockId: z.string().optional(),
}

/**
 * Fetch the exercise content currently displayed to the student.
 * Returns sanitized exercise content (without correctness/answer fields).
 *
 * @param args - Tool arguments containing exerciseId and optional activeBlockId
 * @param req - Payload request for database access
 * @returns Sanitized exercise content as JSON
 */
export const getActiveExerciseContextTool = {
  description:
    'Fetch the exercise content currently displayed to the student. Returns the exercise title, blocks (prompts, questions, options) with answer keys removed. Use this to understand what the student is looking at and help them with their questions.',
  name: 'getActiveExerciseContext',
  parameters: GetActiveExerciseContextParamsSchema,
  handler: async (
    args: Record<string, unknown>,
    req: PayloadRequest,
    _extra: unknown,
  ): Promise<{
    content: Array<{ text: string; type: 'text' }>
    role?: string
  }> => {
    const { exerciseId, activeBlockId } = args as { exerciseId: string; activeBlockId?: string }

    // Validate exerciseId is provided
    if (!exerciseId || typeof exerciseId !== 'string') {
      return {
        content: [
          { text: JSON.stringify({ error: 'exerciseId is required' }), type: 'text' as const },
        ],
      }
    }

    try {
      // Fetch exercise from Payload database with access control enforcement
      const exercise = await req.payload.findByID({
        collection: 'exercises',
        id: exerciseId,
        depth: 0,
        overrideAccess: false,
        req,
      })

      if (!exercise) {
        return {
          content: [
            { text: JSON.stringify({ error: 'Exercise not found' }), type: 'text' as const },
          ],
        }
      }

      // Parse and sanitize exercise content
      let sanitizedContent: SanitizedExerciseContent

      if (typeof exercise.content === 'string') {
        try {
          const parsedContent = JSON.parse(exercise.content)
          sanitizedContent = sanitizeExerciseContentForStudent(parsedContent)
        } catch {
          return {
            content: [
              {
                text: JSON.stringify({ error: 'Invalid exercise content format' }),
                type: 'text' as const,
              },
            ],
          }
        }
      } else if (typeof exercise.content === 'object' && exercise.content !== null) {
        // Validate the structure before sanitizing
        const contentData = exercise.content as unknown
        if (
          typeof contentData === 'object' &&
          contentData !== null &&
          'blocks' in contentData &&
          Array.isArray((contentData as { blocks: unknown }).blocks)
        ) {
          sanitizedContent = sanitizeExerciseContentForStudent(contentData as ContentData)
        } else {
          return {
            content: [
              {
                text: JSON.stringify({
                  error: 'Invalid exercise content format: missing blocks array',
                }),
                type: 'text' as const,
              },
            ],
          }
        }
      } else {
        return {
          content: [
            { text: JSON.stringify({ error: 'Exercise has no content' }), type: 'text' as const },
          ],
        }
      }

      // Build response
      const responseData: {
        exerciseId: string
        title: string
        activeBlockId?: string
        blocks: SanitizedExerciseContent['blocks']
        activeQuestion?: unknown
      } = {
        exerciseId,
        title: exercise.title || 'Untitled Exercise',
        blocks: sanitizedContent.blocks,
      }

      // If activeBlockId is provided, extract that specific block for convenience
      if (activeBlockId && typeof activeBlockId === 'string') {
        responseData.activeBlockId = activeBlockId
        const activeBlock = sanitizedContent.blocks.find((block) => block.id === activeBlockId)
        if (activeBlock) {
          responseData.activeQuestion = activeBlock
        }
      }

      return {
        content: [{ text: JSON.stringify(responseData, null, 2), type: 'text' as const }],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        content: [
          {
            text: JSON.stringify({ error: `Failed to fetch exercise: ${errorMessage}` }),
            type: 'text' as const,
          },
        ],
      }
    }
  },
}
