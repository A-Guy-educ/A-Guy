/**
 * Exercise Preview Component
 * Links to the web frontend preview of the exercise
 */

'use client'

import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

export const ExercisePreview: React.FC = () => {
  // Read content from form state
  const contentField = useFormFields(([fields]) => fields.content)
  const content = contentField?.value as ExerciseContentData | undefined

  // Get document ID from useDocumentInfo (not available in form fields)
  const { id: exerciseId } = useDocumentInfo()

  const hasContent = content?.blocks && Array.isArray(content.blocks) && content.blocks.length > 0

  if (!hasContent) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <p>Add content blocks to enable preview</p>
      </div>
    )
  }

  // If exercise is saved, link to the existing exercise page
  if (exerciseId) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground mb-3">View the saved exercise</p>
        <a
          href={`/exercises/${exerciseId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          View Exercise
        </a>
      </div>
    )
  }

  // For unsaved drafts, show a message
  return (
    <div className="p-4">
      <p className="text-sm text-muted-foreground">Save the exercise to preview it</p>
    </div>
  )
}

export default ExercisePreview
