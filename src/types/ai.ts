/**
 * Frontend types for AI features
 * Shared types for client-side AI interactions
 */

export interface AIExerciseData {
  question: string
  options: string[]
  correctAnswer: number
  explanation?: string
}

export interface AIMetadata {
  model: string
  processingTimeMs: number
  imageSizeBytes: number
  hasAccompanyingText: boolean
}

export interface ImageToExerciseAPIResponse {
  success: boolean
  data?: AIExerciseData
  metadata?: AIMetadata
  error?: string
  requestId: string
}

/**
 * Future type placeholders for upcoming features
 */

// Exercise chat types (future)
export interface ExerciseChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// Exercise editing suggestions (future)
export interface ExerciseEditSuggestion {
  type: 'clarity' | 'difficulty' | 'correctness' | 'formatting'
  message: string
  suggestedChange?: string
}
