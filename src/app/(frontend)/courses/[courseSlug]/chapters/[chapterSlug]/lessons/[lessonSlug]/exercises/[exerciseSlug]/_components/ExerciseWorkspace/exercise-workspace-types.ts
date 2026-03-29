/**
 * View mode for mobile devices
 * PDF: Content visible, chat input bar visible, chat messages hidden
 * CHAT: Chat visible full-screen, content hidden
 */
export type ViewMode = 'PDF' | 'CHAT'

/**
 * Props for ExerciseWorkspace component
 */
export interface ExerciseWorkspaceProps {
  /** Exercise title for header */
  exerciseTitle: string
  /** Optional back URL for navigation */
  backUrl?: string
  /** Primary content to display (PDF or exercise content) */
  primaryContent: React.ReactNode
  /** Chat interface component (omit to hide chat) */
  chatContent?: React.ReactNode
}

/**
 * Props for ExerciseHeader component
 */
export interface ExerciseHeaderProps {
  /** Exercise title */
  exerciseTitle: string
  /** Optional back URL */
  backUrl?: string
  /** Menu click handler */
  onMenuClick: () => void
  /** Whether device is mobile (< 1024px) */
  isMobile?: boolean
  /** Current view mode (mobile only) */
  viewMode?: ViewMode
  /** Mode toggle handler (mobile only) */
  onModeToggle?: () => void
}
