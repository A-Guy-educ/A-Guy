export type MasteryLevel = 'weak' | 'medium' | 'strong'
export type ActivityType = 'practice' | 'hybrid' | 'full_simulation' | 'reinforcement' | 'warmup'
export type DayStatus = 'planned' | 'completed'
export type TimeframeMode = 'survival' | 'high_intensity' | 'balanced'

export interface TopicInput {
  topicId: string
  topicLabel: string
  mastery: MasteryLevel
}

export interface StudyPlanDay {
  dayId: string
  date: string // YYYY-MM-DD
  activityType: ActivityType
  topicIds: string[]
  status: DayStatus
  estimatedDurationMinutes: number
  tasks: string[] // Human-readable task descriptions for this day
  userTopicIds?: string[] // User override: custom topic selection
  userDurationMinutes?: number // User override: custom duration
  userStartTime?: string // User override: HH:MM
}

export interface StudyPlanSnapshot {
  courseId: string
  examDate: string // YYYY-MM-DD
  generatedAt: string // YYYY-MM-DD (date plan was generated)
  topics: TopicInput[]
  days: StudyPlanDay[]
}

export interface GeneratePlanInput {
  today: string // YYYY-MM-DD — injected for determinism
  examDate: string // YYYY-MM-DD
  topics: TopicInput[]
  idGenerator: () => string // nanoid injected for testability
}
