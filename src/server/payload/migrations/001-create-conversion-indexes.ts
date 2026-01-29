import type { Migration } from 'payload'

export const createConversionIndexes: Migration = {
  async up(db) {
    // Prompts indexes
    await db
      .collection('prompts')
      .createIndex({ tenant: 1, status: 1, usage: 1 }, { name: 'idx_prompt_tenant_status_usage' })

    // Exercises indexes - Mongo partial filter syntax (NOT Payload-style)
    await db.collection('exercises').createIndex(
      { lesson: 1, sourceDoc: 1, contentHash: 1 },
      {
        unique: true,
        name: 'idx_exercise_dedup',
        partialFilterExpression: { origin: 'conversion' }, // Mongo syntax
      },
    )
    await db
      .collection('exercises')
      .createIndex({ conversionJobId: 1 }, { name: 'idx_exercise_job' })
    await db
      .collection('exercises')
      .createIndex({ status: 1, origin: 1 }, { name: 'idx_exercise_draft_review' })

    // Jobs indexes
    await db
      .collection('jobs')
      .createIndex({ taskSlug: 1, status: 1, lockExpiresAt: 1 }, { name: 'idx_job_claim_query' })
    await db.collection('jobs').createIndex(
      {
        taskSlug: 1,
        status: 1,
        'input.ctx.lessonId': 1,
        'input.ctx.sourceDocId': 1,
        lockExpiresAt: 1,
      },
      { name: 'idx_job_queue_policy' },
    )
  },

  async down(db) {
    await db.collection('prompts').dropIndex('idx_prompt_tenant_status_usage')
    await db.collection('exercises').dropIndex('idx_exercise_dedup')
    await db.collection('exercises').dropIndex('idx_exercise_job')
    await db.collection('exercises').dropIndex('idx_exercise_draft_review')
    await db.collection('jobs').dropIndex('idx_job_claim_query')
    await db.collection('jobs').dropIndex('idx_job_queue_policy')
  },
}
