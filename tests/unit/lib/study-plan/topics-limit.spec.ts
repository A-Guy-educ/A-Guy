import { describe, expect, it } from 'vitest'

import type { TopicInput } from '@/lib/study-plan/types'
import { addTopicWithLimit } from '@/lib/study-plan/topics-limit'

/**
 * @fileType utility
 * @domain study-plan
 * @pattern array-limit
 * @ai-summary Tests for adding topics with a hard limit of 10 topics maximum.
 */

// Test helper - creates a topic with the given label
const createTopic = (label: string): TopicInput => ({
  topicId: `topic-${label}`,
  topicLabel: label,
  mastery: 'weak',
})

// Test helper - creates an array of topics with the given count
const createTopics = (count: number): TopicInput[] =>
  Array.from({ length: count }, (_, i) => createTopic(`Topic ${i + 1}`))

describe('topics-limit (addTopicWithLimit)', () => {
  describe('adding topics under the limit', () => {
    it('can add first topic to empty array', () => {
      const existingTopics: TopicInput[] = []
      const newTopic = createTopic('Algebra')

      const result = addTopicWithLimit(existingTopics, newTopic)

      expect(result.topics).toHaveLength(1)
      expect(result.topics[0].topicLabel).toBe('Algebra')
      expect(result.error).toBeNull()
    })

    it('can add topic when below limit (5 topics)', () => {
      const existingTopics = createTopics(5)
      const newTopic = createTopic('New Topic')

      const result = addTopicWithLimit(existingTopics, newTopic)

      expect(result.topics).toHaveLength(6)
      expect(result.topics[5].topicLabel).toBe('New Topic')
      expect(result.error).toBeNull()
    })

    it('can add topic when at limit - 1 (9 topics)', () => {
      const existingTopics = createTopics(9)
      const newTopic = createTopic('Final Topic')

      const result = addTopicWithLimit(existingTopics, newTopic)

      expect(result.topics).toHaveLength(10)
      expect(result.topics[9].topicLabel).toBe('Final Topic')
      expect(result.error).toBeNull()
    })

    it('does not mutate original array when adding topic', () => {
      const existingTopics = createTopics(3)
      const originalLength = existingTopics.length
      const newTopic = createTopic('New Topic')

      const result = addTopicWithLimit(existingTopics, newTopic)

      // Original should be unchanged
      expect(existingTopics).toHaveLength(originalLength)
      // Result should have new topic
      expect(result.topics).toHaveLength(originalLength + 1)
    })
  })

  describe('cannot add 11th topic - hard limit of 10', () => {
    it('cannot add 11th topic - returns without mutation', () => {
      const existingTopics = createTopics(10)
      const newTopic = createTopic('Extra Topic')

      const result = addTopicWithLimit(existingTopics, newTopic)

      // Should NOT add the topic
      expect(result.topics).toHaveLength(10)
      // Should return error
      expect(result.error).toBe('Topic limit reached (max 10)')
    })

    it('cannot add topic when already at limit (10 topics)', () => {
      const existingTopics = createTopics(10)
      const newTopic = createTopic('Should Not Add')

      const result = addTopicWithLimit(existingTopics, newTopic)

      // Verify all original topics are still there
      expect(result.topics).toEqual(existingTopics)
      expect(result.error).toBe('Topic limit reached (max 10)')
    })

    it('original array is not mutated when limit is reached', () => {
      const existingTopics = createTopics(10)
      const originalTopicsSnapshot = [...existingTopics]
      const newTopic = createTopic('Should Not Add')

      const result = addTopicWithLimit(existingTopics, newTopic)

      // Original should be completely unchanged
      expect(existingTopics).toEqual(originalTopicsSnapshot)
      expect(result.topics).toEqual(originalTopicsSnapshot)
    })
  })

  describe('error clears when topic count drops below 10', () => {
    it('returns null error when topics are below limit', () => {
      // Simulate a scenario where we previously had an error but now have fewer topics
      const existingTopics = createTopics(5)

      // When calling addTopicWithLimit, error should be null since we're under limit
      const newTopic = createTopic('New Topic')
      const result = addTopicWithLimit(existingTopics, newTopic)

      expect(result.error).toBeNull()
    })

    it('can add after removing topics to go below limit', () => {
      // Start with 10 topics
      let topics = createTopics(10)

      // Try to add - should fail
      let result = addTopicWithLimit(topics, createTopic('Should Fail'))
      expect(result.error).toBe('Topic limit reached (max 10)')

      // Remove some topics (simulate user deleting)
      topics = topics.slice(0, 7)

      // Now should succeed
      result = addTopicWithLimit(topics, createTopic('Should Succeed'))
      expect(result.error).toBeNull()
      expect(result.topics).toHaveLength(8)
    })

    it('error is null for any call when current count < 10', () => {
      // Even if we check without adding (by checking current state), error should be null
      const existingTopics = createTopics(8)

      // The function should return null error when topics < 10
      // This test verifies the "error clears" behavior
      const result = addTopicWithLimit(existingTopics, createTopic('Any Topic'))

      expect(result.error).toBeNull()
    })
  })

  describe('preserves topic data integrity', () => {
    it('preserves mastery level when adding topic', () => {
      const existingTopics: TopicInput[] = [
        { topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' },
        { topicId: 't2', topicLabel: 'Topic 2', mastery: 'strong' },
      ]
      const newTopic: TopicInput = {
        topicId: 't3',
        topicLabel: 'Topic 3',
        mastery: 'medium',
      }

      const result = addTopicWithLimit(existingTopics, newTopic)

      expect(result.topics[0].mastery).toBe('weak')
      expect(result.topics[1].mastery).toBe('strong')
      expect(result.topics[2].mastery).toBe('medium')
    })

    it('preserves existing topic IDs', () => {
      const existingTopics = createTopics(5)
      const existingIds = existingTopics.map((t) => t.topicId)
      const newTopic = createTopic('New')

      const result = addTopicWithLimit(existingTopics, newTopic)

      // All original IDs should be preserved
      expect(result.topics.slice(0, 5).map((t: TopicInput) => t.topicId)).toEqual(existingIds)
    })
  })
})
