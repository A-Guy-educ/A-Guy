/**
 * Client-side types for Interactive Demo lesson
 */

export interface ClientRichText {
  type: 'rich_text'
  format: 'md-math-v1'
  value: string
  mediaIds: string[]
}

export interface ClientMcqOption {
  id: string
  content: ClientRichText
}

export interface ClientBlock {
  id: string
  type: 'content' | 'mcq' | 'open'
  content: ClientRichText
  options?: ClientMcqOption[]
  media?: string
}

export interface SessionState {
  sessionId: string | null
  status: 'idle' | 'loading' | 'active' | 'completed' | 'error'
  currentBlockIndex: number
  currentPhase: 'awaiting_input' | 'awaiting_continue' | null
  blocks: ClientBlock[]
  skillScore: number
  remediation: string | null
  isSubmitting: boolean
  isCorrect?: boolean
}

export interface StepResponse {
  sessionId: string
  block: ClientBlock | null
  currentPhase: 'awaiting_input' | 'awaiting_continue'
  skillScore: number
  remediation: string | null
  isCorrect?: boolean
  completed: boolean
  message?: string
}

export interface StepRequest {
  action: 'start' | 'answer' | 'next' | 'reset'
  lessonId: string
  sessionId?: string
  clientActionId: string
  answer?: string | { selected: string }
}
