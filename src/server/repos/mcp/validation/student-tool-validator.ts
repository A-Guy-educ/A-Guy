/**
 * Student Tool Validator
 *
 * Validates that student tool calls are restricted to allowed tools and that
 * tool arguments match the current request context (e.g., exerciseId).
 *
 * This is a security layer to prevent students from fetching arbitrary exercises
 * via prompt injection or LLM hallucination.
 *
 * @fileType validator
 * @domain mcp
 * @pattern security, tool-calling, student-access
 */

import { logger } from '@/infra/utils/logger'
import { isStudentAllowedToolName } from '../tool-allowlist'

/**
 * Request context for student tool validation
 */
export interface StudentToolRequestContext {
  /** The active exercise ID from the chat request */
  exerciseId?: string
}

/**
 * Validate tool arguments for student tool-calling
 *
 * @param toolName - Name of the tool being called
 * @param args - Arguments provided to the tool
 * @param requestContext - Context from the chat request (e.g., active exercise ID)
 * @throws Error if tool is not allowed or args don't match context
 */
export function validateStudentToolArgs(
  toolName: string,
  args: Record<string, unknown>,
  requestContext: StudentToolRequestContext,
): void {
  // Check if tool is in the student allowlist
  if (!isStudentAllowedToolName(toolName)) {
    const error = `Tool not allowed for students: ${toolName}`
    logger.warn({ toolName, reason: 'not_in_student_allowlist' }, `[MCP] ${error}`)
    throw new Error(error)
  }

  // For getActiveExerciseContext, validate that exerciseId matches request context
  if (toolName === 'getActiveExerciseContext') {
    const toolExerciseId = args.exerciseId

    // Check if exerciseId was provided in args
    if (!toolExerciseId || typeof toolExerciseId !== 'string') {
      const error = 'getActiveExerciseContext requires exerciseId in arguments'
      logger.warn({ toolName, args }, `[MCP] ${error}`)
      throw new Error(error)
    }

    // Check if request context has an active exerciseId
    if (!requestContext.exerciseId) {
      const error = 'No active exercise in request context'
      logger.warn({ toolName, args, requestContext }, `[MCP] ${error}`)
      throw new Error(error)
    }

    // Validate that tool's exerciseId matches the request's exerciseId
    if (toolExerciseId !== requestContext.exerciseId) {
      const error = `exerciseId mismatch: tool requested exercise "${toolExerciseId}" but active exercise is "${requestContext.exerciseId}"`
      logger.warn({ toolName, args, requestContext }, `[MCP] ${error}`)
      throw new Error(error)
    }

    logger.debug(
      { toolName, exerciseId: toolExerciseId },
      '[MCP] Student tool args validated successfully',
    )
  }
}
