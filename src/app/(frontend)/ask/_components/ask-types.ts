export interface ExerciseFile {
  id: number
  title: string
  url: string
  date: string
  /** Media ID from /api/media upload — allows the chat to reference this image */
  mediaId?: string
  /** True while the image is being uploaded to /api/media */
  isUploading?: boolean
}

export interface AskActionEvent {
  type: 'hint' | 'solution' | 'check'
  title: string
  imageData?: string
  /** Media ID of the exercise image so the AI can see it */
  mediaId?: string
}

export interface AskMediaAttachEvent {
  mediaId: string
  filename: string
}

export interface AskMediaRestoreEvent {
  mediaId: string
  filename: string
  url: string
}

export const ASK_ACTION_EVENT = 'ask-action' as const
export const ASK_MEDIA_ATTACH_EVENT = 'ask-media-attach' as const
export const ASK_MEDIA_RESTORE_EVENT = 'ask-media-restore' as const
