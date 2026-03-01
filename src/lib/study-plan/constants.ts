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
  mastery_cycle: [
    'practice',
    'practice',
    'reinforcement',
    'practice',
    'hybrid',
    'practice',
    'reinforcement',
  ],
}

export const TASK_TEMPLATES: Record<ActivityType, { label: string; description: string }[]> = {
  warmup: [
    { label: 'Quick topic review', description: 'Brief review of strong topics' },
    { label: 'Light practice', description: 'One quick exercise on weak topic' },
  ],
  practice: [
    { label: 'Topic practice', description: 'Practice 10-15 questions on selected topic' },
    { label: 'Error analysis', description: 'Review and summarize common mistakes' },
  ],
  hybrid: [
    { label: 'Weak topic focus', description: '70% exercises on weak topics' },
    { label: 'Strength reinforcement', description: '30% exercises on strong topics' },
  ],
  full_simulation: [
    { label: 'Full simulation exam', description: 'Take exam under real-time conditions' },
    { label: 'Mistake analysis', description: 'Analyze errors after completion' },
  ],
  reinforcement: [
    { label: 'Review past mistakes', description: 'Go over errors from previous days' },
    { label: 'Targeted practice', description: 'Focused practice on weak points' },
  ],
}

export const MAX_TOPICS_PER_DAY: Record<ActivityType, number> = {
  practice: 2,
  hybrid: 3,
  full_simulation: 0, // 0 = all topics
  reinforcement: 2,
  warmup: 1,
}
