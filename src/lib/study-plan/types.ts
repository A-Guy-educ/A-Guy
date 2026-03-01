export type MasteryLevel = 'weak' | 'medium' | 'strong'
export type ActivityType = 'practice' | 'hybrid' | 'full_simulation' | 'reinforcement' | 'warmup'
export type DayStatus = 'planned' | 'completed'
export type TimeframeMode = 'survival' | 'high_intensity' | 'balanced' | 'mastery_cycle'

export interface TopicInput {
  topicId: string
  topicLabel: string
  mastery: MasteryLevel
}

export interface Task {
  label: string
  description: string
}

export interface StudyPlanDay {
  dayId: string
  date: string // YYYY-MM-DD
  activityType: ActivityType
  topicIds: string[]
  status: DayStatus
  estimatedDurationMinutes: number
  userTopicIds?: string[] // User override: custom topic selection
  userDurationMinutes?: number // User override: custom duration
  userStartTime?: string // User override: HH:MM
  tasks?: Task[] // Concrete tasks for this day
  timeframeMode?: TimeframeMode // The strategy mode for this day
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
