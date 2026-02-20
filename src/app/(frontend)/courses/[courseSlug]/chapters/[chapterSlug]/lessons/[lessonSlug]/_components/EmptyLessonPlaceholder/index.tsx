/**
 * Empty lesson placeholder - shown when a lesson has no exercises
 * This provides the chat interface for AI tutoring without exercises
 */
export function EmptyLessonPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">No exercises in this lesson yet.</p>
    </div>
  )
}
