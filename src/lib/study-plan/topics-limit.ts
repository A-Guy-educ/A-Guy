import type { TopicInput } from './types'

export const MAX_TOPICS = 10

export interface AddTopicResult {
  topics: TopicInput[]
  error: string | null
}

/**
 * Add a topic to the topics array with a hard limit of 10.
 * Returns the updated topics array and any error message.
 */
export function addTopicWithLimit(
  currentTopics: TopicInput[],
  newTopic: TopicInput,
): AddTopicResult {
  if (currentTopics.length >= MAX_TOPICS) {
    return {
      topics: currentTopics,
      error: 'Topic limit reached (max 10)',
    }
  }

  return {
    topics: [...currentTopics, newTopic],
    error: null,
  }
}

/**
 * Remove a topic from the topics array.
 * Returns the updated topics array (error is always null since we're removing).
 */
export function removeTopic(currentTopics: TopicInput[], topicIdToRemove: string): AddTopicResult {
  return {
    topics: currentTopics.filter((t) => t.topicId !== topicIdToRemove),
    error: null,
  }
}
