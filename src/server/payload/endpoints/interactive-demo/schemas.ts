import { z } from 'zod'

export const StepRequestSchema = z.object({
  lessonId: z.string().min(1),
  sessionId: z.string().optional(),
  action: z.enum(['start', 'answer', 'next', 'reset']),
  answer: z.string().max(2000).optional(),
  selectedOptionIds: z.array(z.string().min(1)).optional(),
  clientActionId: z.string().uuid(),
})

export interface StepResponse {
  sessionId: string
  status: 'active' | 'completed'
  currentBlockIndex: number
  currentPhase: 'awaiting_input' | 'awaiting_continue'
  block: { type: string; content?: object; options?: object[]; media?: string } | null
  skillScore: number
  isCorrect?: boolean
  feedback?: string
  remediation?: string
  schemaVersion: number
  totalBlocks?: number
}
