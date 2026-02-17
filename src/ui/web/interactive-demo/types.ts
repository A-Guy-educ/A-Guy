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
  type: 'content' | 'mcq' | 'open' | 'client_message'
  content: ClientRichText
  options?: ClientMcqOption[]
  media?: string
}

export interface ClientMessage {
  id: string
  type: 'client_message'
  content: ClientRichText
  role: 'user'
}

export interface SessionState {
  sessionId: string | null
  status: 'idle' | 'loading' | 'active' | 'completed' | 'error'
  currentBlockIndex: number
  currentPhase: 'awaiting_input' | 'awaiting_continue' | null
  blocks: ClientBlock[]
  clientMessages: ClientMessage[]
  skillScore: number
  remediation: string | null
  isSubmitting: boolean
  isCorrect?: boolean
  totalBlocks: number
}

export interface StepResponse {
  sessionId: string
  block: ClientBlock | null
  currentPhase: 'awaiting_input' | 'awaiting_continue'
  skillScore: number
  remediation: string | null
  isCorrect?: boolean
  status: 'active' | 'completed'
  message?: string
  totalBlocks?: number
}

export interface StepRequest {
  action: 'start' | 'answer' | 'next' | 'reset'
  lessonId: string
  sessionId?: string
  clientActionId: string
  answer?: string | { selected: string }
}
