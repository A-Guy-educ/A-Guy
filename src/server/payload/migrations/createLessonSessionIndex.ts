import type { Payload } from 'payload'

export async function createLessonSessionIndexes(payload: Payload): Promise<void> {
  const db = payload.db.connection.db
  if (!db) return
  const collection = db.collection('lesson-sessions')
  await collection.createIndex(
    { user: 1, lesson: 1 },
    { unique: true, partialFilterExpression: { status: 'active' }, name: 'unique_active_session' },
  )
}
