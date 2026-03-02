import type { ActivityType, TimeframeMode } from './types'

export const MASTERY_WEIGHTS: Record<string, number> = {
  weak: 3,
  medium: 2,
  strong: 1,
}

export const ACTIVITY_DURATIONS: Record<ActivityType, number> = {
  practice: 45,
  hybrid: 50,
  full_simulation: 90,
  reinforcement: 30,
  warmup: 20,
}

export const ACTIVITY_TEMPLATES: Record<TimeframeMode, ActivityType[]> = {
  survival: ['warmup', 'warmup', 'warmup', 'warmup', 'warmup', 'warmup', 'warmup'],
  high_intensity: [
    'full_simulation',
    'reinforcement',
    'practice',
    'full_simulation',
    'reinforcement',
    'practice',
    'warmup',
  ],
  balanced: [
    'practice',
    'hybrid',
    'practice',
    'reinforcement',
    'hybrid',
    'full_simulation',
    'warmup',
  ],
}

export const MAX_TOPICS_PER_DAY: Record<ActivityType, number> = {
  practice: 2,
  hybrid: 3,
  full_simulation: 0, // 0 = all topics
  reinforcement: 2,
  warmup: 1,
}
