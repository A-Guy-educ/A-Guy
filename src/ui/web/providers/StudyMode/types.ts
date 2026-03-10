/**
 * @fileType types
 * @domain study-mode
 * @pattern context-provider
 * @ai-summary Study mode types for the course studying page
 */

/**
 * Study modes available in the studying page
 */
export type StudyMode = 'study' | 'hint' | 'practice' | 'test'

/**
 * Chat policy types (hint vs ask mode)
 */
export type ChatPolicy = 'hint' | 'ask'

/**
 * Context value type for StudyModeProvider
 */
export interface StudyModeContextValue {
  mode: StudyMode
  previousMode: StudyMode | null
  setMode: (mode: StudyMode) => void
  chatPolicy: ChatPolicy
  setChatPolicy: (policy: ChatPolicy) => void
  isChatOpen: boolean
  setIsChatOpen: (open: boolean) => void
}
