# Implementation Plan

## Files to Modify

### 1. src/lib/study-plan/engine.ts
Implement adaptive scaling + rotation + topicsPerDay + daily modes

**Implementation Steps:**
- Export types: `DayMode`, `StudyPlanDay`, `StudyPlanEngineInput`, `StudyPlanEngineOutput`
- Implement `calculateDaysUntilExam(examDate: Date): number`
- Implement `calculatePlanDaysCount(daysAvailable: number): number` (min 7)
- Implement `calculateTopicsPerDay(totalTopics: number, planDaysCount: number): number`
- Implement `rotateTopicsByMastery(topics: Topic[]): Topic[]` with round-robin + fallback
- Implement `determineDayMode(daysUntilExam: number): DayMode`
- Implement `generateDayTasks(mode: DayMode, topics: Topic[]): string[]`
- Implement main `generateStudyPlan(input: StudyPlanEngineInput): StudyPlanEngineOutput`

### 2. src/app/(frontend)/study-plan/_components/useStudyPlan.ts
Manage state and persistence

**Implementation Steps:**
- Add `hasGenerated` state (default: false)
- Add `persistedPlan` loading from storage/UserProgress
- Add `handleGenerateClick()` function that:
  - Calls engine.generateStudyPlan()
  - Persists plan to UserProgress
  - Sets hasGenerated = true
- Implement regenerate semantics (overwrite existing plan)
- Implement completion state persistence (load/save to UserProgress)

### 3. src/app/(frontend)/study-plan/_components/DayCard.tsx
UI for day display and completion

**Implementation Steps:**
- Add completion toggle button (checkmark icon)
- Add completed visual: opacity-50 + "בוצע" badge
- Render weekday + date using date-fns
- Render mode badge (Standard/High Intensity/Simulation/Warm-up)
- Render task list based on mode from engine output

### 4. Empty State Component
Add empty state before generation

**Implementation Steps:**
- Show "מוכנים לצאת לדרך?" message
- Add CTA button with HE/EN text
- Only show schedule after Generate click

## Styling Requirements
- Tailwind only
- Assistant font (300-800)
- Full RTL support
- Lucide icons
- Slate/Indigo palette

## Testing
- Unit tests for engine: 2-day, 5-day, 7-day scenarios
- Varying topic mixes (all weak, mixed, all strong)
- Edge cases: daysAvailable <= 0, no topics, 1 topic
